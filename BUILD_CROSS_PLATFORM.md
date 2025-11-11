# Cross-Platform Build Guide

This guide covers building quiche-nwep for Windows and Android platforms.

## Quick Start

### Windows (using cross-rs)

```bash
# Install cross-rs (one-time setup)
cargo install cross --git https://github.com/cross-rs/cross

# Build for Windows
./scripts/cross-build.sh windows-x64 --release --features ffi
```

### Android (using Docker)

```bash
# Build for all Android targets
./scripts/cross-build.sh android-all --release --features ffi

# Or build for specific target
./scripts/cross-build.sh android-arm64 --release --features ffi

# After building, package libraries into releases/
npm run package
```

## Packaging Built Libraries

After building for various platforms, use the packaging script to organize libraries:

```bash
# Package all built libraries into releases/v{version}/{platform}/
./scripts/package-releases.sh
# or
npm run package
```

This creates a structured `releases/` directory:
- `releases/v1.0.0/linux-x86_64/` - Native Linux libraries
- `releases/v1.0.0/windows-x64-gnu/` - Windows GNU toolchain libraries
- `releases/v1.0.0/android-arm64/` - Android ARM64 libraries
- etc.

The `releases/` folder is tracked in git and suitable for distribution.

## Detailed Instructions

### Windows Cross-Compilation

The project uses [cross-rs](https://github.com/cross-rs/cross) for Windows builds on Linux/macOS.

#### Supported Targets

- `x86_64-pc-windows-gnu` - 64-bit Windows (MinGW-w64)
- `x86_64-pc-windows-msvc` - 64-bit Windows (MSVC)

#### Manual Build

```bash
# Install cross (if not already installed)
cargo install cross --git https://github.com/cross-rs/cross

# Build for Windows x64 (GNU)
cross build --release --target x86_64-pc-windows-gnu --features ffi

# Build for Windows x64 (MSVC)
cross build --release --target x86_64-pc-windows-msvc --features ffi

# Output will be in: target/x86_64-pc-windows-gnu/release/
```

#### Using the Build Script

```bash
# Windows x64 (recommended)
./scripts/cross-build.sh windows-x64 --release --features ffi

# Windows x64 MSVC
./scripts/cross-build.sh windows-x64-msvc --release --features ffi,qlog
```

#### Output Files

After building, you'll find:
- `libquiche.a` - Static library
- `quiche.dll` - Dynamic library
- `quiche.dll.lib` - Import library (MSVC only)

### Android Cross-Compilation

Android builds use Docker with the Android NDK to cross-compile for ARM and x86 targets.

#### Supported Targets

- `aarch64-linux-android` - ARM64 (modern phones, recommended)
- `armv7-linux-androideabi` - ARM32 (older devices)
- `x86_64-linux-android` - x86_64 (emulators, rare devices)
- `i686-linux-android` - x86 (older emulators)

#### Prerequisites

- Docker installed and running
- 4GB+ free disk space for NDK download

#### Using the Build Script (Recommended)

```bash
# Build for ARM64 (most common)
./scripts/cross-build.sh android-arm64 --release --features ffi

# Build for all Android targets
./scripts/cross-build.sh android-all --release --features ffi

# Output will be in: target/android-output/{target}/
```

#### Manual Docker Build

```bash
# Build for ARM64
docker build -f Dockerfile.android \
  --build-arg ANDROID_TARGET=aarch64-linux-android \
  --build-arg CARGO_FEATURES=ffi \
  -t quiche-nwep-android-arm64 .

# Extract libraries
mkdir -p android-libs
docker run --rm quiche-nwep-android-arm64 \
  tar -czf - -C /output . | tar -xzf - -C ./android-libs/
```

#### Android Integration

The build produces:
- `libquiche.a` - Static library for linking
- `libquiche.so` - Dynamic library
- BoringSSL libraries (`libcrypto.a`, `libssl.a`)

**In your Android NDK project:**

```cmake
# CMakeLists.txt
add_library(quiche STATIC IMPORTED)
set_target_properties(quiche PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/libs/${ANDROID_ABI}/libquiche.a
)

target_link_libraries(your_app
    quiche
    # Include BoringSSL libraries if needed
)
```

**Supported Android versions:**
- Minimum: Android 7.0 (API Level 24)
- Recommended: Android 8.0+ (API Level 26+)

### Linux ARM Cross-Compilation

For building on Raspberry Pi or ARM servers:

```bash
# ARM64 / AArch64
./scripts/cross-build.sh linux-arm64 --release --features ffi

# ARMv7 (32-bit)
./scripts/cross-build.sh linux-armv7 --release --features ffi
```

## Configuration Files

### Cross.toml

Configures cross-rs for Windows and Linux ARM builds. Specifies:
- Docker images for each target
- Pre-build commands for dependencies
- Environment variables

### Dockerfile.android

Multi-architecture Android build environment:
- Android NDK 26.1
- API Level 24 (Android 7.0) minimum
- Rust Android targets pre-installed
- Configured cargo toolchains

## Troubleshooting

### Windows: "cross: command not found"

```bash
# Install cross-rs
cargo install cross --git https://github.com/cross-rs/cross

# Add cargo bin to PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

### Android: "Docker is not running"

```bash
# Start Docker
sudo systemctl start docker  # Linux
# or open Docker Desktop (macOS/Windows)

# Verify Docker is running
docker info
```

### Android: "NDK download failed"

The first build downloads ~1GB Android NDK. If it fails:
- Check internet connection
- Increase Docker memory limit (4GB+ recommended)
- Try building again (downloads are cached)

### Build fails with "BoringSSL compilation error"

BoringSSL requires:
- CMake 3.10+
- Working C/C++ compiler
- Sufficient memory (2GB+ RAM for parallel builds)

Workaround:
```bash
# Build without parallel compilation
CARGO_BUILD_JOBS=1 ./scripts/cross-build.sh [target] --release
```

## Feature Flags

Common feature combinations:

```bash
# Minimal build (no extras)
--features ffi

# With QLOG support
--features ffi,qlog

# Everything (not recommended for embedded)
--features ffi,qlog,sfv
```

## Performance Notes

### Build Times

Approximate build times (first build):
- Windows: 5-10 minutes
- Android (single target): 10-15 minutes
- Android (all targets): 30-40 minutes
- Linux ARM: 5-10 minutes

Subsequent builds use Docker layer caching and Cargo incremental compilation.

### Binary Sizes

Approximate sizes (release mode, stripped):
- Static library (`.a`): 5-8 MB
- Dynamic library (`.so`/`.dll`): 3-5 MB

Use `strip` or link-time optimization to reduce size:
```bash
# In Cargo.toml
[profile.release]
lto = true
strip = true
opt-level = "z"  # optimize for size
```

## CI/CD Integration

Example GitHub Actions workflow snippet:

```yaml
- name: Install cross
  run: cargo install cross --git https://github.com/cross-rs/cross

- name: Build for Windows
  run: cross build --release --target x86_64-pc-windows-gnu --features ffi

- name: Build for Android
  run: |
    docker build -f Dockerfile.android \
      --build-arg ANDROID_TARGET=aarch64-linux-android \
      --build-arg CARGO_FEATURES=ffi \
      -t quiche-nwep-android .
```

## Additional Resources

- [cross-rs documentation](https://github.com/cross-rs/cross)
- [Android NDK documentation](https://developer.android.com/ndk)
- [Rust Platform Support](https://doc.rust-lang.org/nightly/rustc/platform-support.html)
- [BoringSSL](https://boringssl.googlesource.com/boringssl/)

## Support

For build issues:
1. Check this guide's troubleshooting section
2. Review `CLAUDE.md` for development setup
3. Open an issue at https://github.com/usenwep/quiche-nwep/issues
