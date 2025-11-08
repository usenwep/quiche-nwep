# NWEP (New Web Exchange Protocol) Build Environment
# Copyright (C) 2025, Ethan Pelletier
# All rights reserved.

FROM rust:1.85-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    libssl-dev \
    clang \
    libclang-dev \
    libfontconfig1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /nwep

# Copy the entire project
COPY . .

# Accept build command as argument (allows for different targets)
ARG CARGO_CMD="cargo build --features ffi"

# Build with the specified command
RUN ${CARGO_CMD}

# Set environment variables
ENV RUST_LOG=info
ENV PATH="/nwep/target/release/examples:${PATH}"

# Default command shows available binaries
CMD ["bash", "-c", "echo 'NWEP Build Environment' && echo 'Available binaries:' && ls -lh target/release/examples/ && echo '' && echo 'Run with: docker run -it <image> nwep-server' && echo '          docker run -it <image> nwep-client web://example.com' && bash"]
