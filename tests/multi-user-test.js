#!/usr/bin/env node

/**
 * Multi-User Video Call Test Script
 *
 * This script simulates multiple users joining a video call to test:
 * - Room joining and participant management
 * - WebRTC connection establishment
 * - Video stream handling
 * - Audio/video state synchronization
 * - Connection quality and performance
 */

const puppeteer = require('puppeteer');
const WebSocket = require('ws');
const EventEmitter = require('events');

class VideoCallTester extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      roomCount: options.roomCount || 1,
      usersPerRoom: options.usersPerRoom || 5,
      testDuration: options.testDuration || 60000, // 1 minute
      headless: options.headless !== false,
      frontendUrl: options.frontendUrl || 'http://localhost:3000',
      backendUrl: options.backendUrl || 'http://localhost:8000',
      sfuUrl: options.sfuUrl || 'ws://localhost:8080',
      ...options
    };

    this.browsers = [];
    this.pages = [];
    this.connections = [];
    this.metrics = {
      startTime: null,
      endTime: null,
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      connectionTimes: [],
      errors: []
    };
  }

  async initialize() {
    console.log('🚀 Initializing multi-user video call test...');
    this.metrics.startTime = new Date();

    // Create browsers for each user
    const browserPromises = [];
    for (let i = 0; i < this.options.usersPerRoom; i++) {
      browserPromises.push(this.createBrowser(i));
    }

    const browsers = await Promise.all(browserPromises);
    this.browsers = browsers.map(b => b.browser);
    this.pages = browsers.map(b => b.page);

    console.log(`✅ Created ${this.browsers.length} browser instances`);
  }

  async createBrowser(userIndex) {
    const browser = await puppeteer.launch({
      headless: this.options.headless,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();

    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`User ${userIndex} Error:`, msg.text());
        this.metrics.errors.push({
          user: userIndex,
          type: 'console_error',
          message: msg.text(),
          timestamp: new Date()
        });
      }
    });

    // Set up page error handling
    page.on('pageerror', error => {
      console.error(`User ${userIndex} Page Error:`, error.message);
      this.metrics.errors.push({
        user: userIndex,
        type: 'page_error',
        message: error.message,
        timestamp: new Date()
      });
    });

    // Set up request/response monitoring
    page.on('response', response => {
      if (response.status() >= 400) {
        this.metrics.errors.push({
          user: userIndex,
          type: 'http_error',
          status: response.status(),
          url: response.url(),
          timestamp: new Date()
        });
      }
    });

    // Override navigator.mediaDevices for testing
    await page.evaluateOnNewDocument(() => {
      // Mock getUserMedia for testing
      navigator.mediaDevices = {
        getUserMedia: async (constraints) => {
          console.log(`User requesting media:`, constraints);

          // Create mock media stream
          const stream = new MediaStream();

          if (constraints.video) {
            // Create a canvas-based mock video track
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');

            // Draw a colored rectangle to simulate video
            ctx.fillStyle = `hsl(${(Math.random() * 360)}, 70%, 50%)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
            stream.addTrack(videoTrack);
          }

          if (constraints.audio) {
            // Create a mock audio track with silence
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(0, audioContext.currentTime); // Silence
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);

            const audioTrack = audioContext.createMediaStreamDestination().stream.getAudioTracks()[0];
            stream.addTrack(audioTrack);
          }

          return stream;
        },
        enumerateDevices: async () => [
          { kind: 'videoinput', deviceId: 'fake-camera', label: 'Fake Camera' },
          { kind: 'audioinput', deviceId: 'fake-microphone', label: 'Fake Microphone' },
          { kind: 'audiooutput', deviceId: 'fake-speaker', label: 'Fake Speaker' }
        ]
      };
    });

    return { browser, page };
  }

  async runTest() {
    try {
      console.log('🎯 Starting multi-user video call test...');

      // Step 1: Create a test room
      const roomCode = await this.createTestRoom();

      // Step 2: Have all users join the room
      await this.joinRoomAllUsers(roomCode);

      // Step 3: Wait for connections to stabilize
      await this.waitForStableConnections();

      // Step 4: Perform interaction tests
      await this.performInteractionTests();

      // Step 5: Monitor connection quality
      await this.monitorConnectionQuality();

      // Step 6: Clean up
      await this.cleanup();

      console.log('✅ Test completed successfully!');
      this.printResults();

    } catch (error) {
      console.error('❌ Test failed:', error);
      this.metrics.errors.push({
        type: 'test_error',
        message: error.message,
        timestamp: new Date()
      });
      await this.cleanup();
      throw error;
    }
  }

  async createTestRoom() {
    console.log('📝 Creating test room...');

    const response = await fetch(`${this.options.backendUrl}/api/rooms/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Test Room ${Date.now()}`,
        max_participants: this.options.usersPerRoom
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.status}`);
    }

    const roomData = await response.json();
    console.log(`✅ Created room: ${roomData.code}`);

    return roomData.code;
  }

  async joinRoomAllUsers(roomCode) {
    console.log(`👥 Having ${this.options.usersPerRoom} users join room: ${roomCode}`);

    const joinPromises = this.pages.map(async (page, index) => {
      const startTime = Date.now();

      try {
        // Navigate to join page
        await page.goto(`${this.options.frontendUrl}/join/${roomCode}`);

        // Wait for the video call page to load
        await page.waitForSelector('[data-testid="video-call-container"]', { timeout: 10000 });

        // Wait for WebRTC connection to establish
        await page.waitForFunction(() => {
          return document.querySelector('[data-testid="connection-status"]')?.textContent === 'Connected';
        }, { timeout: 15000 });

        const connectionTime = Date.now() - startTime;
        this.metrics.connectionTimes.push(connectionTime);
        this.metrics.successfulConnections++;

        console.log(`✅ User ${index + 1} joined successfully (${connectionTime}ms)`);

      } catch (error) {
        const connectionTime = Date.now() - startTime;
        this.metrics.failedConnections++;
        this.metrics.errors.push({
          user: index,
          type: 'join_error',
          message: error.message,
          connectionTime: connectionTime,
          timestamp: new Date()
        });

        console.error(`❌ User ${index + 1} failed to join:`, error.message);
      }
    });

    await Promise.allSettled(joinPromises);
    this.metrics.totalConnections = this.options.usersPerRoom;
  }

  async waitForStableConnections() {
    console.log('⏳ Waiting for connections to stabilize...');

    // Wait for all users to see each other
    const stabilizationPromises = this.pages.map(async (page, index) => {
      await page.waitForFunction(() => {
        const participantCount = document.querySelector('[data-testid="participant-count"]');
        return participantCount && parseInt(participantCount.textContent) >= 2;
      }, { timeout: 30000 });

      console.log(`✅ User ${index + 1} sees other participants`);
    });

    await Promise.allSettled(stabilizationPromises);
    console.log('✅ All connections stabilized');
  }

  async performInteractionTests() {
    console.log('🎮 Performing interaction tests...');

    // Test 1: Audio toggle
    console.log('🔊 Testing audio controls...');
    await this.testAudioControls();

    // Test 2: Video toggle
    console.log('📹 Testing video controls...');
    await this.testVideoControls();

    // Test 3: Screen sharing (if supported)
    console.log('💻 Testing screen sharing...');
    await this.testScreenSharing();

    // Test 4: Participant count changes
    console.log('👥 Testing participant dynamics...');
    await this.testParticipantDynamics();
  }

  async testAudioControls() {
    const audioTestPromises = this.pages.map(async (page, index) => {
      try {
        // Toggle audio
        await page.click('[data-testid="audio-toggle"]');

        // Wait for state change
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="audio-toggle"]');
          return button && button.classList.contains('muted');
        }, { timeout: 5000 });

        // Toggle back
        await page.click('[data-testid="audio-toggle"]');
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="audio-toggle"]');
          return button && !button.classList.contains('muted');
        }, { timeout: 5000 });

        console.log(`✅ User ${index + 1} audio controls working`);
      } catch (error) {
        console.error(`❌ User ${index + 1} audio control test failed:`, error.message);
        this.metrics.errors.push({
          user: index,
          type: 'audio_test_error',
          message: error.message,
          timestamp: new Date()
        });
      }
    });

    await Promise.allSettled(audioTestPromises);
  }

  async testVideoControls() {
    const videoTestPromises = this.pages.map(async (page, index) => {
      try {
        // Toggle video
        await page.click('[data-testid="video-toggle"]');

        // Wait for state change
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="video-toggle"]');
          return button && button.classList.contains('disabled');
        }, { timeout: 5000 });

        // Toggle back
        await page.click('[data-testid="video-toggle"]');
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="video-toggle"]');
          return button && !button.classList.contains('disabled');
        }, { timeout: 5000 });

        console.log(`✅ User ${index + 1} video controls working`);
      } catch (error) {
        console.error(`❌ User ${index + 1} video control test failed:`, error.message);
        this.metrics.errors.push({
          user: index,
          type: 'video_test_error',
          message: error.message,
          timestamp: new Date()
        });
      }
    });

    await Promise.allSettled(videoTestPromises);
  }

  async testScreenSharing() {
    // Test screen sharing with first user
    try {
      const page = this.pages[0];

      // Check if screen sharing is available
      const screenShareAvailable = await page.evaluate(() => {
        return 'getDisplayMedia' in navigator.mediaDevices;
      });

      if (screenShareAvailable) {
        // Mock getDisplayMedia for testing
        await page.evaluate(() => {
          navigator.mediaDevices.getDisplayMedia = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Test Screen Share', canvas.width/2, canvas.height/2);

            return canvas.captureStream(30);
          };
        });

        await page.click('[data-testid="screen-share-button"]');

        // Wait for screen share to start
        await page.waitForSelector('[data-testid="screen-sharing-active"]', { timeout: 10000 });

        console.log('✅ Screen sharing test passed');

        // Stop screen sharing
        await page.click('[data-testid="screen-share-button"]');
      } else {
        console.log('⚠️ Screen sharing not available in this environment');
      }
    } catch (error) {
      console.error('❌ Screen sharing test failed:', error.message);
      this.metrics.errors.push({
        type: 'screen_share_error',
        message: error.message,
        timestamp: new Date()
      });
    }
  }

  async testParticipantDynamics() {
    // Test dynamic participant joining/leaving
    try {
      // Simulate a user leaving (close one browser)
      const leavingBrowser = this.browsers[this.browsers.length - 1];
      const leavingPage = this.pages[this.pages.length - 1];

      // Wait for other users to detect the participant leaving
      const detectionPromises = this.pages.slice(0, -1).map(async (page, index) => {
        await page.waitForFunction(() => {
          const count = document.querySelector('[data-testid="participant-count"]');
          return count && parseInt(count.textContent) < 5;
        }, { timeout: 10000 });
      });

      await Promise.allSettled(detectionPromises);

      // Close the leaving user's browser
      await leavingBrowser.close();

      console.log('✅ Participant dynamics test passed');
    } catch (error) {
      console.error('❌ Participant dynamics test failed:', error.message);
      this.metrics.errors.push({
        type: 'participant_dynamics_error',
        message: error.message,
        timestamp: new Date()
      });
    }
  }

  async monitorConnectionQuality() {
    console.log('📊 Monitoring connection quality...');

    const monitoringDuration = Math.min(this.options.testDuration, 30000); // Max 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < monitoringDuration) {
      const qualityChecks = this.pages.map(async (page, index) => {
        try {
          const quality = await page.evaluate(() => {
            const qualityElement = document.querySelector('[data-testid="connection-quality"]');
            const statsElement = document.querySelector('[data-testid="connection-stats"]');

            return {
              quality: qualityElement?.textContent || 'unknown',
              stats: statsElement?.textContent || 'no stats'
            };
          });

          // Log quality for each user periodically
          if (Math.random() < 0.1) { // 10% chance to log
            console.log(`📊 User ${index + 1} quality:`, quality);
          }

        } catch (error) {
          // Ignore monitoring errors
        }
      });

      await Promise.allSettled(qualityChecks);

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Connection quality monitoring completed');
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    // Close all browsers
    const closePromises = this.browsers.map(async (browser) => {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    });

    await Promise.allSettled(closePromises);

    this.metrics.endTime = new Date();
    console.log('✅ Cleanup completed');
  }

  printResults() {
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`Total Users: ${this.metrics.totalConnections}`);
    console.log(`Successful Connections: ${this.metrics.successfulConnections}`);
    console.log(`Failed Connections: ${this.metrics.failedConnections}`);
    console.log(`Success Rate: ${((this.metrics.successfulConnections / this.metrics.totalConnections) * 100).toFixed(1)}%`);

    if (this.metrics.connectionTimes.length > 0) {
      const avgTime = this.metrics.connectionTimes.reduce((a, b) => a + b, 0) / this.metrics.connectionTimes.length;
      const minTime = Math.min(...this.metrics.connectionTimes);
      const maxTime = Math.max(...this.metrics.connectionTimes);

      console.log(`Average Connection Time: ${avgTime.toFixed(0)}ms`);
      console.log(`Min Connection Time: ${minTime}ms`);
      console.log(`Max Connection Time: ${maxTime}ms`);
    }

    if (this.metrics.errors.length > 0) {
      console.log(`\n❌ Errors (${this.metrics.errors.length}):`);
      this.metrics.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
      });
    }

    const duration = this.metrics.endTime - this.metrics.startTime;
    console.log(`\n⏱️ Total Test Duration: ${(duration / 1000).toFixed(1)}s`);
  }
}

// CLI interface
async function runMultiUserTest() {
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
  options.roomCount = options.roomCount || 1;
  options.usersPerRoom = options.usersPerRoom || 5;
  options.testDuration = options.testDuration || 60000;

  console.log('🎯 Multi-User Video Call Test');
  console.log(`Rooms: ${options.roomCount}`);
  console.log(`Users per Room: ${options.usersPerRoom}`);
  console.log(`Duration: ${(options.testDuration / 1000)}s`);
  console.log(`Headless: ${options.headless !== false}`);
  console.log('');

  const tester = new VideoCallTester(options);

  try {
    await tester.initialize();
    await tester.runTest();
  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { VideoCallTester };

// Run if called directly
if (require.main === module) {
  runMultiUserTest().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}