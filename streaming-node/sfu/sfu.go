package sfu

import (
	"fmt"
	"sync"
	"strings"

	"streaming-node/config"

	"github.com/pion/logging"
	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
)

// SFU represents the Selective Forwarding Unit
type SFU struct {
	config     *config.Config
	rooms      map[string]*Room
	roomsMutex sync.RWMutex
	api        *webrtc.API
	pcConfig   webrtc.Configuration
	logger     *logrus.Logger
}

// NewSFU creates a new SFU instance
func NewSFU(cfg *config.Config) *SFU {
	// Create WebRTC API with custom configuration
	webrtcConfig := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
		SDPSemantics: webrtc.SDPSemanticsUnifiedPlan,
	}

	if cfg.WebRTC.ICEServers != nil {
		webrtcConfig.ICEServers = cfg.WebRTC.ICEServers
	}

	// Create a setting engine with custom logger
	settingEngine := webrtc.SettingEngine{}
	settingEngine.LoggerFactory = &loggerFactory{}

	// If a UDP port range is configured, restrict ICE to that range.
	// This is critical when running SFU inside Docker with a fixed
	// port mapping (e.g. 8081-8090/udp), otherwise Pion will pick
	// random ephemeral ports that are not exposed.
	if cfg.WebRTC.UDPPortMin > 0 && cfg.WebRTC.UDPPortMax >= cfg.WebRTC.UDPPortMin {
		settingEngine.SetEphemeralUDPPortRange(uint16(cfg.WebRTC.UDPPortMin), uint16(cfg.WebRTC.UDPPortMax))
	}

	// If NAT1To1 IPs are configured, use them in ICE candidates so that
	// browsers connect to the host (e.g. 127.0.0.1 / host.docker.internal)
	// instead of the internal Docker IP of the container.
	if len(cfg.WebRTC.NAT1To1IPs) > 0 {
		candidateType := webrtc.ICECandidateTypeHost
		switch strings.ToLower(cfg.WebRTC.NAT1To1CandidateType) {
		case "srflx":
			candidateType = webrtc.ICECandidateTypeSrflx
		case "relay":
			candidateType = webrtc.ICECandidateTypeRelay
		case "prflx":
			candidateType = webrtc.ICECandidateTypePrflx
		}
		settingEngine.SetNAT1To1IPs(cfg.WebRTC.NAT1To1IPs, candidateType)
	}

	api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &SFU{
		config: cfg,
		rooms:  make(map[string]*Room),
		api:    api,
		pcConfig: webrtcConfig,
		logger: logger,
	}
}

// GetPeerConnectionConfig returns a copy of default peer connection config.
func (s *SFU) GetPeerConnectionConfig() webrtc.Configuration {
	cfg := s.pcConfig
	servers := make([]webrtc.ICEServer, 0, len(cfg.ICEServers))
	for _, srv := range cfg.ICEServers {
		urls := make([]string, len(srv.URLs))
		copy(urls, srv.URLs)
		servers = append(servers, webrtc.ICEServer{
			URLs:           urls,
			Username:       srv.Username,
			Credential:     srv.Credential,
			CredentialType: srv.CredentialType,
		})
	}
	cfg.ICEServers = servers
	return cfg
}

// CreateRoom creates a new room or returns existing one
func (s *SFU) CreateRoom(roomID string) (*Room, error) {
	s.roomsMutex.Lock()
	defer s.roomsMutex.Unlock()

	if room, exists := s.rooms[roomID]; exists {
		return room, nil
	}

	room := NewRoom(roomID, s.api, s.config, s.logger)
	s.rooms[roomID] = room

	s.logger.WithField("roomID", roomID).Info("Created new room")
	return room, nil
}

// GetRoom returns a room by ID
func (s *SFU) GetRoom(roomID string) (*Room, error) {
	s.roomsMutex.RLock()
	defer s.roomsMutex.RUnlock()

	room, exists := s.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room %s not found", roomID)
	}

	return room, nil
}

// RemoveRoom removes a room from the SFU
func (s *SFU) RemoveRoom(roomID string) {
	s.roomsMutex.Lock()
	defer s.roomsMutex.Unlock()

	if room, exists := s.rooms[roomID]; exists {
		room.Close()
		delete(s.rooms, roomID)
		s.logger.WithField("roomID", roomID).Info("Removed room")
	}
}

// GetRooms returns all active rooms
func (s *SFU) GetRooms() map[string]*Room {
	s.roomsMutex.RLock()
	defer s.roomsMutex.RUnlock()

	rooms := make(map[string]*Room)
	for id, room := range s.rooms {
		rooms[id] = room
	}

	return rooms
}

// Close cleans up all resources
func (s *SFU) Close() {
	s.roomsMutex.Lock()
	defer s.roomsMutex.Unlock()

	for roomID, room := range s.rooms {
		room.Close()
		s.logger.WithField("roomID", roomID).Info("Closed room")
	}

	s.rooms = make(map[string]*Room)
	s.logger.Info("SFU closed")
}

// LoggerFactory implements logging.LoggerFactory
type loggerFactory struct{}

func (f *loggerFactory) NewLogger(scope string) logging.LeveledLogger {
	return &logger{scope: scope}
}

type logger struct {
	scope string
}

func (l *logger) Trace(msg string) {
	logrus.WithField("scope", l.scope).Trace(msg)
}

func (l *logger) Tracef(format string, args ...interface{}) {
	logrus.WithField("scope", l.scope).Tracef(format, args...)
}

func (l *logger) Debug(msg string) {
	logrus.WithField("scope", l.scope).Debug(msg)
}

func (l *logger) Debugf(format string, args ...interface{}) {
	logrus.WithField("scope", l.scope).Debugf(format, args...)
}

func (l *logger) Info(msg string) {
	logrus.WithField("scope", l.scope).Info(msg)
}

func (l *logger) Infof(format string, args ...interface{}) {
	logrus.WithField("scope", l.scope).Infof(format, args...)
}

func (l *logger) Warn(msg string) {
	logrus.WithField("scope", l.scope).Warn(msg)
}

func (l *logger) Warnf(format string, args ...interface{}) {
	logrus.WithField("scope", l.scope).Warnf(format, args...)
}

func (l *logger) Error(msg string) {
	logrus.WithField("scope", l.scope).Error(msg)
}

func (l *logger) Errorf(format string, args ...interface{}) {
	logrus.WithField("scope", l.scope).Errorf(format, args...)
}
