# Use the official Rust image as a parent image
FROM rust:latest AS builder
# Set the working directory in the container
WORKDIR /usr/src/gitmotion
# Copy the Cargo.toml and Cargo.lock files
COPY api/Cargo.toml api/Cargo.lock ./api/
# Copy the source code
COPY api/src ./api/src
# Build the application
WORKDIR /usr/src/gitmotion/api
RUN cargo build --release

# Use a smaller base image for the final stage
FROM ubuntu:22.04

# Install necessary dependencies and clean up in a single layer
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  git \
  gource \
  ffmpeg \
  xvfb \
  ca-certificates && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy the built executable from the builder stage
COPY --from=builder /usr/src/gitmotion/api/target/release/gitmotion-api /usr/local/bin/gitmotion-api

# Create a directory for Gource videos
RUN mkdir -p /gource_videos && chmod 777 /gource_videos

# Set the working directory
WORKDIR /usr/local/bin

# Set the RUST_LOG environment variable
ENV RUST_LOG=info

# Run the binary
CMD ["gitmotion-api"]