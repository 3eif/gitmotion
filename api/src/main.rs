use actix_web::{error::ResponseError, web, App, HttpResponse, HttpServer, Responder};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
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

fn check_dependencies() -> Result<(), String> {
    let dependencies = vec!["git", "gource", "ffmpeg", "xvfb-run"];
    for dep in dependencies {
        if let Err(_) = Command::new(dep).arg("--version").output() {
            return Err(format!("{} is not available", dep));
        }
    }
    Ok(())
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

    if let Err(e) = run_gource_with_progress(&temp_dir.path(), seconds_per_day, &output_file) {
        error!("Gource generation failed: {:?}", e);
        return Err(e);
    }

    info!(
        "Successfully generated Gource visualization for: {}",
        repo_url.repo_url
    );

    Ok(HttpResponse::Ok().json(GourceResponse {
        video_url: "/gource_videos/gource.mp4".to_string(),
    }))
}

fn run_gource_with_progress(
    temp_dir: &std::path::Path,
    seconds_per_day: f64,
    output_file: &std::path::Path,
) -> Result<(), GourceError> {
    let gource_command = format!(
        "gource {} -1920x1080 \
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
        --output-ppm-stream -",
        temp_dir.to_str().unwrap(),
        seconds_per_day
    );

    let ffmpeg_command = format!(
        "ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i - \
        -vcodec libx264 -crf 19 -threads 0 -bf 0 {}",
        output_file.to_str().unwrap()
    );

    info!("Starting Gource visualization generation");
    let start_time = Instant::now();

    let mut gource_process = Command::new("xvfb-run")
        .arg("-a")
        .arg("sh")
        .arg("-c")
        .arg(&gource_command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            error!("Failed to spawn Gource command: {}", e);
            GourceError::GourceGenerationFailed
        })?;

    let mut ffmpeg_process = Command::new("sh")
        .arg("-c")
        .arg(&ffmpeg_command)
        .stdin(gource_process.stdout.take().unwrap())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            error!("Failed to spawn FFmpeg command: {}", e);
            GourceError::GourceGenerationFailed
        })?;

    let mut last_progress_time = Instant::now();

    loop {
        match (gource_process.try_wait(), ffmpeg_process.try_wait()) {
            (Ok(Some(status)), _) if !status.success() => {
                error!("Gource process failed with exit code: {:?}", status.code());
                return Err(GourceError::GourceGenerationFailed);
            }
            (_, Ok(Some(status))) if !status.success() => {
                error!("FFmpeg process failed with exit code: {:?}", status.code());
                return Err(GourceError::GourceGenerationFailed);
            }
            (Ok(Some(_)), Ok(Some(_))) => {
                info!("Gource visualization generation completed");
                break;
            }
            _ => {
                if last_progress_time.elapsed() >= Duration::from_secs(5) {
                    info!(
                        "Gource visualization in progress... ({}s elapsed)",
                        start_time.elapsed().as_secs()
                    );
                    last_progress_time = Instant::now();
                }
                std::thread::sleep(Duration::from_secs(1));
            }
        }
    }

    let total_time = start_time.elapsed();
    info!(
        "Gource visualization generation completed in {}s",
        total_time.as_secs()
    );

    Ok(())
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
    // Target value: 0.005 seconds per day for 10,000 commits
    let target_seconds: f64 = 0.005;
    let target_commits: f64 = 10000.0;

    // Calculate the scaling factor to hit our target
    let scaling_factor = (target_commits * target_seconds).powf(0.5);

    // Calculate seconds per day
    let seconds_per_day = scaling_factor / (commit_count as f64).sqrt();

    // Clamp the value to ensure it's within a reasonable range
    let clamped_seconds = seconds_per_day.clamp(0.00001, 0.5);

    info!(
        "Calculated seconds per day: {} for {} commits",
        clamped_seconds, commit_count
    );

    clamped_seconds
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
