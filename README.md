# Gitmotion

## Prerequisites

- Docker
- Docker Compose (optional, for easier management)

## Installation

1. Clone the repository:

```
git clone https://github.com/3eif/gitmotion.git
cd gitmotion
```

2. Build the Docker image:

```
docker build -t gitmotion . --no-cache
```

## Usage

1. Run the Docker container:

```
docker run -it -p 8081:8081 -v "$(pwd)/gource_videos:/gource_videos" gitmotion
```

2. The server will start and listen on `http://0.0.0.0:8081`

3. To generate a Gource visualization, send a POST request to the `/generate-gource` endpoint with a JSON payload containing the `repo_url`:

```
curl -X POST http://localhost:8081/generate-gource \
      -H "Content-Type: application/json" \
      -d '{"repo_url": "https://github.com/username/repo"}'
```

4. The server will respond with a JSON object containing the `video_url` once the visualization is complete.

5. Generated videos can be found in the `gource_videos` directory on your host machine.
