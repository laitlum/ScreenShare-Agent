#!/bin/bash

# Electron Agent Production Build Script
set -e

echo "🚀 Building Electron Agent for Production"
echo "=========================================="

# Check if required environment variables are set
check_env_vars() {
    echo "🔍 Checking environment variables..."
    
    if [ -z "$BACKEND_URL" ]; then
        echo "⚠️  BACKEND_URL not set, using default production URL"
        export BACKEND_URL="https://laitlum.lipiq.in"
    fi
    
    if [ -z "$WS_SERVER_URL" ]; then
        echo "⚠️  WS_SERVER_URL not set, using default production URL"
        export WS_SERVER_URL="wss://laitlum.lipiq.in/ws"
    fi
    
    echo "✅ Environment variables configured:"
    echo "   BACKEND_URL: $BACKEND_URL"
    echo "   WS_SERVER_URL: $WS_SERVER_URL"
}

# Build the application
build() {
    echo "🔨 Building Electron application..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm ci --only=production
    
    # Build for all platforms
    echo "🏗️  Building for macOS, Windows, and Linux..."
    npm run build:prod
    
    echo "✅ Production build completed!"
    echo ""
    echo "📁 Build artifacts:"
    echo "   macOS: dist/*.dmg"
    echo "   Windows: dist/*.exe"
    echo "   Linux: dist/*.AppImage"
}

# Clean build artifacts
clean() {
    echo "🧹 Cleaning build artifacts..."
    rm -rf dist/
    rm -rf node_modules/
    echo "✅ Cleanup completed"
}

# Main script logic
case "${1:-build}" in
    "build")
        check_env_vars
        build
        ;;
    "clean")
        clean
        ;;
    "help")
        echo "Usage: $0 [build|clean|help]"
        echo ""
        echo "Commands:"
        echo "  build   - Build Electron app for production (default)"
        echo "  clean   - Clean build artifacts"
        echo "  help    - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  BACKEND_URL     - Backend API URL (default: https://laitlum.lipiq.in)"
        echo "  WS_SERVER_URL   - WebSocket server URL (default: wss://laitlum.lipiq.in/ws)"
        echo "  NODE_ENV        - Node environment (set to 'production')"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
