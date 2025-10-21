#!/bin/bash

# Security Scanning Script for CI/CD Pipeline
# This script runs comprehensive security scans

set -e  # Exit on any error

echo "🔒 Starting security scans..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Install security tools if not present
install_security_tools() {
    log_info "Installing security scanning tools..."

    # Python security tools
    if command -v python &> /dev/null; then
        pip install safety bandit || log_warn "Failed to install some Python security tools"
    fi

    # Node.js security tools
    if command -v npm &> /dev/null; then
        npm install -g npm-audit || log_warn "Failed to install npm-audit"
    fi

    # Go security tools
    if command -v go &> /dev/null; then
        go install github.com/securecodewarrior/github-action-gosec@latest || log_warn "Failed to install gosec"
    fi
}

# Scan Python dependencies
scan_python_deps() {
    log_info "Scanning Python dependencies..."

    if [ -f "backend/requirements.txt" ]; then
        cd backend
        if command -v safety &> /dev/null; then
            safety check --output json > ../safety-report.json || log_warn "Safety scan found vulnerabilities"
        fi
        cd ..
    fi
}

# Scan Node.js dependencies
scan_nodejs_deps() {
    log_info "Scanning Node.js dependencies..."

    if [ -f "videocall-frontend/package.json" ]; then
        cd videocall-frontend
        if command -v npm &> /dev/null; then
            npm audit --audit-level=moderate --json > ../npm-audit-report.json || log_warn "npm audit found vulnerabilities"
        fi
        cd ..
    fi
}

# Run SAST scans
run_sast_scans() {
    log_info "Running Static Application Security Testing (SAST)..."

    # Python SAST with bandit
    if [ -d "backend" ] && command -v bandit &> /dev/null; then
        bandit -r backend/ -f sarif -o bandit-report.sarif || log_warn "Bandit scan found issues"
    fi

    # Go SAST with gosec
    if [ -d "streaming-node" ] && command -v gosec &> /dev/null; then
        gosec -fmt sarif -out gosec-report.sarif -severity medium -confidence medium ./streaming-node/... || log_warn "Gosec scan found issues"
    fi

    # Frontend SAST with eslint
    if [ -d "videocall-frontend" ] && [ -f "videocall-frontend/package.json" ]; then
        cd videocall-frontend
        if command -v npx &> /dev/null; then
            npx eslint . --ext .js,.vue --format sarif --output-file ../eslint-report.sarif || log_warn "ESLint scan found issues"
        fi
        cd ..
    fi
}

# Run container security scans
run_container_scans() {
    log_info "Running container security scans..."

    if ! command -v docker &> /dev/null; then
        log_warn "Docker not available for container scanning"
        return
    fi

    # Build images for scanning
    docker build -t videocall-backend:scan ./backend/ || log_warn "Failed to build backend image for scanning"
    docker build -t videocall-frontend:scan ./videocall-frontend/ || log_warn "Failed to build frontend image for scanning"
    docker build -t videocall-streaming:scan ./streaming-node/ || log_warn "Failed to build streaming image for scanning"

    # Run Trivy scans if available
    if command -v trivy &> /dev/null; then
        trivy image --format sarif --output backend-container-report.sarif videocall-backend:scan || log_warn "Trivy backend scan failed"
        trivy image --format sarif --output frontend-container-report.sarif videocall-frontend:scan || log_warn "Trivy frontend scan failed"
        trivy image --format sarif --output streaming-container-report.sarif videocall-streaming:scan || log_warn "Trivy streaming scan failed"
    fi

    # Clean up scan images
    docker rmi videocall-backend:scan videocall-frontend:scan videocall-streaming:scan || true
}

# Run secrets detection
run_secrets_scan() {
    log_info "Running secrets detection..."

    if command -v git &> /dev/null && command -v gitleaks &> /dev/null; then
        gitleaks detect --source . --format sarif --report-path gitleaks-report.sarif || log_warn "Gitleaks found potential secrets"
    fi
}

# Run license compliance check
run_license_check() {
    log_info "Running license compliance check..."

    # Python license check
    if [ -f "backend/requirements.txt" ] && command -v pip-licenses &> /dev/null; then
        cd backend
        pip-licenses --format=json > ../backend-license-report.json || log_warn "Python license check failed"
        cd ..
    fi

    # Node.js license check
    if [ -f "videocall-frontend/package.json" ] && command -v npx &> /dev/null; then
        cd videocall-frontend
        npx license-checker --json > ../frontend-license-report.json || log_warn "Node.js license check failed"
        cd ..
    fi
}

# Generate security summary
generate_security_summary() {
    log_info "Generating security summary..."

    cat > security-summary.md << EOF
# 🔒 Security Scan Summary

## Scan Results

### Dependency Scanning
- Python dependencies: $([ -f safety-report.json ] && echo "✅ Completed" || echo "❌ Failed")
- Node.js dependencies: $([ -f npm-audit-report.json ] && echo "✅ Completed" || echo "❌ Failed")

### Static Application Security Testing (SAST)
- Python (Bandit): $([ -f bandit-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")
- Go (Gosec): $([ -f gosec-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")
- Frontend (ESLint): $([ -f eslint-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")

### Container Security
- Backend image: $([ -f backend-container-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")
- Frontend image: $([ -f frontend-container-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")
- Streaming image: $([ -f streaming-container-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")

### Secrets Detection
- GitLeaks scan: $([ -f gitleaks-report.sarif ] && echo "✅ Completed" || echo "❌ Failed")

### License Compliance
- Python licenses: $([ -f backend-license-report.json ] && echo "✅ Completed" || echo "❌ Failed")
- Node.js licenses: $([ -f frontend-license-report.json ] && echo "✅ Completed" || echo "❌ Failed")

## Recommendations

1. **High Priority**: Address any critical or high-severity vulnerabilities immediately
2. **Dependencies**: Keep dependencies updated to latest secure versions
3. **Secrets**: Ensure no secrets are committed to the repository
4. **Licenses**: Review and approve all dependency licenses for production use
5. **Containers**: Use minimal base images and multi-stage builds
6. **Code Quality**: Address security issues found in SAST scans

## Next Steps

- Review all scan reports in detail
- Create tickets for addressing identified issues
- Update dependencies regularly
- Implement security scanning in CI/CD pipeline
- Conduct regular security audits

---
*Report generated on $(date)*
EOF

    log_info "✅ Security summary generated"
}

# Main execution
main() {
    log_info "🚀 Starting comprehensive security scanning..."

    install_security_tools
    scan_python_deps
    scan_nodejs_deps
    run_sast_scans
    run_container_scans
    run_secrets_scan
    run_license_check
    generate_security_summary

    log_info "✅ Security scanning completed"

    # List generated reports
    echo ""
    echo "📊 Generated Security Reports:"
    ls -la *-report.* 2>/dev/null || echo "No reports generated"
    echo ""
    echo "📋 Security Summary: security-summary.md"
}

# Run main function
main "$@"