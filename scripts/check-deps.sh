#!/bin/bash
# Dependency checker for quiche-nwep
# Verifies all required and optional dependencies are installed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
REQUIRED_MISSING=0
OPTIONAL_MISSING=0
REQUIRED_TOTAL=0
OPTIONAL_TOTAL=0

echo -e "${BLUE}=== Checking quiche-nwep Dependencies ===${NC}"
echo ""

# Function to check if command exists
check_command() {
    local cmd=$1
    local version_flag=$2
    local required=$3
    local name=$4

    if [ "$required" = "required" ]; then
        ((REQUIRED_TOTAL++))
    else
        ((OPTIONAL_TOTAL++))
    fi

    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $name is installed"
        if [ ! -z "$version_flag" ]; then
            local version=$($cmd $version_flag 2>&1 | head -1)
            echo -e "  ${BLUE}└─${NC} $version"
        fi
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT installed"
        if [ "$required" = "required" ]; then
            ((REQUIRED_MISSING++))
        else
            ((OPTIONAL_MISSING++))
        fi
        return 1
    fi
}

# Check required dependencies
echo -e "${BLUE}Required Dependencies (for native builds):${NC}"
echo ""

check_command "rustc" "--version" "required" "Rust compiler"
check_command "cargo" "--version" "required" "Cargo (Rust package manager)"
check_command "node" "--version" "required" "Node.js"
check_command "npm" "--version" "required" "npm"
check_command "clang" "--version" "required" "Clang (C/C++ compiler)"
check_command "cmake" "--version" "required" "CMake"
check_command "git" "--version" "required" "Git"
check_command "pkg-config" "--version" "required" "pkg-config"

echo ""

# Check Rust version
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version | awk '{print $2}')
    REQUIRED_VERSION="1.85.0"

    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$RUST_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]]; then
        echo -e "${GREEN}✓${NC} Rust version is sufficient (${RUST_VERSION} >= ${REQUIRED_VERSION})"
    else
        echo -e "${YELLOW}⚠${NC} Rust version ${RUST_VERSION} is below required ${REQUIRED_VERSION}"
        echo "  Update with: rustup update stable"
    fi
    echo ""
fi

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_NODE="18.0.0"

    if [[ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]]; then
        echo -e "${GREEN}✓${NC} Node.js version is sufficient (${NODE_VERSION} >= ${REQUIRED_NODE})"
    else
        echo -e "${YELLOW}⚠${NC} Node.js version ${NODE_VERSION} is below recommended ${REQUIRED_NODE}"
    fi
    echo ""
fi

# Check optional dependencies for cross-compilation
echo -e "${BLUE}Optional Dependencies (for cross-compilation):${NC}"
echo ""

if check_command "cross" "--version" "optional" "cross-rs"; then
    echo -e "  ${GREEN}→${NC} Windows and Linux ARM cross-compilation available"
else
    echo -e "  ${YELLOW}→${NC} Install with: ${BLUE}cargo install cross --git https://github.com/cross-rs/cross${NC}"
fi
echo ""

if check_command "docker" "--version" "optional" "Docker"; then
    echo -e "  ${GREEN}→${NC} Android builds and cross-compilation available"

    # Check buildx
    if docker buildx version &> /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Docker BuildX is available"
        docker buildx version | head -1 | sed 's/^/  /'
    else
        echo -e "${YELLOW}⚠${NC} Docker BuildX is NOT available"
        echo -e "  ${YELLOW}→${NC} Install docker-buildx package for better build performance"
        ((OPTIONAL_MISSING++))
    fi

    # Check if user can run docker
    if docker ps &> /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} User can run Docker without sudo"
    else
        echo -e "${YELLOW}⚠${NC} User cannot run Docker without sudo"
        echo -e "  ${YELLOW}→${NC} Add yourself to docker group: ${BLUE}sudo usermod -aG docker \$USER${NC}"
        echo -e "  ${YELLOW}→${NC} Then log out and back in"
    fi
else
    echo -e "  ${YELLOW}→${NC} Android builds will not be available"
    echo -e "  ${YELLOW}→${NC} Install Docker: https://docs.docker.com/get-docker/"
fi
echo ""

# Check optional qlog-dancer dependencies
echo -e "${BLUE}Optional Dependencies (for qlog-dancer visualization):${NC}"
echo ""

check_command "pkg-config" "--list-all | grep -q expat && echo 'found'" "" "optional" "expat" &> /dev/null && \
    echo -e "${GREEN}✓${NC} expat library is available" || \
    echo -e "${YELLOW}⚠${NC} expat library not found (qlog-dancer may not build)"

check_command "pkg-config" "--list-all | grep -q freetype2 && echo 'found'" "" "optional" "freetype" &> /dev/null && \
    echo -e "${GREEN}✓${NC} freetype library is available" || \
    echo -e "${YELLOW}⚠${NC} freetype library not found (qlog-dancer may not build)"

check_command "pkg-config" "--list-all | grep -q fontconfig && echo 'found'" "" "optional" "fontconfig" &> /dev/null && \
    echo -e "${GREEN}✓${NC} fontconfig library is available" || \
    echo -e "${YELLOW}⚠${NC} fontconfig library not found (qlog-dancer may not build)"

echo ""

# Check if npm packages are installed
echo -e "${BLUE}Node.js Dependencies:${NC}"
echo ""

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} npm packages are installed"
    echo -e "  ${BLUE}└─${NC} $(ls node_modules | wc -l) packages in node_modules/"
else
    echo -e "${YELLOW}⚠${NC} npm packages are NOT installed"
    echo -e "  ${YELLOW}→${NC} Run: ${BLUE}npm install${NC}"
fi
echo ""

# Check Git submodules
echo -e "${BLUE}Git Submodules:${NC}"
echo ""

if [ -d "quiche/deps/boringssl/.git" ]; then
    echo -e "${GREEN}✓${NC} BoringSSL submodule is initialized"
else
    echo -e "${YELLOW}⚠${NC} BoringSSL submodule is NOT initialized"
    echo -e "  ${YELLOW}→${NC} Run: ${BLUE}git submodule update --init --recursive${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
echo ""

if [ $REQUIRED_MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ All required dependencies are installed!${NC}"
    echo -e "  You can build quiche-nwep natively"
else
    echo -e "${RED}✗ Missing $REQUIRED_MISSING/$REQUIRED_TOTAL required dependencies${NC}"
    echo -e "  See ${BLUE}DEPENDENCIES.md${NC} for installation instructions"
fi
echo ""

if [ $OPTIONAL_MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ All optional dependencies are installed!${NC}"
    echo -e "  You can cross-compile for all platforms"
elif [ $OPTIONAL_MISSING -lt $OPTIONAL_TOTAL ]; then
    echo -e "${YELLOW}⚠ Missing $OPTIONAL_MISSING/$OPTIONAL_TOTAL optional dependencies${NC}"
    echo -e "  Some cross-compilation features may not be available"
else
    echo -e "${YELLOW}⚠ No optional dependencies installed${NC}"
    echo -e "  Only native builds will work"
fi
echo ""

# Build capability summary
echo -e "${BLUE}Build Capabilities:${NC}"
echo ""

echo -n "  Native build:        "
if [ $REQUIRED_MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${RED}✗ Not available${NC}"
fi

echo -n "  Windows builds:      "
if command -v cross &> /dev/null && command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${YELLOW}✗ Requires cross-rs and Docker${NC}"
fi

echo -n "  Android builds:      "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${YELLOW}✗ Requires Docker${NC}"
fi

echo -n "  Linux ARM builds:    "
if command -v cross &> /dev/null && command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${YELLOW}✗ Requires cross-rs and Docker${NC}"
fi

echo ""

# Exit with appropriate code
if [ $REQUIRED_MISSING -gt 0 ]; then
    echo -e "${RED}Please install missing required dependencies before building.${NC}"
    echo -e "See ${BLUE}DEPENDENCIES.md${NC} for detailed instructions."
    exit 1
else
    echo -e "${GREEN}Your system is ready to build quiche-nwep!${NC}"
    echo -e "Run: ${BLUE}npm run build${NC}"
    exit 0
fi
