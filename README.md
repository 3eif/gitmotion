<p align="center">
  <img src="/website/public/gitmotion.png" height="128">
  <h1 align="center">Gitmotion</h1>
</p>

[Gitmotion](https://gitmotion.app/) lets you generate visualizations of your Git repositories right from your browser.

## Tech Stack

- [Next.js](https://nextjs.org/) – website framework
- [Tailwind](https://tailwindcss.com/) – CSS
- [FFmpeg](https://ffmpeg.org/) – video rendering
- [Gource](https://gource.io/) – software version control visualization
- [Redis](https://redis.io/) – in-memory storage
- [Docker](https://www.docker.com/) – containerization
- [Bun](https://bun.sh/) – JavaScript runtime

## Getting Started

### Prerequisites

- Docker
- Docker Compose (optional, for easier management)
- Node.js
- Bun

### Running the API

1. Clone the repository:

```
git clone https://github.com/3eif/gitmotion.git
cd gitmotion
```

2. Replace the example environment file and fill in the credentials

```
cp .env.example .env
```

3. Build the Docker image:

```
docker compose build
```

4. Run the Docker container:

```
docker compose up
```

### Running the Website

1. Change directory

```
cd website
```

2. Replace the example environment file and fill in the credentials

```
cp .env.local.example .env.local
```

3. Install packages

```
bun install
```

4. Run the website

```
bun dev
```
