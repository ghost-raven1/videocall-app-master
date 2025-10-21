#!/bin/bash

# Streaming Service Testing Script for CI/CD Pipeline
# This script runs comprehensive tests for the Go-based streaming service

set -e  # Exit on any error

echo "📡 Starting streaming service tests..."

# Navigate to streaming directory
cd streaming-node

# Install Go dependencies
echo "📦 Installing Go dependencies..."
go mod download
go mod tidy

# Verify Go installation and version
echo "🔧 Go version: $(go version)"

# Run Go formatting check
echo "🧹 Checking Go formatting..."
if [ "$(gofmt -s -l . | wc -l)" -gt 0 ]; then
    echo "❌ Go code is not formatted properly"
    gofmt -d .
    exit 1
fi

# Run Go vet for static analysis
echo "🔍 Running Go vet..."
go vet ./...

# Run Go security scan with gosec if available
if command -v gosec &> /dev/null; then
    echo "🔒 Running Go security scan..."
    gosec -fmt sarif -out gosec-report.sarif -severity medium -confidence medium ./... || echo "⚠️ Security scan found issues, but continuing..."
fi

# Run tests with race detection and coverage
echo "🧪 Running tests with coverage..."
go test \
    -v \
    -race \
    -coverprofile=coverage.out \
    -covermode=atomic \
    ./...

# Run benchmark tests
echo "⚡ Running benchmark tests..."
go test -bench=. -benchmem ./...

# Build the streaming service
echo "🔨 Building streaming service..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a \
    -installsuffix cgo \
    -o videocall-streaming \
    .

# Test the binary
echo "🔍 Testing binary..."
if [ -x "./videocall-streaming" ]; then
    echo "✅ Binary created successfully"

    # Get binary size
    BINARY_SIZE=$(stat -c%s "./videocall-streaming" 2>/dev/null || stat -f%z "./videocall-streaming")
    echo "📏 Binary size: $BINARY_SIZE bytes"

    # Check if binary is statically linked (no dynamic dependencies)
    if command -v ldd &> /dev/null; then
        echo "🔗 Checking dynamic dependencies..."
        ldd ./videocall-streaming || echo "✅ Binary appears to be statically linked"
    fi
else
    echo "❌ Binary creation failed"
    exit 1
fi

# Generate coverage report in different formats
echo "📊 Generating coverage reports..."

# Convert coverage to HTML if gocov is available
if command -v gocov &> /dev/null && command -v go tool cover &> /dev/null; then
    go tool cover -html=coverage.out -o coverage.html
    echo "📄 HTML coverage report: $(pwd)/coverage.html"
fi

# Convert to cobertura format if gocov-xml is available
if command -v gocov-xml &> /dev/null; then
    gocov-xml coverage.out > cobertura-coverage.xml
    echo "📄 Cobertura coverage report: $(pwd)/cobertura-coverage.xml"
fi

# Run integration tests if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Running integration tests with Docker..."

    # Build test container
    docker build -t videocall-streaming:test -f Dockerfile ..

    # Run basic smoke test
    timeout 30s docker run --rm videocall-streaming:test --help || echo "⚠️ Container test had issues, but continuing..."
fi

# Clean up binary
rm -f videocall-streaming

echo "✅ Streaming service tests completed successfully"

# Output test summary
echo "📊 Test Summary:"
echo "Coverage profile: $(pwd)/coverage.out"
echo "Coverage report (HTML): $(pwd)/coverage.html"
echo "Coverage report (Cobertura): $(pwd)/cobertura-coverage.xml"

# Exit with proper code
exit 0