#!/bin/bash
# scripts/check-coverage.sh - Check test coverage for backend and frontend

set -e

echo "📊 Checking Test Coverage..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Backend coverage
if [ -d "backend" ]; then
    echo "🔍 Checking Backend Coverage..."
    cd backend
    
    # Check if pytest is available
    if command -v pytest &> /dev/null || python3 -m pytest --version &> /dev/null; then
        echo "Running backend tests with coverage..."
        
        # Run tests with coverage
        if python3 -m pytest --cov=apps --cov-report=term-missing --cov-report=html -q 2>&1 | tee /tmp/coverage_output.txt; then
            echo -e "${GREEN}✅ Backend coverage check completed${NC}"
            
            # Extract coverage percentage
            COVERAGE=$(grep -oP 'TOTAL.*\K\d+%' /tmp/coverage_output.txt | head -1 || echo "N/A")
            echo "📈 Backend Coverage: $COVERAGE"
            echo "📁 HTML Report: backend/htmlcov/index.html"
        else
            echo -e "${YELLOW}⚠️ Backend coverage check had issues${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ pytest not available, skipping backend coverage${NC}"
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️ Backend directory not found${NC}"
fi

echo ""

# Frontend coverage
if [ -d "videocall-frontend" ]; then
    echo "🔍 Checking Frontend Coverage..."
    cd videocall-frontend
    
    # Check if npm is available
    if command -v npm &> /dev/null; then
        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            echo "📦 Installing dependencies..."
            npm install
        fi
        
        echo "Running frontend tests with coverage..."
        
        # Run tests with coverage
        if npm run test:coverage 2>&1 | tee /tmp/frontend_coverage_output.txt; then
            echo -e "${GREEN}✅ Frontend coverage check completed${NC}"
            echo "📁 Coverage Report: videocall-frontend/coverage/"
        else
            echo -e "${YELLOW}⚠️ Frontend coverage check had issues${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ npm not available, skipping frontend coverage${NC}"
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️ Frontend directory not found${NC}"
fi

echo ""
echo "📊 Coverage Summary:"
echo "  - Backend: Check backend/htmlcov/index.html"
echo "  - Frontend: Check videocall-frontend/coverage/"
echo ""
echo "✅ Coverage check completed!"

