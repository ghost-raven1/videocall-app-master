package sfu

import (
	"sync"

	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
)

// Peer represents a WebRTC peer connection in a room
type Peer struct {
	id               string
	pc               *webrtc.PeerConnection
	room             *Room
	logger           *logrus.Logger
	tracks           map[string]*webrtc.TrackLocalStaticRTP
	tracksMutex      sync.RWMutex
	onTrackHandlers  []func(*webrtc.TrackRemote, *webrtc.RTPReceiver)
	onICEHandlers    []func(webrtc.ICEConnectionState)
	onNegotiationNeededHandlers []func()
	closed           bool
	closedMutex      sync.RWMutex
}

// NewPeer creates a new peer
func NewPeer(peerID string, pc *webrtc.PeerConnection, room *Room, logger *logrus.Logger) *Peer {
	peer := &Peer{
		id:     peerID,
		pc:     pc,
		room:   room,
		logger: logger,
		tracks: make(map[string]*webrtc.TrackLocalStaticRTP),
	}

	// Set up peer connection handlers
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		peer.handleTrack(track, receiver)
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		peer.handleICEConnectionStateChange(state)
	})

	// Handle negotiation needed when tracks are added
	pc.OnNegotiationNeeded(func() {
		peer.logger.WithFields(logrus.Fields{
			"peerID": peer.id,
		}).Info("Negotiation needed - new track added")
		
		// Call negotiation needed handlers
		for _, handler := range peer.onNegotiationNeededHandlers {
			handler()
		}
	})

	return peer
}

// ID returns the peer ID
func (p *Peer) ID() string {
	return p.id
}

// AddTrack adds a remote track to be forwarded to this peer.
// originPeerID is the ID of the peer that originally sent this track.
// We use it in the track/stream IDs so that SFU clients can reliably
// determine which logical participant a track belongs to.
func (p *Peer) AddTrack(remoteTrack *webrtc.TrackRemote, originPeerID string) error {
	p.tracksMutex.Lock()
	defer p.tracksMutex.Unlock()

	if p.isClosed() {
		return nil // Already closed, ignore
	}

	// Check if track already exists
	if _, exists := p.tracks[remoteTrack.ID()]; exists {
		return nil // Track already added
	}

	// Create a track to send to this peer. We intentionally suffix
	// the IDs with the ORIGIN peer ID (sender), not with this peer's
	// ID, so that downstream WebRTC clients can extract the
	// participant identity from stream.id / track.label.
	track, err := webrtc.NewTrackLocalStaticRTP(
		remoteTrack.Codec().RTPCodecCapability,
		remoteTrack.ID()+"_"+originPeerID,
		remoteTrack.StreamID()+"_"+originPeerID,
	)
	if err != nil {
		return err
	}

	// Add track to peer connection
	sender, err := p.pc.AddTrack(track)
	if err != nil {
		return err
	}

	p.tracks[remoteTrack.ID()] = track

	p.logger.WithFields(logrus.Fields{
		"peerID":         p.id,
		"originPeerID":   originPeerID,
		"trackID":        remoteTrack.ID(),
		"streamID":       remoteTrack.StreamID(),
		"codec":          remoteTrack.Codec().MimeType,
		"signalingState": p.pc.SignalingState().String(),
		"connectionState": p.pc.ConnectionState().String(),
	}).Info("Added track to peer connection")

	// Start forwarding RTP packets
	go p.forwardTrack(remoteTrack, track)

	// If connection is already established, trigger renegotiation
	// OnNegotiationNeeded will be called automatically by WebRTC
	// We just need to handle it in the server code
	signalingState := p.pc.SignalingState()
	if signalingState == webrtc.SignalingStateStable {
		p.logger.WithFields(logrus.Fields{
			"peerID":  p.id,
			"trackID": remoteTrack.ID(),
		}).Info("Connection stable, OnNegotiationNeeded should be triggered")
		// The OnNegotiationNeeded handler will be called automatically by WebRTC
	} else {
		p.logger.WithFields(logrus.Fields{
			"peerID":         p.id,
			"trackID":        remoteTrack.ID(),
			"signalingState": signalingState.String(),
		}).Info("Track added before connection stable, will be included in next SDP")
	}

	// Store sender for potential removal later
	_ = sender

	return nil
}

// RemoveTrack removes a track from the peer
func (p *Peer) RemoveTrack(trackID string) error {
	p.tracksMutex.Lock()
	defer p.tracksMutex.Unlock()

	track, exists := p.tracks[trackID]
	if !exists {
		return nil // Track doesn't exist
	}

	// Remove track from peer connection
	for _, sender := range p.pc.GetSenders() {
		if sender.Track() != nil && sender.Track().ID() == track.ID() {
			if err := p.pc.RemoveTrack(sender); err != nil {
				p.logger.WithFields(logrus.Fields{
					"peerID":  p.id,
					"trackID": trackID,
				}).Error("Failed to remove track from peer connection")
			}
			break
		}
	}

	delete(p.tracks, trackID)

	p.logger.WithFields(logrus.Fields{
		"peerID":  p.id,
		"trackID": trackID,
	}).Debug("Removed track from peer")

	return nil
}

// SendMessage sends a message to the peer (for signaling)
func (p *Peer) SendMessage(message interface{}) {
	// This would be implemented with WebSocket or other signaling mechanism
	p.logger.WithField("peerID", p.id).Debug("Sending message to peer")
}

// OnTrack adds a handler for when tracks are received
func (p *Peer) OnTrack(handler func(*webrtc.TrackRemote, *webrtc.RTPReceiver)) {
	p.onTrackHandlers = append(p.onTrackHandlers, handler)
}

// OnICEConnectionStateChange adds a handler for ICE connection state changes
func (p *Peer) OnICEConnectionStateChange(handler func(webrtc.ICEConnectionState)) {
	p.onICEHandlers = append(p.onICEHandlers, handler)
}

// OnNegotiationNeeded adds a handler for when negotiation is needed
func (p *Peer) OnNegotiationNeeded(handler func()) {
	p.onNegotiationNeededHandlers = append(p.onNegotiationNeededHandlers, handler)
}

// GetPeerConnection returns the underlying peer connection
func (p *Peer) GetPeerConnection() *webrtc.PeerConnection {
	return p.pc
}

// GetTracks returns all tracks for this peer
func (p *Peer) GetTracks() map[string]*webrtc.TrackLocalStaticRTP {
	p.tracksMutex.RLock()
	defer p.tracksMutex.RUnlock()

	tracks := make(map[string]*webrtc.TrackLocalStaticRTP)
	for id, track := range p.tracks {
		tracks[id] = track
	}

	return tracks
}

// forwardTrack forwards RTP packets from remote track to local track
func (p *Peer) forwardTrack(remoteTrack *webrtc.TrackRemote, localTrack *webrtc.TrackLocalStaticRTP) {
	for {
		if p.isClosed() {
			return
		}

		// Read RTP packet from remote track
		rtpPacket, _, err := remoteTrack.ReadRTP()
		if err != nil {
			p.logger.WithFields(logrus.Fields{
				"peerID":  p.id,
				"trackID": remoteTrack.ID(),
			}).Error("Failed to read RTP packet")
			return
		}

		// Write RTP packet to local track
		if err := localTrack.WriteRTP(rtpPacket); err != nil {
			p.logger.WithFields(logrus.Fields{
				"peerID":  p.id,
				"trackID": remoteTrack.ID(),
			}).Error("Failed to write RTP packet")
			return
		}
	}
}

// handleTrack handles incoming tracks from the peer connection
func (p *Peer) handleTrack(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
	p.logger.WithFields(logrus.Fields{
		"peerID":    p.id,
		"trackID":   track.ID(),
		"kind":      track.Kind(),
		"streamID":  track.StreamID(),
		"codec":     track.Codec().MimeType,
		"handlers":  len(p.onTrackHandlers),
	}).Info("Received track from peer connection")

	// Call track handlers
	for i, handler := range p.onTrackHandlers {
		p.logger.WithFields(logrus.Fields{
			"peerID":  p.id,
			"trackID": track.ID(),
			"handler": i,
		}).Debug("Calling track handler")
		handler(track, receiver)
	}
}

// handleICEConnectionStateChange handles ICE connection state changes
func (p *Peer) handleICEConnectionStateChange(state webrtc.ICEConnectionState) {
	p.logger.WithFields(logrus.Fields{
		"peerID": p.id,
		"state":  state,
	}).Debug("ICE connection state changed")

	// Call ICE handlers
	for _, handler := range p.onICEHandlers {
		handler(state)
	}
}

// isClosed checks if the peer is closed
func (p *Peer) isClosed() bool {
	p.closedMutex.RLock()
	defer p.closedMutex.RUnlock()

	return p.closed
}

// Close closes the peer connection and cleans up resources
func (p *Peer) Close() {
	p.closedMutex.Lock()
	if p.closed {
		p.closedMutex.Unlock()
		return
	}
	p.closed = true
	p.closedMutex.Unlock()

	p.tracksMutex.Lock()
	defer p.tracksMutex.Unlock()

	// Close all tracks
	for trackID := range p.tracks {
		p.logger.WithFields(logrus.Fields{
			"peerID":  p.id,
			"trackID": trackID,
		}).Debug("Closing track")
		// Note: TrackLocalStaticRTP doesn't have a Stop() method in newer versions
		// Tracks are automatically cleaned up when the peer connection closes
	}

	p.tracks = make(map[string]*webrtc.TrackLocalStaticRTP)

	// Close peer connection
	if p.pc != nil {
		if err := p.pc.Close(); err != nil {
			p.logger.WithField("peerID", p.id).Error("Failed to close peer connection")
		}
	}

	p.logger.WithField("peerID", p.id).Info("Peer closed")
}