package sfu

import (
	"fmt"
	"sync"

	"streaming-node/config"

	"github.com/google/uuid"
	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
)

// Room represents a video call room
type Room struct {
	id           string
	config       *config.Config
	api          *webrtc.API
	logger       *logrus.Logger
	peers        map[string]*Peer
	peersMutex   sync.RWMutex
	closed       bool
	closedMutex  sync.RWMutex
	// Store tracks from each peer to forward to new participants
	peerTracks   map[string][]*webrtc.TrackRemote // peerID -> []tracks
	tracksMutex  sync.RWMutex
}

// NewRoom creates a new room
func NewRoom(roomID string, api *webrtc.API, cfg *config.Config, logger *logrus.Logger) *Room {
	return &Room{
		id:         roomID,
		config:     cfg,
		api:        api,
		logger:     logger,
		peers:      make(map[string]*Peer),
		peerTracks: make(map[string][]*webrtc.TrackRemote),
	}
}

// ID returns the room ID
func (r *Room) ID() string {
	return r.id
}

// GetAPI returns the WebRTC API for creating peer connections
func (r *Room) GetAPI() *webrtc.API {
	return r.api
}

// AddPeer adds a peer to the room
func (r *Room) AddPeer(peerID string, pc *webrtc.PeerConnection) (*Peer, error) {
	r.peersMutex.Lock()
	defer r.peersMutex.Unlock()

	if r.isClosed() {
		return nil, fmt.Errorf("room %s is closed", r.id)
	}

	// Create new peer ID if not provided
	if peerID == "" {
		peerID = uuid.New().String()
	}

	// Check if peer already exists
	if _, exists := r.peers[peerID]; exists {
		return nil, fmt.Errorf("peer %s already exists in room %s", peerID, r.id)
	}

	peer := NewPeer(peerID, pc, r, r.logger)
	r.peers[peerID] = peer

	r.logger.WithFields(logrus.Fields{
		"roomID": r.id,
		"peerID": peerID,
	}).Info("Added peer to room")

	// Setup peer connection handlers
	peer.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		r.handleNewTrack(peerID, track, receiver)
	})

	peer.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		r.handleICEConnectionStateChange(peerID, state)
	})

	// Note: Existing tracks will be added in handleOffer BEFORE creating answer
	// This ensures all tracks are included in the initial SDP
	// If tracks are added later (after connection is established), OnNegotiationNeeded will handle it

	return peer, nil
}

// RemovePeer removes a peer from the room
func (r *Room) RemovePeer(peerID string) error {
	r.peersMutex.Lock()
	defer r.peersMutex.Unlock()

	peer, exists := r.peers[peerID]
	if !exists {
		return fmt.Errorf("peer %s not found in room %s", peerID, r.id)
	}

	peer.Close()
	delete(r.peers, peerID)

	// Remove tracks for this peer
	r.tracksMutex.Lock()
	delete(r.peerTracks, peerID)
	r.tracksMutex.Unlock()

	r.logger.WithFields(logrus.Fields{
		"roomID": r.id,
		"peerID": peerID,
	}).Info("Removed peer from room")

	return nil
}

// GetPeer returns a peer by ID
func (r *Room) GetPeer(peerID string) (*Peer, error) {
	r.peersMutex.RLock()
	defer r.peersMutex.RUnlock()

	peer, exists := r.peers[peerID]
	if !exists {
		return nil, fmt.Errorf("peer %s not found in room %s", peerID, r.id)
	}

	return peer, nil
}

// GetPeers returns all peers in the room
func (r *Room) GetPeers() map[string]*Peer {
	r.peersMutex.RLock()
	defer r.peersMutex.RUnlock()

	peers := make(map[string]*Peer)
	for id, peer := range r.peers {
		peers[id] = peer
	}

	return peers
}

// GetPeerCount returns the number of peers in the room
func (r *Room) GetPeerCount() int {
	r.peersMutex.RLock()
	defer r.peersMutex.RUnlock()

	return len(r.peers)
}

// GetPeerTracks returns all tracks from all peers in the room
func (r *Room) GetPeerTracks() map[string][]*webrtc.TrackRemote {
	r.tracksMutex.RLock()
	defer r.tracksMutex.RUnlock()

	tracks := make(map[string][]*webrtc.TrackRemote)
	for peerID, peerTracks := range r.peerTracks {
		tracks[peerID] = make([]*webrtc.TrackRemote, len(peerTracks))
		copy(tracks[peerID], peerTracks)
	}

	return tracks
}

// BroadcastToAll sends data to all peers except the sender
func (r *Room) BroadcastToAll(senderID string, data interface{}) {
	r.peersMutex.RLock()
	defer r.peersMutex.RUnlock()

	for peerID, peer := range r.peers {
		if peerID != senderID {
			peer.SendMessage(data)
		}
	}
}

// handleNewTrack handles when a new track is added by a peer
func (r *Room) handleNewTrack(peerID string, track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
	r.logger.WithFields(logrus.Fields{
		"roomID":  r.id,
		"peerID":  peerID,
		"trackID": track.ID(),
		"kind":    track.Kind(),
	}).Info("New track received")

	// Store track for forwarding to future participants
	r.tracksMutex.Lock()
	if r.peerTracks[peerID] == nil {
		r.peerTracks[peerID] = make([]*webrtc.TrackRemote, 0)
	}
	// Check if track already exists
	trackExists := false
	for _, existingTrack := range r.peerTracks[peerID] {
		if existingTrack.ID() == track.ID() {
			trackExists = true
			break
		}
	}
	if !trackExists {
		r.peerTracks[peerID] = append(r.peerTracks[peerID], track)
	}
	r.tracksMutex.Unlock()

	// Forward track to all other peers
	r.peersMutex.RLock()
	defer r.peersMutex.RUnlock()

	for otherPeerID, peer := range r.peers {
		if otherPeerID != peerID {
			// Pass the ORIGINAL peerID (the sender) into AddTrack so that
			// the forwarded track/stream IDs encode the sender identity.
			if err := peer.AddTrack(track, peerID); err != nil {
				r.logger.WithFields(logrus.Fields{
					"roomID":      r.id,
					"peerID":      peerID,
					"otherPeerID": otherPeerID,
					"trackID":     track.ID(),
				}).Error("Failed to add track to peer")
			} else {
				r.logger.WithFields(logrus.Fields{
					"roomID":      r.id,
					"peerID":      peerID,
					"otherPeerID": otherPeerID,
					"trackID":     track.ID(),
				}).Info("Forwarded track to peer")
			}
		}
	}
}

// handleICEConnectionStateChange handles ICE connection state changes
func (r *Room) handleICEConnectionStateChange(peerID string, state webrtc.ICEConnectionState) {
	r.logger.WithFields(logrus.Fields{
		"roomID": r.id,
		"peerID": peerID,
		"state":  state,
	}).Debug("ICE connection state changed")

	switch state {
	case webrtc.ICEConnectionStateFailed:
		fallthrough
	case webrtc.ICEConnectionStateClosed:
		r.logger.WithFields(logrus.Fields{
			"roomID": r.id,
			"peerID": peerID,
		}).Warn("Peer connection failed or closed")

		// Remove peer from room
		if err := r.RemovePeer(peerID); err != nil {
			r.logger.WithFields(logrus.Fields{
				"roomID": r.id,
				"peerID": peerID,
			}).Error("Failed to remove peer after connection failure")
		}
	}
}

// isClosed checks if the room is closed
func (r *Room) isClosed() bool {
	r.closedMutex.RLock()
	defer r.closedMutex.RUnlock()

	return r.closed
}

// Close closes the room and all its peers
func (r *Room) Close() {
	r.closedMutex.Lock()
	r.closed = true
	r.closedMutex.Unlock()

	r.peersMutex.Lock()
	defer r.peersMutex.Unlock()

	for peerID, peer := range r.peers {
		peer.Close()
		r.logger.WithFields(logrus.Fields{
			"roomID": r.id,
			"peerID": peerID,
		}).Debug("Closed peer")
	}

	r.peers = make(map[string]*Peer)
	r.logger.WithField("roomID", r.id).Info("Room closed")
}