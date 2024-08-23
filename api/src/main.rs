use actix_cors::Cors;
use actix_files::NamedFile;
use actix_web::Result;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use chrono::NaiveDate;
use crypto::buffer::{BufferResult, ReadBuffer, WriteBuffer};
use crypto::digest::Digest;
use crypto::sha2::Sha256;
use crypto::symmetriccipher::Decryptor;
use crypto::{aes, blockmodes, buffer, symmetriccipher};
use hex;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::Mutex;
use url::Url;
use uuid::Uuid;

#[derive(Deserialize)]
struct GourceRequest {
    repo_url: String,
    access_token: Option<String>,
}

#[derive(Serialize, Clone)]
struct GourceResponse {
    job_id: String,
}

#[derive(Serialize, Clone, Copy, PartialEq, Debug)]
enum ProgressStep {
    InitializingProject = 1,
    AnalyzingHistory = 2,
    GeneratingVisualization = 3,
}

#[derive(Serialize, Clone)]
struct JobStatus {
    step: ProgressStep,
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
    #[error("Failed to decrypt access token")]
    DecryptionFailed,
}

type JobStore = Arc<Mutex<HashMap<String, JobStatus>>>;

fn derive_key(secret_key: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.input_str(secret_key);
    let mut hashed_key = vec![0; 32];
    hasher.result(&mut hashed_key);
    hashed_key
}

fn decrypt_token(encrypted_token: &str, secret_key: &str) -> Result<String, GourceError> {
    let parts: Vec<&str> = encrypted_token.split(':').collect();
    if parts.len() != 2 {
        return Err(GourceError::DecryptionFailed);
    }

    let iv = hex::decode(parts[0]).map_err(|_| GourceError::DecryptionFailed)?;
    let ciphertext = hex::decode(parts[1]).map_err(|_| GourceError::DecryptionFailed)?;

    // Derive the key using the full SECRET_KEY
    let key = derive_key(secret_key);

    let mut decryptor = aes::ctr(aes::KeySize::KeySize256, &key, &iv);
    let mut buffer = vec![0; ciphertext.len()];
    let mut read_buffer = buffer::RefReadBuffer::new(&ciphertext);
    let mut write_buffer = buffer::RefWriteBuffer::new(&mut buffer);

    decryptor
        .decrypt(&mut read_buffer, &mut write_buffer, true)
        .map_err(|_| GourceError::DecryptionFailed)?;

    String::from_utf8(buffer).map_err(|_| GourceError::DecryptionFailed)
}

async fn start_gource(
    repo_request: web::Json<GourceRequest>,
    job_store: web::Data<JobStore>,
) -> impl Responder {
    let job_id = Uuid::new_v4().to_string();
    let repo_url = repo_request.repo_url.clone();
    let access_token = repo_request.access_token.clone();

    {
        let mut store = job_store.lock().await;
        store.insert(
            job_id.clone(),
            JobStatus {
                step: ProgressStep::InitializingProject,
                video_url: None,
                error: None,
            },
        );
    }

    let job_store_clone = job_store.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        if let Err(e) = process_gource(
            repo_url,
            access_token,
            job_id_clone.clone(),
            job_store_clone.clone(),
        )
        .await
        {
            let mut store = job_store_clone.lock().await;
            if let Some(status) = store.get_mut(&job_id_clone) {
                status.step = ProgressStep::GeneratingVisualization;
                status.error = Some(e.to_string());
            }
        }
    });

    HttpResponse::Ok().json(GourceResponse { job_id })
}

async fn process_gource(
    repo_url: String,
    access_token: Option<String>,
    job_id: String,
    job_store: web::Data<JobStore>,
) -> Result<(), GourceError> {
    info!("Starting process_gource for job {}", job_id);
    let start_time = Instant::now();

    update_job_status(&job_store, &job_id, ProgressStep::InitializingProject).await;
    info!("Updated job status to InitializingProject");

    let url = Url::parse(&repo_url).map_err(|_| GourceError::InvalidUrl)?;
    if url.host_str() != Some("github.com") {
        return Err(GourceError::UnsupportedRepository);
    }
    info!("Validated repository URL");

    let temp_dir = tempfile::TempDir::new().map_err(|_| GourceError::TempDirCreationFailed)?;
    info!("Created temporary directory");

    let clone_start = Instant::now();
    info!("Attempting to decrypt token");
    let decrypted_token = if let Some(encrypted_token) = access_token {
        info!("Access token provided, attempting decryption");
        let secret_key = std::env::var("SECRET_KEY").expect("SECRET_KEY must be set");
        info!("SECRET_KEY found, length: {}", secret_key.len());
        match decrypt_token(&encrypted_token, &secret_key) {
            Ok(token) => {
                info!("Token decrypted successfully");
                Some(token)
            }
            Err(e) => {
                error!("Failed to decrypt token: {:?}", e);
                return Err(e);
            }
        }
    } else {
        info!("No access token provided");
        None
    };

    info!("Attempting to clone repository");
    clone_repository(&repo_url, temp_dir.path(), decrypted_token.as_deref())?;
    let clone_duration = clone_start.elapsed();
    info!("Repository cloning took {:?}", clone_duration);

    update_job_status(&job_store, &job_id, ProgressStep::AnalyzingHistory).await;
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

    update_job_status(&job_store, &job_id, ProgressStep::GeneratingVisualization).await;
    let output_file = PathBuf::from(format!("/gource_videos/gource_{}.mp4", job_id));
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

    update_job_status(&job_store, &job_id, ProgressStep::GeneratingVisualization).await;
    set_video_url(
        &job_store,
        &job_id,
        &format!("/gource_videos/gource_{}.mp4", job_id),
    )
    .await;

    Ok(())
}

async fn get_job_status(
    job_id: web::Path<String>,
    job_store: web::Data<JobStore>,
) -> impl Responder {
    let store = job_store.lock().await;
    match store.get(job_id.as_str()) {
        Some(status) => {
            info!(
                "Returning job status for {}: step={:?}, video_url={:?}",
                job_id, status.step, status.video_url
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

async fn update_job_status(job_store: &JobStore, job_id: &str, step: ProgressStep) {
    let mut store = job_store.lock().await;
    if let Some(job_status) = store.get_mut(job_id) {
        job_status.step = step;
    }
}

async fn set_video_url(job_store: &JobStore, job_id: &str, video_url: &str) {
    let mut store = job_store.lock().await;
    if let Some(job_status) = store.get_mut(job_id) {
        job_status.video_url = Some(video_url.to_string());
    }
}

fn clone_repository(
    repo_url: &str,
    temp_dir: &Path,
    github_token: Option<&str>,
) -> Result<(), GourceError> {
    info!("Cloning repository: {}", repo_url);

    let mut url = Url::parse(repo_url).map_err(|_| GourceError::InvalidUrl)?;

    // If a token is provided, include it in the URL
    if let Some(token) = github_token {
        url.set_username("oauth2")
            .map_err(|_| GourceError::InvalidUrl)?;
        url.set_password(Some(token))
            .map_err(|_| GourceError::InvalidUrl)?;
    }

    let mut child = Command::new("git")
        .arg("clone")
        .arg(url.as_str())
        .arg(temp_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| GourceError::CloneFailed)?;

    let output = child
        .wait_with_output()
        .map_err(|_| GourceError::CloneFailed)?;

    if !output.status.success() {
        let error_message = String::from_utf8_lossy(&output.stderr);
        error!("Git clone failed: {}", error_message);
        return Err(GourceError::CloneFailed);
    }

    info!("Successfully cloned repository");
    Ok(())
}

fn count_days_and_commits(repo_path: &Path) -> Result<(i32, i32), GourceError> {
    info!(
        "Counting days with commits and total commits in repository at: {:?}",
        repo_path
    );

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
    const MIN_DURATION: f64 = 60.0;
    const MAX_DURATION: f64 = 100.0;
    const THRESHOLD: i32 = 1000;

    let target_duration = if days_with_commits <= THRESHOLD {
        // For repos with fewer commits, scale linearly from MIN_DURATION to MAX_DURATION
        MIN_DURATION + (MAX_DURATION - MIN_DURATION) * (days_with_commits as f64 / THRESHOLD as f64)
    } else {
        // For repos with many commits, use MAX_DURATION
        MAX_DURATION
    };

    let seconds_per_day = target_duration / days_with_commits as f64;

    let clamped_seconds = seconds_per_day.clamp(0.00001, 2.0);

    info!(
        "Calculated seconds per day: {} for {} days with commits. Target duration: {}",
        clamped_seconds, days_with_commits, target_duration
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

async fn serve_video(req: HttpRequest, job_id: web::Path<String>) -> Result<HttpResponse> {
    let video_path = PathBuf::from(format!("/gource_videos/gource_{}.mp4", job_id));
    if video_path.exists() {
        Ok(NamedFile::open(video_path)?
            .set_content_type(mime::APPLICATION_OCTET_STREAM)
            .into_response(&req))
    } else {
        Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Video not found"
        })))
    }
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
            .service(web::resource("/video/{job_id}").route(web::get().to(serve_video)))
            .service(web::resource("/health").route(web::get().to(health_check)))
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy"}))
}
