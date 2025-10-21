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

	return peer
}

// ID returns the peer ID
func (p *Peer) ID() string {
	return p.id
}

// AddTrack adds a remote track to be forwarded to this peer
func (p *Peer) AddTrack(remoteTrack *webrtc.TrackRemote) error {
	p.tracksMutex.Lock()
	defer p.tracksMutex.Unlock()

	if p.isClosed() {
		return nil // Already closed, ignore
	}

	// Check if track already exists
	if _, exists := p.tracks[remoteTrack.ID()]; exists {
		return nil // Track already added
	}

	// Create a track to send to this peer
	track, err := webrtc.NewTrackLocalStaticRTP(
		remoteTrack.Codec().RTPCodecCapability,
		remoteTrack.ID()+"_"+p.id,
		remoteTrack.StreamID()+"_"+p.id,
	)
	if err != nil {
		return err
	}

	// Add track to peer connection
	if _, err := p.pc.AddTrack(track); err != nil {
		return err
	}

	p.tracks[remoteTrack.ID()] = track

	p.logger.WithFields(logrus.Fields{
		"peerID":    p.id,
		"trackID":   remoteTrack.ID(),
		"streamID":  remoteTrack.StreamID(),
		"codec":     remoteTrack.Codec().MimeType,
	}).Debug("Added track to peer")

	// Start forwarding RTP packets
	go p.forwardTrack(remoteTrack, track)

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
		"peerID":  p.id,
		"trackID": track.ID(),
		"kind":    track.Kind(),
	}).Debug("Received track from peer")

	// Call track handlers
	for _, handler := range p.onTrackHandlers {
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
	for trackID, track := range p.tracks {
		if err := track.Stop(); err != nil {
			p.logger.WithFields(logrus.Fields{
				"peerID":  p.id,
				"trackID": trackID,
			}).Error("Failed to stop track")
		}
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