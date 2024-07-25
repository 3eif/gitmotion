use actix_web::{error::ResponseError, web, App, HttpResponse, HttpServer, Responder};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use thiserror::Error;
use url::Url;

#[derive(Deserialize)]
struct GourceRequest {
    repo_url: String,
}

#[derive(Serialize)]
struct GourceResponse {
    video_url: String,
}

#[derive(Error, Debug)]
enum GourceError {
    #[error("Invalid URL")]
    InvalidUrl,
    #[error("Only GitHub repositories are supported")]
    UnsupportedRepository,
    #[error("Failed to create temporary directory")]
    TempDirCreationFailed,
    #[error("Failed to clone repository")]
    CloneFailed,
    #[error("Failed to count commits")]
    CommitCountFailed,
    #[error("Failed to generate Gource visualization")]
    GourceGenerationFailed,
}

impl ResponseError for GourceError {
    fn error_response(&self) -> HttpResponse {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": self.to_string()
        }))
    }
}

async fn generate_gource(repo_url: web::Json<GourceRequest>) -> impl Responder {
    info!(
        "Received request to generate Gource for repository: {}",
        repo_url.repo_url
    );

    // Validate URL
    let url = Url::parse(&repo_url.repo_url).map_err(|_| GourceError::InvalidUrl)?;

    // Check if it's a GitHub URL
    if url.host_str() != Some("github.com") {
        return Err(GourceError::UnsupportedRepository);
    }

    // Create a temporary directory
    let temp_dir = tempfile::TempDir::new().map_err(|_| GourceError::TempDirCreationFailed)?;
    info!("Created temporary directory: {:?}", temp_dir.path());

    // Clone the repository
    clone_repository(&repo_url.repo_url, &temp_dir.path())?;

    // Count commits
    let commit_count = count_commits(&temp_dir.path())?;

    // Determine seconds_per_day based on commit count
    let seconds_per_day = calculate_seconds_per_day(commit_count);

    // Define the output path for the video
    let output_file = PathBuf::from("/gource_videos/gource.mp4");

    // Run Gource command
    let gource_command = format!(
        "xvfb-run -a gource {} -1920x1080 \
        --seconds-per-day {} \
        --auto-skip-seconds 0.1 \
        --hide progress \
        --max-user-speed 500 \
        --key \
        --output-framerate 30 \
        --multi-sampling \
        --hide filenames \
        --bloom-intensity 0.04 \
        --user-scale 1.0 \
        -o - | \
        ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i - \
        -vcodec libx264 -crf 19 -threads 0 -bf 0 {}",
        temp_dir.path().to_str().unwrap(),
        seconds_per_day,
        output_file.to_str().unwrap()
    );

    let output = Command::new("sh")
        .arg("-c")
        .arg(&gource_command)
        .output()
        .map_err(|_| GourceError::GourceGenerationFailed)?;

    if !output.status.success() {
        error!(
            "Gource generation failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        return Err(GourceError::GourceGenerationFailed);
    }

    info!(
        "Successfully generated Gource visualization for: {}",
        repo_url.repo_url
    );

    Ok(HttpResponse::Ok().json(GourceResponse {
        video_url: "/gource_videos/gource.mp4".to_string(),
    }))
}

fn clone_repository(repo_url: &str, temp_dir: &std::path::Path) -> Result<(), GourceError> {
    info!("Cloning repository: {}", repo_url);
    let output = Command::new("git")
        .arg("clone")
        .arg(repo_url)
        .arg(temp_dir)
        .output()
        .map_err(|_| GourceError::CloneFailed)?;

    if !output.status.success() {
        error!(
            "Git clone failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        return Err(GourceError::CloneFailed);
    }

    info!("Successfully cloned repository: {}", repo_url);
    Ok(())
}

fn count_commits(repo_path: &std::path::Path) -> Result<i32, GourceError> {
    info!("Counting commits in repository at: {:?}", repo_path);
    let output = Command::new("git")
        .arg("rev-list")
        .arg("--count")
        .arg("HEAD")
        .current_dir(repo_path)
        .output()
        .map_err(|_| GourceError::CommitCountFailed)?;

    if !output.status.success() {
        error!(
            "Git commit count failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        return Err(GourceError::CommitCountFailed);
    }

    let count = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<i32>()
        .map_err(|_| GourceError::CommitCountFailed)?;

    info!("Counted {} commits", count);
    Ok(count)
}

fn calculate_seconds_per_day(commit_count: i32) -> f64 {
    let seconds_per_day = match commit_count {
        0..=49 => 1.0,
        50..=99 => 0.5,
        100..=499 => 0.1,
        500..=999 => 0.05,
        1_000..=4_999 => 0.01,
        5_000..=9_999 => 0.005,
        10_000..=49_999 => 0.001,
        _ => 0.0005,
    };

    info!(
        "Calculated seconds per day: {} for {} commits",
        seconds_per_day, commit_count
    );

    seconds_per_day
}

fn check_dependencies() -> Result<(), String> {
    let dependencies = vec!["git", "gource", "ffmpeg", "xvfb-run"];
    for dep in dependencies {
        if let Err(_) = Command::new(dep).arg("--version").output() {
            return Err(format!("{} is not available", dep));
        }
    }
    Ok(())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    let output_dir = std::path::Path::new("/gource_videos");
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)?;
    }

    match check_dependencies() {
        Ok(_) => info!("All dependencies are available"),
        Err(e) => {
            error!("Dependency check failed: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, e));
        }
    }

    info!("Starting server at http://0.0.0.0:8081");
    HttpServer::new(|| {
        App::new().service(web::resource("/generate-gource").route(web::post().to(generate_gource)))
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}
