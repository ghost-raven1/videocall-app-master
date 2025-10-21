# 🚀 VideoCall Application CI/CD Pipeline

This document provides comprehensive documentation for the VideoCall application's CI/CD pipeline implementation.

## 📋 Overview

The CI/CD pipeline consists of multiple GitHub Actions workflows that handle:

- **Continuous Integration (CI)**: Automated testing, code quality checks, and security scanning
- **Continuous Deployment (CD)**: Blue-green deployments to staging and production environments
- **Security Scanning**: Comprehensive vulnerability assessments and compliance checks
- **Monitoring Integration**: Automated setup of monitoring and alerting

## 🏗️ Architecture

### Pipeline Stages

1. **Code Quality Checks**: Linting, formatting, and static analysis
2. **Unit & Integration Testing**: Comprehensive test suites for all components
3. **Security Scanning**: SAST, DAST, dependency, and container scanning
4. **Container Building**: Multi-stage Docker builds with security hardening
5. **Blue-Green Deployment**: Zero-downtime deployments with rollback capabilities
6. **Monitoring Setup**: Automated Prometheus and Grafana configuration

### Components

- **Backend**: Django application with WebSocket support
- **Frontend**: Vue.js SPA with real-time communication
- **Streaming**: Go-based WebRTC SFU (Selective Forwarding Unit)
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for sessions and real-time features

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster**: Running Kubernetes 1.19+
2. **Container Registry**: GitHub Container Registry (ghcr.io)
3. **Domain & TLS**: Configured domain with Let's Encrypt certificates
4. **Secrets Management**: Pre-configured secrets in each namespace

### Initial Setup

1. **Configure Secrets**:
```bash
# Generate secure secrets
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"
python -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"

# Create secrets in each namespace
kubectl apply -f k8s/staging/secrets.yaml
kubectl apply -f k8s/production/secrets.yaml
```

2. **Deploy Infrastructure**:
```bash
# Deploy to staging
./scripts/deploy.sh staging deploy

# Deploy to production (requires confirmation)
./scripts/deploy.sh production deploy
```

3. **Verify Deployment**:
```bash
# Check deployment status
kubectl get pods -n videocall-staging
kubectl get services -n videocall-staging

# Check logs
kubectl logs -f deployment/videocall-backend -n videocall-staging
```

## 🔄 GitHub Actions Workflows

### 1. Continuous Integration (`ci.yml`)

**Triggers**: Push/PR to `main` and `develop` branches

**Jobs**:
- **Quality Checks**: Linting, formatting, and type checking
- **Backend Tests**: Django tests with PostgreSQL and Redis
- **Frontend Tests**: Vue.js tests with coverage
- **Streaming Tests**: Go tests with race detection
- **Integration Tests**: End-to-end testing with Docker Compose
- **Build & Push**: Container images to GitHub Container Registry

**Environment Variables**:
```yaml
REGISTRY: ghcr.io
BACKEND_IMAGE: videocall-backend
FRONTEND_IMAGE: videocall-frontend
STREAMING_IMAGE: videocall-streaming
```

### 2. Continuous Deployment (`cd.yml`)

**Triggers**: Successful CI completion, manual dispatch

**Jobs**:
- **Deploy Staging**: Blue-green deployment to staging environment
- **Deploy Production**: Blue-green deployment to production (requires approval)
- **Rollback**: Automated rollback on deployment failures
- **Monitoring Setup**: Post-deployment monitoring configuration

**Features**:
- Manual approval gates for production deployments
- Automated rollback capabilities
- Health checks and smoke tests
- Post-deployment monitoring

### 3. Security Scanning (`security.yml`)

**Triggers**: Daily schedule, push/PR, manual dispatch

**Jobs**:
- **Dependency Scanning**: Safety (Python) and npm audit (Node.js)
- **SAST**: Bandit (Python), Gosec (Go), ESLint (JavaScript/Vue)
- **Container Scanning**: Trivy vulnerability scanning
- **Infrastructure Scanning**: Checkov IaC security
- **Secrets Detection**: GitLeaks scan
- **License Compliance**: License compatibility checks

## 🌍 Environment Management

### Staging Environment

- **Namespace**: `videocall-staging`
- **Resources**: Limited quotas for cost optimization
- **Domain**: `staging.video-call-ghost.ru`
- **Purpose**: Pre-production testing and validation

**Configuration**:
```yaml
# k8s/staging/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: videocall-staging
  labels:
    environment: staging
```

### Production Environment

- **Namespace**: `videocall-production`
- **Resources**: Higher quotas with auto-scaling
- **Domain**: `video-call-ghost.ru`
- **Purpose**: Live production workload

**Features**:
- Horizontal Pod Autoscaling (HPA)
- Resource limits and requests
- Comprehensive health checks
- Automated rollback capabilities

## 🔒 Security Implementation

### Secrets Management

Secrets are managed through Kubernetes secrets with base64 encoding:

```yaml
# k8s/production/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: videocall-production
type: Opaque
data:
  SECRET_KEY: <base64-encoded-secret>
  JWT_SECRET: <base64-encoded-secret>
```

### Security Scanning Tools

1. **SAST (Static Application Security Testing)**:
   - Bandit for Python
   - Gosec for Go
   - ESLint for JavaScript/Vue

2. **DAST (Dynamic Application Security Testing)**:
   - OWASP ZAP integration ready
   - API endpoint testing

3. **Container Security**:
   - Trivy for vulnerability scanning
   - Multi-stage builds for minimal attack surface

4. **Infrastructure Security**:
   - Checkov for Kubernetes manifests
   - Resource policy validation

## 📊 Monitoring & Alerting

### Prometheus Configuration

```yaml
# k8s/monitoring/prometheus-config.yaml
scrape_configs:
  - job_name: 'videocall-backend'
    static_configs:
      - targets: ['videocall-app.videocall-production.svc.cluster.local:8000']
    metrics_path: /api/metrics/
```

### Grafana Dashboards

Pre-configured dashboards include:
- Application performance metrics
- WebSocket connection statistics
- Database query performance
- Error rates and alerting

### Alert Rules

```yaml
groups:
- name: deployment_alerts
  rules:
  - alert: DeploymentFailed
    expr: kube_deployment_status_replicas_unavailable > 0
    for: 5m
    labels:
      severity: critical
```

## 🧪 Testing Strategy

### Unit Tests

- **Backend**: Django test suite with pytest
- **Frontend**: Vitest with Vue Test Utils
- **Streaming**: Go testing with race detection

### Integration Tests

- **API Testing**: REST endpoint validation
- **WebSocket Testing**: Real-time communication
- **Database Testing**: Migration and query testing
- **E2E Testing**: Cross-component workflows

### Performance Tests

- **Load Testing**: Artillery and custom scripts
- **Stress Testing**: WebRTC connection limits
- **Scalability Testing**: HPA validation

## 🔄 Blue-Green Deployment

### Deployment Process

1. **Blue Environment**: Current production version
2. **Green Environment**: New version for testing
3. **Traffic Switch**: Gradual migration to green
4. **Rollback**: Immediate rollback if issues detected

### Rollback Procedure

```bash
# Manual rollback
./scripts/deploy.sh production rollback

# Automatic rollback (triggered by health check failures)
# Handled by GitHub Actions CD workflow
```

## 🚨 Troubleshooting

### Common Issues

1. **Deployment Failures**:
   ```bash
   # Check pod status
   kubectl describe pod <pod-name> -n <namespace>

   # Check logs
   kubectl logs <pod-name> -n <namespace>
   ```

2. **Health Check Failures**:
   ```bash
   # Verify service endpoints
   kubectl get endpoints -n <namespace>

   # Check ingress configuration
   kubectl describe ingress -n <namespace>
   ```

3. **Resource Issues**:
   ```bash
   # Check resource usage
   kubectl top pods -n <namespace>

   # Check quota limits
   kubectl describe resourcequota -n <namespace>
   ```

### Debug Commands

```bash
# Debug database connectivity
kubectl run postgres-client --rm -i --tty --image postgres:15-alpine -- psql -h postgres -U videocall_user -d videocall_production

# Debug Redis connectivity
kubectl run redis-client --rm -i --tty --image redis:7-alpine -- redis-cli -h redis ping

# Port forward for local debugging
kubectl port-forward service/videocall-app 8000:80 -n videocall-production
```

## 📈 Performance Optimization

### Horizontal Pod Autoscaling

```yaml
# Production HPA configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: videocall-hpa
  namespace: videocall-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: videocall-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Optimization

- Connection pooling configuration
- Query optimization and indexing
- Read replica setup for analytics

### Caching Strategy

- Redis for session storage
- Application-level caching
- CDN integration for static assets

## 🔧 Maintenance

### Regular Tasks

1. **Dependency Updates**: Monthly security updates
2. **Certificate Renewal**: Automated via cert-manager
3. **Backup Validation**: Regular backup testing
4. **Performance Review**: Weekly performance analysis

### Backup Strategy

```yaml
# PostgreSQL backup configuration
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: videocall-db
  namespace: videocall-production
spec:
  instances: 3
  backup:
    retentionPolicy: 30d
    barmanObjectStore:
      destinationPath: s3://videocall-backups/
```

## 📚 Additional Resources

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Testing Strategy](TESTING_STRATEGY.md)
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
- [Validation Checklist](VALIDATION_CHECKLIST.md)

## 🤝 Contributing

1. All changes require CI/CD pipeline approval
2. Security scans must pass for production deployments
3. Documentation updates required for configuration changes
4. Rollback procedures must be tested before production changes

---

*For questions or issues, please contact the DevOps team.*