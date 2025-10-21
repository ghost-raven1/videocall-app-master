#!/bin/bash

# Deployment Script for VideoCall Application
# This script handles deployment to different environments

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-staging}
ACTION=${2:-deploy}
NAMESPACE="videocall-${ENVIRONMENT}"

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

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    # Check if we're connected to a cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Not connected to a Kubernetes cluster"
        exit 1
    fi
}

# Check environment
check_environment() {
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi

    if [[ "$ENVIRONMENT" == "production" && "$ACTION" == "deploy" ]]; then
        log_warn "Deploying to PRODUCTION environment!"
        read -p "Are you sure? (type 'yes' to confirm): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
}

# Validate secrets
validate_secrets() {
    log_info "Validating secrets for $ENVIRONMENT..."

    # Check if required secrets exist
    if ! kubectl get secret postgres-secrets -n "$NAMESPACE" &> /dev/null; then
        log_error "postgres-secrets not found in namespace $NAMESPACE"
        exit 1
    fi

    if ! kubectl get secret app-secrets -n "$NAMESPACE" &> /dev/null; then
        log_error "app-secrets not found in namespace $NAMESPACE"
        exit 1
    fi

    log_info "✅ Secrets validation passed"
}

# Deploy database
deploy_database() {
    log_info "Deploying database for $ENVIRONMENT..."
    kubectl apply -f "k8s/$ENVIRONMENT/postgres-config.yaml"
    kubectl rollout status statefulset/postgres -n "$NAMESPACE" --timeout=600s
    log_info "✅ Database deployment completed"
}

# Deploy Redis
deploy_redis() {
    log_info "Deploying Redis for $ENVIRONMENT..."
    kubectl apply -f "k8s/$ENVIRONMENT/redis-config.yaml"
    kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=300s
    log_info "✅ Redis deployment completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application for $ENVIRONMENT..."

    # Apply configurations
    kubectl apply -f "k8s/$ENVIRONMENT/namespace.yaml"
    kubectl apply -f "k8s/$ENVIRONMENT/secrets.yaml"

    # Deploy in order
    kubectl apply -f "k8s/$ENVIRONMENT/streaming-deployment.yaml"
    kubectl apply -f "k8s/$ENVIRONMENT/backend-deployment.yaml"
    kubectl apply -f "k8s/$ENVIRONMENT/frontend-deployment.yaml"

    # Wait for deployments
    kubectl rollout status deployment/videocall-streaming -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/videocall-blue -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/videocall-frontend -n "$NAMESPACE" --timeout=600s

    log_info "✅ Application deployment completed"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying ingress for $ENVIRONMENT..."
    kubectl apply -f "k8s/$ENVIRONMENT/ingress.yaml"
    log_info "✅ Ingress deployment completed"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks for $ENVIRONMENT..."

    # Wait for ingress to be ready
    sleep 60

    # Check main application
    if [[ "$ENVIRONMENT" == "production" ]]; then
        HEALTH_URL="https://video-call-ghost.ru/api/health/"
        WS_URL="wss://video-call-ghost.ru"
    else
        HEALTH_URL="https://staging.video-call-ghost.ru/api/health/"
        WS_URL="wss://staging.video-call-ghost.ru"
    fi

    # Health check with retry
    max_attempts=10
    for i in $(seq 1 "$max_attempts"); do
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            log_info "✅ Application health check passed"
            break
        fi

        if [ "$i" -eq "$max_attempts" ]; then
            log_error "❌ Application health check failed after $max_attempts attempts"
            exit 1
        fi

        log_warn "Health check attempt $i/$max_attempts failed, retrying..."
        sleep 30
    done
}

# Rollback function
rollback() {
    log_warn "Starting rollback for $ENVIRONMENT..."

    # Get current color
    CURRENT_COLOR=$(kubectl get service videocall-app -n "$NAMESPACE" -o jsonpath='{.spec.selector.app}' 2>/dev/null || echo "blue")

    # Determine previous color
    if [[ "$CURRENT_COLOR" == "blue" ]]; then
        PREVIOUS_COLOR="green"
    else
        PREVIOUS_COLOR="blue"
    fi

    log_info "Rolling back from $CURRENT_COLOR to $PREVIOUS_COLOR"

    # Scale up previous deployment
    kubectl scale deployment/videocall-"$PREVIOUS_COLOR" -n "$NAMESPACE" --replicas=3

    # Update service selector
    kubectl patch service videocall-app -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"app\":\"$PREVIOUS_COLOR\"}}}" --type=merge

    # Scale down current deployment
    kubectl scale deployment/videocall-"$CURRENT_COLOR" -n "$NAMESPACE" --replicas=0

    # Verify rollback
    sleep 30
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        log_info "✅ Rollback completed successfully"
    else
        log_error "❌ Rollback verification failed"
        exit 1
    fi
}

# Main deployment logic
main() {
    log_info "🚀 Starting deployment: $ACTION $ENVIRONMENT"

    check_kubectl
    check_environment

    case "$ACTION" in
        "deploy")
            validate_secrets
            deploy_database
            deploy_redis
            deploy_application
            deploy_ingress
            run_health_checks
            log_info "🎉 Deployment to $ENVIRONMENT completed successfully"
            ;;
        "rollback")
            rollback
            ;;
        *)
            log_error "Invalid action: $ACTION. Must be 'deploy' or 'rollback'"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"