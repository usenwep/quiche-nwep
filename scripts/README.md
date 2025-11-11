# Scripts Directory

This directory contains automation scripts for building, packaging, and managing the quiche-nwep project.

## TypeScript Scripts (Interactive)

These scripts use [@clack/prompts](https://github.com/natemoo-re/clack) for a beautiful interactive CLI experience.

### build.ts
Interactive cross-platform build script.

```bash
npm run build
```

Features:
- Multi-select platform targets (Windows, Android, Linux ARM, Native)
- Choose build mode (debug/release)
- Select features (ffi, qlog, sfv)
- Build in parallel or sequentially
- Real-time verbose logging option

### commit.ts
Interactive git commit helper with conventional commit support.

```bash
npm run commit
```

Features:
- Smart file staging with multi-select
- Conventional commit message formatting (feat, fix, docs, etc.)
- Optional scope and detailed description
- Breaking change marking
- Automatic version tagging (major/minor/patch)
- Push to remote with confirmation

**Conventional Commit Format:**
```
<type>(<scope>): <message>

[optional body]

[optional footer]
```

Examples:
- `feat(nwep): add support for custom status tokens`
- `fix(build): resolve Windows cross-compilation NASM issue`
- `docs: update QUICKSTART guide with packaging instructions`

## Bash Scripts

### cross-build.sh
Cross-compilation build script for CI/CD and command-line usage.

```bash
./scripts/cross-build.sh [TARGET] [OPTIONS]
```

Targets:
- `windows-x64` - Windows x64 (GNU)
- `windows-x64-msvc` - Windows x64 (MSVC)
- `android-arm64` - Android ARM64
- `android-all` - All Android targets
- `linux-arm64` - Linux ARM64
- `linux-armv7` - Linux ARMv7

Options:
- `--release` - Release build (default)
- `--debug` - Debug build
- `--features FEAT` - Feature flags (default: ffi)

Examples:
```bash
./scripts/cross-build.sh windows-x64 --release --features ffi
./scripts/cross-build.sh android-all --release --features ffi,qlog
```

### package-releases.sh
Packages built libraries into the `releases/` folder structure.

```bash
./scripts/package-releases.sh
# or
npm run package
```

Output structure:
```
releases/
└── v{version}/
    ├── linux-x86_64/
    ├── windows-x64-gnu/
    ├── android-arm64/
    └── ...
```

### check-deps.sh
Dependency checker script.

```bash
./scripts/check-deps.sh
# or
npm run check-deps
```

Checks for:
- Required dependencies (Rust, Node.js, clang, cmake, git, pkg-config)
- Optional dependencies (cross-rs, Docker)
- Version requirements
- Build capabilities

## Workflow Examples

### Complete Build and Release

```bash
# 1. Check dependencies
npm run check-deps

# 2. Build for multiple platforms
npm run build
# Select: Windows x64, Linux ARM64, Native
# Mode: Release
# Features: ffi, qlog
# Parallel: Yes

# 3. Package libraries
npm run package

# 4. Commit changes
npm run commit
# Type: build
# Scope: cross-platform
# Message: add Windows and Linux ARM release builds
# Tag: Yes, bump minor version
# Push: Yes
```

### Quick Native Build

```bash
# Build native only
npm run build:native

# Or use cargo directly
cargo build --release --features ffi,qlog --workspace
```

### CI/CD Pipeline

```bash
# Install dependencies
npm install

# Check system dependencies
./scripts/check-deps.sh

# Build for specific target
./scripts/cross-build.sh windows-x64 --release --features ffi

# Package releases
./scripts/package-releases.sh
```

## Script Dependencies

All TypeScript scripts require:
- Node.js 18+
- npm packages (installed via `npm install`)

Bash scripts require:
- Standard Unix tools (bash, git, etc.)
- Platform-specific tools as needed (cross-rs, Docker)

## Adding New Scripts

When adding new scripts:

1. **TypeScript scripts** - Use `.ts` extension, add shebang `#!/usr/bin/env tsx`
2. **Bash scripts** - Use `.sh` extension, add shebang `#!/bin/bash`
3. **Make executable** - `chmod +x scripts/your-script.{ts,sh}`
4. **Add npm script** - Update `package.json` scripts section
5. **Document here** - Add to this README

## License

See the main repository LICENSE file.
