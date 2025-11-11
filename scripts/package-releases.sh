#!/bin/bash
# Package built libraries into releases/ folder
# Organizes libraries by platform and version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RELEASES_DIR="$PROJECT_ROOT/releases"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get version from Cargo.toml
VERSION=$(grep '^version' "$PROJECT_ROOT/quiche/Cargo.toml" | head -1 | sed 's/version = "\(.*\)"/\1/')

echo -e "${BLUE}=== Packaging quiche-nwep v${VERSION} ===${NC}"
echo ""

# Create releases directory structure
create_release_dir() {
    local platform=$1
    local dir="$RELEASES_DIR/v${VERSION}/$platform"
    mkdir -p "$dir"
    echo "$dir"
}

# Copy file if it exists
copy_if_exists() {
    local src=$1
    local dest=$2
    if [ -f "$src" ]; then
        cp "$src" "$dest"
        echo -e "${GREEN}✓${NC} Copied $(basename "$src")"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Not found: $(basename "$src")"
        return 1
    fi
}

# Package native Linux build
package_native() {
    echo -e "${BLUE}Packaging native Linux build...${NC}"
    local target_dir="$PROJECT_ROOT/target/release"

    if [ ! -d "$target_dir" ]; then
        echo -e "${YELLOW}No native build found. Skipping.${NC}"
        return
    fi

    local release_dir=$(create_release_dir "linux-x86_64")

    copy_if_exists "$target_dir/libquiche.a" "$release_dir/libquiche.a"
    copy_if_exists "$target_dir/libquiche.so" "$release_dir/libquiche.so"

    echo ""
}

# Package Windows builds
package_windows() {
    local target=$1
    local name=$2

    echo -e "${BLUE}Packaging Windows $name build...${NC}"
    local target_dir="$PROJECT_ROOT/target/$target/release"

    if [ ! -d "$target_dir" ]; then
        echo -e "${YELLOW}No Windows $name build found. Skipping.${NC}"
        return
    fi

    local release_dir=$(create_release_dir "$name")

    copy_if_exists "$target_dir/libquiche.a" "$release_dir/libquiche.a"
    copy_if_exists "$target_dir/quiche.dll" "$release_dir/quiche.dll"
    copy_if_exists "$target_dir/libquiche.dll.a" "$release_dir/libquiche.dll.a"

    echo ""
}

# Package Android builds
package_android() {
    local target=$1
    local name=$2

    echo -e "${BLUE}Packaging Android $name build...${NC}"
    local target_dir="$PROJECT_ROOT/target/android-output/$target"

    if [ ! -d "$target_dir" ]; then
        echo -e "${YELLOW}No Android $name build found. Skipping.${NC}"
        return
    fi

    local release_dir=$(create_release_dir "android-$name")

    # Android builds should have libquiche.a and libquiche.so
    copy_if_exists "$target_dir/libquiche.a" "$release_dir/libquiche.a"
    copy_if_exists "$target_dir/libquiche.so" "$release_dir/libquiche.so"

    # Also copy BoringSSL libraries if present
    copy_if_exists "$target_dir/libcrypto.a" "$release_dir/libcrypto.a"
    copy_if_exists "$target_dir/libssl.a" "$release_dir/libssl.a"

    echo ""
}

# Package Linux ARM builds
package_linux_arm() {
    local target=$1
    local name=$2

    echo -e "${BLUE}Packaging Linux $name build...${NC}"
    local target_dir="$PROJECT_ROOT/target/$target/release"

    if [ ! -d "$target_dir" ]; then
        echo -e "${YELLOW}No Linux $name build found. Skipping.${NC}"
        return
    fi

    local release_dir=$(create_release_dir "$name")

    copy_if_exists "$target_dir/libquiche.a" "$release_dir/libquiche.a"
    copy_if_exists "$target_dir/libquiche.so" "$release_dir/libquiche.so"

    echo ""
}

# Create README for releases
create_readme() {
    cat > "$RELEASES_DIR/README.md" << 'EOF'
# quiche-nwep Releases

This directory contains pre-built libraries for various platforms.

## Directory Structure

```
releases/
├── v1.0.0/
│   ├── linux-x86_64/
│   │   ├── libquiche.a      # Static library
│   │   └── libquiche.so     # Dynamic library
│   ├── windows-x64-gnu/
│   │   ├── libquiche.a      # Static library
│   │   ├── quiche.dll       # Dynamic library
│   │   └── libquiche.dll.a  # Import library
│   ├── windows-x64-msvc/
│   │   └── ...
│   ├── android-arm64/
│   │   ├── libquiche.a
│   │   ├── libquiche.so
│   │   ├── libcrypto.a      # BoringSSL
│   │   └── libssl.a         # BoringSSL
│   └── ...
└── README.md (this file)
```

## Platform Support

### Native Builds
- **linux-x86_64** - Linux x86_64 (native build)

### Windows
- **windows-x64-gnu** - Windows x64 with MinGW-w64 toolchain
- **windows-x64-msvc** - Windows x64 with MSVC toolchain

### Android
- **android-arm64** - Android ARM64 (aarch64-linux-android)
- **android-arm32** - Android ARM32 (armv7-linux-androideabi)
- **android-x64** - Android x86_64
- **android-x86** - Android x86

### Linux ARM
- **linux-arm64** - Linux ARM64 (aarch64-unknown-linux-gnu)
- **linux-armv7** - Linux ARMv7 (armv7-unknown-linux-gnueabihf)

## Usage

### C/C++ Projects

**CMake:**
```cmake
# Link against quiche static library
add_library(quiche STATIC IMPORTED)
set_target_properties(quiche PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/releases/v1.0.0/linux-x86_64/libquiche.a
)

target_link_libraries(your_app quiche)
```

**Android CMake:**
```cmake
add_library(quiche STATIC IMPORTED)
set_target_properties(quiche PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/releases/v1.0.0/android-${ANDROID_ABI}/libquiche.a
)

target_link_libraries(your_app quiche)
```

### Rust Projects

For Rust projects, it's recommended to use the source directly via Cargo:

```toml
[dependencies]
quiche = { git = "https://github.com/usenwep/quiche-nwep", features = ["ffi"] }
```

## Building from Source

To rebuild these libraries:

```bash
# Interactive build (recommended)
npm run build

# Or use helper scripts
./scripts/cross-build.sh windows-x64 --release --features ffi
./scripts/cross-build.sh android-all --release --features ffi

# Package into releases/
./scripts/package-releases.sh
```

## License

See the main repository LICENSE file.
EOF
    echo -e "${GREEN}✓${NC} Created releases/README.md"
}

# Main execution
main() {
    # Create releases directory
    mkdir -p "$RELEASES_DIR"

    # Package all platforms
    package_native
    package_windows "x86_64-pc-windows-gnu" "windows-x64-gnu"
    package_windows "x86_64-pc-windows-msvc" "windows-x64-msvc"
    package_android "aarch64-linux-android" "arm64"
    package_android "armv7-linux-androideabi" "arm32"
    package_android "x86_64-linux-android" "x64"
    package_android "i686-linux-android" "x86"
    package_linux_arm "aarch64-unknown-linux-gnu" "linux-arm64"
    package_linux_arm "armv7-unknown-linux-gnueabihf" "linux-armv7"

    # Create README
    create_readme

    # Summary
    echo -e "${BLUE}=== Summary ===${NC}"
    echo ""
    echo -e "Version: ${GREEN}v${VERSION}${NC}"
    echo -e "Location: ${BLUE}$RELEASES_DIR/${NC}"
    echo ""

    # List what was packaged
    if [ -d "$RELEASES_DIR/v${VERSION}" ]; then
        echo "Packaged platforms:"
        for platform_dir in "$RELEASES_DIR/v${VERSION}"/*; do
            if [ -d "$platform_dir" ]; then
                local platform=$(basename "$platform_dir")
                local file_count=$(find "$platform_dir" -type f | wc -l)
                echo -e "  ${GREEN}✓${NC} $platform ($file_count files)"
            fi
        done
    fi

    echo ""
    echo -e "${GREEN}Done! Libraries packaged in releases/v${VERSION}/${NC}"
}

main "$@"
