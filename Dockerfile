# Use the official Rust image as a parent image
FROM rust:latest AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the API code into the container
COPY api/ .

# Build the application
RUN cargo build --release

# Use a compatible base image for the final image
FROM debian:bullseye-slim

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    git \
    gource \
    xvfb \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/api /usr/local/bin/api

# Set the working directory
WORKDIR /usr/local/bin

# Run the binary
CMD ["api"]
