# Multi-User Video Call Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the multi-user video call functionality, covering unit tests, integration tests, end-to-end scenarios, performance testing, and deployment validation.

## Architecture Overview

The system consists of three main components:
- **Backend (Django)**: Room management, authentication, SFU communication
- **SFU (Go)**: Selective Forwarding Unit for WebRTC peer connections and stream routing
- **Frontend (Vue.js)**: Multi-user video call interface with participant grid

## 1. Testing Strategy

### 1.1 Unit Tests

#### 1.1.1 Go SFU Components

**Room Management (`streaming-node/sfu/room.go`)**
- Test room creation and lifecycle
- Test peer addition/removal
- Test track forwarding between peers
- Test room capacity limits
- Test concurrent peer operations
- Test room cleanup and resource management

**Peer Management (`streaming-node/sfu/peer.go`)**
- Test peer connection lifecycle
- Test RTP packet forwarding
- Test track addition/removal
- Test ICE connection state handling
- Test message sending mechanisms
- Test error handling and cleanup

**SFU Core (`streaming-node/sfu/sfu.go`)**
- Test SFU initialization and configuration
- Test multiple room management
- Test concurrent room operations
- Test resource cleanup and shutdown

#### 1.1.2 Django Backend Components

**SFU Client (`backend/apps/rooms/sfu_client.py`)**
- Test HTTP API communication with SFU
- Test retry logic and error handling
- Test room creation/deletion
- Test participant management
- Test timeout scenarios

**Room Models (`backend/apps/rooms/models.py`)**
- Test room creation and validation
- Test participant management
- Test room status tracking
- Test database constraints

### 1.2 Integration Tests

#### 1.2.1 Django + SFU Communication
- Test full room lifecycle (create → join → leave → delete)
- Test participant management across both systems
- Test WebSocket signaling through Django to SFU
- Test error propagation and recovery
- Test concurrent room operations

#### 1.2.2 Frontend + Backend Integration
- Test WebSocket connection establishment
- Test room joining and participant synchronization
- Test media permission handling
- Test connection state management
- Test error recovery and reconnection

### 1.3 End-to-End Tests

#### 1.3.1 Multi-User Scenarios
- **2 Users**: Basic video call functionality
- **5 Users**: Medium-scale multi-user call
- **10 Users**: Large-scale multi-user call
- **Dynamic Join/Leave**: Users joining and leaving during active calls

#### 1.3.2 Media Stream Scenarios
- Audio-only calls
- Video-only calls
- Audio + Video calls
- Screen sharing integration
- Muted/unmuted state synchronization
- Camera on/off state synchronization

### 1.4 Performance Tests

#### 1.4.1 Load Testing
- Concurrent room creation (100+ rooms)
- Peer connection establishment under load
- RTP packet forwarding performance
- Memory usage under sustained load
- CPU usage during multi-user calls

#### 1.4.2 Stress Testing
- Maximum concurrent users per room
- Maximum rooms per SFU instance
- Network bandwidth utilization
- Memory leak detection
- Resource cleanup verification

#### 1.4.3 Scalability Testing
- Horizontal scaling of SFU instances
- Load balancer performance
- Database performance under load
- Redis caching effectiveness

## 2. Testing Tools and Infrastructure

### 2.1 Test Environment Setup

#### 2.1.1 Docker Compose Test Environment
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: videocall_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password

  test-redis:
    image: redis:7-alpine

  test-sfu:
    build: ./streaming-node
    environment:
      SERVER_PORT: 8080
      LOG_LEVEL: debug

  test-backend:
    build: ./backend
    environment:
      DEBUG: True
      DB_HOST: test-db
      REDIS_URL: redis://test-redis:6379/0

  test-frontend:
    build: ./videocall-frontend
    environment:
      VITE_API_BASE_URL: http://test-backend:8000
```

#### 2.1.2 Test Data Management
- Automated test database seeding
- Realistic test participant data
- Media stream simulation data
- Network condition simulation

### 2.2 Testing Tools

#### 2.2.1 Unit Testing Frameworks
- **Go**: `testing` package + `testify` for assertions
- **Python**: `unittest` + `pytest` + `pytest-django`
- **JavaScript**: `Jest` + `Vue Test Utils`

#### 2.2.2 Integration Testing Tools
- **WebRTC Testing**: `pion/webrtc` test utilities
- **API Testing**: `Postman` + `Newman` for API automation
- **E2E Testing**: `Playwright` for browser automation

#### 2.2.3 Performance Testing Tools
- **Load Testing**: `k6` for HTTP/WebSocket load testing
- **Browser Automation**: `Puppeteer` for multi-user simulation
- **Network Simulation**: `tc` (Traffic Control) for network conditions

#### 2.2.4 Monitoring and Observability
- **Metrics Collection**: `Prometheus` + `Grafana`
- **Distributed Tracing**: `Jaeger`
- **Log Aggregation**: `ELK Stack` (Elasticsearch, Logstash, Kibana)

## 3. Test Scenarios and Cases

### 3.1 Unit Test Cases

#### 3.1.1 Room Management Tests
```go
func TestRoomCreation(t *testing.T) {
    sfu := NewSFU(config)
    room, err := sfu.CreateRoom("test-room")
    assert.NoError(t, err)
    assert.Equal(t, "test-room", room.ID())
}

func TestPeerAddition(t *testing.T) {
    room := NewRoom("test-room", api, config, logger)
    peerConn := createMockPeerConnection()
    peer, err := room.AddPeer("peer-1", peerConn)
    assert.NoError(t, err)
    assert.Equal(t, 1, room.GetPeerCount())
}
```

#### 3.1.2 SFU Client Tests
```python
def test_create_room(self):
    client = SFUClient()
    response = client.create_room("test-room-123")
    self.assertTrue(response['success'])
    self.assertEqual(response['room_id'], "test-room-123")

def test_add_participant(self):
    client = SFUClient()
    response = client.add_participant("test-room-123", "user-456")
    self.assertTrue(response['success'])
```

### 3.2 Integration Test Cases

#### 3.2.1 Full Room Lifecycle
```python
def test_full_room_lifecycle(self):
    # Create room through Django
    room = Room.objects.create(code="TEST123")

    # Connect to SFU
    sfu_client = SFUClient()
    sfu_response = sfu_client.create_room(room.id)

    # Join with multiple users
    for i in range(5):
        participant = RoomParticipant.objects.create(
            room=room,
            user_id=f"user-{i}",
            status="active"
        )
        sfu_client.add_participant(room.id, participant.user_id)

    # Verify all participants are connected
    stats = sfu_client.get_room_stats(room.id)
    self.assertEqual(stats['participant_count'], 5)

    # Clean shutdown
    sfu_client.delete_room(room.id)
```

### 3.3 End-to-End Test Scenarios

#### 3.3.1 Multi-User Video Call (5 Users)
```javascript
// Test scenario using Playwright
test('5-user video call', async ({ browser }) => {
  // Create 5 browser contexts
  const contexts = await Promise.all(
    Array(5).fill().map(() => browser.newContext())
  );

  const pages = await Promise.all(
    contexts.map(context => context.newPage())
  );

  // Navigate all users to join the same room
  const roomCode = 'TEST123';
  await Promise.all(
    pages.map(page => page.goto(`/join/${roomCode}`))
  );

  // Wait for all users to connect
  await Promise.all(
    pages.map(page =>
      page.waitForSelector('[data-testid="participant-grid"]')
    )
  );

  // Verify all participants see each other
  for (const page of pages) {
    await page.waitForSelector('[data-testid="participant-count"]');
    const count = await page.textContent('[data-testid="participant-count"]');
    expect(count).toBe('5');
  }

  // Test media controls
  await pages[0].click('[data-testid="mute-button"]');
  await pages[1].waitForSelector('[data-testid="participant-muted"]');

  // Clean up
  await Promise.all(contexts.map(context => context.close()));
});
```

### 3.4 Performance Test Scenarios

#### 3.4.1 Load Testing with k6
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
};

export default function () {
  // Simulate user joining a room
  const response = http.post('http://localhost:8000/api/rooms/', {
    max_participants: 10
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'room created': (r) => r.json().success === true,
  });

  sleep(1);
}
```

#### 3.4.2 Network Condition Simulation
```bash
#!/bin/bash
# Simulate poor network conditions
tc qdisc add dev eth0 root netem delay 100ms 20ms loss 2% duplicate 1%
```

## 4. Quality Gates and Metrics

### 4.1 Success Criteria

#### 4.1.1 Functional Requirements
- [ ] All unit tests pass (>95% coverage)
- [ ] All integration tests pass
- [ ] E2E tests pass for 2, 5, and 10 user scenarios
- [ ] Performance benchmarks meet requirements

#### 4.1.2 Performance Requirements
- [ ] Room creation < 100ms
- [ ] Peer connection establishment < 2s
- [ ] Video stream forwarding latency < 50ms
- [ ] CPU usage < 70% under normal load
- [ ] Memory usage stable under sustained load

#### 4.1.3 Reliability Requirements
- [ ] 99.9% uptime for SFU service
- [ ] Automatic recovery from network failures
- [ ] Graceful degradation under high load
- [ ] Proper resource cleanup

### 4.2 Key Metrics

#### 4.2.1 System Metrics
- Room creation rate
- Peer connection success rate
- Video stream quality (resolution, fps, bitrate)
- Audio quality metrics
- Connection establishment time

#### 4.2.2 Performance Metrics
- CPU utilization per room
- Memory usage per peer
- Network bandwidth utilization
- Packet loss rate
- Round-trip time (RTT)

#### 4.2.3 Quality Metrics
- Video frame rate stability
- Audio latency
- Connection quality score
- User experience ratings

## 5. Test Data and Environment

### 5.1 Test Data Requirements

#### 5.1.1 Realistic Test Data
- User profiles with various devices
- Different network conditions
- Various media codecs and resolutions
- Realistic call patterns and durations

#### 5.1.2 Edge Cases
- Maximum room capacity scenarios
- Network interruption scenarios
- Device capability variations
- Concurrent operation scenarios

### 5.2 Environment Configuration

#### 5.2.1 Development Environment
```yaml
# .env.test
DEBUG=True
DB_HOST=localhost
REDIS_URL=redis://localhost:6379/1
SFU_API_BASE_URL=http://localhost:8080/api
LOG_LEVEL=DEBUG
```

#### 5.2.2 CI/CD Environment
```yaml
# .env.ci
DEBUG=False
DB_HOST=test-db
REDIS_URL=redis://test-redis:6379/0
SFU_API_BASE_URL=http://test-sfu:8080/api
LOG_LEVEL=WARN
```

## 6. Monitoring and Reporting

### 6.1 Test Reporting
- Automated test result aggregation
- Performance benchmark tracking
- Coverage report generation
- Trend analysis and reporting

### 6.2 Continuous Monitoring
- Real-time system health monitoring
- Performance metric collection
- Error rate tracking
- User experience monitoring

### 6.3 Alerting
- Test failure notifications
- Performance degradation alerts
- System health alerts
- Security incident alerts

This testing strategy ensures comprehensive coverage of the multi-user video call functionality while maintaining high quality and performance standards.