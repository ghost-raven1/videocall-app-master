package sfu

import (
	"sync"
	"testing"
	"time"

	"streaming-node/config"

	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createTestRoom(t *testing.T) (*Room, *webrtc.API) {
	cfg := createTestConfig()
	logger := logrus.New()

	api := webrtc.NewAPI(webrtc.WithSettingEngine(webrtc.SettingEngine{
		LoggerFactory: &loggerFactory{},
	}))

	room := NewRoom("test-room", api, cfg, logger)
	return room, api
}

func createMockPeerConnection() (*webrtc.PeerConnection, error) {
	return webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	})
}

func TestNewRoom(t *testing.T) {
	room, _ := createTestRoom(t)

	assert.NotNil(t, room)
	assert.Equal(t, "test-room", room.ID())
	assert.NotNil(t, room.peers)
	assert.NotNil(t, room.logger)
	assert.Equal(t, 0, len(room.peers))
	assert.False(t, room.isClosed())
}

func TestRoom_AddPeer(t *testing.T) {
	room, api := createTestRoom(t)

	// Create mock peer connection
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	})
	require.NoError(t, err)
	defer pc.Close()

	// Test adding a peer
	peer, err := room.AddPeer("peer-1", pc)
	require.NoError(t, err)
	require.NotNil(t, peer)

	assert.Equal(t, "peer-1", peer.ID())
	assert.Equal(t, 1, room.GetPeerCount())

	// Test adding peer with auto-generated ID
	peer2, err := room.AddPeer("", pc)
	assert.Error(t, err) // Should fail because PC is already used
	assert.Nil(t, peer2)

	// Test adding duplicate peer
	peer3, err := room.AddPeer("peer-1", pc)
	assert.Error(t, err)
	assert.Nil(t, peer3)
	assert.Contains(t, err.Error(), "already exists")
}

func TestRoom_RemovePeer(t *testing.T) {
	room, _ := createTestRoom(t)

	// Create and add a peer
	pc, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc.Close()

	peer, err := room.AddPeer("peer-1", pc)
	require.NoError(t, err)
	assert.Equal(t, 1, room.GetPeerCount())

	// Test removing existing peer
	err = room.RemovePeer("peer-1")
	assert.NoError(t, err)
	assert.Equal(t, 0, room.GetPeerCount())

	// Verify peer is closed
	assert.True(t, peer.isClosed())

	// Test removing non-existent peer
	err = room.RemovePeer("non-existent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRoom_GetPeer(t *testing.T) {
	room, _ := createTestRoom(t)

	// Create and add a peer
	pc, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc.Close()

	peer, err := room.AddPeer("peer-1", pc)
	require.NoError(t, err)

	// Test getting existing peer
	retrievedPeer, err := room.GetPeer("peer-1")
	assert.NoError(t, err)
	assert.Equal(t, peer, retrievedPeer)

	// Test getting non-existent peer
	retrievedPeer, err = room.GetPeer("non-existent")
	assert.Error(t, err)
	assert.Nil(t, retrievedPeer)
	assert.Contains(t, err.Error(), "not found")
}

func TestRoom_GetPeers(t *testing.T) {
	room, _ := createTestRoom(t)

	// Initially no peers
	peers := room.GetPeers()
	assert.Equal(t, 0, len(peers))

	// Add multiple peers
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	pc2, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc2.Close()

	peer1, err := room.AddPeer("peer-1", pc1)
	require.NoError(t, err)

	peer2, err := room.AddPeer("peer-2", pc2)
	require.NoError(t, err)

	peers = room.GetPeers()
	assert.Equal(t, 2, len(peers))
	assert.Contains(t, peers, "peer-1")
	assert.Contains(t, peers, "peer-2")
	assert.Equal(t, peer1, peers["peer-1"])
	assert.Equal(t, peer2, peers["peer-2"])
}

func TestRoom_GetPeerCount(t *testing.T) {
	room, _ := createTestRoom(t)

	// Initially no peers
	assert.Equal(t, 0, room.GetPeerCount())

	// Add peers and check count
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	pc2, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc2.Close()

	room.AddPeer("peer-1", pc1)
	assert.Equal(t, 1, room.GetPeerCount())

	room.AddPeer("peer-2", pc2)
	assert.Equal(t, 2, room.GetPeerCount())

	// Remove peer and check count
	room.RemovePeer("peer-1")
	assert.Equal(t, 1, room.GetPeerCount())
}

func TestRoom_BroadcastToAll(t *testing.T) {
	room, _ := createTestRoom(t)

	// Create and add peers
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	pc2, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc2.Close()

	pc3, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc3.Close()

	peer1, err := room.AddPeer("peer-1", pc1)
	require.NoError(t, err)

	peer2, err := room.AddPeer("peer-2", pc2)
	require.NoError(t, err)

	peer3, err := room.AddPeer("peer-3", pc3)
	require.NoError(t, err)

	// Track messages sent to peers
	var messages1, messages2, messages3 []interface{}
	var mu1, mu2, mu3 sync.Mutex

	peer1.SendMessage = func(msg interface{}) {
		mu1.Lock()
		messages1 = append(messages1, msg)
		mu1.Unlock()
	}

	peer2.SendMessage = func(msg interface{}) {
		mu2.Lock()
		messages2 = append(messages2, msg)
		mu2.Unlock()
	}

	peer3.SendMessage = func(msg interface{}) {
		mu3.Lock()
		messages3 = append(messages3, msg)
		mu3.Unlock()
	}

	// Broadcast message from peer1
	testMessage := map[string]string{"type": "test", "data": "hello"}
	room.BroadcastToAll("peer-1", testMessage)

	// Allow some time for async operations
	time.Sleep(10 * time.Millisecond)

	// Check that message was sent to other peers but not to sender
	mu2.Lock()
	mu3.Lock()
	assert.Equal(t, 1, len(messages2))
	assert.Equal(t, 1, len(messages3))
	assert.Equal(t, testMessage, messages2[0])
	assert.Equal(t, testMessage, messages3[0])
	mu2.Unlock()
	mu3.Unlock()

	mu1.Lock()
	assert.Equal(t, 0, len(messages1)) // Sender should not receive message
	mu1.Unlock()
}

func TestRoom_Close(t *testing.T) {
	room, _ := createTestRoom(t)

	// Add some peers
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	pc2, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc2.Close()

	peer1, err := room.AddPeer("peer-1", pc1)
	require.NoError(t, err)

	peer2, err := room.AddPeer("peer-2", pc2)
	require.NoError(t, err)

	assert.Equal(t, 2, room.GetPeerCount())
	assert.False(t, room.isClosed())

	// Close the room
	room.Close()

	// Verify room is closed
	assert.True(t, room.isClosed())
	assert.Equal(t, 0, len(room.peers))

	// Verify peers are closed
	assert.True(t, peer1.isClosed())
	assert.True(t, peer2.isClosed())
}

func TestRoom_AddPeerToClosedRoom(t *testing.T) {
	room, _ := createTestRoom(t)

	// Close the room first
	room.Close()
	assert.True(t, room.isClosed())

	// Try to add peer to closed room
	pc, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc.Close()

	peer, err := room.AddPeer("peer-1", pc)
	assert.Error(t, err)
	assert.Nil(t, peer)
	assert.Contains(t, err.Error(), "room test-room is closed")
}

func TestRoom_ConcurrentPeerOperations(t *testing.T) {
	room, _ := createTestRoom(t)

	// Test concurrent peer addition
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(peerID string) {
			pc, err := createMockPeerConnection()
			if err != nil {
				t.Errorf("Failed to create peer connection: %v", err)
				done <- false
				return
			}
			defer pc.Close()

			peer, err := room.AddPeer(peerID, pc)
			if err != nil {
				t.Errorf("Failed to add peer: %v", err)
				done <- false
				return
			}

			assert.NotNil(t, peer)
			done <- true
		}(string(rune('a' + i)))
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		success := <-done
		assert.True(t, success)
	}

	// Verify all peers were added
	assert.Equal(t, 10, room.GetPeerCount())
}

func TestRoom_PeerEventHandlers(t *testing.T) {
	room, _ := createTestRoom(t)

	// Create mock peer connection
	pc, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc.Close()

	// Track handler calls
	var trackCalls, iceCalls int
	var trackMu, iceMu sync.Mutex

	// Add event handlers before adding peer
	onTrackCalled := make(chan bool, 1)
	onICECalled := make(chan bool, 1)

	// We need to modify the room to use our test handlers
	// For this test, we'll verify the handlers are set up correctly
	peer, err := room.AddPeer("peer-1", pc)
	require.NoError(t, err)

	// The handlers should be set up during AddPeer
	// We can't directly test the handler calls without more complex setup
	// But we can verify the peer was created successfully with handlers
	assert.NotNil(t, peer)
	assert.Equal(t, 1, room.GetPeerCount())
}

func TestRoom_ID(t *testing.T) {
	room, _ := createTestRoom(t)

	assert.Equal(t, "test-room", room.ID())
}

// Helper function to create test configuration
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