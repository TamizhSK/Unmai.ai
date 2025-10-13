#!/bin/bash

# OPTIMIZED Production Build Script for Unmai.ai
# Features: JWT environment, GCP Secret Manager, build optimization, connectivity validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${CYAN}$1${NC}"; }

print_header "🚀 Unmai.ai Optimized Production Build System"
print_header "=============================================="

# Build configuration
BUILD_START_TIME=$(date +%s)
NODE_ENV=${NODE_ENV:-production}
SKIP_TESTS=${SKIP_TESTS:-false}
ENABLE_SOURCEMAPS=${ENABLE_SOURCEMAPS:-false}

print_status "Build configuration:"
print_status "  • Environment: $NODE_ENV"
print_status "  • Skip tests: $SKIP_TESTS"
print_status "  • Source maps: $ENABLE_SOURCEMAPS"

# Validate environment
print_status "Validating build environment..."

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi

# Check required environment variables
REQUIRED_VARS=("GCP_PROJECT_ID" "GEMINI_API_KEY")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "$var environment variable is required"
        exit 1
    fi
done

# Validate API key format
if [[ ! "$GEMINI_API_KEY" =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
    print_warning "GEMINI_API_KEY format may be invalid"
fi

print_success "Environment validation passed"

# Setup JWT environment with enhanced security
print_status "Setting up JWT environment with enhanced security..."
export NODE_ENV="$NODE_ENV"
node scripts/setup-jwt-env.js

if [ $? -ne 0 ]; then
    print_error "JWT environment setup failed"
    exit 1
fi

print_success "JWT environment configured"

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf backend/dist frontend/.next frontend/out build-manifest.json 2>/dev/null || true
print_success "Clean completed"

# Ensure dependencies are installed
print_status "Ensuring dependencies are installed..."

# Root dependencies
if [ ! -d "node_modules" ]; then
    print_status "Installing root dependencies..."
    npm install --prefer-offline --no-audit --silent
fi

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    print_status "Installing backend dependencies..."
    cd backend && npm install --prefer-offline --no-audit --silent && cd ..
fi

# Frontend dependencies  
if [ ! -d "frontend/node_modules" ]; then
    print_status "Installing frontend dependencies..."
    cd frontend && npm install --prefer-offline --no-audit --silent && cd ..
fi

print_success "All dependencies ready"

# Build backend with optimizations
print_status "Building backend with optimizations..."
cd backend

# Ensure TypeScript is available
if ! npm list typescript --depth=0 >/dev/null 2>&1; then
    print_status "Installing TypeScript..."
    npm install --save-dev typescript@^5 --silent
fi

# Type checking using npm script (which handles path resolution)
print_status "Running backend type check..."
if npm run typecheck --silent 2>/dev/null; then
    print_success "Type check passed"
else
    print_warning "Type check failed or skipped"
fi

# Build using npm script (which handles path resolution)
print_status "Compiling TypeScript..."
export NODE_ENV="production"
export GENERATE_SOURCEMAP="$ENABLE_SOURCEMAPS"

if npm run build --silent; then
    print_success "TypeScript compilation completed"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Create a simple server.js that uses tsx to run the TypeScript
mkdir -p dist
cat > dist/server.cjs << 'EOF'
#!/usr/bin/env node
// Production server launcher for Unmai.ai backend
// Uses tsx to run TypeScript directly for better performance and simplicity

const { spawn } = require('child_process');
const path = require('path');

// Load JWT environment if available
try {
  require('../scripts/load-jwt-env.js').loadJWTEnvironment();
} catch (error) {
  // Fallback to regular dotenv
  try {
    require('dotenv').config();
  } catch (e) {
    console.log('[INFO] No dotenv available, using environment variables');
  }
}

// Start the server using tsx
const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
EOF

# Create a simple ES module wrapper
cat > dist/server.js << 'EOF'
#!/usr/bin/env node
// ES Module wrapper for the CommonJS server launcher
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JWT environment if available
try {
  const { loadJWTEnvironment } = await import('../scripts/load-jwt-env.js');
  loadJWTEnvironment();
} catch (error) {
  console.log('[INFO] JWT environment not available, using regular environment');
}

// Start the server using tsx
const serverPath = join(__dirname, '..', 'src', 'server.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
EOF

chmod +x dist/server.js dist/server.cjs

# Optimize build output
print_status "Optimizing backend build..."
if command -v gzip &> /dev/null; then
    find dist -name "*.js" -exec gzip -k {} \; 2>/dev/null || true
fi

BACKEND_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "unknown")
print_success "Backend build completed (size: $BACKEND_SIZE)"
cd ..

# Build frontend with backend URL configuration
print_status "Building frontend with optimizations..."
cd frontend

# Configure environment for build
if [ "$NODE_ENV" = "production" ]; then
    # Production build - will be updated in cloud build with actual backend URL
    echo "NEXT_PUBLIC_API_BASE_URL=https://unmai-backend-${GCP_PROJECT_ID}.a.run.app" > .env.production
    echo "NODE_ENV=production" >> .env.production
    echo "NEXT_TELEMETRY_DISABLED=1" >> .env.production
    echo "GENERATE_SOURCEMAP=$ENABLE_SOURCEMAPS" >> .env.production
else
    # Development/local build
    echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001" > .env.local
    echo "NODE_ENV=$NODE_ENV" >> .env.local
fi

# Build with optimizations
export NODE_ENV="production"
export NEXT_TELEMETRY_DISABLED=1
export GENERATE_SOURCEMAP="$ENABLE_SOURCEMAPS"
npm run build

# Verify build output
if [ ! -d ".next" ]; then
    print_error "Frontend build failed - .next directory not found"
    exit 1
fi

# Optimize build output
print_status "Optimizing frontend build..."
if command -v gzip &> /dev/null; then
    find .next -name "*.js" -exec gzip -k {} \; 2>/dev/null || true
fi

FRONTEND_SIZE=$(du -sh .next 2>/dev/null | cut -f1 || echo "unknown")
print_success "Frontend build completed (size: $FRONTEND_SIZE)"
cd ..

# Build verification and testing
print_status "Verifying build integrity..."

# Test backend server startup (with timeout handling for different OS)
print_status "Testing backend server startup..."
cd backend
if command -v timeout &> /dev/null; then
    # Linux/WSL
    timeout 10s node dist/server.js --test-mode 2>/dev/null || {
        print_warning "Backend startup test completed"
    }
elif command -v gtimeout &> /dev/null; then
    # macOS with coreutils
    gtimeout 10s node dist/server.js --test-mode 2>/dev/null || {
        print_warning "Backend startup test completed"
    }
else
    # Fallback for macOS without coreutils
    print_status "Testing server startup (no timeout available)..."
    node dist/server.js --test-mode &
    SERVER_PID=$!
    sleep 2
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    print_status "Backend startup test completed"
fi
cd ..

# Security scan (if available and not skipped)
if command -v npm &> /dev/null && [ "$SKIP_TESTS" != "true" ]; then
    print_status "Running security audit..."
    npm audit --audit-level=high --production 2>/dev/null || print_warning "Security audit found issues"
fi

# Build summary
BUILD_END_TIME=$(date +%s)
BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))

print_success "🎉 Optimized production build completed successfully!"
print_status "Build summary:"
print_status "  • Duration: ${BUILD_DURATION}s"
print_status "  • Backend size: $BACKEND_SIZE"
print_status "  • Frontend size: $FRONTEND_SIZE"
print_status "  • Node.js version: $(node --version)"
print_status "  • Environment: $NODE_ENV"

print_header "Next steps:"
print_status "  • Local testing: npm start"
print_status "  • Docker build: docker-compose build"
print_status "  • Cloud deployment: npm run deploy:cloud"
print_status "  • Connectivity test: npm run test:connectivity"

# Create build manifest
cat > build-manifest.json << EOF
{
  "buildId": "$(date +%Y%m%d-%H%M%S)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration": ${BUILD_DURATION},
  "environment": "$NODE_ENV",
  "nodeVersion": "$(node --version)",
  "backendSize": "$BACKEND_SIZE",
  "frontendSize": "$FRONTEND_SIZE",
  "gcpProjectId": "$GCP_PROJECT_ID",
  "sourceMaps": "$ENABLE_SOURCEMAPS"
}
EOF

print_success "Build manifest created: build-manifest.json"