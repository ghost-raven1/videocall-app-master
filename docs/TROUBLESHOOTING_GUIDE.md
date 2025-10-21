# Multi-User Video Call Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered during deployment, testing, and operation of the multi-user video call system. Issues are organized by component and severity.

## Quick Diagnostic Commands

### 1. System Health Check

```bash
# Check all services status
docker-compose ps

# Check service logs
docker-compose logs sfu
docker-compose logs backend
docker-compose logs frontend

# Check health endpoints
curl http://localhost:8080/health      # SFU
curl http://localhost:8000/api/health/  # Backend
curl http://localhost:3000/health       # Frontend
```

### 2. Network Connectivity

```bash
# Test WebRTC port availability
netstat -tuln | grep :808

# Test WebSocket connectivity
websocat ws://localhost:8000/ws/test/

# Check firewall settings
sudo ufw status
```

## Component-Specific Issues

### 1. Go SFU Server Issues

#### 1.1 SFU Server Won't Start

**Symptoms:**
- `docker-compose logs sfu` shows startup errors
- Port 8080 not accessible
- Health check fails

**Diagnosis:**
```bash
# Check SFU logs for detailed errors
docker-compose logs sfu

# Verify configuration file exists
docker-compose exec sfu ls -la /app/config.yaml

# Check if port is already in use
netstat -tuln | grep :8080
```

**Solutions:**

1. **Configuration Issues:**
```bash
# Validate config file syntax
docker-compose exec sfu cat /app/config.yaml

# Check for missing required fields
# Ensure ICE servers are configured
# Verify port ranges are valid
```

2. **Port Conflicts:**
```bash
# Find process using port 8080
sudo lsof -i :8080

# Kill conflicting process
sudo kill -9 <PID>

# Or change SFU port in docker-compose.yml
```

3. **Resource Issues:**
```bash
# Check available memory
free -h

# Check disk space
df -h

# Increase Docker memory limits if needed
```

#### 1.2 WebRTC Connection Failures

**Symptoms:**
- Users can't establish peer connections
- ICE connection state stuck in "connecting"
- No video/audio streams

**Diagnosis:**
```bash
# Check SFU WebRTC logs
docker-compose logs sfu | grep -i webrtc

# Monitor ICE connection states
curl http://localhost:8080/api/rooms/{room-id}/stats

# Test STUN/TURN servers
telnet stun.l.google.com 19302
```

**Solutions:**

1. **ICE Server Configuration:**
```yaml
# Update config.yaml with working ICE servers
webrtc:
  ice_servers:
    - urls: ["stun:stun.l.google.com:19302"]
    - urls: ["stun:stun1.l.google.com:19302"]
    - urls: ["turn:your-turn-server.com:3478"]
      username: "your-username"
      credential: "your-password"
```

2. **Firewall and Network:**
```bash
# Open required ports
sudo ufw allow 8080:8100/udp
sudo ufw allow 8080:8100/tcp

# Enable IP forwarding for Docker
sudo sysctl net.ipv4.ip_forward=1
```

3. **Docker Network Issues:**
```bash
# Recreate Docker network
docker-compose down
docker network rm videocall-network
docker-compose up -d
```

#### 1.3 High CPU/Memory Usage

**Symptoms:**
- SFU consuming excessive resources
- Video streams lagging or dropping
- System becoming unresponsive

**Diagnosis:**
```bash
# Monitor SFU resource usage
docker stats

# Check for memory leaks
docker-compose logs sfu | grep -i memory

# Monitor room/peer counts
curl http://localhost:8080/api/stats
```

**Solutions:**

1. **Resource Limits:**
```yaml
# Add resource limits in docker-compose.yml
sfu:
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.0'
      reservations:
        memory: 1G
        cpus: '0.5'
```

2. **Room Management:**
```bash
# Monitor and clean up inactive rooms
curl -X DELETE http://localhost:8080/api/rooms/{room-id}

# Set room timeouts in config
room:
  max_idle_time: 300  # 5 minutes
  cleanup_interval: 60  # 1 minute
```

### 2. Django Backend Issues

#### 2.1 Database Connection Issues

**Symptoms:**
- Backend fails to start
- "Connection refused" errors
- Database migrations failing

**Diagnosis:**
```bash
# Check database container status
docker-compose ps db

# Test database connectivity
docker-compose exec backend python manage.py dbshell

# Check database logs
docker-compose logs db
```

**Solutions:**

1. **Database Not Ready:**
```bash
# Wait for database to be healthy
docker-compose up -d db
sleep 30
docker-compose up -d backend
```

2. **Connection Parameters:**
```python
# Verify DATABASES settings in settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'videocall_dev'),
        'USER': os.getenv('DB_USER', 'dev_user'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'db'),
        'PORT': int(os.getenv('DB_PORT', 5432)),
        'CONN_MAX_AGE': 60,
    }
}
```

3. **Database Corruption:**
```bash
# Backup current database
docker-compose exec db pg_dump -U ${DB_USER} ${DB_NAME} > backup.sql

# Drop and recreate database
docker-compose down db
docker volume rm videocall_postgres_data
docker-compose up -d db
```

#### 2.2 WebSocket Connection Issues

**Symptoms:**
- Frontend can't connect to backend WebSocket
- Real-time features not working
- Signaling messages not received

**Diagnosis:**
```bash
# Check Daphne/WebSocket logs
docker-compose logs backend

# Test WebSocket endpoint
websocat ws://localhost:8000/ws/test-room/

# Check ASGI configuration
docker-compose exec backend python manage.py check --deploy
```

**Solutions:**

1. **ASGI Configuration:**
```python
# Verify ASGI settings in settings.py
ASGI_APPLICATION = 'videocall_app.asgi.application'

# Check routing configuration
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/<room_code>/', consumers.VideoCallConsumer.as_asgi()),
]
```

2. **Daphne Server Issues:**
```bash
# Check Daphne process
docker-compose exec backend ps aux | grep daphne

# Restart Daphne server
docker-compose restart backend
```

3. **CORS Issues:**
```python
# Update CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True
```

#### 2.3 SFU Communication Issues

**Symptoms:**
- Backend can't communicate with SFU server
- Room creation fails
- Participant management not working

**Diagnosis:**
```bash
# Test SFU API connectivity
curl http://localhost:8080/api/health

# Check SFU client configuration
docker-compose exec backend python manage.py shell
>>> from apps.rooms.sfu_client import SFUClient
>>> client = SFUClient()
>>> client.health_check()
```

**Solutions:**

1. **SFU Server Unavailable:**
```bash
# Check SFU container status
docker-compose ps sfu

# Restart SFU server
docker-compose restart sfu

# Check SFU logs for errors
docker-compose logs sfu
```

2. **Network Configuration:**
```python
# Update SFU client settings in settings.py
SFU_API_BASE_URL = os.getenv('SFU_API_BASE_URL', 'http://sfu:8080/api')
SFU_WS_BASE_URL = os.getenv('SFU_WS_BASE_URL', 'ws://sfu:8080/ws')
```

3. **Timeout Issues:**
```python
# Adjust timeout settings in SFUClient
class SFUClient:
    def __init__(self):
        self.timeout = 30  # Increase timeout
```

### 3. Frontend Issues

#### 3.1 Media Device Access Issues

**Symptoms:**
- Camera/microphone not accessible
- "Permission denied" errors
- Black video screens

**Diagnosis:**
```bash
# Check browser console for media errors
# In browser dev tools, check console logs

# Test media permissions
navigator.permissions.query({name:'camera'})
navigator.permissions.query({name:'microphone'})
```

**Solutions:**

1. **HTTPS Requirement:**
```javascript
// Ensure HTTPS in production
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
```

2. **Media Constraints:**
```javascript
// Use appropriate media constraints
const constraints = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};
```

3. **Fallback Handling:**
```javascript
// Handle media access failures gracefully
try {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // Show user-friendly permission message
  } else if (error.name === 'NotFoundError') {
    // No camera/microphone found
  }
}
```

#### 3.2 WebRTC Connection Issues

**Symptoms:**
- Can't connect to other users
- Video streams not appearing
- Connection drops frequently

**Diagnosis:**
```bash
# Check WebRTC statistics
# In browser console:
console.log(pc.getStats());

// Monitor connection state changes
pc.onconnectionstatechange = () => {
  console.log('Connection state:', pc.connectionState);
};
```

**Solutions:**

1. **ICE Candidate Issues:**
```javascript
// Ensure proper ICE candidate handling
pc.onicecandidate = (event) => {
  if (event.candidate) {
    // Send candidate to remote peer
    signalingChannel.send({ type: 'candidate', candidate: event.candidate });
  }
};
```

2. **Network Configuration:**
```javascript
// Configure appropriate STUN/TURN servers
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
```

3. **Connection Monitoring:**
```javascript
// Monitor connection health
setInterval(() => {
  if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
    // Attempt reconnection
    reconnect();
  }
}, 5000);
```

### 4. Docker and Infrastructure Issues

#### 4.1 Docker Compose Issues

**Symptoms:**
- Services fail to start
- Volume mounting issues
- Network connectivity problems

**Diagnosis:**
```bash
# Check Docker Compose version
docker-compose --version

# Validate compose file syntax
docker-compose config

# Check service dependencies
docker-compose exec backend nslookup db
```

**Solutions:**

1. **Service Dependencies:**
```yaml
# Ensure proper service dependencies
backend:
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy
    sfu:
      condition: service_healthy
```

2. **Volume Issues:**
```bash
# Clean up Docker volumes
docker system prune -a --volumes

# Recreate specific volumes
docker volume rm videocall_postgres_data
docker-compose up -d db
```

3. **Network Issues:**
```bash
# Recreate Docker network
docker-compose down
docker network rm videocall-network 2>/dev/null || true
docker-compose up -d
```

#### 4.2 SSL Certificate Issues

**Symptoms:**
- HTTPS certificate errors
- Mixed content warnings
- WebRTC failing on HTTPS sites

**Diagnosis:**
```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
curl -I https://your-domain.com

# Check Nginx SSL configuration
sudo nginx -t
```

**Solutions:**

1. **Certificate Renewal:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Force renewal if needed
sudo certbot renew --force-renewal
```

2. **Nginx SSL Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name videocall.example.com;

    ssl_certificate /etc/letsencrypt/live/videocall.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/videocall.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
}
```

3. **Mixed Content Issues:**
```javascript
// Ensure all resources use HTTPS
const wsUrl = window.location.protocol === 'https:'
  ? `wss://${window.location.host}/ws/`
  : `ws://${window.location.host}/ws/`;
```

## Performance Issues

### 1. High Latency

**Symptoms:**
- Delayed video/audio
- Poor call quality
- Connection drops

**Diagnosis:**
```bash
# Monitor network latency
ping -c 10 google.com

# Check SFU performance metrics
curl http://localhost:8080/api/stats

# Monitor system resources
htop
```

**Solutions:**

1. **Network Optimization:**
```bash
# Optimize kernel networking
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
sudo sysctl -w net.core.netdev_max_backlog=5000
```

2. **SFU Tuning:**
```yaml
# Optimize SFU configuration
webrtc:
  rtp:
    buffer_size: 1048576  # 1MB buffer
    packet_queue_size: 1000

server:
  read_timeout: 30
  write_timeout: 30
```

### 2. Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- System slowdowns
- Out of memory errors

**Diagnosis:**
```bash
# Monitor memory usage over time
while true; do ps aux | grep sfu; sleep 60; done

# Check for memory leaks in logs
docker-compose logs sfu | grep -i leak

# Monitor garbage collection
curl http://localhost:8080/debug/gc
```

**Solutions:**

1. **Resource Limits:**
```yaml
# Set appropriate resource limits
sfu:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 1G
```

2. **Connection Cleanup:**
```bash
# Monitor and cleanup inactive connections
curl -X POST http://localhost:8080/api/admin/cleanup

# Set connection timeouts
room:
  peer_timeout: 300  # 5 minutes
  cleanup_interval: 60
```

## Debugging Tools

### 1. WebRTC Debugging

**Browser Console Commands:**
```javascript
// Get peer connection stats
const stats = await pc.getStats();
stats.forEach(report => {
  if (report.type === 'inbound-rtp') {
    console.log('Inbound RTP:', report);
  }
});

// Monitor connection state
pc.onconnectionstatechange = () => {
  console.log('Connection state changed:', pc.connectionState);
};

// Check ICE candidates
pc.onicecandidate = (event) => {
  console.log('ICE candidate:', event.candidate);
};
```

### 2. Network Debugging

**WebRTC Network Test:**
```bash
# Test WebRTC connectivity
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

# Test STUN server
telnet stun.l.google.com 19302

# Monitor network traffic
sudo tcpdump -i any port 8080 -w capture.pcap
```

### 3. Log Analysis

**Centralized Logging Setup:**
```yaml
# ELK Stack for log aggregation
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:7.15.0
    # ... configuration

  logstash:
    image: logstash:7.15.0
    # ... configuration

  kibana:
    image: kibana:7.15.0
    # ... configuration
```

## Common Error Messages

### 1. "Room not found"

**Cause:** SFU room doesn't exist or expired
**Solution:**
```bash
# Check if room exists in SFU
curl http://localhost:8080/api/rooms/{room-id}

# Recreate room if needed
curl -X POST http://localhost:8080/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"room_id": "room-id", "max_participants": 10}'
```

### 2. "ICE connection failed"

**Cause:** WebRTC can't establish connection
**Solution:**
```bash
# Check ICE servers
curl http://localhost:8080/api/health

# Verify network configuration
ip route show

# Test with different STUN servers
```

### 3. "Permission denied (microphone)"

**Cause:** Browser media permissions not granted
**Solution:**
```javascript
// Request permissions properly
const permissions = await Promise.all([
  navigator.permissions.query({ name: 'camera' }),
  navigator.permissions.query({ name: 'microphone' })
]);

// Handle permission states
permissions.forEach(permission => {
  if (permission.state === 'denied') {
    // Show permission instructions
  }
});
```

## Emergency Procedures

### 1. System Recovery

```bash
# Emergency stop all services
docker-compose down

# Backup current state
cp -r /path/to/volumes /backup/$(date +%Y%m%d_%H%M%S)

# Restart core services
docker-compose up -d db redis sfu

# Run health checks
curl http://localhost:8080/health
curl http://localhost:8000/api/health/
```

### 2. Data Recovery

```bash
# Restore from backup
docker-compose down
docker volume restore videocall_postgres_data backup.sql
docker-compose up -d

# Verify data integrity
docker-compose exec backend python manage.py check
```

## Getting Help

### 1. Log Collection

```bash
# Collect all relevant logs
mkdir -p logs
docker-compose logs sfu > logs/sfu.log
docker-compose logs backend > logs/backend.log
docker-compose logs frontend > logs/frontend.log
docker-compose logs nginx > logs/nginx.log

# Create system information report
{
  echo "=== System Info ==="
  uname -a
  echo "=== Docker Info ==="
  docker --version
  docker-compose --version
  echo "=== Service Status ==="
  docker-compose ps
  echo "=== Resource Usage ==="
  docker stats --no-stream
} > logs/system_info.txt
```

### 2. Support Checklist

Before contacting support, ensure you have:

- [ ] Complete error logs
- [ ] System information report
- [ ] Steps to reproduce the issue
- [ ] Expected vs actual behavior
- [ ] Recent changes that might have caused the issue
- [ ] Health check results
- [ ] Network connectivity test results

## Prevention

### 1. Monitoring Setup

```bash
# Set up monitoring alerts
curl -X POST http://localhost:9090/api/v1/rules \
  -H 'Content-Type: application/yaml' \
  -d 'groups:
  - name: videocall
    rules:
    - alert: SFUDown
      expr: up{job="sfu"} == 0
      for: 5m
    - alert: HighMemoryUsage
      expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
      for: 10m'
```

### 2. Regular Maintenance

```bash
# Weekly maintenance script
#!/bin/bash
# Clean up Docker resources
docker system prune -f

# Update containers
docker-compose pull
docker-compose up -d

# Check for security updates
sudo apt update && sudo apt upgrade -y

# Rotate logs
find /var/log -name "*.log" -size +100M -exec truncate -s 0 {} \;
```

This troubleshooting guide should help resolve most common issues with the multi-user video call system. For complex issues, please contact the development team with the collected diagnostic information.