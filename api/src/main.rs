use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::process::Command;
use url::Url;
use std::fs;
use std::path::Path;

#[derive(Deserialize)]
struct GourceRequest {
    repo_url: String,
}

#[derive(Serialize)]
struct GourceResponse {
    video_url: String,
}

async fn generate_gource(repo_url: web::Json<GourceRequest>) -> impl Responder {
    // Validate URL
    if let Err(_) = Url::parse(&repo_url.repo_url) {
        return HttpResponse::BadRequest().body("Invalid URL");
    }

    // Check if it's a GitHub URL
    if !repo_url.repo_url.starts_with("https://github.com/") {
        return HttpResponse::BadRequest().body("Only GitHub repositories are supported");
    }

    // Create a temporary directory
    let temp_dir = match tempfile::TempDir::new() {
        Ok(dir) => dir,
        Err(_) => return HttpResponse::InternalServerError().body("Failed to create temporary directory"),
    };

    // Clone the repository
    let clone_output = Command::new("git")
        .arg("clone")
        .arg(&repo_url.repo_url)
        .arg(temp_dir.path())
        .output();

    if let Err(_) = clone_output {
        return HttpResponse::InternalServerError().body("Failed to clone repository");
    }

    // Count commits
    let commit_count_output = Command::new("git")
        .arg("rev-list")
        .arg("--count")
        .arg("HEAD")
        .current_dir(temp_dir.path())
        .output();

    let commit_count = match commit_count_output {
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim().parse::<i32>().unwrap_or(0),
        Err(_) => return HttpResponse::InternalServerError().body("Failed to count commits"),
    };

    // Determine seconds_per_day based on commit count
    let seconds_per_day = if commit_count < 50 {
        0.75
    } else if commit_count < 500 {
        0.1
    } else if commit_count < 5000 {
        0.01
    } else {
        0.001
    };

    // Define the output path for the video
    let output_file = Path::new("src/gource.mp4");

    // Run Gource command
    let gource_output = Command::new("sh")
        .arg("-c")
        .arg(format!(
            "xvfb-run -a gource {} -1920x1080 --seconds-per-day {} --auto-skip-seconds 0.1 --stop-position 1.0 --hide filenames --key --output-framerate 30 -o - | \
             ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i - -c:v mpeg4 -q:v 2 -r 30 -pix_fmt yuv420p {}",
            temp_dir.path().to_str().unwrap(),
            seconds_per_day,
            output_file.to_str().unwrap()
        ))
        .output();

    if let Err(_) = gource_output {
        return HttpResponse::InternalServerError().body("Failed to generate Gource visualization");
    }

    // Return the URL for accessing the video
    HttpResponse::Ok().json(GourceResponse {
        video_url: format!("/src/gource.mp4"),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(web::resource("/generate-gource").route(web::post().to(generate_gource)))
    })
    .bind("127.0.0.1:8081")?
    .run()
    .await
}
