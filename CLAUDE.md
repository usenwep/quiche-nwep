# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **quiche-nwep**, a fork of Cloudflare's quiche QUIC/HTTP/3 implementation that adds support for **NWEP (New Web Exchange Protocol)**. NWEP is an HTTP/3-compatible protocol designed for constrained environments, featuring simplified request methods (READ, WRITE, MODIFY, DELETE, PROBE, CONNECT, TRACE), human-readable text status tokens (ok, not_found, internal_error, etc.), and the `web://` URI scheme.

Repository: https://github.com/usenwep/quiche-nwep

## Build Commands

### Interactive Build Script (Recommended)

The easiest way to build for multiple platforms is using the interactive TypeScript build script:

```bash
# Install dependencies (one-time setup)
npm install

# Run the interactive builder
npm run build
```

This will launch an interactive CLI that allows you to:
- **Multi-select** which platforms to build for (Windows, Android, Linux ARM, Native)
- Choose build mode (debug/release)
- Select features (ffi, qlog, sfv)
- Build in parallel or sequentially
- See real-time progress and build summary

The script automatically checks for prerequisites (cross-rs, Docker) and only shows available targets.

### Packaging Built Libraries

After building, package the libraries into the `releases/` folder:

```bash
# Package all built libraries
npm run package

# Or run directly
./scripts/package-releases.sh
```

This organizes libraries by version and platform in `releases/v{version}/{platform}/`. The `releases/` folder is tracked in git and can be committed for distribution.

### Standard Build
```bash
# Build all workspace members
cargo build --workspace

# Build with specific features (recommended for development)
cargo build --features=ffi,qlog --workspace

# Build with async support (includes tokio-quiche)
cargo build --features=async,ffi,qlog --workspace

# Release build
cargo build --release --workspace
```

### Testing
```bash
# Run all tests (default: boringssl-vendored TLS backend)
cargo test --verbose --all-targets --features=ffi,qlog --workspace --exclude h3i --exclude tokio-quiche

# Run tests with async support (includes tokio-quiche)
cargo test --verbose --all-targets --features=async,ffi,qlog --workspace

# Run documentation tests
cargo test --verbose --doc --features=async,ffi,qlog --workspace

# Run a specific test
cargo test --package quiche --lib h3::tests::nwep_method_conversion

# Run tests for a specific package
cargo test --package quiche
```

### Linting
```bash
# Run clippy (configured via clippy.toml)
cargo clippy --workspace --all-targets --features=async,ffi,qlog

# Check code formatting
cargo fmt --all -- --check

# Auto-format code
cargo fmt --all
```

### Examples
```bash
# Build NWEP examples
cargo build --example nwep-server
cargo build --example nwep-client

# Run NWEP server
cargo run --example nwep-server -- --listen 127.0.0.1:4433 --cert quiche/examples/cert.crt --key quiche/examples/cert.key

# Run NWEP client
cargo run --example nwep-client -- https://127.0.0.1:4433/

# Build HTTP/3 examples
cargo build --example http3-server
cargo build --example http3-client

# Build standard QUIC examples
cargo build --example server
cargo build --example client
```

### C API (FFI) Examples
```bash
cd quiche/examples
make  # Builds client, server, http3-client, http3-server C examples
```

### Cross-Compilation

#### Windows Builds (using cross-rs)

**Prerequisites:**
```bash
# Install cross-rs
cargo install cross --git https://github.com/cross-rs/cross
```

**Build Commands:**
```bash
# Windows x86_64 (GNU toolchain)
cross build --release --target x86_64-pc-windows-gnu --features ffi

# Windows x86_64 (MSVC toolchain)
cross build --release --target x86_64-pc-windows-msvc --features ffi

# Using the helper script (recommended)
./scripts/cross-build.sh windows-x64 --release --features ffi
./scripts/cross-build.sh windows-x64-msvc --release --features ffi,qlog
```

**Output:** Binaries will be in `target/{target}/release/`

#### Android Builds (using Docker)

**Prerequisites:**
- Docker installed and running

**Build Commands:**
```bash
# Build for Android ARM64 (most common - modern phones)
docker build -f Dockerfile.android \
  --build-arg ANDROID_TARGET=aarch64-linux-android \
  --build-arg CARGO_FEATURES=ffi \
  -t quiche-nwep-android-arm64 .

# Build for Android ARM32 (older devices)
docker build -f Dockerfile.android \
  --build-arg ANDROID_TARGET=armv7-linux-androideabi \
  --build-arg CARGO_FEATURES=ffi \
  -t quiche-nwep-android-arm .

# Build for Android x86_64 (emulators)
docker build -f Dockerfile.android \
  --build-arg ANDROID_TARGET=x86_64-linux-android \
  --build-arg CARGO_FEATURES=ffi \
  -t quiche-nwep-android-x64 .

# Using the helper script (recommended - builds all targets)
./scripts/cross-build.sh android-arm64 --release --features ffi
./scripts/cross-build.sh android-all --release --features ffi

# Extract built libraries from Docker
docker run --rm quiche-nwep-android-arm64 tar -czf - -C /output . | \
  tar -xzf - -C ./android-libs/
```

**Output:** Libraries will be in `target/android-output/{target}/` or extraction directory

**Android Integration:**
- Use `libquiche.a` (static library) or `libquiche.so` (dynamic library)
- Link against BoringSSL libraries also built in the container
- NDK API Level 24+ (Android 7.0+)

#### Linux ARM Builds (for Raspberry Pi, ARM servers)

```bash
# ARM64 / AArch64
cross build --release --target aarch64-unknown-linux-gnu --features ffi

# ARMv7 (Raspberry Pi 2/3/4 in 32-bit mode)
cross build --release --target armv7-unknown-linux-gnueabihf --features ffi

# Using the helper script
./scripts/cross-build.sh linux-arm64 --release --features ffi
./scripts/cross-build.sh linux-armv7 --release --features ffi
```

#### Cross-Compilation Notes

- **BoringSSL:** The vendored BoringSSL will be cross-compiled automatically
- **Features:** Use `--features ffi` for C API, add `qlog` for logging support
- **Static vs Dynamic:** By default, builds both `.a` (static) and `.so`/`.dll` (dynamic) libraries
- **Testing:** Cross-compiled binaries cannot be run directly; test on target platform
- **Configuration:** See `Cross.toml` for cross-rs configuration details
- **Android NDK:** Dockerfile.android uses NDK 26.1 with API level 24 (Android 7.0+)

## Architecture

### Workspace Structure

This is a Cargo workspace with the following crates:

- **`quiche/`** - Main QUIC/HTTP/3/NWEP implementation (v1.0.0)
  - Core QUIC transport protocol
  - HTTP/3 implementation (`quiche/src/h3/`)
  - NWEP implementation (`quiche/src/h3/nwep.rs`)
  - FFI bindings for C (`quiche/src/ffi.rs`)

- **`apps/`** - Command-line QUIC/HTTP/3 client and server (`quiche-client`, `quiche-server`)

- **`h3i/`** - Interactive HTTP/3 testing tool with REPL interface

- **`tokio-quiche/`** - Async Tokio integration for quiche

- **`qlog/`** - QUIC logging format implementation

- **`qlog-dancer/`** - QLOG visualization and analysis tool

- **`octets/`** - Efficient buffer manipulation primitives

- **`buffer-pool/`** - Memory pool for buffer management

- **`datagram-socket/`** - Socket wrapper for datagram handling

- **`netlog/`** - Network event logging

- **`task-killswitch/`** - Async task cancellation utilities

- **`fuzz/`** - Fuzzing harnesses (excluded from workspace, use `cargo +nightly fuzz`)

- **`tools/http3_test/`** - HTTP/3 testing utilities (excluded from workspace)

### NWEP Integration

NWEP is implemented as a layer on top of the HTTP/3 stack, maintaining full backward compatibility:

**Key Files:**
- `quiche/src/h3/nwep.rs` - NWEP types (Method, StatusToken, StatusClass)
- `quiche/src/h3/mod.rs` - H3/NWEP integration with protocol detection and validation
- `quiche/src/h3/frame.rs` - Includes `SETTINGS_NWEP_VERSION` constant
- `quiche/examples/nwep-server.rs` - NWEP server reference implementation
- `quiche/examples/nwep-client.rs` - NWEP client reference implementation

**Protocol Negotiation:**
- ALPN tokens: `b"nwep/1"` (NWEP), `b"h3"` (HTTP/3), or both
- Use `quiche::h3::NWEP_APPLICATION_PROTOCOL` for NWEP-only
- Use `quiche::h3::APPLICATION_PROTOCOL_WITH_NWEP` to support both

**Runtime Detection:**
```rust
// Check if connection is using NWEP
if h3_conn.is_nwep(&quic_conn) {
    // Apply NWEP-specific logic
}
```

**NWEP Specifics:**
- Methods: READ, WRITE, MODIFY, DELETE, PROBE, CONNECT, TRACE (replaces GET, POST, PUT, PATCH, etc.)
- Status tokens: Text-based (ok, not_found, internal_error) instead of numeric codes (200, 404, 500)
- Settings: Adds `SETTINGS_NWEP_VERSION = 0x4E574550` with value 1
- URI scheme: `web://` instead of `https://`
- Validation: NWEP connections enforce strict header validation (rejects HTTP methods/numeric status codes)

### TLS Backend Support

The project supports three TLS backends (configured via Cargo features):

1. **boringssl-vendored** (default) - Vendored BoringSSL built from source
2. **boringssl-boring-crate** - BoringSSL provided by the `boring` crate
3. **openssl** - System OpenSSL (requires quictls/openssl fork with QUIC support)

When working on code, be aware that only one TLS backend can be active at a time.

### QUIC/HTTP/3 Layer Architecture

```
Application Layer
  ↓
HTTP/3 / NWEP Layer (quiche::h3::Connection)
  - Stream management (h3/stream.rs)
  - QPACK compression (h3/qpack/)
  - Frame handling (h3/frame.rs)
  - NWEP validation (h3/mod.rs lines 2910-3004)
  ↓
QUIC Transport Layer (quiche::Connection)
  - Connection management (quiche/src/lib.rs)
  - Stream multiplexing (quiche/src/stream.rs)
  - Flow control (quiche/src/flowcontrol.rs)
  - Congestion control (quiche/src/recovery.rs)
  - Packet handling (quiche/src/packet.rs)
  ↓
TLS Layer (BoringSSL/OpenSSL)
  - Handshake (crypto/boringssl.rs)
  ↓
UDP Network Layer
```

## Development Workflow

### Before Making Changes

1. Ensure BoringSSL submodule is initialized:
   ```bash
   git submodule update --init --recursive
   ```

2. Install required system dependencies (for qlog-dancer):
   ```bash
   sudo apt-get install libexpat1-dev libfreetype6-dev libfontconfig1-dev
   ```

### Testing Changes

- Always run tests before committing: `cargo test --workspace`
- When modifying NWEP code, test both NWEP and HTTP/3 compatibility
- Test with different TLS backends if changing crypto-related code
- Run clippy to catch common issues: `cargo clippy --workspace --all-targets`
- Check formatting: `cargo fmt --all -- --check`

### NWEP-Specific Development

When modifying NWEP functionality:

1. **Method/Status Token Changes**: Edit `quiche/src/h3/nwep.rs`
   - Add new methods to `nwep::Method` enum
   - Add new status tokens to `nwep::StatusToken` enum
   - Update HTTP conversion methods (`from_http_method()`, `to_http_code()`)

2. **Validation Logic**: Edit `quiche/src/h3/mod.rs`
   - Header validation: lines ~2970-3004
   - Settings validation: lines ~2910-2924
   - Connection initialization: lines ~1086-1094

3. **Testing**: Add tests to `quiche/src/h3/nwep.rs` and `quiche/src/h3/mod.rs`
   - Test method conversions
   - Test status token parsing
   - Test NWEP/HTTP/3 interoperability

### FFI Development

When modifying the C API:

- Edit `quiche/src/ffi.rs` and `quiche/include/quiche.h`
- The crate builds as lib, staticlib, and cdylib
- Test C examples in `quiche/examples/` after changes
- Run `make` in `quiche/examples/` to test FFI

## Important Constraints

### Minimum Rust Version
- Rust 1.85+ required (specified in `quiche/Cargo.toml`)

### Dependency Management
- Workspace dependencies defined in root `Cargo.toml` `[workspace.dependencies]`
- When adding dependencies, add them to workspace dependencies first
- Use `cargo machete` to check for unused dependencies (CI enforces this)

### Code Quality
- CI enforces `RUSTFLAGS="-D warnings"` (all warnings treated as errors)
- Follow existing code style (rustfmt.toml and clippy.toml configurations)
- Add tests for new functionality
- Document public APIs with doc comments

### Security Considerations
- This code handles untrusted network input
- Be mindful of integer overflow, buffer overruns, and DoS attacks
- Use safe Rust patterns; avoid unnecessary `unsafe` blocks
- NWEP validation must prevent HTTP/3 headers from being accepted on NWEP connections

## CI/CD

GitHub Actions workflows (`.github/workflows/`):

- **stable.yml** - Main CI pipeline
  - Tests on Linux with all three TLS backends
  - Runs clippy, tests (unit + doc), and checks
  - Tests with and without async features

- **nightly.yml** - Nightly Rust testing

- **semgrep.yml** - Security scanning

- **deploy.yml** - Deployment automation

The CI configuration is the source of truth for build commands and feature combinations that must work.
