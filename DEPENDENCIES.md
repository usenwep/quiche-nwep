# System Dependencies

This document lists all required dependencies for building quiche-nwep on your host system.

## Quick Install (by Distribution)

### Arch Linux

```bash
# Core build dependencies (REQUIRED for all builds)
sudo pacman -S base-devel clang cmake git

# Node.js for build scripts (REQUIRED)
# If using nvm (recommended):
nvm install 18
nvm use 18
# Or install system package:
# sudo pacman -S nodejs npm

# Rust (REQUIRED)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Cross-compilation tools (OPTIONAL - only for Windows/Linux ARM builds)
cargo install cross --git https://github.com/cross-rs/cross

# Docker + BuildX (OPTIONAL - only for Android builds and cross-rs)
sudo pacman -S docker docker-buildx docker-compose

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Additional libraries for qlog-dancer visualization tool
sudo pacman -S expat freetype2 fontconfig
```

### Debian/Ubuntu

```bash
# Core build dependencies (REQUIRED for all builds)
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    clang \
    libclang-dev \
    cmake \
    git \
    pkg-config

# Node.js for build scripts (REQUIRED)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
# Or use system package:
# sudo apt-get install -y nodejs npm

# Rust (REQUIRED)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Cross-compilation tools (OPTIONAL - only for Windows/Linux ARM builds)
cargo install cross --git https://github.com/cross-rs/cross

# Docker + BuildX (OPTIONAL - only for Android builds and cross-rs)
# Install Docker Engine
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Additional libraries for qlog-dancer visualization tool
sudo apt-get install -y libexpat1-dev libfreetype6-dev libfontconfig1-dev
```

### Fedora/RHEL/CentOS

```bash
# Core build dependencies (REQUIRED for all builds)
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y \
    clang \
    clang-devel \
    cmake \
    git \
    pkg-config

# Node.js for build scripts (REQUIRED)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
# Or use system package:
# sudo dnf install -y nodejs npm

# Rust (REQUIRED)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Cross-compilation tools (OPTIONAL - only for Windows/Linux ARM builds)
cargo install cross --git https://github.com/cross-rs/cross

# Docker + BuildX (OPTIONAL - only for Android builds and cross-rs)
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Additional libraries for qlog-dancer visualization tool
sudo dnf install -y expat-devel freetype-devel fontconfig-devel
```

### macOS

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Core build dependencies (REQUIRED for all builds)
brew install cmake git pkg-config llvm

# Node.js for build scripts (REQUIRED)
brew install node@18
# Or use nvm:
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 18

# Rust (REQUIRED)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Cross-compilation tools (OPTIONAL - only for Windows/Linux ARM builds)
cargo install cross --git https://github.com/cross-rs/cross

# Docker Desktop (OPTIONAL - only for Android builds and cross-rs)
# Download from: https://www.docker.com/products/docker-desktop
# Docker Desktop includes buildx by default

# Additional libraries for qlog-dancer visualization tool
brew install expat freetype fontconfig
```

## Dependency Breakdown

### Required for ALL Builds

These are needed to build quiche-nwep natively:

| Dependency | Purpose | Check Command |
|------------|---------|---------------|
| **Rust 1.85+** | Compiler for quiche-nwep | `rustc --version` |
| **Cargo** | Rust package manager | `cargo --version` |
| **Node.js 18+** | Interactive build scripts | `node --version` |
| **npm** | Node package manager | `npm --version` |
| **C/C++ compiler** | Build BoringSSL | `gcc --version` or `clang --version` |
| **clang** | Required for bindgen (BoringSSL FFI) | `clang --version` |
| **libclang** | Required for bindgen | Check: build should work |
| **CMake 3.10+** | Build BoringSSL | `cmake --version` |
| **Git** | Clone repository, submodules | `git --version` |
| **pkg-config** | Dependency detection | `pkg-config --version` |

### Required for Cross-Compilation

Additional dependencies for building Windows/Linux ARM binaries:

| Dependency | Purpose | Check Command |
|------------|---------|---------------|
| **cross-rs** | Cross-compilation tool | `cross --version` |
| **Docker** | Container runtime for cross | `docker --version` |
| **docker-buildx** | Modern Docker builder | `docker buildx version` |

**Installation:**
```bash
cargo install cross --git https://github.com/cross-rs/cross
```

### Required for Android Builds

| Dependency | Purpose | Check Command |
|------------|---------|---------------|
| **Docker** | Container runtime | `docker --version` |
| **docker-buildx** | Build Android images | `docker buildx version` |

The Android NDK is installed automatically inside the Docker container - no manual setup needed!

### Optional Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| **expat-dev** | qlog-dancer XML parsing | `sudo pacman -S expat` |
| **freetype-dev** | qlog-dancer font rendering | `sudo pacman -S freetype2` |
| **fontconfig-dev** | qlog-dancer font configuration | `sudo pacman -S fontconfig` |

## Verification Script

Run this to check if all dependencies are installed:

```bash
#!/bin/bash

echo "=== Checking Required Dependencies ==="
echo ""

# Function to check if command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✓ $1 is installed: $(command -v $1)"
        if [ ! -z "$2" ]; then
            echo "  Version: $($1 $2 2>&1 | head -1)"
        fi
    else
        echo "✗ $1 is NOT installed"
        return 1
    fi
    echo ""
}

# Core dependencies
check_command "rustc" "--version"
check_command "cargo" "--version"
check_command "node" "--version"
check_command "npm" "--version"
check_command "clang" "--version"
check_command "cmake" "--version"
check_command "git" "--version"
check_command "pkg-config" "--version"

echo "=== Checking Optional Dependencies ==="
echo ""

# Cross-compilation
if check_command "cross" "--version"; then
    echo "  Cross-compilation is available ✓"
else
    echo "  Cross-compilation is NOT available (install with: cargo install cross --git https://github.com/cross-rs/cross)"
fi
echo ""

# Docker
if check_command "docker" "--version"; then
    echo "  Docker is available ✓"

    # Check buildx
    if docker buildx version &> /dev/null; then
        echo "  Docker BuildX is available ✓"
    else
        echo "  Docker BuildX is NOT available (install docker-buildx package)"
    fi

    # Check if user can run docker
    if docker ps &> /dev/null; then
        echo "  User can run Docker without sudo ✓"
    else
        echo "  User CANNOT run Docker without sudo (add yourself to docker group)"
    fi
else
    echo "  Docker is NOT available"
    echo "  Android builds and cross-compilation will not work"
fi
echo ""

echo "=== Summary ==="
echo ""
echo "Required dependencies: $(check_command rustc && check_command cargo && check_command node && check_command npm && check_command clang && check_command cmake && check_command git && check_command pkg-config && echo 'ALL INSTALLED' || echo 'MISSING SOME')"
```

Save as `scripts/check-deps.sh` and run:
```bash
chmod +x scripts/check-deps.sh
./scripts/check-deps.sh
```

## Post-Installation Steps

### 1. Initialize Git Submodules

```bash
cd /path/to/quiche-nwep
git submodule update --init --recursive
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Verify Build Works

```bash
# Test native build
cargo build --features ffi

# Or use interactive builder
npm run build
```

## Troubleshooting

### "libclang not found"

```bash
# Arch Linux
sudo pacman -S clang

# Debian/Ubuntu
sudo apt-get install libclang-dev

# macOS
brew install llvm
export LIBCLANG_PATH=/opt/homebrew/opt/llvm/lib  # Apple Silicon
# or
export LIBCLANG_PATH=/usr/local/opt/llvm/lib     # Intel Mac
```

### "docker buildx: unknown command"

```bash
# Arch Linux
sudo pacman -S docker-buildx

# Debian/Ubuntu
sudo apt-get install docker-buildx-plugin

# macOS
# Docker Desktop includes buildx - reinstall Docker Desktop
```

### "Permission denied" when running Docker

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, then verify
docker ps
```

### "cross: command not found"

```bash
# Install cross-rs
cargo install cross --git https://github.com/cross-rs/cross

# Make sure ~/.cargo/bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

## Minimum System Requirements

- **RAM**: 4GB minimum, 8GB+ recommended (Android builds need more)
- **Disk Space**: 10GB free (Android NDK is ~1GB, build artifacts ~5GB)
- **CPU**: Multi-core recommended (parallel builds are much faster)
- **OS**: Linux (any modern distro), macOS 11+, or WSL2 on Windows

## Docker Configuration

For optimal performance:

```bash
# Increase Docker memory limit (Docker Desktop)
# Settings → Resources → Memory: 6GB or more

# Enable BuildKit by default
export DOCKER_BUILDKIT=1
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
```

## See Also

- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [BUILD_CROSS_PLATFORM.md](BUILD_CROSS_PLATFORM.md) - Cross-compilation details
- [CLAUDE.md](CLAUDE.md) - Development guide
