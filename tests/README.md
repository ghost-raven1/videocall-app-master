# Load Testing Infrastructure

This directory contains comprehensive load testing infrastructure for the Video Call Application, supporting 100+ concurrent users across all system components.

## 🎯 Overview

The load testing suite includes:
- **HTTP/WebSocket Load Testing**: Artillery and custom Node.js scripts
- **Browser-based Testing**: Enhanced Puppeteer multi-user simulation
- **SFU Stress Testing**: WebRTC media streaming load tests
- **Database Performance Testing**: Concurrent database operations
- **Monitoring & Metrics**: Prometheus and Grafana integration
- **Automated Orchestration**: Comprehensive test runner scripts

## 📁 Directory Structure

```
tests/
├── README.md                    # This file
├── run-load-tests.sh           # Main test orchestration script
├── multi-user-test.js          # Enhanced browser-based testing (existing)
├── load-test-config.yml        # Artillery HTTP/WebSocket configuration
├── websocket-load-test.js      # Custom WebSocket load testing
├── monitoring/                 # Monitoring infrastructure
│   ├── prometheus.yml          # Prometheus configuration
│   └── grafana-dashboard.json  # Grafana dashboard configuration
├── docker-compose.test.yml     # Test environment with monitoring
├── Dockerfile.loadtest         # Load testing container
└── Dockerfile.puppeteer        # Browser testing container
```

## 🚀 Quick Start

### 1. Start Test Infrastructure

```bash
# Start all services with monitoring
./tests/run-load-tests.sh monitoring-setup

# Or manually start test environment
docker-compose -f tests/docker-compose.test.yml up -d
```

### 2. Run Load Tests

```bash
# Run all tests (comprehensive)
./tests/run-load-tests.sh all

# Run specific test types
./tests/run-load-tests.sh http-load-test
./tests/run-load-tests.sh websocket-load-test
./tests/run-load-tests.sh browser-load-test
./tests/run-load-tests.sh database-load-test
./tests/run-load-tests.sh sfu-load-test

# Custom parameters
CONCURRENT_USERS=150 TEST_DURATION=600 ./tests/run-load-tests.sh websocket-load-test
```

### 3. Monitor Tests in Real-time

- **Grafana Dashboard**: http://localhost:3000 (admin/admin)
- **Prometheus Metrics**: http://localhost:9090

## 🛠️ Test Types

### HTTP/WebSocket Load Testing (Artillery)

Tests HTTP APIs and WebSocket signaling with realistic user behavior patterns.

**Features:**
- 7 different test scenarios (room management, signaling, admin, etc.)
- Configurable load phases (ramp-up, sustained load, spike testing)
- WebSocket subprotocol support
- Realistic message flows

**Usage:**
```bash
docker-compose -f tests/docker-compose.test.yml run --rm artillery \
    run tests/load-test-config.yml
```

### WebSocket Load Testing (Custom)

Advanced WebSocket signaling load testing with detailed metrics.

**Features:**
- 100+ concurrent WebSocket connections
- Multiple scenario types (room lifecycle, WebRTC signaling, admin monitoring)
- Real-time metrics and reporting
- Message latency tracking

**Usage:**
```bash
node tests/websocket-load-test.js \
    --concurrentUsers 100 \
    --testDuration 300000 \
    --backendUrl "ws://localhost:8000"
```

### Browser-based Multi-user Testing

Enhanced Puppeteer testing for realistic browser scenarios.

**Features:**
- Multi-browser instances simulation
- Real WebRTC media stream handling
- Audio/video control testing
- Screen sharing simulation
- Participant dynamics testing

**Usage:**
```bash
node tests/multi-user-test.js \
    --usersPerRoom 50 \
    --testDuration 120000 \
    --frontendUrl "http://localhost:3000"
```

### Database Load Testing

PostgreSQL performance testing with concurrent operations.

**Features:**
- Concurrent connection testing (50+ connections)
- Complex analytical queries
- Bulk insert/update operations
- Connection pool stress testing

### SFU Stress Testing

Go SFU server stress testing for WebRTC media streaming.

**Features:**
- Multiple room/peer scenarios
- RTP packet simulation
- Concurrent peer connection testing
- Media stream forwarding validation

## 📊 Monitoring & Metrics

### Prometheus Integration

- **System Metrics**: CPU, memory, disk usage
- **Application Metrics**: Request rates, response times, error rates
- **SFU Metrics**: Active rooms, peers, RTP packets
- **Database Metrics**: Connection counts, query performance

### Grafana Dashboard

Pre-configured dashboard with:
- Real-time connection metrics
- Performance trends and alerts
- System resource utilization
- Custom application metrics

## 🔧 Configuration

### Environment Variables

```bash
# Test parameters
CONCURRENT_USERS=100          # Number of concurrent users
TEST_DURATION=300             # Test duration in seconds
RAMP_UP_TIME=60               # Ramp-up time in seconds

# Infrastructure settings
BACKEND_URL=ws://localhost:8000
SFU_URL=ws://localhost:8080
FRONTEND_URL=http://localhost:3000

# Reporting
REPORT_DIR=./reports
```

### Artillery Configuration

Edit `tests/load-test-config.yml` to customize:
- Load phases and timing
- Request scenarios and weights
- WebSocket message flows
- Target endpoints

## 📈 Performance Targets

The testing infrastructure validates against these targets:

### Connection Performance
- **Room Creation**: < 100ms
- **Peer Connection**: < 2s
- **Message Latency**: < 50ms
- **Success Rate**: > 95%

### System Resources
- **CPU Usage**: < 70% under normal load
- **Memory Usage**: Stable under sustained load
- **Database Connections**: < 80% of max pool size

### Scalability
- **Concurrent Rooms**: 100+ rooms
- **Concurrent Users**: 1000+ users
- **RTP Throughput**: 1000+ packets/sec per room

## 🚨 Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check service health
   docker-compose -f tests/docker-compose.test.yml ps

   # View service logs
   docker-compose -f tests/docker-compose.test.yml logs [service-name]
   ```

2. **Port conflicts**
   ```bash
   # Check port usage
   netstat -tuln | grep -E '(3000|9090|8000|8080)'

   # Modify port mappings in docker-compose.test.yml
   ```

3. **Memory issues with many concurrent users**
   ```bash
   # Increase Docker memory limit
   # Edit Docker Desktop settings or add to docker-compose.test.yml:
   deploy:
     resources:
       limits:
         memory: 4G
   ```

4. **Database connection errors**
   ```bash
   # Check database connectivity
   docker-compose -f tests/docker-compose.test.yml exec test-db pg_isready -U test_user

   # Reset test database
   docker-compose -f tests/docker-compose.test.yml down -v
   docker-compose -f tests/docker-compose.test.yml up -d test-db
   ```

### Debug Mode

For detailed debugging, run tests with additional logging:

```bash
DEBUG=* ./tests/run-load-tests.sh websocket-load-test
```

## 📋 Test Reports

Reports are generated in `./reports/load_test_YYYYMMDD_HHMMSS/`:

- **HTML Report**: `report.html` - Visual summary with charts
- **JSON Metrics**: Artillery and custom test metrics
- **Log Files**: Detailed execution logs
- **Screenshots**: Browser test screenshots (if enabled)

## 🔄 CI/CD Integration

Integrate load testing into your CI/CD pipeline:

```bash
#!/bin/bash
# Example GitHub Actions step

- name: Run Load Tests
  run: |
    ./tests/run-load-tests.sh all
    # Upload reports as artifacts
    # Fail build if performance targets not met
```

## 🎛️ Advanced Usage

### Custom Test Scenarios

Add new scenarios to `tests/load-test-config.yml`:

```yaml
- name: "Custom Scenario"
  weight: 10
  flow:
    - get:
        url: "/api/custom-endpoint"
```

### Custom Metrics

Add custom metrics to your application:

```python
# Django example
from prometheus_client import Counter, Histogram

requests_total = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')
```

### Network Simulation

Simulate network conditions:

```bash
# Add latency and packet loss
tc qdisc add dev eth0 root netem delay 100ms 20ms loss 2%
```

## 📚 Related Documentation

- [TESTING_STRATEGY.md](../docs/TESTING_STRATEGY.md) - Comprehensive testing strategy
- [DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) - Deployment instructions
- [TROUBLESHOOTING_GUIDE.md](../docs/TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

---

**🎯 Ready for Production Load Testing!**

The testing infrastructure is now configured for comprehensive performance validation with 100+ concurrent users across all system components.