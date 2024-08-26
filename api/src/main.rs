use actix_cors::Cors;
use actix_files::NamedFile;
use actix_web::Result;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use chrono::NaiveDate;
use crypto::digest::Digest;
use crypto::sha2::Sha256;
use crypto::symmetriccipher::Decryptor;
use crypto::{aes, buffer};
use env_logger::Builder;
use hex;
use log::{error, info, LevelFilter};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use thiserror::Error;
use tokio::sync::Mutex;
use tokio::time::interval;
use url::Url;
use uuid::Uuid;

#[derive(Deserialize)]
struct GourceRequest {
    repo_url: String,
    access_token: Option<String>,
    settings: Option<GourceSettings>,
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
    repo_url: String,
    error: Option<String>,
    settings: GourceSettings,
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
struct GourceSettings {
    show_file_extension_key: bool,
    show_usernames: bool,
    show_dirnames: bool,
    dir_font_size: u32,
    file_font_size: u32,
    user_font_size: u32,
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

fn log_message(level: log::Level, message: &str, job_id: Option<&str>) {
    let target = job_id.map_or("gitmotion_api".to_string(), |id| format!("job-{}", id));
    match level {
        log::Level::Error => log::error!(target: &target, "{}", message),
        log::Level::Warn => log::warn!(target: &target, "{}", message),
        log::Level::Info => log::info!(target: &target, "{}", message),
        log::Level::Debug => log::debug!(target: &target, "{}", message),
        log::Level::Trace => log::trace!(target: &target, "{}", message),
    }
}

async fn start_gource(
    repo_request: web::Json<GourceRequest>,
    job_store: web::Data<JobStore>,
) -> impl Responder {
    let job_id = Uuid::new_v4().to_string();
    log_message(
        log::Level::Info,
        &format!("Starting new job with ID: {}", job_id),
        None,
    );

    let repo_url = repo_request.repo_url.clone();
    let access_token = repo_request.access_token.clone();
    let settings = repo_request.settings.clone().unwrap_or_default();

    {
        let mut store = job_store.lock().await;
        store.insert(
            job_id.clone(),
            JobStatus {
                step: ProgressStep::InitializingProject,
                video_url: None,
                repo_url: repo_url.clone(),
                error: None,
                settings: settings.clone(),
            },
        );
    }

    let job_store_clone = job_store.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        if let Err(e) = process_gource(
            repo_url,
            access_token,
            Some(settings),
            job_id_clone.clone(),
            job_store_clone.clone(),
        )
        .await
        {
            log_message(
                log::Level::Error,
                &format!("Job failed: {}", e),
                Some(&job_id_clone),
            );
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
    settings: Option<GourceSettings>,
    job_id: String,
    job_store: web::Data<JobStore>,
) -> Result<(), GourceError> {
    let job_id_clone = job_id.clone();
    log_message(
        log::Level::Info,
        "Starting process_gource",
        Some(&job_id_clone),
    );
    let start_time = Instant::now();

    update_job_status(&job_store, &job_id, ProgressStep::InitializingProject).await;
    log_message(
        log::Level::Info,
        "Updated job status to InitializingProject",
        Some(&job_id_clone),
    );

    let url = Url::parse(&repo_url).map_err(|_| GourceError::InvalidUrl)?;
    if url.host_str() != Some("github.com") {
        return Err(GourceError::UnsupportedRepository);
    }
    log_message(
        log::Level::Info,
        &format!("Validated repository URL: {}", repo_url),
        Some(&job_id_clone),
    );

    let temp_dir = tempfile::TempDir::new().map_err(|_| GourceError::TempDirCreationFailed)?;
    log_message(
        log::Level::Info,
        "Created temporary directory",
        Some(&job_id_clone),
    );

    let clone_start = Instant::now();
    log_message(
        log::Level::Info,
        "Attempting to decrypt token",
        Some(&job_id_clone),
    );
    let decrypted_token = if let Some(encrypted_token) = access_token {
        log_message(
            log::Level::Info,
            "Access token provided, attempting decryption",
            Some(&job_id_clone),
        );
        let secret_key = std::env::var("SECRET_KEY").expect("SECRET_KEY must be set");
        log_message(
            log::Level::Info,
            &format!("SECRET_KEY found, length: {}", secret_key.len()),
            Some(&job_id_clone),
        );
        match decrypt_token(&encrypted_token, &secret_key) {
            Ok(token) => {
                log_message(
                    log::Level::Info,
                    "Token decrypted successfully",
                    Some(&job_id_clone),
                );
                Some(token)
            }
            Err(e) => {
                log_message(
                    log::Level::Error,
                    &format!("Failed to decrypt token: {:?}", e),
                    Some(&job_id_clone),
                );
                return Err(e);
            }
        }
    } else {
        None
    };
    log_message(
        log::Level::Info,
        "Attempting to clone repository",
        Some(&job_id_clone),
    );
    clone_repository(&repo_url, temp_dir.path(), decrypted_token.as_deref())?;
    let clone_duration = clone_start.elapsed();
    log_message(
        log::Level::Info,
        &format!("Repository cloning took {:?}", clone_duration),
        Some(&job_id_clone),
    );

    update_job_status(&job_store, &job_id, ProgressStep::AnalyzingHistory).await;
    let count_start = Instant::now();
    let (days_with_commits, total_commits) =
        count_days_and_commits(temp_dir.path(), Some(&job_id_clone))?;
    let count_duration = count_start.elapsed();
    log_message(
        log::Level::Info,
        &format!("Counting days with commits took {:?}", count_duration),
        Some(&job_id_clone),
    );

    let seconds_per_day = calculate_seconds_per_day(days_with_commits, Some(&job_id_clone));
    let hide_filenames = total_commits > 500;

    update_job_status(&job_store, &job_id, ProgressStep::GeneratingVisualization).await;
    let output_file = PathBuf::from(format!("/gource_videos/gource_{}.mp4", job_id));
    let gource_start = Instant::now();

    // Use tokio::task::spawn_blocking for CPU-intensive tasks
    let job_id_for_closure = job_id_clone.clone();
    let repo_url_for_closure = repo_url.clone();
    let _gource_result = tokio::task::spawn_blocking(move || {
        let result = generate_gource_visualization(
            temp_dir.path(),
            seconds_per_day,
            hide_filenames,
            &output_file,
            &settings,
            Some(&job_id_for_closure),
            Some(&repo_url_for_closure),
        );

        // Explicitly close the temporary directory
        if let Err(e) = temp_dir.close() {
            log_message(
                log::Level::Error,
                &format!("Failed to remove temporary directory: {:?}", e),
                Some(&job_id_for_closure),
            );
        } else {
            log_message(
                log::Level::Info,
                "Temporary directory removed successfully",
                Some(&job_id_for_closure),
            );
        }

        result
    })
    .await
    .map_err(|_| GourceError::GourceGenerationFailed)??;

    let gource_duration = gource_start.elapsed();
    log_message(
        log::Level::Info,
        &format!("Gource visualization generation took {:?}", gource_duration),
        Some(&job_id_clone),
    );

    let total_duration = start_time.elapsed();
    log_message(
        log::Level::Info,
        &format!("Total process took {:?}", total_duration),
        Some(&job_id_clone),
    );

    update_job_status(&job_store, &job_id, ProgressStep::GeneratingVisualization).await;
    set_video_url(
        &job_store,
        &job_id,
        &format!("/gource_videos/gource_{}.mp4", job_id),
    )
    .await;

    Ok(())
}

async fn stop_job(job_id: web::Path<String>, job_store: web::Data<JobStore>) -> impl Responder {
    let mut store = job_store.lock().await;
    let response = match store.get_mut(job_id.as_str()) {
        Some(status) => {
            if status.video_url.is_none() && status.error.is_none() {
                status.error = Some("Job stopped by user".to_string());

                log_message(
                    log::Level::Info,
                    &format!("Job {} stopped by user", job_id),
                    Some(job_id.as_str()),
                );
                serde_json::json!({
                    "message": "Job stopped successfully and temporary files cleaned up",
                    "status": "stopped"
                })
            } else {
                log_message(
                    log::Level::Info,
                    &format!("Cannot stop job {}: already completed or errored", job_id),
                    Some(job_id.as_str()),
                );
                serde_json::json!({
                    "error": "Cannot stop job: already completed or errored",
                    "status": "unchanged"
                })
            }
        }
        None => {
            log_message(
                log::Level::Info,
                &format!("Job not found: {}", job_id),
                Some(job_id.as_str()),
            );
            serde_json::json!({
                "error": "Job not found",
                "status": "not_found"
            })
        }
    };

    HttpResponse::Ok().json(response)
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
    log_message(
        log::Level::Info,
        &format!("Cloning repository: {}", repo_url),
        None,
    );

    let mut url = Url::parse(repo_url).map_err(|_| GourceError::InvalidUrl)?;

    if let Some(token) = github_token {
        url.set_username("oauth2")
            .map_err(|_| GourceError::InvalidUrl)?;
        url.set_password(Some(token))
            .map_err(|_| GourceError::InvalidUrl)?;
    }

    let child = Command::new("git")
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
        log_message(
            log::Level::Error,
            &format!("Git clone failed: {}", error_message),
            None,
        );
        return Err(GourceError::CloneFailed);
    }

    log_message(log::Level::Info, "Successfully cloned repository", None);
    Ok(())
}

fn count_days_and_commits(
    repo_path: &Path,
    job_id: Option<&str>,
) -> Result<(i32, i32), GourceError> {
    log_message(
        log::Level::Info,
        &format!(
            "Counting days with commits and total commits in repository at: {:?}",
            repo_path
        ),
        job_id,
    );

    let commit_output = Command::new("git")
        .args(&["rev-list", "--count", "HEAD"])
        .current_dir(repo_path)
        .output()
        .map_err(|_| GourceError::CommitCountFailed)?;

    if !commit_output.status.success() {
        let error_message = String::from_utf8_lossy(&commit_output.stderr);
        log_message(
            log::Level::Error,
            &format!("Git commit count failed: {}", error_message),
            job_id,
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
        let error_message = String::from_utf8_lossy(&log_output.stderr);
        log_message(
            log::Level::Error,
            &format!("Git log failed: {}", error_message),
            job_id,
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

fn calculate_seconds_per_day(days_with_commits: i32, job_id: Option<&str>) -> f64 {
    const MIN_DURATION: f64 = 40.0;
    const MAX_DURATION: f64 = 80.0;
    const THRESHOLD: i32 = 1000;

    let target_duration = if days_with_commits <= THRESHOLD {
        // For repos with fewer commits, scale linearly from MIN_DURATION to MAX_DURATION
        MIN_DURATION + (MAX_DURATION - MIN_DURATION) * (days_with_commits as f64 / THRESHOLD as f64)
    } else {
        // For repos with many commits, use MAX_DURATION
        MAX_DURATION
    };

    let seconds_per_day = target_duration / days_with_commits as f64;

    let clamped_seconds = seconds_per_day.clamp(0.00001, 1.0);

    log_message(
        log::Level::Info,
        &format!(
            "Calculated seconds per day: {} for {} days with commits. Target duration: {}",
            clamped_seconds, days_with_commits, target_duration
        ),
        job_id,
    );

    clamped_seconds
}

fn generate_gource_visualization(
    temp_dir: &Path,
    seconds_per_day: f64,
    hide_filenames: bool,
    output_file: &Path,
    settings: &Option<GourceSettings>,
    job_id: Option<&str>,
    repo_url: Option<&str>,
) -> Result<(), GourceError> {
    let title = generate_repo_title(repo_url.unwrap_or(""));

    let mut gource_command = format!(
        "xvfb-run -a gource {} -1920x1200 \
        --seconds-per-day {} \
        --auto-skip-seconds 0.001 \
        --max-user-speed 500 \
        --output-framerate 30 \
        --multi-sampling \
        --bloom-intensity 0.2 \
        --user-scale 0.75 \
        --elasticity 0.01 \
        --background-colour 000000 \
        --font-size 14 \
        --title \"{}\" \
        --dir-font-size {} \
        --file-font-size {} \
        --user-font-size {} \
        --stop-at-end",
        temp_dir.to_str().unwrap(),
        seconds_per_day,
        title,
        settings.as_ref().map_or(11, |s| s.dir_font_size),
        settings.as_ref().map_or(10, |s| s.file_font_size),
        settings.as_ref().map_or(12, |s| s.user_font_size)
    );

    let mut hide_elements = vec!["progress"];
    if hide_filenames {
        hide_elements.push("filenames");
    }

    if let Some(settings) = settings {
        if settings.show_file_extension_key {
            gource_command.push_str(" --key");
        }
        if !settings.show_usernames {
            hide_elements.push("usernames");
        }
        if !settings.show_dirnames {
            hide_elements.push("dirnames");
        }
    }

    if !hide_elements.is_empty() {
        gource_command.push_str(&format!(" --hide {}", hide_elements.join(",")));
    }

    gource_command.push_str(&format!(
        " -o - | \
        ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i - \
        -vcodec libx264 -preset fast -crf 23 -movflags +faststart \
        -pix_fmt yuv420p -vf \"pad=ceil(iw/2)*2:ceil(ih/2)*2\" \
        -acodec aac -b:a 128k \
        {}",
        output_file.to_str().unwrap()
    ));

    log_message(
        log::Level::Info,
        &format!("Running gource command: {}", gource_command),
        job_id,
    );

    let output = Command::new("sh")
        .arg("-c")
        .arg(&gource_command)
        .output()
        .map_err(|_| GourceError::GourceGenerationFailed)?;

    if !output.status.success() {
        let error_message = String::from_utf8_lossy(&output.stderr);
        log_message(
            log::Level::Error,
            &format!("Gource generation failed: {}", error_message),
            job_id,
        );
        return Err(GourceError::GourceGenerationFailed);
    }

    Ok(())
}

fn generate_repo_title(repo_url: &str) -> String {
    let url = Url::parse(repo_url).unwrap_or_else(|_| Url::parse("https://example.com").unwrap());

    let segments: Vec<&str> = url.path_segments().map(|c| c.collect()).unwrap_or_default();

    if segments.len() >= 2 {
        format!(
            "{}/{} ⋅ gitmotion.app",
            segments[segments.len() - 2],
            segments[segments.len() - 1]
        )
    } else {
        "Repository Visualization ⋅ gitmotion.app".to_string()
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

async fn clear_gource_videos() {
    let path = Path::new("/gource_videos");
    let one_hour_ago = SystemTime::now() - Duration::from_secs(3600);

    if let Err(e) = fs::read_dir(path).and_then(|entries| {
        entries
            .filter_map(Result::ok)
            .filter(|entry| {
                entry.path().extension().map_or(false, |ext| ext == "mp4")
                    && entry.metadata().map_or(false, |m| m.is_file())
            })
            .try_for_each(|entry| {
                let file_path = entry.path();
                if entry
                    .metadata()
                    .and_then(|m| m.created())
                    .map_or(false, |created| created < one_hour_ago)
                {
                    fs::remove_file(&file_path).map_err(|e| {
                        log_message(
                            log::Level::Error,
                            &format!("Failed to remove file {:?}: {}", file_path, e),
                            None,
                        );
                        e
                    })?;
                    log_message(
                        log::Level::Info,
                        &format!("Removed file: {:?}", file_path),
                        None,
                    );
                }
                Ok(())
            })
    }) {
        log_message(
            log::Level::Error,
            &format!("Failed to process directory: {}", e),
            None,
        );
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Custom logger configuration
    Builder::new()
        .format(|buf, record| {
            writeln!(
                buf,
                "{} {} [{}] {}",
                buf.timestamp(),
                record.level(),
                record.target(),
                record.args()
            )
        })
        .filter(None, LevelFilter::Info)
        .init();

    let output_dir = Path::new("/gource_videos");
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)?;
    }

    if let Err(e) = check_dependencies() {
        log_message(
            log::Level::Error,
            &format!("Dependency check failed: {}", e),
            None,
        );
        return Err(std::io::Error::new(std::io::ErrorKind::Other, e));
    }

    let job_store = web::Data::new(JobStore::default());

    // Set up periodic task to clear gource_videos
    tokio::spawn(async {
        let mut interval = interval(Duration::from_secs(3600)); // 1 hour
        loop {
            interval.tick().await;
            clear_gource_videos().await;
        }
    });

    log_message(
        log::Level::Info,
        "Starting server at http://0.0.0.0:8081",
        None,
    );
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
            .service(web::resource("/stop/{job_id}").route(web::get().to(stop_job)))
    })
    .bind("0.0.0.0:8081")?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy"}))
}
