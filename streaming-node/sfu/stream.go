package sfu

import (
	"fmt"
	"sync"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
)

// StreamManager manages streams within a room
type StreamManager struct {
	room         *Room
	streams      map[string]*Stream
	streamsMutex sync.RWMutex
	logger       *logrus.Logger
}

// Stream represents a media stream in the room
type Stream struct {
	id           string
	track        *webrtc.TrackRemote
	codec        webrtc.RTPCodecParameters
	subscribers  map[string]*Peer
	subscribersMutex sync.RWMutex
	qualityController *QualityController
	logger       *logrus.Logger
}

// NewStreamManager creates a new stream manager for a room
func NewStreamManager(room *Room, logger *logrus.Logger) *StreamManager {
	return &StreamManager{
		room:    room,
		streams: make(map[string]*Stream),
		logger:  logger,
	}
}

// AddStream adds a new stream to the manager
func (sm *StreamManager) AddStream(track *webrtc.TrackRemote, sourcePeerID string) (*Stream, error) {
	sm.streamsMutex.Lock()
	defer sm.streamsMutex.Unlock()

	streamID := fmt.Sprintf("%s_%s", track.StreamID(), track.ID())

	// Check if stream already exists
	if _, exists := sm.streams[streamID]; exists {
		return nil, fmt.Errorf("stream %s already exists", streamID)
	}

	stream := &Stream{
		id:          streamID,
		track:       track,
		codec:       track.Codec(),
		subscribers: make(map[string]*Peer),
		qualityController: NewQualityController(track, sm.logger),
		logger:      sm.logger,
	}

	sm.streams[streamID] = stream

	sm.logger.WithFields(logrus.Fields{
		"streamID": streamID,
		"trackID":  track.ID(),
		"kind":     track.Kind().String(),
		"codec":    track.Codec().MimeType,
	}).Info("Added new stream")

	// Start reading from the track
	go sm.readTrackPackets(stream)

	return stream, nil
}

// RemoveStream removes a stream from the manager
func (sm *StreamManager) RemoveStream(streamID string) error {
	sm.streamsMutex.Lock()
	defer sm.streamsMutex.Unlock()

	stream, exists := sm.streams[streamID]
	if !exists {
		return fmt.Errorf("stream %s not found", streamID)
	}

	stream.Close()
	delete(sm.streams, streamID)

	sm.logger.WithField("streamID", streamID).Info("Removed stream")

	return nil
}

// SubscribeToStream subscribes a peer to a stream
func (sm *StreamManager) SubscribeToStream(peer *Peer, streamID string) error {
	sm.streamsMutex.RLock()
	defer sm.streamsMutex.RUnlock()

	stream, exists := sm.streams[streamID]
	if !exists {
		return fmt.Errorf("stream %s not found", streamID)
	}

	stream.subscribersMutex.Lock()
	defer stream.subscribersMutex.Unlock()

	// Check if already subscribed
	if _, subscribed := stream.subscribers[peer.ID()]; subscribed {
		return nil // Already subscribed
	}

	stream.subscribers[peer.ID()] = peer

	sm.logger.WithFields(logrus.Fields{
		"streamID": streamID,
		"peerID":   peer.ID(),
	}).Info("Peer subscribed to stream")

	return nil
}

// UnsubscribeFromStream unsubscribes a peer from a stream
func (sm *StreamManager) UnsubscribeFromStream(peer *Peer, streamID string) error {
	sm.streamsMutex.RLock()
	defer sm.streamsMutex.RUnlock()

	stream, exists := sm.streams[streamID]
	if !exists {
		return fmt.Errorf("stream %s not found", streamID)
	}

	stream.subscribersMutex.Lock()
	defer stream.subscribersMutex.Unlock()

	if _, subscribed := stream.subscribers[peer.ID()]; !subscribed {
		return nil // Not subscribed
	}

	delete(stream.subscribers, peer.ID())

	sm.logger.WithFields(logrus.Fields{
		"streamID": streamID,
		"peerID":   peer.ID(),
	}).Info("Peer unsubscribed from stream")

	return nil
}

// GetStreams returns all streams
func (sm *StreamManager) GetStreams() map[string]*Stream {
	sm.streamsMutex.RLock()
	defer sm.streamsMutex.RUnlock()

	streams := make(map[string]*Stream)
	for id, stream := range sm.streams {
		streams[id] = stream
	}

	return streams
}

// readTrackPackets reads RTP packets from a track and forwards them to subscribers
func (sm *StreamManager) readTrackPackets(stream *Stream) {
	for {
		// Check if stream is still active
		sm.streamsMutex.RLock()
		_, exists := sm.streams[stream.id]
		sm.streamsMutex.RUnlock()

		if !exists {
			return // Stream was removed
		}

		// Read RTP packet
		rtpPacket, _, err := stream.track.ReadRTP()
		if err != nil {
			sm.logger.WithFields(logrus.Fields{
				"streamID": stream.id,
				"trackID":  stream.track.ID(),
			}).Error("Failed to read RTP packet")
			return
		}

		// Update quality controller first
		stream.qualityController.UpdateWithRTPPacket(rtpPacket)

		// Check if we should adapt quality
		stream.qualityController.AdaptQuality()

		// Get target bitrate for this stream
		targetBitrate := stream.qualityController.GetTargetBitrate()
		currentBitrate := stream.qualityController.GetQualityMetrics().Bitrate

		// Apply bandwidth limiting: only forward packets if we're within target bitrate
		// This is a simple throttling mechanism
		if currentBitrate > targetBitrate && targetBitrate > 0 {
			// Calculate packet drop rate to achieve target bitrate
			dropRate := 1.0 - float64(targetBitrate)/float64(currentBitrate)
			if dropRate > 0 && dropRate < 1.0 {
				// Randomly drop packets to achieve target bitrate
				// In production, this could be more sophisticated (e.g., drop based on priority)
				if stream.qualityController.shouldDropPacket(dropRate) {
					continue // Skip this packet
				}
			}
		}

		// Forward to all subscribers
		stream.subscribersMutex.RLock()
		subscribers := make([]*Peer, 0, len(stream.subscribers))
		for _, peer := range stream.subscribers {
			subscribers = append(subscribers, peer)
		}
		stream.subscribersMutex.RUnlock()

		for _, peer := range subscribers {
			peer.SendRTPPacket(stream.id, rtpPacket)
		}
	}
}

// GetStream returns a stream by ID
func (sm *StreamManager) GetStream(streamID string) (*Stream, error) {
	sm.streamsMutex.RLock()
	defer sm.streamsMutex.RUnlock()

	stream, exists := sm.streams[streamID]
	if !exists {
		return nil, fmt.Errorf("stream %s not found", streamID)
	}

	return stream, nil
}

// Close closes the stream manager and all streams
func (sm *StreamManager) Close() {
	sm.streamsMutex.Lock()
	defer sm.streamsMutex.Unlock()

	for streamID, stream := range sm.streams {
		stream.Close()
		sm.logger.WithField("streamID", streamID).Debug("Closed stream")
	}

	sm.streams = make(map[string]*Stream)
	sm.logger.Info("Stream manager closed")
}

// ID returns the stream ID
func (s *Stream) ID() string {
	return s.id
}

// GetTrack returns the WebRTC track
func (s *Stream) GetTrack() *webrtc.TrackRemote {
	return s.track
}

// GetCodec returns the stream codec
func (s *Stream) GetCodec() webrtc.RTPCodecParameters {
	return s.codec
}

// GetSubscribers returns all subscribers
func (s *Stream) GetSubscribers() map[string]*Peer {
	s.subscribersMutex.RLock()
	defer s.subscribersMutex.RUnlock()

	subscribers := make(map[string]*Peer)
	for id, peer := range s.subscribers {
		subscribers[id] = peer
	}

	return subscribers
}

// GetSubscriberCount returns the number of subscribers
func (s *Stream) GetSubscriberCount() int {
	s.subscribersMutex.RLock()
	defer s.subscribersMutex.RUnlock()

	return len(s.subscribers)
}

// Close closes the stream
func (s *Stream) Close() {
	s.subscribersMutex.Lock()
	s.subscribers = make(map[string]*Peer)
	s.subscribersMutex.Unlock()

	s.logger.WithField("streamID", s.id).Info("Stream closed")
}

// SendRTPPacket is a method on Peer to send RTP packets (placeholder for interface)
func (p *Peer) SendRTPPacket(streamID string, packet *rtp.Packet) {
	// This would forward the RTP packet to the appropriate track for this peer
	p.logger.WithFields(logrus.Fields{
		"peerID":   p.id,
		"streamID": streamID,
		"sequence": packet.SequenceNumber,
	}).Debug("Sending RTP packet to peer")
}