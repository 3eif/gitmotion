use actix_web::{error::ResponseError, web, App, HttpResponse, HttpServer, Responder};
use chrono::NaiveDate;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
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

fn count_days_and_commits(repo_path: &std::path::Path) -> Result<(i32, i32), GourceError> {
    info!(
        "Counting days with commits and total commits in repository at: {:?}",
        repo_path
    );

    // Count total commits
    let commit_output = Command::new("git")
        .args(&["rev-list", "--count", "HEAD"])
        .current_dir(repo_path)
        .output()
        .map_err(|_| GourceError::CommitCountFailed)?;

    if !commit_output.status.success() {
        error!(
            "Git commit count failed: {}",
            String::from_utf8_lossy(&commit_output.stderr)
        );
        return Err(GourceError::CommitCountFailed);
    }

    let total_commits: i32 = String::from_utf8_lossy(&commit_output.stdout)
        .trim()
        .parse()
        .map_err(|_| GourceError::CommitCountFailed)?;

    // Count days with commits
    let log_output = Command::new("git")
        .args(&["log", "--format=%ad", "--date=short"])
        .current_dir(repo_path)
        .output()
        .map_err(|_| GourceError::CommitCountFailed)?;

    if !log_output.status.success() {
        error!(
            "Git log failed: {}",
            String::from_utf8_lossy(&log_output.stderr)
        );
        return Err(GourceError::CommitCountFailed);
    }

    let days_with_commits: HashSet<NaiveDate> = String::from_utf8_lossy(&log_output.stdout)
        .lines()
        .filter_map(|line| NaiveDate::parse_from_str(line, "%Y-%m-%d").ok())
        .collect();

    let count_days = days_with_commits.len() as i32;

    Ok((count_days, total_commits))
}

async fn generate_gource(repo_url: web::Json<GourceRequest>) -> impl Responder {
    let start_time = Instant::now();

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
    let clone_start = Instant::now();
    clone_repository(&repo_url.repo_url, &temp_dir.path())?;
    let clone_duration = clone_start.elapsed();
    info!("Repository cloning took {:?}", clone_duration);

    // Count days with commits and total commits
    let count_start = Instant::now();
    let (days_with_commits, total_commits) = count_days_and_commits(&temp_dir.path())?;
    let count_duration = count_start.elapsed();
    info!("Counting days with commits took {:?}", count_duration);

    // Determine seconds_per_day based on days with commits
    let seconds_per_day = calculate_seconds_per_day(days_with_commits);

    // Define the output path for the video
    let output_file = PathBuf::from("/gource_videos/gource.mp4");

    // Conditionally hide filenames based on total commits
    let hide_filenames = if total_commits > 100 {
        "--hide filenames"
    } else {
        ""
    };

    // Run Gource command
    let gource_command = format!(
        "xvfb-run -a gource {} -1920x1080 \
        --seconds-per-day {} \
        --auto-skip-seconds 0.01 \
        {} \
        --max-user-speed 500 \
        --key \
        --output-framerate 30 \
        --multi-sampling \
        --bloom-intensity 0.2 \
        --user-scale 0.75 \
        --elasticity 0.01 \
        --background-colour 000000 \
        --dir-font-size 12 \
        --stop-at-end \
        -o - | \
        ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i - \
        -vcodec libx264 -crf 19 -threads 0 -bf 0 {}",
        temp_dir.path().to_str().unwrap(),
        seconds_per_day,
        hide_filenames,
        output_file.to_str().unwrap()
    );

    let gource_start = Instant::now();
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

    let gource_duration = gource_start.elapsed();
    let total_duration = start_time.elapsed();

    info!(
        "Successfully generated Gource visualization for: {}",
        repo_url.repo_url
    );
    info!("Gource visualization generation took {:?}", gource_duration);
    info!("Total process took {:?}", total_duration);

    Ok(HttpResponse::Ok().json(GourceResponse {
        video_url: "/gource_videos/gource.mp4".to_string(),
    }))
}

fn calculate_seconds_per_day(days_with_commits: i32) -> f64 {
    const TARGET_DURATION: f64 = 60.0;

    // Calculate seconds per day
    let seconds_per_day = TARGET_DURATION / days_with_commits as f64;

    let clamped_seconds = seconds_per_day.clamp(0.00001, 2.0) / 1.5;

    info!(
        "Calculated seconds per day: {} for {} days with commits. Estimated duration: {:.2} seconds",
        clamped_seconds,
        days_with_commits,
        clamped_seconds * days_with_commits as f64
    );

    clamped_seconds
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
