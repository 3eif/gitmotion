# Gitmotion

## Prerequisites

- Docker
- Docker Compose (optional, for easier management)

## Running the API

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

## Running the Website

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
