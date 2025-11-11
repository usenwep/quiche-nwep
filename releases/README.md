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
