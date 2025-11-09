# Multi-User Video Call Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the multi-user video call system consisting of Django backend, Go SFU server, Vue.js frontend, and supporting infrastructure.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vue.js        │    │   Nginx          │    │   Internet      │
│   Frontend      │◄──►│   Reverse Proxy  │◄──►│   Users         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         │                        │
┌─────────────────┐    ┌──────────────────┐
│   Django        │    │   Go SFU         │
│   Backend       │◄──►│   Server         │
│   (WebSocket)   │    │   (WebRTC)       │
└─────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│   PostgreSQL    │    │   Redis          │
│   Database      │    │   Cache/Session  │
└─────────────────┘    └──────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Git
- SSL certificates (for production)
- Domain name (for production)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd videocall-app-master
```

### 2. Environment Configuration

Copy and configure environment files:

```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp videocall-frontend/.env.example videocall-frontend/.env.local

# Root environment for Docker Compose
cp .env.example .env
```

### 3. Deploy with Docker Compose

```bash
# Development deployment
docker-compose up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## Detailed Deployment Guide

### Development Environment

#### 1. Docker Compose Configuration

**docker-compose.dev.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: videocall_dev
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
    volumes:
      - dev_postgres_data:/var/lib/postgresql/data/
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d videocall_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for Sessions and Caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - dev_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    command: redis-server --appendonly yes

  # Go SFU Server
  sfu:
    build:
      context: ./streaming-node
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
      - "8081:8081"  # WebRTC ports
      - "8082:8082"
    environment:
      - SERVER_ADDRESS=0.0.0.0
      - SERVER_PORT=8080
      - LOG_LEVEL=debug
      - WEBRTC_PORT_RANGE_MIN=8081
      - WEBRTC_PORT_RANGE_MAX=8082
    volumes:
      - ./streaming-node/config.yaml:/app/config.yaml:ro
      - ./streaming-node/logs:/app/logs
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  # Django Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    environment:
      - DEBUG=True
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=videocall_dev
      - DB_USER=dev_user
      - DB_PASSWORD=dev_password
      - REDIS_URL=redis://redis:6379/0
      - SFU_API_BASE_URL=http://sfu:8080/api
      - SFU_WS_BASE_URL=ws://sfu:8080/ws
      - SECRET_KEY=your-secret-key-here
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      sfu:
        condition: service_healthy
    networks:
      - videocall-network

  # Vue.js Frontend
  frontend:
    build:
      context: ./videocall-frontend
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./videocall-frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_BASE_URL=http://localhost:8000
      - VITE_WS_BASE_URL=ws://localhost:8000
      - VITE_SFU_WS_URL=ws://localhost:8080
    depends_on:
      - backend

  # Nginx Development Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.dev.conf:/etc/nginx/nginx.conf:ro
      - static_volume:/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      - backend
      - frontend
      - sfu
    networks:
      - videocall-network

volumes:
  dev_postgres_data:
  dev_redis_data:
  static_volume:
  media_volume:

networks:
  videocall-network:
    driver: bridge
```

#### 2. Development Environment Variables

**backend/.env**
```bash
DEBUG=True
SECRET_KEY=your-secret-key-here
DB_HOST=db
DB_PORT=5432
DB_NAME=videocall_dev
DB_USER=dev_user
DB_PASSWORD=dev_password
REDIS_URL=redis://redis:6379/0
SFU_API_BASE_URL=http://sfu:8080/api
SFU_WS_BASE_URL=ws://sfu:8080/ws
ALLOWED_HOSTS=localhost,127.0.0.1,backend,nginx
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**videocall-frontend/.env.local**
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_SFU_WS_URL=ws://localhost:8080
```

### Production Environment

#### 1. Docker Compose Production Configuration

**docker-compose.prod.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - prod_postgres_data:/var/lib/postgresql/data/
    networks:
      - videocall-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cluster
  redis:
    image: redis:7-alpine
    volumes:
      - prod_redis_data:/data
    networks:
      - videocall-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    command: redis-server --appendonly yes

  # Go SFU Server (Multiple instances for load balancing)
  sfu-1:
    build:
      context: ./streaming-node
      dockerfile: Dockerfile
    environment:
      - SERVER_ADDRESS=0.0.0.0
      - SERVER_PORT=8080
      - LOG_LEVEL=info
      - WEBRTC_PORT_RANGE_MIN=10000
      - WEBRTC_PORT_RANGE_MAX=12000
      - INSTANCE_ID=sfu-1
    volumes:
      - ./streaming-node/config.prod.yaml:/app/config.yaml:ro
      - ./streaming-node/logs:/app/logs
    depends_on:
      - redis
    networks:
      - videocall-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  sfu-2:
    build:
      context: ./streaming-node
      dockerfile: Dockerfile
    environment:
      - SERVER_ADDRESS=0.0.0.0
      - SERVER_PORT=8080
      - LOG_LEVEL=info
      - WEBRTC_PORT_RANGE_MIN=12001
      - WEBRTC_PORT_RANGE_MAX=14000
      - INSTANCE_ID=sfu-2
    volumes:
      - ./streaming-node/config.prod.yaml:/app/config.yaml:ro
      - ./streaming-node/logs:/app/logs
    depends_on:
      - redis
    networks:
      - videocall-network
    restart: unless-stopped

  # Load Balancer for SFU
  sfu-lb:
    image: nginx:alpine
    ports:
      - "8080:8080"
    volumes:
      - ./nginx.sfu.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - sfu-1
      - sfu-2
    networks:
      - videocall-network

  # Django Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    volumes:
      - static_volume:/app/staticfiles:ro
      - media_volume:/app/media:ro
      - ./backend/logs:/app/logs
    environment:
      - DEBUG=False
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=${POSTGRES_DB}
      - DB_USER=${POSTGRES_USER}
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_URL=redis://redis:6379/0
      - SFU_API_BASE_URL=http://sfu-lb:8080/api
      - SFU_WS_BASE_URL=ws://sfu-lb:8080/ws
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_HOSTS=${ALLOWED_HOSTS}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      sfu-lb:
        condition: service_healthy
    networks:
      - videocall-network
    restart: unless-stopped

  # Vue.js Frontend
  frontend:
    build:
      context: ./videocall-frontend
      dockerfile: Dockerfile.prod
    networks:
      - videocall-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - static_volume:/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      - backend
      - frontend
    networks:
      - videocall-network
    restart: unless-stopped

  # SSL Certificate Management
  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@example.com --agree-tos --no-eff-email -d videocall.example.com

volumes:
  prod_postgres_data:
  prod_redis_data:
  static_volume:
  media_volume:

networks:
  videocall-network:
    driver: bridge
```

#### 2. Production Environment Variables

**docker-compose.prod.env**
```bash
# Database
POSTGRES_DB=videocall_prod
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=your-secure-password

# Django
SECRET_KEY=your-production-secret-key
ALLOWED_HOSTS=videocall.example.com,www.videocall.example.com

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/videocall.example.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/videocall.example.com/privkey.pem
```

### SSL/TLS Configuration

#### 1. Let's Encrypt SSL Setup

```bash
# Install Certbot
sudo apt-get install certbot

# Generate SSL certificate
sudo certbot certonly --webroot --webroot-path=/var/www/certbot \
  --email admin@example.com --agree-tos --no-eff-email \
  -d videocall.example.com

# Auto-renewal (add to crontab)
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo tee -a /etc/crontab
```

#### 2. Nginx SSL Configuration

**nginx.prod.conf**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    upstream sfu {
        server sfu-lb:8080;
    }

    server {
        listen 80;
        server_name videocall.example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name videocall.example.com;

        ssl_certificate /etc/letsencrypt/live/videocall.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/videocall.example.com/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # WebRTC endpoints
        location /ws/ {
            proxy_pass http://sfu;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400;
        }

        # API endpoints
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location /staticfiles/ {
            alias /staticfiles/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Media files
        location /media/ {
            alias /app/media/;
            expires 1M;
            add_header Cache-Control "public";
        }
    }
}
```

### Monitoring and Logging

#### 1. Monitoring Stack

**docker-compose.monitoring.yml**
```yaml
version: '3.8'

services:
  # Prometheus for metrics collection
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - monitoring-network

  # Grafana for visualization
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    networks:
      - monitoring-network

  # Jaeger for distributed tracing
  jaeger:
    image: jaegertracing/all-in-one
    ports:
      - "16686:16686"
      - "14250:14250"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - monitoring-network

volumes:
  prometheus_data:
  grafana_data:

networks:
  monitoring-network:
    external: true
```

#### 2. Health Check Endpoints

**SFU Health Check**
```bash
curl http://localhost:8080/health
# Response: {"status": "healthy", "uptime": "1h30m", "rooms": 5, "participants": 15}
```

**Backend Health Check**
```bash
curl http://localhost:8000/api/health/
# Response: {"status": "healthy", "database": "connected", "redis": "connected"}
```

**Frontend Health Check**
```bash
curl http://localhost:3000/health
# Response: {"status": "healthy", "version": "1.0.0"}
```

### Database Migrations

#### 1. Initial Setup

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

#### 2. Production Migration Strategy

```bash
# Create backup before migration
docker-compose exec db pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > backup.sql

# Run migrations in zero-downtime manner
docker-compose exec backend python manage.py migrate --check  # Verify migrations
docker-compose exec backend python manage.py migrate          # Apply migrations
```

### Scaling Configuration

#### 1. Horizontal Scaling

**Auto-scaling with Docker Swarm**
```bash
# Initialize swarm
docker swarm init

# Deploy with scaling
docker-compose -f docker-compose.swarm.yml up -d

# Scale SFU instances
docker service scale videocall_sfu=5
```

#### 2. Load Balancing

**HAProxy Configuration**
```haproxy
frontend videocall_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/videocall.pem

    # WebSocket/SFU traffic
    acl is_websocket hdr(upgrade) -i websocket
    use_backend sfu_backend if is_websocket

    # API traffic
    acl is_api path_beg /api/
    use_backend backend_backend if is_api

    # Frontend traffic
    default_backend frontend_backend

backend sfu_backend
    balance roundrobin
    server sfu-1 sfu-1:8080 check
    server sfu-2 sfu-2:8080 check

backend backend_backend
    balance roundrobin
    server backend-1 backend-1:8000 check
    server backend-2 backend-2:8000 check

backend frontend_backend
    balance roundrobin
    server frontend-1 frontend-1:3000 check
    server frontend-2 frontend-2:3000 check
```

### Backup and Recovery

#### 1. Automated Backup

**backup-script.sh**
```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose exec -T db pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > ${BACKUP_DIR}/db_backup_${DATE}.sql

# Redis backup
docker-compose exec redis redis-cli SAVE
cp $(docker volume inspect videocall_redis | jq -r '.[0].Mountpoint')/dump.rdb ${BACKUP_DIR}/redis_backup_${DATE}.rdb

# Upload to cloud storage
aws s3 cp ${BACKUP_DIR}/db_backup_${DATE}.sql s3://videocall-backups/
aws s3 cp ${BACKUP_DIR}/redis_backup_${DATE}.rdb s3://videocall-backups/
```

#### 2. Recovery Procedures

**Database Recovery**
```bash
# Stop the application
docker-compose down

# Restore database
docker-compose up -d db
docker-compose exec -T db psql -U ${POSTGRES_USER} ${POSTGRES_DB} < backup.sql

# Start application
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### 1. WebRTC Connection Issues
```bash
# Check SFU logs
docker-compose logs sfu

# Test STUN/TURN servers
docker-compose exec sfu wget -q -O- https://api.ipify.org
```

#### 2. WebSocket Connection Issues
```bash
# Check backend WebSocket logs
docker-compose logs backend

# Test WebSocket endpoint
 websocat ws://localhost:8000/ws/room/test-room/
```

#### 3. SSL Certificate Issues
```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate
sudo certbot renew
```

### Performance Optimization

#### 1. SFU Optimization
```yaml
# SFU Configuration (config.prod.yaml)
webrtc:
  ice_servers:
    - urls: ["stun:stun.l.google.com:19302"]
    - urls: ["turn:your-turn-server.com:3478"]
      username: "user"
      credential: "pass"

server:
  max_rooms: 1000
  max_participants_per_room: 50
  rtp_port_range:
    min: 10000
    max: 20000

logging:
  level: "info"
  format: "json"
```

#### 2. Django Optimization
```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://redis:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}
```

## Security Considerations

### 1. Network Security
- Use internal networks for service communication
- Implement rate limiting
- Enable DDoS protection
- Use VPN for administrative access

### 2. Application Security
- Keep dependencies updated
- Implement proper authentication
- Use HTTPS for all communications
- Implement input validation and sanitization

### 3. Infrastructure Security
- Regular security updates
- Firewall configuration
- Log monitoring and alerting
- Backup encryption

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Monitor system metrics
4. Check health endpoints
5. Contact the development team

This deployment guide ensures a robust, scalable, and secure multi-user video call system.
