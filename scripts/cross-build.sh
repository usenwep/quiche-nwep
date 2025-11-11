#!/bin/bash
# Cross-compilation build script for quiche-nwep
# Supports Windows (via cross-rs) and Android (via Docker) builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    cat << EOF
Usage: $0 [TARGET] [OPTIONS]

Cross-compile quiche-nwep for various platforms.

TARGETS:
  Windows:
    windows-x64        Build for Windows x86_64 (GNU)
    windows-x64-msvc   Build for Windows x86_64 (MSVC)

  Android:
    android-arm64      Build for Android ARM64 (aarch64)
    android-arm        Build for Android ARM32 (armv7)
    android-x64        Build for Android x86_64
    android-x86        Build for Android x86
    android-all        Build for all Android targets

  Linux ARM:
    linux-arm64        Build for Linux ARM64
    linux-armv7        Build for Linux ARMv7

OPTIONS:
    --release          Build in release mode (default)
    --debug            Build in debug mode
    --features FEAT    Comma-separated list of features (default: ffi)
    --help             Show this help message

EXAMPLES:
    $0 windows-x64                    # Build for Windows x64
    $0 android-arm64 --release        # Build Android ARM64 release
    $0 android-all --features ffi,qlog # Build all Android targets with features

REQUIREMENTS:
    Windows builds: Install cross-rs with 'cargo install cross'
    Android builds: Docker must be installed and running
EOF
}

check_cross_installed() {
    if ! command -v cross &> /dev/null; then
        echo -e "${RED}Error: cross-rs is not installed${NC}"
        echo "Install it with: cargo install cross --git https://github.com/cross-rs/cross"
        exit 1
    fi
}

check_docker_installed() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        echo "Install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker is not running${NC}"
        echo "Start Docker and try again"
        exit 1
    fi
}

build_windows() {
    local target=$1
    local build_mode=$2
    local features=$3

    check_cross_installed

    echo -e "${GREEN}Building for Windows target: $target${NC}"
    echo -e "${YELLOW}Build mode: $build_mode${NC}"
    echo -e "${YELLOW}Features: $features${NC}"

    cd "$PROJECT_ROOT"

    if [ "$build_mode" = "release" ]; then
        cross build --release --target "$target" --features "$features"
    else
        cross build --target "$target" --features "$features"
    fi

    echo -e "${GREEN}Build complete!${NC}"
    echo -e "Output location: target/$target/$build_mode/"
}

build_android() {
    local android_target=$1
    local build_mode=$2
    local features=$3

    check_docker_installed

    echo -e "${GREEN}Building for Android target: $android_target${NC}"
    echo -e "${YELLOW}Build mode: $build_mode${NC}"
    echo -e "${YELLOW}Features: $features${NC}"

    cd "$PROJECT_ROOT"

    # Map friendly names to Rust target triples
    case $android_target in
        android-arm64|aarch64-linux-android)
            rust_target="aarch64-linux-android"
            ;;
        android-arm|armv7-linux-androideabi)
            rust_target="armv7-linux-androideabi"
            ;;
        android-x64|x86_64-linux-android)
            rust_target="x86_64-linux-android"
            ;;
        android-x86|i686-linux-android)
            rust_target="i686-linux-android"
            ;;
        *)
            echo -e "${RED}Unknown Android target: $android_target${NC}"
            exit 1
            ;;
    esac

    docker build \
        -f Dockerfile.android \
        --build-arg ANDROID_TARGET="$rust_target" \
        --build-arg CARGO_FEATURES="$features" \
        -t "quiche-nwep-android-$rust_target" \
        .

    # Extract built libraries
    OUTPUT_DIR="$PROJECT_ROOT/target/android-output/$rust_target"
    mkdir -p "$OUTPUT_DIR"

    docker run --rm "quiche-nwep-android-$rust_target" \
        tar -czf - -C /output . | tar -xzf - -C "$OUTPUT_DIR"

    echo -e "${GREEN}Build complete!${NC}"
    echo -e "Output location: $OUTPUT_DIR"
}

build_android_all() {
    local build_mode=$1
    local features=$2

    echo -e "${GREEN}Building for all Android targets...${NC}"

    targets=("android-arm64" "android-arm" "android-x64" "android-x86")

    for target in "${targets[@]}"; do
        echo -e "\n${YELLOW}===========================================${NC}"
        build_android "$target" "$build_mode" "$features"
    done

    echo -e "\n${GREEN}All Android builds complete!${NC}"
    echo -e "Output location: $PROJECT_ROOT/target/android-output/"
}

build_linux_arm() {
    local target=$1
    local build_mode=$2
    local features=$3

    check_cross_installed

    echo -e "${GREEN}Building for Linux ARM target: $target${NC}"
    echo -e "${YELLOW}Build mode: $build_mode${NC}"
    echo -e "${YELLOW}Features: $features${NC}"

    cd "$PROJECT_ROOT"

    if [ "$build_mode" = "release" ]; then
        cross build --release --target "$target" --features "$features"
    else
        cross build --target "$target" --features "$features"
    fi

    echo -e "${GREEN}Build complete!${NC}"
    echo -e "Output location: target/$target/$build_mode/"
}

# Main script
main() {
    if [ $# -eq 0 ]; then
        print_usage
        exit 1
    fi

    # Default options
    BUILD_MODE="release"
    FEATURES="ffi"
    TARGET=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --release)
                BUILD_MODE="release"
                shift
                ;;
            --debug)
                BUILD_MODE="debug"
                shift
                ;;
            --features)
                FEATURES="$2"
                shift 2
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            windows-x64)
                TARGET="windows-x64"
                RUST_TARGET="x86_64-pc-windows-gnu"
                shift
                ;;
            windows-x64-msvc)
                TARGET="windows-x64-msvc"
                RUST_TARGET="x86_64-pc-windows-msvc"
                shift
                ;;
            android-arm64|android-arm|android-x64|android-x86)
                TARGET="$1"
                shift
                ;;
            android-all)
                TARGET="android-all"
                shift
                ;;
            linux-arm64)
                TARGET="linux-arm64"
                RUST_TARGET="aarch64-unknown-linux-gnu"
                shift
                ;;
            linux-armv7)
                TARGET="linux-armv7"
                RUST_TARGET="armv7-unknown-linux-gnueabihf"
                shift
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                print_usage
                exit 1
                ;;
        esac
    done

    if [ -z "$TARGET" ]; then
        echo -e "${RED}Error: No target specified${NC}"
        print_usage
        exit 1
    fi

    # Execute build
    case $TARGET in
        windows-*)
            build_windows "$RUST_TARGET" "$BUILD_MODE" "$FEATURES"
            ;;
        android-all)
            build_android_all "$BUILD_MODE" "$FEATURES"
            ;;
        android-*)
            build_android "$TARGET" "$BUILD_MODE" "$FEATURES"
            ;;
        linux-arm*)
            build_linux_arm "$RUST_TARGET" "$BUILD_MODE" "$FEATURES"
            ;;
    esac
}

main "$@"
