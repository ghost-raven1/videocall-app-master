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

func createTestPeer(t *testing.T) (*Peer, *Room) {
	room, _ := createTestRoom(t)

	pc, err := createMockPeerConnection()
	require.NoError(t, err)

	peer := NewPeer("test-peer", pc, room, logrus.New())
	return peer, room
}

func TestNewPeer(t *testing.T) {
	room, _ := createTestRoom(t)

	pc, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc.Close()

	peer := NewPeer("test-peer", pc, room, logrus.New())

	assert.NotNil(t, peer)
	assert.Equal(t, "test-peer", peer.ID())
	assert.Equal(t, pc, peer.pc)
	assert.Equal(t, room, peer.room)
	assert.NotNil(t, peer.logger)
	assert.NotNil(t, peer.tracks)
	assert.Equal(t, 0, len(peer.tracks))
	assert.False(t, peer.isClosed())
}

func TestPeer_AddTrack(t *testing.T) {
	peer, room := createTestPeer(t)

	// Create a mock remote track
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	// Add a track to the first peer connection
	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	// Create a remote track from the local track
	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	// Test adding track
	err = peer.AddTrack(remoteTrack)
	assert.NoError(t, err)

	// Verify track was added
	tracks := peer.GetTracks()
	assert.Equal(t, 1, len(tracks))

	// Test adding duplicate track (should be ignored)
	err = peer.AddTrack(remoteTrack)
	assert.NoError(t, err)

	tracks = peer.GetTracks()
	assert.Equal(t, 1, len(tracks)) // Should still be 1
}

func TestPeer_RemoveTrack(t *testing.T) {
	peer, room := createTestPeer(t)

	// Create a mock remote track
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	// Add track first
	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)
	assert.Equal(t, 1, len(peer.GetTracks()))

	// Remove track
	err = peer.RemoveTrack("video-track")
	assert.NoError(t, err)
	assert.Equal(t, 0, len(peer.GetTracks()))

	// Remove non-existent track (should not error)
	err = peer.RemoveTrack("non-existent")
	assert.NoError(t, err)
}

func TestPeer_SendMessage(t *testing.T) {
	peer, room := createTestPeer(t)

	// Track message sending
	var sentMessage interface{}
	var mu sync.Mutex

	// Override SendMessage for testing
	originalSendMessage := peer.SendMessage
	peer.SendMessage = func(msg interface{}) {
		mu.Lock()
		sentMessage = msg
		mu.Unlock()
		originalSendMessage(msg)
	}

	// Send a test message
	testMessage := map[string]string{"type": "test", "data": "hello"}
	peer.SendMessage(testMessage)

	// Verify message was captured
	mu.Lock()
	assert.Equal(t, testMessage, sentMessage)
	mu.Unlock()
}

func TestPeer_OnTrack(t *testing.T) {
	peer, room := createTestPeer(t)

	// Track handler calls
	var handlerCalled bool
	var receivedTrack *webrtc.TrackRemote
	var receivedReceiver *webrtc.RTPReceiver
	var mu sync.Mutex

	// Add a track handler
	peer.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		mu.Lock()
		handlerCalled = true
		receivedTrack = track
		receivedReceiver = receiver
		mu.Unlock()
	})

	// Simulate track handler call (this would normally be called by WebRTC)
	// We can't easily trigger this without complex WebRTC setup
	// But we can verify the handler was added

	// Verify handler was added (indirectly through no panic)
	assert.NotNil(t, peer.onTrackHandlers)
	assert.Equal(t, 1, len(peer.onTrackHandlers))
}

func TestPeer_OnICEConnectionStateChange(t *testing.T) {
	peer, room := createTestPeer(t)

	// Track handler calls
	var handlerCalled bool
	var receivedState webrtc.ICEConnectionState
	var mu sync.Mutex

	// Add an ICE state change handler
	peer.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		mu.Lock()
		handlerCalled = true
		receivedState = state
		mu.Unlock()
	})

	// Verify handler was added
	assert.NotNil(t, peer.onICEHandlers)
	assert.Equal(t, 1, len(peer.onICEHandlers))
}

func TestPeer_GetPeerConnection(t *testing.T) {
	peer, room := createTestPeer(t)

	pc := peer.GetPeerConnection()
	assert.NotNil(t, pc)
	assert.Equal(t, peer.pc, pc)
}

func TestPeer_GetTracks(t *testing.T) {
	peer, room := createTestPeer(t)

	// Initially no tracks
	tracks := peer.GetTracks()
	assert.Equal(t, 0, len(tracks))

	// Add a track
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)

	tracks = peer.GetTracks()
	assert.Equal(t, 1, len(tracks))
	assert.Contains(t, tracks, "video-track")
}

func TestPeer_Close(t *testing.T) {
	peer, room := createTestPeer(t)

	// Add some tracks first
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)
	assert.Equal(t, 1, len(peer.GetTracks()))

	// Close peer
	peer.Close()

	// Verify peer is closed
	assert.True(t, peer.isClosed())
	assert.Equal(t, 0, len(peer.GetTracks()))

	// Verify peer connection is closed
	assert.NotNil(t, peer.pc) // Should still be accessible but closed

	// Close again (should not panic)
	peer.Close()
	assert.True(t, peer.isClosed())
}

func TestPeer_ConcurrentTrackOperations(t *testing.T) {
	peer, room := createTestPeer(t)

	// Test concurrent track addition
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(trackID string) {
			pc, err := createMockPeerConnection()
			if err != nil {
				t.Errorf("Failed to create peer connection: %v", err)
				done <- false
				return
			}
			defer pc.Close()

			track, err := pc.NewTrack(webrtc.DefaultPayloadTypeVP8, trackID, "stream1")
			if err != nil {
				t.Errorf("Failed to create track: %v", err)
				done <- false
				return
			}

			remoteTrack := &webrtc.TrackRemote{
				TrackCommon: track.TrackCommon,
			}

			err = peer.AddTrack(remoteTrack)
			if err != nil {
				t.Errorf("Failed to add track: %v", err)
				done <- false
				return
			}

			done <- true
		}(string(rune('a' + i)))
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		success := <-done
		assert.True(t, success)
	}

	// Verify all tracks were added
	tracks := peer.GetTracks()
	assert.Equal(t, 10, len(tracks))
}

func TestPeer_AddTrackToClosedPeer(t *testing.T) {
	peer, room := createTestPeer(t)

	// Close the peer first
	peer.Close()
	assert.True(t, peer.isClosed())

	// Try to add track to closed peer
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	err = peer.AddTrack(remoteTrack)
	assert.NoError(t, err) // Should not error but should be ignored

	// Verify no tracks were added
	tracks := peer.GetTracks()
	assert.Equal(t, 0, len(tracks))
}

func TestPeer_TrackForwarding(t *testing.T) {
	peer, room := createTestPeer(t)

	// Create a mock remote track
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	// Add track to peer
	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)

	tracks := peer.GetTracks()
	require.Equal(t, 1, len(tracks))

	localTrack := tracks["video-track"]
	require.NotNil(t, localTrack)

	// Verify track properties
	assert.Equal(t, "video-track_"+peer.id, localTrack.ID())
	assert.Equal(t, "stream1_"+peer.id, localTrack.StreamID())
}

func TestPeer_ID(t *testing.T) {
	peer, room := createTestPeer(t)

	assert.Equal(t, "test-peer", peer.ID())
}

func TestPeer_ConcurrentClose(t *testing.T) {
	peer, room := createTestPeer(t)

	// Add some tracks
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	track, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "video-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: track.TrackCommon,
	}

	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)

	// Test concurrent close operations
	done := make(chan bool, 5)

	for i := 0; i < 5; i++ {
		go func() {
			peer.Close()
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 5; i++ {
		<-done
	}

	// Verify peer is closed
	assert.True(t, peer.isClosed())
	assert.Equal(t, 0, len(peer.GetTracks()))
}

// Integration test for track forwarding simulation
func TestPeer_TrackForwardingIntegration(t *testing.T) {
	// This test simulates the track forwarding mechanism
	// In a real scenario, this would involve actual RTP packet forwarding

	peer, room := createTestPeer(t)

	// Create a source track
	pc1, err := createMockPeerConnection()
	require.NoError(t, err)
	defer pc1.Close()

	sourceTrack, err := pc1.NewTrack(webrtc.DefaultPayloadTypeVP8, "source-track", "stream1")
	require.NoError(t, err)

	remoteTrack := &webrtc.TrackRemote{
		TrackCommon: sourceTrack.TrackCommon,
	}

	// Add track to peer (this would normally start forwarding)
	err = peer.AddTrack(remoteTrack)
	require.NoError(t, err)

	// Verify the track was set up correctly for forwarding
	tracks := peer.GetTracks()
	require.Equal(t, 1, len(tracks))

	localTrack := tracks["source-track"]
	require.NotNil(t, localTrack)

	// In a real implementation, this is where RTP forwarding would happen
	// For testing, we verify the track is properly configured
	assert.Contains(t, localTrack.ID(), "source-track_"+peer.id)
	assert.Contains(t, localTrack.StreamID(), "stream1_"+peer.id)
}