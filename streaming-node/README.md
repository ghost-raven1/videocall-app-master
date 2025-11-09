# Streaming Node (WebRTC SFU Server)

A high-performance Selective Forwarding Unit (SFU) server built in Go for handling multiple WebRTC participants in video calling applications.

## Features

### Core Features
- **WebRTC Peer Management** - Handle multiple peer connections simultaneously
- **Stream Routing** - Forward appropriate streams to each participant based on subscription
- **Room Management** - Support multiple video call rooms with participant tracking
- **Bandwidth Optimization** - Efficient stream forwarding and quality adaptation
- **WebSocket Signaling** - Real-time signaling for WebRTC coordination

### Technical Capabilities
- **Pion WebRTC Integration** - Built using the robust Pion WebRTC library for Go
- **HTTP API** - RESTful API for room management and participant coordination
- **Quality Adaptation** - Dynamic bitrate and quality adjustment based on network conditions
- **Docker Support** - Containerized deployment with multi-stage builds
- **Django Integration** - WebSocket-based integration with Django backend for room events

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Django        │    │   Streaming     │    │   WebRTC        │
│   Backend       │◄──►│   Node (SFU)    │◄──►│   Clients       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Room & Peer   │
                       │   Management    │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Stream        │
                       │   Forwarding    │
                       └─────────────────┘
```

## Project Structure

```
streaming-node/
├── main.go                 # Main server entry point
├── server/
│   └── server.go          # HTTP/WebSocket server implementation
├── sfu/
│   ├── sfu.go             # Core SFU logic with Pion WebRTC
│   ├── room.go            # Room management system
│   ├── peer.go            # Peer connection handling
│   ├── stream.go          # Stream management and forwarding
│   └── quality.go         # Quality adaptation and bandwidth optimization
├── config/
│   └── config.go          # Configuration management
├── django_client.go       # Django WebSocket integration
├── go.mod                 # Go module definition
├── Dockerfile             # Container definition
└── README.md              # This file
```

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd streaming-node
   ```

2. **Configure the server:**
   Edit `config.yaml` to match your requirements:
   ```yaml
   server:
     address: "0.0.0.0"
     port: 8080

   django:
     url: "your-django-backend:8000"
   ```

3. **Start the server:**
   ```bash
   docker-compose up -d
   ```

4. **Check server health:**
   ```bash
   curl http://localhost:8080/health
   ```

### Manual Installation

1. **Prerequisites:**
   - Go 1.21 or later
   - Make sure Go modules are enabled

2. **Install dependencies:**
   ```bash
   go mod download
   ```

3. **Configure the server:**
   ```bash
   cp config.yaml config_local.yaml
   # Edit config_local.yaml as needed
   ```

4. **Run the server:**
   ```bash
   go run . --config config_local.yaml
   ```

## Configuration

The server can be configured via `config.yaml` or environment variables:

### Server Configuration
- `SERVER_PORT` - Server port (default: 8080)
- `SERVER_ADDRESS` - Bind address (default: "0.0.0.0")
- `SERVER_READ_TIMEOUT` - HTTP read timeout (default: "10s")
- `SERVER_WRITE_TIMEOUT` - HTTP write timeout (default: "10s")

### WebRTC Configuration
- `WEBRTC_MAX_BITRATE` - Maximum bitrate (default: 5000000)
- `WEBRTC_MIN_BITRATE` - Minimum bitrate (default: 100000)
- `WEBRTC_DEFAULT_BITRATE` - Default bitrate (default: 1000000)

### Django Integration
- `DJANGO_URL` - Django backend URL (default: "backend:8000")
- `DJANGO_RECONNECT_INTERVAL` - Reconnection interval (default: "5s")
- `DJANGO_MAX_RECONNECTS` - Maximum reconnection attempts (default: 10)

### Quality Adaptation
- `QUALITY_PACKET_LOSS_THRESHOLD` - Packet loss threshold (default: 0.05)
- `QUALITY_ADAPTATION_INTERVAL` - Adaptation check interval (default: "5s")

## API Endpoints

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-XX-XXTXX:XX:XX.XXXZ",
  "rooms": 2,
  "version": "1.0.0"
}
```

### Room Management
```http
# Create room
POST /api/v1/rooms
{
  "room_id": "room-123"
}

# Get room info
GET /api/v1/rooms/{roomID}

# Delete room
DELETE /api/v1/rooms/{roomID}
```

### Join Room
```http
POST /api/v1/rooms/{roomID}/join
{
  "peer_id": "peer-456"
}
```

Response:
```json
{
  "room_id": "room-123",
  "peer_id": "peer-456",
  "status": "joined",
  "websocket_url": "ws://localhost:8080/ws?room=room-123&peer=peer-456"
}
```

### Metrics
```http
GET /api/v1/metrics
```

## WebSocket Signaling

Connect to `ws://localhost:8080/ws?room={roomID}&peer={peerID}` for WebRTC signaling.

### Message Types
```json
// WebRTC signaling
{
  "type": "offer",
  "data": { ... },
  "request_id": "unique-id"
}

{
  "type": "answer",
  "data": { ... },
  "request_id": "unique-id"
}

{
  "type": "ice-candidate",
  "data": { ... },
  "request_id": "unique-id"
}

// Stream subscription
{
  "type": "subscribe",
  "data": "stream-id"
}

{
  "type": "unsubscribe",
  "data": "stream-id"
}
```

## Integration with Django

The SFU server integrates with Django backend via WebSocket for room event coordination:

1. **Room Events** - Django notifies SFU of room creation/deletion
2. **User Events** - Django notifies SFU of user join/leave events
3. **State Synchronization** - SFU and Django maintain consistent room state

### Django WebSocket Events

The SFU server listens for these Django events:
- `room_created` - Create new room in SFU
- `room_deleted` - Remove room from SFU
- `user_joined` - Prepare for new participant
- `user_left` - Clean up participant resources

## Development

### Running Tests
```bash
go test ./...
```

### Building for Production
```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o streaming-node .
```

### Code Structure

- **`sfu/`** - Core SFU implementation with WebRTC handling
- **`server/`** - HTTP and WebSocket server
- **`config/`** - Configuration management
- **`main.go`** - Application entry point with graceful shutdown

## Deployment

### Docker Deployment
```bash
docker build -t streaming-node .
docker run -p 8080:8080 streaming-node
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: streaming-node
spec:
  replicas: 2
  selector:
    matchLabels:
      app: streaming-node
  template:
    metadata:
      labels:
        app: streaming-node
    spec:
      containers:
      - name: streaming-node
        image: streaming-node:latest
        ports:
        - containerPort: 8080
        env:
        - name: DJANGO_URL
          value: "django-service:8000"
```

## Monitoring

### Health Checks
- HTTP endpoint: `GET /health`
- Docker health checks configured
- Kubernetes readiness/liveness probes

### Metrics
- Room count and peer statistics
- Connection status
- Quality adaptation metrics

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS configuration in `config.yaml`
   - Verify Django backend URL is accessible
   - Check network connectivity

2. **Poor Video Quality**
   - Monitor packet loss and RTT metrics
   - Adjust quality thresholds in configuration
   - Check bandwidth limitations

3. **High CPU Usage**
   - Monitor concurrent rooms and peers
   - Consider horizontal scaling
   - Check quality adaptation settings

### Logging

Logs are configurable via `config.yaml`:
```yaml
logging:
  level: "info"  # debug, info, warn, error
  file: ""       # Empty for stdout
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check existing GitHub issues
- Create new issue with detailed information
- Include server logs and configuration
