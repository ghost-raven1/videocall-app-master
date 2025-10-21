package sfu

import (
	"testing"
	"time"

	"streaming-node/config"

	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createTestConfig() *config.Config {
	return &config.Config{
		WebRTC: config.WebRTCConfig{
			ICEServers: []webrtc.ICEServer{
				{
					URLs: []string{"stun:stun.l.google.com:19302"},
				},
			},
		},
		Server: config.ServerConfig{
			Address: "localhost",
			Port:    8080,
		},
	}
}

func TestNewSFU(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	assert.NotNil(t, sfu)
	assert.NotNil(t, sfu.rooms)
	assert.NotNil(t, sfu.api)
	assert.NotNil(t, sfu.logger)
	assert.Equal(t, cfg, sfu.config)
	assert.Equal(t, 0, len(sfu.rooms))
}

func TestSFU_CreateRoom(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Test creating a new room
	room, err := sfu.CreateRoom("test-room-1")
	require.NoError(t, err)
	require.NotNil(t, room)

	assert.Equal(t, "test-room-1", room.ID())
	assert.Equal(t, 1, len(sfu.rooms))

	// Test creating duplicate room (should return existing)
	room2, err := sfu.CreateRoom("test-room-1")
	require.NoError(t, err)
	require.NotNil(t, room2)

	assert.Equal(t, room, room2)
	assert.Equal(t, 1, len(sfu.rooms))
}

func TestSFU_GetRoom(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Test getting non-existent room
	room, err := sfu.GetRoom("non-existent")
	assert.Error(t, err)
	assert.Nil(t, room)
	assert.Contains(t, err.Error(), "room non-existent not found")

	// Test getting existing room
	createdRoom, err := sfu.CreateRoom("test-room-1")
	require.NoError(t, err)

	room, err = sfu.GetRoom("test-room-1")
	require.NoError(t, err)
	assert.Equal(t, createdRoom, room)
}

func TestSFU_RemoveRoom(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Create a room
	room, err := sfu.CreateRoom("test-room-1")
	require.NoError(t, err)
	assert.Equal(t, 1, len(sfu.rooms))

	// Remove the room
	sfu.RemoveRoom("test-room-1")
	assert.Equal(t, 0, len(sfu.rooms))

	// Verify room is closed
	assert.True(t, room.isClosed())
}

func TestSFU_GetRooms(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Initially no rooms
	rooms := sfu.GetRooms()
	assert.Equal(t, 0, len(rooms))

	// Create multiple rooms
	room1, err := sfu.CreateRoom("room-1")
	require.NoError(t, err)

	room2, err := sfu.CreateRoom("room-2")
	require.NoError(t, err)

	rooms = sfu.GetRooms()
	assert.Equal(t, 2, len(rooms))
	assert.Contains(t, rooms, "room-1")
	assert.Contains(t, rooms, "room-2")
	assert.Equal(t, room1, rooms["room-1"])
	assert.Equal(t, room2, rooms["room-2"])
}

func TestSFU_Close(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Create multiple rooms with peers
	room1, err := sfu.CreateRoom("room-1")
	require.NoError(t, err)

	room2, err := sfu.CreateRoom("room-2")
	require.NoError(t, err)

	// Close SFU
	sfu.Close()

	// Verify all rooms are closed
	assert.True(t, room1.isClosed())
	assert.True(t, room2.isClosed())
	assert.Equal(t, 0, len(sfu.rooms))
}

func TestSFU_ConcurrentRoomOperations(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Test concurrent room creation
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(roomID string) {
			room, err := sfu.CreateRoom(roomID)
			assert.NoError(t, err)
			assert.NotNil(t, room)
			done <- true
		}(string(rune('a' + i)))
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify all rooms were created
	assert.Equal(t, 10, len(sfu.rooms))
}

func TestSFU_ConcurrentRoomAccess(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Create a room
	room, err := sfu.CreateRoom("test-room")
	require.NoError(t, err)

	// Test concurrent access to room
	done := make(chan bool, 20)

	// Concurrent readers
	for i := 0; i < 10; i++ {
		go func() {
			room, err := sfu.GetRoom("test-room")
			assert.NoError(t, err)
			assert.NotNil(t, room)
			done <- true
		}()
	}

	// Concurrent writers (room removal)
	for i := 0; i < 10; i++ {
		go func() {
			// Only one should succeed
			sfu.RemoveRoom("test-room")
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 20; i++ {
		<-done
	}

	// Room should be removed
	assert.Equal(t, 0, len(sfu.rooms))
}

func TestLoggerFactory(t *testing.T) {
	factory := &loggerFactory{}

	logger := factory.NewLogger("test-scope")
	assert.NotNil(t, logger)

	// Test that logger implements webrtc.Logger interface
	// These should not panic
	logger.Trace("trace message")
	logger.Debug("debug message")
	logger.Info("info message")
	logger.Warn("warn message")
	logger.Error("error message")
}

func TestSFU_ConfigurationWithICEServers(t *testing.T) {
	cfg := createTestConfig()
	cfg.WebRTC.ICEServers = []webrtc.ICEServer{
		{
			URLs: []string{"stun:stun.example.com:19302"},
		},
		{
			URLs:       []string{"turn:turn.example.com:3478"},
			Username:   "user",
			Credential: "pass",
		},
	}

	sfu := NewSFU(cfg)
	assert.NotNil(t, sfu)

	// Verify the API was created with custom ICE servers
	// This is tested indirectly through successful SFU creation
	assert.NotNil(t, sfu.api)
}

func TestSFU_ResourceCleanup(t *testing.T) {
	cfg := createTestConfig()
	sfu := NewSFU(cfg)

	// Create a room and add some state
	room, err := sfu.CreateRoom("cleanup-test")
	require.NoError(t, err)

	// Create mock peer connection for testing
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	})

	// Add peer to room
	peer, err := room.AddPeer("test-peer", pc)
	require.NoError(t, err)

	// Verify peer was added
	assert.Equal(t, 1, room.GetPeerCount())

	// Close SFU and verify cleanup
	sfu.Close()

	// Verify room is closed
	assert.True(t, room.isClosed())

	// Verify peer is closed
	assert.True(t, peer.isClosed())

	// Close peer connection
	pc.Close()
}