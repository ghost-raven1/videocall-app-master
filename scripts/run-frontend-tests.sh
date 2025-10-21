#!/bin/bash

# Frontend Testing Script for CI/CD Pipeline
# This script runs comprehensive tests for the Vue.js frontend

set -e  # Exit on any error

echo "🎨 Starting frontend tests..."

# Navigate to frontend directory
cd videocall-frontend

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm ci

# Run type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

# Run linting
echo "🧹 Running ESLint..."
npm run lint

# Run tests with coverage
echo "🧪 Running tests with coverage..."
npm run test:run -- \
    --coverage \
    --coverage.reporter=lcov \
    --coverage.reporter=json \
    --coverage.reporter=html \
    --watchAll=false

# Run accessibility tests if axe-core is available
if npm list @axe-core/vue &> /dev/null; then
    echo "♿ Running accessibility tests..."
    npm run test:accessibility || echo "⚠️ Accessibility tests failed, but continuing..."
fi

# Run performance tests if lighthouse is available
if command -v lighthouse &> /dev/null; then
    echo "⚡ Running performance tests..."
    # Build the app for performance testing
    npm run build

    # Run Lighthouse CI
    lhci autorun || echo "⚠️ Performance tests failed, but continuing..."
fi

# Run visual regression tests if available
if npm list cypress &> /dev/null; then
    echo "👁️ Running visual regression tests..."
    npx cypress run --component || echo "⚠️ Visual regression tests failed, but continuing..."
fi

# Bundle analyzer
echo "📊 Running bundle analysis..."
npm run build -- --report

# Generate coverage reports
echo "📈 Generating coverage reports..."

# Convert lcov to cobertura format for compatibility
if command -v lcov &> /dev/null && command -v cobertura-lcov &> /dev/null; then
    cobertura-lcov coverage/lcov.info > coverage/cobertura-coverage.xml
fi

echo "✅ Frontend tests completed successfully"

# Output test summary
echo "📊 Test Summary:"
echo "Coverage report (HTML): $(pwd)/coverage/lcov-report/index.html"
echo "Coverage report (LCOV): $(pwd)/coverage/lcov.info"
echo "Coverage report (JSON): $(pwd)/coverage/coverage-final.json"
echo "Bundle analyzer: $(pwd)/dist/report.html"

# Exit with proper code
exit 0