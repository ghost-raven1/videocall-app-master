#!/bin/bash

# Video Call Application Load Testing Orchestration Script
# Supports multiple test scenarios and generates comprehensive reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="${1:-all}"
CONCURRENT_USERS="${CONCURRENT_USERS:-100}"
TEST_DURATION="${TEST_DURATION:-300}"
RAMP_UP_TIME="${RAMP_UP_TIME:-60}"
REPORT_DIR="${REPORT_DIR:-./reports}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CURRENT_REPORT_DIR="${REPORT_DIR}/load_test_${TIMESTAMP}"

# Test scenarios
SCENARIOS=(
    "http-load-test:HTTP API Load Test"
    "websocket-load-test:WebSocket Signaling Load Test"
    "browser-load-test:Browser-based Multi-user Test"
    "database-load-test:Database Performance Test"
    "sfu-load-test:SFU Stress Test"
    "monitoring-setup:Monitoring Infrastructure Setup"
)

echo -e "${BLUE}🎯 Video Call Application Load Testing Suite${NC}"
echo "=============================================="
echo "Test Type: $TEST_TYPE"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Test Duration: ${TEST_DURATION}s"
echo "Ramp-up Time: ${RAMP_UP_TIME}s"
echo "Report Directory: $CURRENT_REPORT_DIR"
echo ""

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if services are running
check_services() {
    print_status "Checking if required services are running..."

    # Check if Docker Compose services are up
    if ! docker-compose -f tests/docker-compose.test.yml ps | grep -q "Up"; then
        print_error "Test services are not running. Starting them now..."
        start_services
    else
        print_success "All test services are running"
    fi
}

# Function to start test infrastructure
start_services() {
    print_status "Starting test infrastructure..."

    # Create report directory
    mkdir -p "$CURRENT_REPORT_DIR"

    # Start monitoring stack first
    print_status "Starting monitoring services (Prometheus, Grafana)..."
    docker-compose -f tests/docker-compose.test.yml up -d prometheus grafana

    # Wait for Prometheus to be ready
    print_status "Waiting for Prometheus to be ready..."
    sleep 10

    # Start application services
    print_status "Starting application services (backend, SFU, frontend)..."
    docker-compose -f tests/docker-compose.test.yml up -d backend sfu frontend nginx

    # Wait for services to be ready
    print_status "Waiting for application services to be ready..."
    sleep 30

    print_success "Test infrastructure is ready"
}

# Function to stop test infrastructure
stop_services() {
    print_status "Stopping test infrastructure..."
    docker-compose -f tests/docker-compose.test.yml down
    print_success "Test infrastructure stopped"
}

# Function to run HTTP load test with Artillery
run_http_load_test() {
    print_status "Running HTTP API load test with Artillery..."

    # Start services if not running
    check_services

    # Run Artillery load test
    docker-compose -f tests/docker-compose.test.yml run --rm artillery \
        run tests/load-test-config.yml \
        --output "$CURRENT_REPORT_DIR/artillery_report.json"

    print_success "HTTP load test completed"
}

# Function to run WebSocket load test
run_websocket_load_test() {
    print_status "Running WebSocket signaling load test..."

    # Start services if not running
    check_services

    # Run custom WebSocket load test
    node tests/websocket-load-test.js \
        --concurrentUsers "$CONCURRENT_USERS" \
        --testDuration "$TEST_DURATION" \
        --rampUpTime "$RAMP_UP_TIME" \
        --backendUrl "ws://localhost:8000" \
        --reportDir "$CURRENT_REPORT_DIR"

    print_success "WebSocket load test completed"
}

# Function to run browser-based load test
run_browser_load_test() {
    print_status "Running browser-based multi-user load test..."

    # Start services if not running
    check_services

    # Run enhanced multi-user test
    node tests/multi-user-test.js \
        --usersPerRoom "$CONCURRENT_USERS" \
        --testDuration "$TEST_DURATION" \
        --frontendUrl "http://localhost:3000" \
        --backendUrl "http://localhost:8000" \
        --headless

    print_success "Browser load test completed"
}

# Function to run database load test
run_database_load_test() {
    print_status "Running database performance load test..."

    # Create database load test script
    cat > "$CURRENT_REPORT_DIR/db-load-test.js" << 'EOF'
const { Client } = require('pg');
const async = require('async');

class DatabaseLoadTester {
    constructor(options = {}) {
        this.options = {
            concurrentConnections: options.concurrentConnections || 50,
            testDuration: options.testDuration || 60000,
            ...options
        };
        this.client = new Client({
            host: 'localhost',
            port: 5432,
            database: 'videocall_test',
            user: 'test_user',
            password: 'test_password'
        });
    }

    async run() {
        await this.client.connect();

        console.log('🗄️ Starting database load test...');

        // Test concurrent connections
        await this.testConcurrentConnections();

        // Test complex queries
        await this.testComplexQueries();

        // Test bulk operations
        await this.testBulkOperations();

        await this.client.end();
        console.log('✅ Database load test completed');
    }

    async testConcurrentConnections() {
        console.log(`Testing ${this.options.concurrentConnections} concurrent connections...`);

        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < this.options.concurrentConnections; i++) {
            promises.push(this.executeQuery(i));
        }

        await Promise.all(promises);
        const duration = Date.now() - startTime;

        console.log(`✅ Concurrent connections test completed in ${duration}ms`);
    }

    async executeQuery(index) {
        const testQueries = [
            'SELECT COUNT(*) FROM rooms',
            'SELECT * FROM rooms LIMIT 10',
            'SELECT COUNT(*) FROM room_participants',
            'SELECT r.code, COUNT(rp.id) as participant_count FROM rooms r LEFT JOIN room_participants rp ON r.id = rp.room_id GROUP BY r.id'
        ];

        const query = testQueries[index % testQueries.length];

        try {
            const result = await this.client.query(query);
            return result.rows;
        } catch (error) {
            console.error(`Query ${index} failed:`, error.message);
            throw error;
        }
    }

    async testComplexQueries() {
        console.log('Testing complex analytical queries...');

        const queries = [
            // Room analytics
            `SELECT
                r.code,
                r.created_at,
                COUNT(rp.id) as total_participants,
                AVG(EXTRACT(EPOCH FROM (rp.joined_at - r.created_at))) as avg_join_time
             FROM rooms r
             LEFT JOIN room_participants rp ON r.id = rp.room_id
             GROUP BY r.id, r.code, r.created_at
             ORDER BY r.created_at DESC
             LIMIT 100`,

            // Participant activity analysis
            `SELECT
                DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as rooms_created,
                AVG(max_participants) as avg_capacity
             FROM rooms
             WHERE created_at >= NOW() - INTERVAL '24 hours'
             GROUP BY DATE_TRUNC('hour', created_at)
             ORDER BY hour DESC`
        ];

        for (const query of queries) {
            const startTime = Date.now();
            try {
                await this.client.query(query);
                const duration = Date.now() - startTime;
                console.log(`Complex query completed in ${duration}ms`);
            } catch (error) {
                console.error('Complex query failed:', error.message);
            }
        }
    }

    async testBulkOperations() {
        console.log('Testing bulk insert/update operations...');

        // Bulk room creation
        const bulkInsertQuery = `
            INSERT INTO rooms (code, name, max_participants, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
        `;

        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 100; i++) {
            promises.push(
                this.client.query(bulkInsertQuery, [
                    `bulk-test-${Date.now()}-${i}`,
                    `Bulk Test Room ${i}`,
                    Math.floor(Math.random() * 20) + 5
                ])
            );
        }

        await Promise.all(promises);
        const duration = Date.now() - startTime;

        console.log(`✅ Bulk operations test completed: 100 rooms in ${duration}ms`);
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new DatabaseLoadTester({
        concurrentConnections: parseInt(process.argv[2]) || 50,
        testDuration: parseInt(process.argv[3]) || 60000
    });

    tester.run().catch(console.error);
}

module.exports = { DatabaseLoadTester };
EOF

    # Run the database load test
    node "$CURRENT_REPORT_DIR/db-load-test.js" 50 60000

    print_success "Database load test completed"
}

# Function to run SFU stress test
run_sfu_load_test() {
    print_status "Running SFU stress test..."

    # Create SFU-specific load test
    cat > "$CURRENT_REPORT_DIR/sfu-stress-test.js" << 'EOF'
const WebSocket = require('ws');
const EventEmitter = require('events');

class SFULoadTester extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            concurrentPeers: options.concurrentPeers || 100,
            rooms: options.rooms || 10,
            testDuration: options.testDuration || 300000,
            sfuUrl: options.sfuUrl || 'ws://localhost:8080',
            ...options
        };

        this.connections = new Map();
        this.metrics = {
            startTime: null,
            connectedPeers: 0,
            failedConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            rtpPackets: 0
        };
    }

    async run() {
        console.log('📡 Starting SFU stress test...');
        this.metrics.startTime = new Date();

        // Create multiple rooms
        await this.createRooms();

        // Connect peers to rooms
        await this.connectPeers();

        // Run stress test
        await this.runStressTest();

        // Cleanup
        await this.cleanup();

        this.printResults();
    }

    async createRooms() {
        console.log(`Creating ${this.options.rooms} test rooms...`);

        for (let i = 0; i < this.options.rooms; i++) {
            await this.createRoom(`stress-test-room-${i}`);
        }
    }

    async createRoom(roomId) {
        const ws = new WebSocket(`${this.options.sfuUrl}/`);

        return new Promise((resolve, reject) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'create_room',
                    room_id: roomId,
                    max_peers: Math.floor(this.options.concurrentPeers / this.options.rooms) + 5
                }));
                ws.close();
                resolve();
            });

            ws.on('error', reject);
        });
    }

    async connectPeers() {
        console.log(`Connecting ${this.options.concurrentPeers} peers to SFU...`);

        const promises = [];
        for (let i = 0; i < this.options.concurrentPeers; i++) {
            promises.push(this.connectPeer(i));
        }

        await Promise.allSettled(promises);
    }

    async connectPeer(peerIndex) {
        const roomIndex = peerIndex % this.options.rooms;
        const roomId = `stress-test-room-${roomIndex}`;
        const ws = new WebSocket(`${this.options.sfuUrl}/ws/${roomId}`);

        return new Promise((resolve) => {
            ws.on('open', () => {
                this.metrics.connectedPeers++;
                this.connections.set(peerIndex, ws);

                // Send join message
                ws.send(JSON.stringify({
                    type: 'join',
                    peer_id: `peer-${peerIndex}`,
                    room_id: roomId
                }));
                this.metrics.messagesSent++;

                resolve();
            });

            ws.on('message', (data) => {
                this.metrics.messagesReceived++;
                this.handlePeerMessage(peerIndex, data);
            });

            ws.on('error', () => {
                this.metrics.failedConnections++;
                resolve();
            });

            ws.on('close', () => {
                this.connections.delete(peerIndex);
            });
        });
    }

    handlePeerMessage(peerIndex, data) {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'rtp_packet') {
                this.metrics.rtpPackets++;
            }
        } catch (error) {
            // Ignore parse errors
        }
    }

    async runStressTest() {
        console.log('Running RTP packet stress test...');

        const testDuration = this.options.testDuration;
        const startTime = Date.now();

        while (Date.now() - startTime < testDuration) {
            // Send RTP-like messages
            for (const [peerIndex, ws] of this.connections) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'rtp_data',
                        peer_id: `peer-${peerIndex}`,
                        sequence_number: Math.floor(Math.random() * 1000000),
                        timestamp: Date.now(),
                        payload: Buffer.alloc(1024, Math.random().toString()).toString('base64')
                    }));
                    this.metrics.messagesSent++;
                }
            }

            // Wait 10ms between bursts
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    async cleanup() {
        console.log('Cleaning up SFU connections...');

        for (const [peerIndex, ws] of this.connections) {
            ws.close();
        }

        this.connections.clear();
    }

    printResults() {
        const duration = Date.now() - this.metrics.startTime;

        console.log('\n📡 SFU Stress Test Results');
        console.log('========================');
        console.log(`Test Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`Connected Peers: ${this.metrics.connectedPeers}`);
        console.log(`Failed Connections: ${this.metrics.failedConnections}`);
        console.log(`Success Rate: ${((this.metrics.connectedPeers / (this.metrics.connectedPeers + this.metrics.failedConnections)) * 100).toFixed(1)}%`);
        console.log(`Messages Sent: ${this.metrics.messagesSent}`);
        console.log(`Messages Received: ${this.metrics.messagesReceived}`);
        console.log(`RTP Packets Processed: ${this.metrics.rtpPackets}`);
        console.log(`Messages/sec: ${(this.metrics.messagesSent / (duration / 1000)).toFixed(1)}`);
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new SFULoadTester({
        concurrentPeers: parseInt(process.argv[2]) || 100,
        rooms: parseInt(process.argv[3]) || 10,
        testDuration: parseInt(process.argv[4]) || 300000
    });

    tester.run().catch(console.error);
}

module.exports = { SFULoadTester };
EOF

    # Run the SFU stress test
    node "$CURRENT_REPORT_DIR/sfu-stress-test.js" "$CONCURRENT_USERS" 10 180000

    print_success "SFU stress test completed"
}

# Function to set up monitoring
setup_monitoring() {
    print_status "Setting up monitoring infrastructure..."

    # Start services if not running
    check_services

    # Wait for Grafana to be ready
    print_status "Waiting for Grafana to be ready..."
    sleep 20

    # Import dashboard
    print_status "Importing load test dashboard to Grafana..."
    curl -X POST \
        -H "Content-Type: application/json" \
        -d @tests/monitoring/grafana-dashboard.json \
        http://admin:admin@localhost:3000/api/dashboards/db \
        || print_warning "Could not import dashboard (Grafana may not be ready)"

    print_success "Monitoring infrastructure is ready"
    print_status "Grafana available at: http://localhost:3000"
    print_status "Prometheus available at: http://localhost:9090"
}

# Function to generate comprehensive report
generate_report() {
    print_status "Generating comprehensive load test report..."

    # Create HTML report
    cat > "$CURRENT_REPORT_DIR/report.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Call Application - Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { background: #e8f4f8; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .chart-placeholder { background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 Video Call Application Load Test Report</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Test Type:</strong> $TEST_TYPE</p>
        <p><strong>Concurrent Users:</strong> $CONCURRENT_USERS</p>
        <p><strong>Test Duration:</strong> ${TEST_DURATION}s</p>
    </div>

    <h2>📊 Test Results Summary</h2>
    <div class="metric">
        <h3>Performance Metrics</h3>
        <ul>
            <li><strong>Total Connections:</strong> <span id="total-connections">-</span></li>
            <li><strong>Success Rate:</strong> <span id="success-rate">-</span></li>
            <li><strong>Average Latency:</strong> <span id="avg-latency">-</span></li>
            <li><strong>Messages/sec:</strong> <span id="messages-per-sec">-</span></li>
        </ul>
    </div>

    <div class="metric">
        <h3>System Resources</h3>
        <ul>
            <li><strong>CPU Usage:</strong> <span id="cpu-usage">-</span></li>
            <li><strong>Memory Usage:</strong> <span id="memory-usage">-</span></li>
            <li><strong>Database Connections:</strong> <span id="db-connections">-</span></li>
        </ul>
    </div>

    <h2>📈 Monitoring Dashboards</h2>
    <div class="chart-placeholder">
        <p>📊 Real-time metrics available at:</p>
        <p><a href="http://localhost:3000" target="_blank">Grafana Dashboard</a></p>
        <p><a href="http://localhost:9090" target="_blank">Prometheus Metrics</a></p>
    </div>

    <h2>🔍 Detailed Logs</h2>
    <div class="chart-placeholder">
        <p>📋 Detailed logs and metrics data:</p>
        <p><code>$CURRENT_REPORT_DIR/</code></p>
    </div>
</body>
</html>
EOF

    print_success "Comprehensive report generated at: $CURRENT_REPORT_DIR/report.html"
}

# Main execution logic
main() {
    case "$TEST_TYPE" in
        "http-load-test")
            run_http_load_test
            ;;
        "websocket-load-test")
            run_websocket_load_test
            ;;
        "browser-load-test")
            run_browser_load_test
            ;;
        "database-load-test")
            run_database_load_test
            ;;
        "sfu-load-test")
            run_sfu_load_test
            ;;
        "monitoring-setup")
            setup_monitoring
            ;;
        "all")
            print_status "Running all load tests..."
            run_http_load_test
            run_websocket_load_test
            run_browser_load_test
            run_database_load_test
            run_sfu_load_test
            setup_monitoring
            ;;
        *)
            print_error "Unknown test type: $TEST_TYPE"
            echo "Available test types:"
            printf '  %s\n' "${SCENARIOS[@]}"
            exit 1
            ;;
    esac

    # Generate report
    generate_report

    print_success "Load testing completed successfully!"
    print_status "Report available at: $CURRENT_REPORT_DIR/report.html"
    print_status "Grafana dashboard: http://localhost:3000"
    print_status "Prometheus metrics: http://localhost:9090"
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}⚠️ Load testing interrupted by user${NC}"; stop_services; exit 0' INT

# Run main function
main "$@"