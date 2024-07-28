use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use chrono::NaiveDate;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::Mutex;
use tokio::time::interval;
use url::Url;
use uuid::Uuid;

#[derive(Deserialize)]
struct GourceRequest {
    repo_url: String,
}

#[derive(Serialize, Clone)]
struct GourceResponse {
    job_id: String,
}

#[derive(Serialize, Clone)]
struct JobStatus {
    status: String,
    progress: f32,
    video_url: Option<String>,
    error: Option<String>,
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

type JobStore = Arc<Mutex<HashMap<String, JobStatus>>>;

async fn start_gource(
    repo_url: web::Json<GourceRequest>,
    job_store: web::Data<JobStore>,
) -> impl Responder {
    let job_id = Uuid::new_v4().to_string();
    let repo_url = repo_url.into_inner().repo_url;

    {
        let mut store = job_store.lock().await;
        store.insert(
            job_id.clone(),
            JobStatus {
                status: "Initializing".to_string(),
                progress: 0.0,
                video_url: None,
                error: None,
            },
        );
    }

    let job_store_clone = job_store.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        if let Err(e) =
            process_gource(repo_url, job_id_clone.clone(), job_store_clone.clone()).await
        {
            let mut store = job_store_clone.lock().await;
            if let Some(status) = store.get_mut(&job_id_clone) {
                status.status = "Failed".to_string();
                status.error = Some(e.to_string());
            }
        }
    });

    HttpResponse::Ok().json(GourceResponse { job_id })
}

async fn get_job_status(
    job_id: web::Path<String>,
    job_store: web::Data<JobStore>,
) -> impl Responder {
    let store = job_store.lock().await;
    match store.get(job_id.as_str()) {
        Some(status) => {
            info!(
                "Returning job status for {}: status={}, progress={}, video_url={:?}",
                job_id, status.status, status.progress, status.video_url
            );
            HttpResponse::Ok().json(status.clone())
        }
        None => {
            info!("Job not found: {}", job_id);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Job not found"
            }))
        }
    }
}

async fn process_gource(
    repo_url: String,
    job_id: String,
    job_store: web::Data<JobStore>,
) -> Result<(), GourceError> {
    let start_time = Instant::now();

    // Start a background task for periodic updates
    let job_store_clone = job_store.clone();
    let job_id_clone = job_id.clone();
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);
    let update_task = tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(1));
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let elapsed = start_time.elapsed().as_secs_f32();
                    update_job_status(
                        &job_store_clone,
                        &job_id_clone,
                        "Processing",
                        elapsed / 60.0,
                    )
                    .await;
                }
                _ = rx.recv() => {
                    break;
                }
            }
        }
    });

    update_job_status(&job_store, &job_id, "Validating URL", 0.1).await;
    let url = Url::parse(&repo_url).map_err(|_| GourceError::InvalidUrl)?;
    if url.host_str() != Some("github.com") {
        return Err(GourceError::UnsupportedRepository);
    }

    update_job_status(&job_store, &job_id, "Creating temporary directory", 0.2).await;
    let temp_dir = tempfile::TempDir::new().map_err(|_| GourceError::TempDirCreationFailed)?;

    update_job_status(&job_store, &job_id, "Cloning repository", 0.3).await;
    let clone_start = Instant::now();
    clone_repository(&repo_url, temp_dir.path())?;
    let clone_duration = clone_start.elapsed();
    info!("Repository cloning took {:?}", clone_duration);

    update_job_status(&job_store, &job_id, "Counting commits", 0.4).await;
    let count_start = Instant::now();
    let (days_with_commits, total_commits) = count_days_and_commits(temp_dir.path())?;
    let count_duration = count_start.elapsed();
    info!("Counting days with commits took {:?}", count_duration);

    let seconds_per_day = calculate_seconds_per_day(days_with_commits);
    let hide_filenames = if total_commits > 100 {
        "--hide filenames"
    } else {
        ""
    };

    update_job_status(&job_store, &job_id, "Generating Gource visualization", 0.5).await;
    let output_file = PathBuf::from("/gource_videos/gource.mp4");
    let gource_start = Instant::now();

    // Use tokio::task::spawn_blocking for CPU-intensive tasks
    let gource_result = tokio::task::spawn_blocking(move || {
        let result = generate_gource_visualization(
            temp_dir.path(),
            seconds_per_day,
            hide_filenames,
            &output_file,
        );

        // Clean up the temporary directory
        if let Err(e) = temp_dir.close() {
            error!("Failed to remove temporary directory: {:?}", e);
        }

        result
    })
    .await
    .map_err(|_| GourceError::GourceGenerationFailed)??;

    let gource_duration = gource_start.elapsed();
    info!("Gource visualization generation took {:?}", gource_duration);

    let total_duration = start_time.elapsed();
    info!("Total process took {:?}", total_duration);

    // Signal the update task to stop
    let _ = tx.send(()).await;
    // Wait for the update task to finish
    let _ = update_task.await;

    // Update the job status with the video URL and mark as completed
    update_job_status(&job_store, &job_id, "Completed", 1.0).await;

    {
        let mut store = job_store.lock().await;
        if let Some(status) = store.get_mut(&job_id) {
            status.video_url = Some("/gource_videos/gource.mp4".to_string());
            info!("Set video_url for job {}: {:?}", job_id, status.video_url);
        } else {
            error!("Failed to find job {} in store to set video_url", job_id);
        }
    }

    // Verify the job status after setting
    {
        let store = job_store.lock().await;
        if let Some(status) = store.get(&job_id) {
            info!(
                "Final job status for {}: status: {}, progress: {}, video_url: {:?}",
                job_id, status.status, status.progress, status.video_url
            );
        } else {
            error!(
                "Failed to find job {} in store for final status check",
                job_id
            );
        }
    }

    Ok(())
}

async fn update_job_status(job_store: &JobStore, job_id: &str, status: &str, progress: f32) {
    let mut store = job_store.lock().await;
    if let Some(job_status) = store.get_mut(job_id) {
        job_status.status = status.to_string();
        job_status.progress = progress.min(1.0); // Cap progress at 1.0
        if status == "Completed" {
            job_status.video_url = Some("/gource_videos/gource.mp4".to_string());
        }
    }
}

fn clone_repository(repo_url: &str, temp_dir: &Path) -> Result<(), GourceError> {
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

fn count_days_and_commits(repo_path: &Path) -> Result<(i32, i32), GourceError> {
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

fn calculate_seconds_per_day(days_with_commits: i32) -> f64 {
    const TARGET_DURATION: f64 = 60.0;
    let seconds_per_day = TARGET_DURATION / days_with_commits as f64;
    let clamped_seconds = seconds_per_day.clamp(0.00001, 2.0) / 2.75;
    info!(
        "Calculated seconds per day: {} for {} days with commits.",
        clamped_seconds, days_with_commits,
    );
    clamped_seconds
}

fn generate_gource_visualization(
    temp_dir: &Path,
    seconds_per_day: f64,
    hide_filenames: &str,
    output_file: &Path,
) -> Result<(), GourceError> {
    let gource_command = format!(
        "xvfb-run -a gource {} -1920x1200 \
        --seconds-per-day {} \
        --auto-skip-seconds 0.01 \
        {} \
        --hide progress \
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
        -vcodec libx264 -preset fast -crf 23 -movflags +faststart \
        -pix_fmt yuv420p -vf \"pad=ceil(iw/2)*2:ceil(ih/2)*2\" \
        -acodec aac -b:a 128k \
        {}",
        temp_dir.to_str().unwrap(),
        seconds_per_day,
        hide_filenames,
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

    Ok(())
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

    let output_dir = Path::new("/gource_videos");
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)?;
    }

    if let Err(e) = check_dependencies() {
        error!("Dependency check failed: {}", e);
        return Err(std::io::Error::new(std::io::ErrorKind::Other, e));
    }

    let job_store = web::Data::new(JobStore::default());

    info!("Starting server at http://0.0.0.0:8081");
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(job_store.clone())
            .service(web::resource("/start-gource").route(web::post().to(start_gource)))
            .service(web::resource("/job-status/{job_id}").route(web::get().to(get_job_status)))
            .service(web::resource("/health").route(web::get().to(health_check)))
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy"}))
}
