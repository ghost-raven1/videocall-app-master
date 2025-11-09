#!/usr/bin/env node

/**
 * WebSocket Load Testing Script for Video Call Application
 *
 * This script simulates 100+ concurrent WebSocket connections for:
 * - Room signaling and participant management
 * - WebRTC offer/answer exchanges
 * - ICE candidate negotiations
 * - Real-time state synchronization
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketLoadTester extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      concurrentUsers: options.concurrentUsers || 100,
      testDuration: options.testDuration || 300000, // 5 minutes
      rampUpTime: options.rampUpTime || 60000, // 1 minute
      backendUrl: options.backendUrl || 'ws://localhost:8000',
      sfuUrl: options.sfuUrl || 'ws://localhost:8080',
      reportInterval: options.reportInterval || 5000, // 5 seconds
      ...options
    };

    this.connections = new Map();
    this.metrics = {
      startTime: null,
      endTime: null,
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: [],
      latencies: [],
      connectionTimes: []
    };

    this.scenarios = {
      // Scenario 1: Room Join/Leave Pattern
      roomLifecycle: {
        weight: 30,
        flow: this.roomLifecycleFlow.bind(this)
      },

      // Scenario 2: WebRTC Signaling Pattern
      webrtcSignaling: {
        weight: 40,
        flow: this.webrtcSignalingFlow.bind(this)
      },

      // Scenario 3: Participant Interaction Pattern
      participantInteraction: {
        weight: 20,
        flow: this.participantInteractionFlow.bind(this)
      },

      // Scenario 4: Admin Monitoring Pattern
      adminMonitoring: {
        weight: 10,
        flow: this.adminMonitoringFlow.bind(this)
      }
    };
  }

  async start() {
    console.log('🚀 Starting WebSocket Load Test...');
    console.log(`Target: ${this.options.concurrentUsers} concurrent users`);
    console.log(`Duration: ${this.options.testDuration / 1000}s`);
    console.log(`Ramp-up: ${this.options.rampUpTime / 1000}s`);

    this.metrics.startTime = new Date();

    // Start metrics reporting
    this.startMetricsReporting();

    // Start load generation
    await this.generateLoad();

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.options.testDuration));

    // Cleanup
    await this.cleanup();
    this.printResults();
  }

  async generateLoad() {
    const usersPerSecond = this.options.concurrentUsers / (this.options.rampUpTime / 1000);

    let userCount = 0;
    const interval = setInterval(async () => {
      if (userCount >= this.options.concurrentUsers) {
        clearInterval(interval);
        return;
      }

      // Create multiple users per interval for faster ramp-up
      const usersThisInterval = Math.min(5, this.options.concurrentUsers - userCount);

      for (let i = 0; i < usersThisInterval; i++) {
        if (userCount < this.options.concurrentUsers) {
          await this.createUser(userCount++);
        }
      }
    }, 1000 / usersPerSecond * 5);
  }

  async createUser(userIndex) {
    const startTime = Date.now();
    const userId = `load-test-user-${userIndex}-${Date.now()}`;

    try {
      // Select random scenario based on weights
      const scenario = this.selectScenario();
      const roomId = `load-test-room-${Math.floor(Math.random() * 1000)}`;

      // Create WebSocket connection (client room endpoint)
      const ws = new WebSocket(`${this.options.backendUrl}/ws/room/${roomId}/`);

      ws.on('open', () => {
        this.metrics.successfulConnections++;
        this.metrics.totalConnections++;
        this.connections.set(userId, { ws, userId, scenario, roomId });

        const connectionTime = Date.now() - startTime;
        this.metrics.connectionTimes.push(connectionTime);

        console.log(`✅ User ${userIndex} connected (${connectionTime}ms)`);

        // Start scenario flow
        scenario.flow(ws, userId, roomId, userIndex);
      });

      ws.on('message', (data) => {
        this.metrics.messagesReceived++;
        this.handleMessage(userId, data);
      });

      ws.on('error', (error) => {
        this.metrics.failedConnections++;
        this.metrics.errors.push({
          userId,
          type: 'connection_error',
          error: error.message,
          timestamp: new Date()
        });
      });

      ws.on('close', () => {
        this.connections.delete(userId);
      });

    } catch (error) {
      this.metrics.failedConnections++;
      this.metrics.errors.push({
        userId,
        type: 'setup_error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  selectScenario() {
    const totalWeight = Object.values(this.scenarios).reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const [name, scenario] of Object.entries(this.scenarios)) {
      random -= scenario.weight;
      if (random <= 0) {
        return { name, ...scenario };
      }
    }

    return Object.values(this.scenarios)[0];
  }

  async roomLifecycleFlow(ws, userId, roomId, userIndex) {
    // Join room
    const joinMessage = {
      type: 'join_room',
      user_id: userId,
      timestamp: Date.now()
    };

    ws.send(JSON.stringify(joinMessage));
    this.metrics.messagesSent++;

    // Simulate being in room for random duration
    const roomDuration = 10000 + Math.random() * 20000; // 10-30 seconds

    setTimeout(() => {
      // Leave room
      const leaveMessage = {
        type: 'leave_room',
        user_id: userId,
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(leaveMessage));
      this.metrics.messagesSent++;

      // Close connection after leaving
      setTimeout(() => {
        ws.close();
      }, 1000 + Math.random() * 2000);
    }, roomDuration);

    // Send periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const heartbeatMessage = {
          type: 'heartbeat',
          user_id: userId,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(heartbeatMessage));
        this.metrics.messagesSent++;
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 5000 + Math.random() * 5000);

    // Stop heartbeat after room duration
    setTimeout(() => clearInterval(heartbeatInterval), roomDuration);
  }

  async webrtcSignalingFlow(ws, userId, roomId, userIndex) {
    // Join room
    const joinMessage = {
      type: 'join_room',
      user_id: userId,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(joinMessage));
    this.metrics.messagesSent++;

    // Simulate WebRTC signaling sequence
    setTimeout(() => {
      // Send offer
      const offerMessage = {
        type: 'webrtc_offer',
        from: userId,
        to: `peer-${Math.floor(Math.random() * 10)}`,
        sdp: this.generateMockSDP(),
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(offerMessage));
      this.metrics.messagesSent++;

      // Simulate answer after delay
      setTimeout(() => {
        const answerMessage = {
          type: 'webrtc_answer',
          from: `peer-${Math.floor(Math.random() * 10)}`,
          to: userId,
          sdp: this.generateMockSDP(),
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(answerMessage));
        this.metrics.messagesSent++;

        // Send ICE candidates
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const iceMessage = {
              type: 'ice_candidate',
              from: userId,
              candidate: this.generateMockICECandidate(),
              timestamp: Date.now()
            };
            ws.send(JSON.stringify(iceMessage));
            this.metrics.messagesSent++;
          }, i * 500 + Math.random() * 1000);
        }
      }, 1000 + Math.random() * 2000);

      // Leave after signaling
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'leave_room',
          user_id: userId,
          timestamp: Date.now()
        }));
        this.metrics.messagesSent++;
        ws.close();
      }, 5000 + Math.random() * 10000);

    }, 2000 + Math.random() * 3000);
  }

  async participantInteractionFlow(ws, userId, roomId, userIndex) {
    // Join room
    ws.send(JSON.stringify({
      type: 'join_room',
      user_id: userId,
      timestamp: Date.now()
    }));
    this.metrics.messagesSent++;

    // Simulate participant interactions
    const interactions = [
      'mute_audio',
      'unmute_audio',
      'disable_video',
      'enable_video',
      'start_screen_share',
      'stop_screen_share'
    ];

    let interactionCount = 0;
    const maxInteractions = 5 + Math.floor(Math.random() * 10);

    const interactionInterval = setInterval(() => {
      if (interactionCount >= maxInteractions || ws.readyState !== WebSocket.OPEN) {
        clearInterval(interactionInterval);

        // Leave room
        ws.send(JSON.stringify({
          type: 'leave_room',
          user_id: userId,
          timestamp: Date.now()
        }));
        this.metrics.messagesSent++;
        ws.close();
        return;
      }

      const interaction = interactions[Math.floor(Math.random() * interactions.length)];
      const message = {
        type: interaction,
        user_id: userId,
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(message));
      this.metrics.messagesSent++;
      interactionCount++;

    }, 2000 + Math.random() * 3000);
  }

  async adminMonitoringFlow(ws, userId, roomId, userIndex) {
    // Admin joins for monitoring
    ws.send(JSON.stringify({
      type: 'admin_join',
      admin_id: userId,
      room_id: roomId,
      timestamp: Date.now()
    }));
    this.metrics.messagesSent++;

    // Monitor for a while
    const monitoringDuration = 15000 + Math.random() * 30000;

    const monitoringInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const statsMessage = {
          type: 'get_room_stats',
          admin_id: userId,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(statsMessage));
        this.metrics.messagesSent++;
      }
    }, 3000 + Math.random() * 2000);

    setTimeout(() => {
      clearInterval(monitoringInterval);
      ws.send(JSON.stringify({
        type: 'admin_leave',
        admin_id: userId,
        timestamp: Date.now()
      }));
      this.metrics.messagesSent++;
      ws.close();
    }, monitoringDuration);
  }

  generateMockSDP() {
    // Generate mock SDP for testing
    const lines = [
      'v=0',
      'o=- 123456789 123456789 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=video 5000 RTP/AVP 96',
      'c=IN IP4 127.0.0.1',
      'a=rtpmap:96 VP8/90000',
      'a=fmtp:96 max-fs=3600;max-fr=30'
    ];

    return lines.join('\r\n') + '\r\n';
  }

  generateMockICECandidate() {
    // Generate mock ICE candidate
    return `candidate:1 1 UDP 2130706431 192.168.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)} ${Math.floor(Math.random() * 10000) + 10000} typ host`;
  }

  handleMessage(userId, data) {
    try {
      const message = JSON.parse(data.toString());

      // Track latency if timestamp is present
      if (message.timestamp && message.original_timestamp) {
        const latency = Date.now() - message.original_timestamp;
        this.metrics.latencies.push(latency);
      }

      // Handle different message types
      switch (message.type) {
        case 'room_joined':
          console.log(`📍 User ${userId} joined room`);
          break;
        case 'room_left':
          console.log(`📍 User ${userId} left room`);
          break;
        case 'participant_joined':
        case 'participant_left':
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'ice_candidate':
          // Expected signaling messages
          break;
        case 'error':
          this.metrics.errors.push({
            userId,
            type: 'message_error',
            error: message.message,
            timestamp: new Date()
          });
          break;
        default:
          // Log unexpected messages for debugging
          if (Math.random() < 0.01) { // 1% sampling
            console.log(`📨 Unexpected message from ${userId}:`, message.type);
          }
      }
    } catch (error) {
      this.metrics.errors.push({
        userId,
        type: 'parse_error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  startMetricsReporting() {
    this.reportingInterval = setInterval(() => {
      const activeConnections = this.connections.size;
      const elapsed = Date.now() - this.metrics.startTime.getTime();
      const avgLatency = this.metrics.latencies.length > 0
        ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
        : 0;

      console.log(`
📊 Load Test Metrics (${Math.floor(elapsed / 1000)}s elapsed):
   Active Connections: ${activeConnections}
   Total Connections: ${this.metrics.totalConnections}
   Success Rate: ${this.metrics.totalConnections > 0 ? ((this.metrics.successfulConnections / this.metrics.totalConnections) * 100).toFixed(1) : 0}%
   Messages Sent: ${this.metrics.messagesSent}
   Messages Received: ${this.metrics.messagesReceived}
   Average Latency: ${avgLatency.toFixed(0)}ms
   Errors: ${this.metrics.errors.length}
      `);
    }, this.options.reportInterval);
  }

  async cleanup() {
    console.log('🧹 Cleaning up connections...');

    // Close all WebSocket connections
    for (const [userId, connection] of this.connections) {
      try {
        connection.ws.close();
      } catch (error) {
        console.error(`Error closing connection for ${userId}:`, error.message);
      }
    }

    this.connections.clear();
    clearInterval(this.reportingInterval);

    this.metrics.endTime = new Date();
  }

  printResults() {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
      : 0;
    const avgConnectionTime = this.metrics.connectionTimes.length > 0
      ? this.metrics.connectionTimes.reduce((a, b) => a + b, 0) / this.metrics.connectionTimes.length
      : 0;

    console.log('\n📊 Final Load Test Results');
    console.log('==========================');
    console.log(`Test Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Total Connections: ${this.metrics.totalConnections}`);
    console.log(`Successful Connections: ${this.metrics.successfulConnections}`);
    console.log(`Failed Connections: ${this.metrics.failedConnections}`);
    console.log(`Success Rate: ${((this.metrics.successfulConnections / this.metrics.totalConnections) * 100).toFixed(1)}%`);
    console.log(`Average Connection Time: ${avgConnectionTime.toFixed(0)}ms`);
    console.log(`Average Message Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`Total Messages Sent: ${this.metrics.messagesSent}`);
    console.log(`Total Messages Received: ${this.metrics.messagesReceived}`);
    console.log(`Messages per Second: ${(this.metrics.messagesSent / (duration / 1000)).toFixed(1)}`);

    if (this.metrics.errors.length > 0) {
      console.log(`\n❌ Errors (${this.metrics.errors.length}):`);
      const errorTypes = {};
      this.metrics.errors.forEach(error => {
        errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
      });

      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    // Performance thresholds
    console.log('\n🎯 Performance Assessment:');
    if (this.metrics.successfulConnections / this.metrics.totalConnections > 0.95) {
      console.log('✅ Connection Success Rate: GOOD');
    } else {
      console.log('⚠️ Connection Success Rate: NEEDS IMPROVEMENT');
    }

    if (avgLatency < 100) {
      console.log('✅ Average Latency: EXCELLENT');
    } else if (avgLatency < 250) {
      console.log('⚠️ Average Latency: ACCEPTABLE');
    } else {
      console.log('❌ Average Latency: POOR');
    }

    if (this.metrics.errors.length < this.metrics.totalConnections * 0.05) {
      console.log('✅ Error Rate: LOW');
    } else {
      console.log('❌ Error Rate: HIGH');
    }
  }
}

// CLI interface
async function runWebSocketLoadTest() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (value === 'true' || value === 'false') {
      options[key] = value === 'true';
    } else if (!isNaN(value)) {
      options[key] = parseInt(value);
    } else {
      options[key] = value;
    }
  }

  // Set defaults
  options.concurrentUsers = options.concurrentUsers || 100;
  options.testDuration = options.testDuration || 300000; // 5 minutes
  options.rampUpTime = options.rampUpTime || 60000; // 1 minute

  console.log('🎯 WebSocket Load Test');
  console.log(`Concurrent Users: ${options.concurrentUsers}`);
  console.log(`Test Duration: ${options.testDuration / 1000}s`);
  console.log(`Ramp-up Time: ${options.rampUpTime / 1000}s`);
  console.log('');

  const tester = new WebSocketLoadTester(options);

  try {
    await tester.start();
  } catch (error) {
    console.error('💥 Load test failed:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { WebSocketLoadTester };

// Run if called directly
if (require.main === module) {
  runWebSocketLoadTest().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
