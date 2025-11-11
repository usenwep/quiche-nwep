# Quick Start Guide - quiche-nwep

Get up and running with quiche-nwep in minutes!

## Prerequisites

### Required
- **Rust 1.85+**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js 18+**: https://nodejs.org/ (for build scripts)

### Optional (for cross-compilation)
- **cross-rs**: `cargo install cross --git https://github.com/cross-rs/cross`
- **Docker**: https://docs.docker.com/get-docker/ (for Android builds)

## 5-Minute Build

### 1. Clone and Setup
```bash
git clone https://github.com/usenwep/quiche-nwep.git
cd quiche-nwep

# Initialize BoringSSL submodule
git submodule update --init --recursive

# Install Node.js dependencies
npm install
```

### 2. Build

#### Option A: Interactive Build (Recommended)
```bash
npm run build
```

This launches a beautiful interactive CLI where you can:
- ✨ Multi-select which platforms to build for
- 🎯 Choose build mode (release/debug)
- 🔧 Select features (FFI, QLOG, SFV)
- ⚡ Build in parallel or sequentially

#### Option B: Native Build (Fastest)
```bash
npm run build:native
# or
cargo build --release --features ffi,qlog --workspace
```

### 3. Run Examples

#### NWEP Server
```bash
cargo run --example nwep-server -- \
  --listen 127.0.0.1:4433 \
  --cert quiche/examples/cert.crt \
  --key quiche/examples/cert.key
```

#### NWEP Client
```bash
cargo run --example nwep-client -- web://127.0.0.1:4433/
```

## Cross-Platform Builds

### Windows
```bash
# Interactive
npm run build
# Select: Windows x64 (GNU)

# Or direct
npm run build:windows
```

### Android
```bash
# Interactive (select multiple Android targets)
npm run build

# Or direct (ARM64 only)
npm run build:android
```

### All Platforms at Once
```bash
npm run build
# Select multiple platforms
# Enable "Build in parallel" for speed

# After building, package into releases/
npm run package
```

## Packaging for Distribution

After building, organize libraries into the `releases/` folder:

```bash
npm run package
```

This creates `releases/v{version}/{platform}/` directories with:
- Static libraries (`.a`)
- Dynamic libraries (`.so`, `.dll`)
- Import libraries (Windows `.dll.a`)

The `releases/` folder is tracked in git and ready for distribution or integration into other projects.

## Project Structure

```
quiche-nwep/
├── quiche/              # Main QUIC/HTTP/3/NWEP library
│   ├── src/
│   │   ├── h3/         # HTTP/3 implementation
│   │   │   └── nwep.rs # NWEP protocol implementation
│   │   └── lib.rs      # QUIC transport
│   └── examples/       # Example servers and clients
├── apps/               # Command-line tools
├── tokio-quiche/       # Async Tokio integration
├── h3i/                # Interactive HTTP/3 testing tool
├── scripts/
│   └── build.ts        # Interactive build script ⭐
└── package.json
```

## What is NWEP?

**NWEP (New Web Exchange Protocol)** is a simplified HTTP/3-compatible protocol:

| Feature | HTTP/3 | NWEP |
|---------|--------|------|
| Methods | GET, POST, PUT, PATCH, DELETE, etc. | READ, WRITE, MODIFY, DELETE, PROBE, CONNECT, TRACE |
| Status | Numeric (200, 404, 500) | Text tokens (ok, not_found, internal_error) |
| URI Scheme | `https://` | `web://` |
| ALPN | `h3` | `nwep/1` |

### NWEP Example Request
```
:method READ
:scheme web
:authority example.com
:path /resource
```

### NWEP Example Response
```
:status ok
content-type: text/plain

Hello, NWEP!
```

## Common Commands

```bash
# Build
npm run build              # Interactive builder
npm run build:native       # Native platform only
cargo build --release      # Standard Rust build

# Test
npm test                   # Run all tests
cargo test --package quiche # Test specific package

# Lint & Format
npm run lint               # Run clippy
npm run fmt                # Check formatting
npm run fmt:fix            # Auto-format code

# Examples
cargo run --example nwep-server
cargo run --example nwep-client
cargo run --example http3-server
```

## Development Workflow

1. **Make changes** to source code
2. **Test**: `npm test`
3. **Lint**: `npm run lint`
4. **Format**: `npm run fmt:fix`
5. **Build**: `npm run build`

## Troubleshooting

### "BoringSSL build failed"
```bash
# Make sure submodules are initialized
git submodule update --init --recursive

# Install build dependencies (Linux)
sudo apt-get install build-essential cmake
```

### "cross: command not found"
```bash
cargo install cross --git https://github.com/cross-rs/cross
export PATH="$HOME/.cargo/bin:$PATH"
```

### "Docker not available"
```bash
# Start Docker
sudo systemctl start docker  # Linux
# or open Docker Desktop (macOS/Windows)
```

### "Module not found: @clack/prompts"
```bash
npm install
```

## Next Steps

- 📖 Read `CLAUDE.md` for detailed development guide
- 🔧 Read `BUILD_CROSS_PLATFORM.md` for cross-compilation details
- 📝 Read `scripts/README.md` for build script documentation
- 🧪 Explore examples in `quiche/examples/`
- 🌐 Visit https://github.com/usenwep/quiche-nwep

## Getting Help

- **Issues**: https://github.com/usenwep/quiche-nwep/issues
- **Documentation**: Check `CLAUDE.md` for architecture details
- **Examples**: Look in `quiche/examples/` for reference implementations

## License

BSD-2-Clause (same as Cloudflare's quiche)

---

**Happy building! 🥧**
