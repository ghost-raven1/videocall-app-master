package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"streaming-node/config"
	"streaming-node/sfu"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"github.com/rs/cors"
	"github.com/sirupsen/logrus"
)

// Server represents the HTTP/WebSocket server
type Server struct {
	config      *config.Config
	sfu         *sfu.SFU
	httpServer  *http.Server
	router      *mux.Router
	upgrader    websocket.Upgrader
	connections map[string]*WebSocketConnection
	connMutex   sync.RWMutex
	logger      *logrus.Logger
}

// WebSocketConnection represents a WebSocket connection
type WebSocketConnection struct {
	conn   *websocket.Conn
	send   chan []byte
	roomID string
	peerID string
	logger *logrus.Logger
	sfu    *sfu.SFU
	peer   *sfu.Peer // SFU peer connection
}

// Message represents a WebSocket message
type Message struct {
	Type      string      `json:"type"`
	RoomID    string      `json:"room_id,omitempty"`
	PeerID    string      `json:"peer_id,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// SignalingMessage represents a WebRTC signaling message
type SignalingMessage struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
}

func extractCandidateType(candidate string) string {
	marker := " typ "
	idx := strings.Index(candidate, marker)
	if idx == -1 {
		return "unknown"
	}

	rest := candidate[idx+len(marker):]
	fields := strings.Fields(rest)
	if len(fields) == 0 {
		return "unknown"
	}

	return fields[0]
}

func truncateCandidate(candidate string) string {
	if len(candidate) <= 140 {
		return candidate
	}
	return candidate[:140] + "..."
}

func extractCandidateAddress(candidate string) string {
	fields := strings.Fields(candidate)
	if len(fields) < 6 {
		return ""
	}

	// Candidate format:
	// candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...
	return strings.Trim(fields[4], "[]")
}

func shouldIgnoreRemoteCandidate(candidate string) (bool, string) {
	ipStr := extractCandidateAddress(candidate)
	if ipStr == "" {
		return false, ""
	}
	candidateType := extractCandidateType(candidate)

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false, ""
	}

	if ip.IsUnspecified() {
		return true, "unspecified-ip"
	}

	if ip.IsLoopback() {
		return true, "loopback-ip"
	}

	// In Docker-based deployments host candidates on private ranges are often
	// not actually reachable from the SFU container. Prefer srflx/relay.
	if candidateType == "host" && ip.IsPrivate() {
		return true, "private-host-ip"
	}

	// Reject clearly non-routable browser privacy candidates
	// that cause TURN CreatePermission(403) and delay checks.
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] >= 224 {
			return true, "multicast-or-reserved-ipv4"
		}
	}

	if ip.To4() == nil && ip.To16() != nil {
		// Unique local IPv6 (fc00::/7)
		if ip[0]&0xfe == 0xfc {
			return true, "unique-local-ipv6"
		}
		if ip.IsMulticast() {
			return true, "multicast-ipv6"
		}
	}

	return false, ""
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, sfuInstance *sfu.SFU) *Server {
	router := mux.NewRouter()

	// Configure CORS
	corsOptions := cors.Options{
		AllowedOrigins: cfg.Server.AllowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	server := &Server{
		config:      cfg,
		sfu:         sfuInstance,
		router:      router,
		connections: make(map[string]*WebSocketConnection),
		logger:      logger,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")

				// If no origin header, reject for security
				if origin == "" {
					logger.WithField("ip", r.RemoteAddr).Warn("WebSocket connection rejected: missing origin header")
					return false
				}

				// Check if origin is in allowed list
				allowed := false
				for _, allowedOrigin := range cfg.Server.AllowedOrigins {
					if allowedOrigin == "*" {
						// Wildcard allows all origins (development only)
						allowed = true
						break
					}
					if origin == allowedOrigin {
						allowed = true
						break
					}
				}

				if !allowed {
					logger.WithFields(logrus.Fields{
						"origin": origin,
						"ip":     r.RemoteAddr,
						"allowed_origins": cfg.Server.AllowedOrigins,
					}).Warn("WebSocket connection rejected: origin not allowed")
					return false
				}

				logger.WithFields(logrus.Fields{
					"origin": origin,
					"ip":     r.RemoteAddr,
				}).Debug("WebSocket connection accepted")

				return true
			},
			ReadBufferSize:  64 * 1024,  // 64KB for large SDP messages
			WriteBufferSize: 64 * 1024,  // 64KB for large SDP messages
		},
	}

	server.setupRoutes()

	httpServer := &http.Server{
		Addr:         cfg.GetAddress(),
		Handler:      cors.New(corsOptions).Handler(router),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	server.httpServer = httpServer

	return server
}

// setupRoutes configures HTTP routes
func (s *Server) setupRoutes() {
	// API routes
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Room management
	api.HandleFunc("/rooms", s.handleCreateRoom).Methods("POST")
	api.HandleFunc("/rooms/{roomID}", s.handleGetRoom).Methods("GET")
	api.HandleFunc("/rooms/{roomID}", s.handleDeleteRoom).Methods("DELETE")

	// Health check
	s.router.HandleFunc("/health", s.handleHealthCheck).Methods("GET")

	// WebSocket endpoint for signaling
	s.router.HandleFunc("/ws", s.handleWebSocket)

	// WebRTC endpoints
	api.HandleFunc("/rooms/{roomID}/join", s.handleJoinRoom).Methods("POST")

	// Metrics endpoint
	api.HandleFunc("/metrics", s.handleMetrics).Methods("GET")
}

// Start starts the server
func (s *Server) Start() error {
	s.logger.WithField("address", s.config.GetAddress()).Info("Starting server")

	return s.httpServer.ListenAndServe()
}

// Close shuts down the server
func (s *Server) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Close all WebSocket connections
	s.connMutex.Lock()
	for _, conn := range s.connections {
		conn.Close()
	}
	s.connections = make(map[string]*WebSocketConnection)
	s.connMutex.Unlock()

	// Shutdown HTTP server
	return s.httpServer.Shutdown(ctx)
}

// handleCreateRoom handles room creation requests
func (s *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RoomID string `json:"room_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.RoomID == "" {
		http.Error(w, "room_id is required", http.StatusBadRequest)
		return
	}

	// Create room in SFU
	room, err := s.sfu.CreateRoom(req.RoomID)
	if err != nil {
		s.logger.WithFields(logrus.Fields{
			"roomID": req.RoomID,
			"error":  err,
		}).Error("Failed to create room")

		http.Error(w, "Failed to create room", http.StatusInternalServerError)
		return
	}

	s.logger.WithField("roomID", req.RoomID).Info("Room created")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"room_id": room.ID(),
		"status":  "created",
	})
}

// handleGetRoom handles room information requests
func (s *Server) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomID"]

	room, err := s.sfu.GetRoom(roomID)
	if err != nil {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"room_id":     room.ID(),
		"peer_count":  room.GetPeerCount(),
		"created_at":  time.Now(), // In real implementation, track creation time
	})
}

// handleDeleteRoom handles room deletion requests
func (s *Server) handleDeleteRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomID"]

	s.sfu.RemoveRoom(roomID)

	s.logger.WithField("roomID", roomID).Info("Room deleted")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "deleted",
	})
}

// handleJoinRoom handles room join requests
func (s *Server) handleJoinRoom(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["roomID"]

	var req struct {
		PeerID string `json:"peer_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Create peer connection (this would be upgraded to WebSocket for actual signaling)
	// For now, return connection information
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"room_id":    roomID,
		"peer_id":    req.PeerID,
		"status":     "joined",
		"websocket_url": fmt.Sprintf("ws://%s/ws?room=%s&peer=%s",
			r.Host, roomID, req.PeerID),
	})
}

// handleHealthCheck handles health check requests
func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	// Check SFU health
	rooms := s.sfu.GetRooms()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now(),
		"rooms":     len(rooms),
		"version":   "1.0.0",
	})
}

// handleMetrics handles metrics requests
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	rooms := s.sfu.GetRooms()

	metrics := map[string]interface{}{
		"total_rooms":    len(rooms),
		"total_peers":    0,
		"server_uptime":  time.Since(time.Now()), // In real implementation, track start time
		"rooms":         make(map[string]interface{}),
	}

	totalPeers := 0
	for _, room := range rooms {
		peerCount := room.GetPeerCount()
		totalPeers += peerCount

		metrics["rooms"].(map[string]interface{})[room.ID()] = map[string]interface{}{
			"peer_count": peerCount,
		}
	}
	metrics["total_peers"] = totalPeers

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// handleWebSocket handles WebSocket connections for signaling
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	// Get room and peer information from query parameters
	roomID := r.URL.Query().Get("room")
	peerID := r.URL.Query().Get("peer")

	if roomID == "" || peerID == "" {
		conn.Close()
		return
	}

	// Create WebSocket connection wrapper
	wsConn := &WebSocketConnection{
		conn:   conn,
		send:   make(chan []byte, 256),
		roomID: roomID,
		peerID: peerID,
		logger: s.logger,
		sfu:    s.sfu,
	}

	// Register connection
	s.connMutex.Lock()
	s.connections[peerID] = wsConn
	s.connMutex.Unlock()

	s.logger.WithFields(logrus.Fields{
		"roomID": roomID,
		"peerID": peerID,
	}).Info("WebSocket connection established")

	// Start goroutines for reading and writing
	go wsConn.readPump()
	go wsConn.writePump()
}

// WebSocket connection methods

func (c *WebSocketConnection) readPump() {
	defer func() {
		// Clean up peer connection when WebSocket closes
		if c.peer != nil {
			room, err := c.sfu.GetRoom(c.roomID)
			if err == nil {
				room.RemovePeer(c.peerID)
			}
		}
		c.conn.Close()
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
		}).Info("WebSocket readPump closed")
	}()

	// Increase read limit to handle large SDP offers (up to 128KB)
	c.conn.SetReadLimit(128 * 1024)
	
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
	}).Info("Starting WebSocket readPump")

	for {
		messageType, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.WithError(err).Error("WebSocket error")
			} else {
				c.logger.WithFields(logrus.Fields{
					"error": err.Error(),
					"roomID": c.roomID,
					"peerID": c.peerID,
				}).Info("WebSocket read ended (normal or expected close)")
			}
			break
		}

		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
			"messageSize": len(message),
			"messageType": messageType,
		}).Info("Read message from WebSocket, calling handleMessage")
		
		c.handleMessage(message)
	}
}

func (c *WebSocketConnection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *WebSocketConnection) handleMessage(message []byte) {
	previewLen := 100
	if len(message) < previewLen {
		previewLen = len(message)
	}
	c.logger.WithFields(logrus.Fields{
		"messageSize": len(message),
		"messagePreview": string(message[:previewLen]),
	}).Info("Raw WebSocket message received")
	
	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		c.logger.WithError(err).WithFields(logrus.Fields{
			"message": string(message),
		}).Error("Failed to unmarshal message")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"type":   msg.Type,
		"roomID": msg.RoomID,
		"peerID": msg.PeerID,
		"hasData": msg.Data != nil,
	}).Info("Received WebSocket message")

	// Handle different message types
	switch msg.Type {
	case "offer", "answer", "ice-candidate":
		c.logger.WithFields(logrus.Fields{
			"type":   msg.Type,
			"roomID": msg.RoomID,
			"peerID": msg.PeerID,
		}).Info("Handling signaling message")
		c.handleSignalingMessage(msg)
	case "ice-candidates-batch":
		// Handle batched ICE candidates for large data streams
		c.handleBatchedICECandidates(msg)
	case "subscribe":
		c.handleSubscribeMessage(msg)
	case "unsubscribe":
		c.handleUnsubscribeMessage(msg)
	default:
		c.logger.WithField("type", msg.Type).Warn("Unknown message type")
	}
}

func (c *WebSocketConnection) handleSignalingMessage(msg Message) {
	// Get or create room if it doesn't exist
	room, err := c.sfu.GetRoom(c.roomID)
	if err != nil {
		// Room doesn't exist, create it
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
		}).Info("Room not found, creating it")
		room, err = c.sfu.CreateRoom(c.roomID)
		if err != nil {
			c.logger.WithError(err).Error("Failed to create room")
			return
		}
	}

	// Handle offer - create peer connection on server side for SFU
	if msg.Type == "offer" {
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
		}).Info("Received offer, creating peer connection on server")
		c.handleOffer(room, msg)
		return
	}

	// Handle answer - set remote description
	if msg.Type == "answer" {
		c.handleAnswer(msg)
		return
	}

	// Handle ICE candidate
	if msg.Type == "ice-candidate" {
		c.handleICECandidate(msg)
		return
	}

	// For other signaling messages, forward to other peers
	room.BroadcastToAll(c.peerID, msg)
}

func (c *WebSocketConnection) handleOffer(room *sfu.Room, msg Message) {
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
		"msgRoomID": msg.RoomID,
		"msgPeerID": msg.PeerID,
	}).Info("Creating peer connection on server for SFU")
	
	// Create peer connection on server side using SFU default config.
	// This must include ICE servers (STUN/TURN) from config.
	pcConfig := c.sfu.GetPeerConnectionConfig()
	c.logger.WithFields(logrus.Fields{
		"roomID":         c.roomID,
		"peerID":         c.peerID,
		"iceServersCount": len(pcConfig.ICEServers),
	}).Info("Creating peer connection with SFU WebRTC config")
	pc, err := room.GetAPI().NewPeerConnection(pcConfig)
	if err != nil {
		c.logger.WithError(err).Error("Failed to create peer connection")
		return
	}
	
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
	}).Info("Peer connection created successfully")

	// Handle ICE candidates from server side
	pc.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			candidateJSON := candidate.ToJSON()
			c.logger.WithFields(logrus.Fields{
				"roomID":        c.roomID,
				"peerID":        c.peerID,
				"candidateType": extractCandidateType(candidateJSON.Candidate),
				"candidate":     truncateCandidate(candidateJSON.Candidate),
			}).Info("Sending local ICE candidate to client")

			iceMsg := Message{
				Type:   "ice-candidate",
				RoomID: c.roomID,
				PeerID: c.peerID,
				Data: map[string]interface{}{
					"candidate":      candidateJSON.Candidate,
					"sdpMLineIndex":  candidateJSON.SDPMLineIndex,
					"sdpMid":         candidateJSON.SDPMid,
				},
			}
			iceBytes, _ := json.Marshal(iceMsg)
			c.send <- iceBytes
		}
	})

	// Add peer to room (OnTrack handler will be set up in room.AddPeer)
	peer, err := room.AddPeer(c.peerID, pc)
	if err != nil {
		c.logger.WithError(err).Error("Failed to add peer to room")
		pc.Close()
		return
	}

	c.peer = peer

	// Handle negotiation needed when tracks are added after connection is established
	peer.OnNegotiationNeeded(func() {
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
		}).Info("Negotiation needed - creating new offer for added tracks")
		
		// Create new offer with added tracks
		pc := peer.GetPeerConnection()
		if pc == nil {
			return
		}
		
		offer, err := pc.CreateOffer(nil)
		if err != nil {
			c.logger.WithError(err).Error("Failed to create offer for renegotiation")
			return
		}
		
		err = pc.SetLocalDescription(offer)
		if err != nil {
			c.logger.WithError(err).Error("Failed to set local description for renegotiation")
			return
		}
		
		// Send new offer to client
		offerMsg := Message{
			Type:   "offer",
			RoomID: c.roomID,
			PeerID: c.peerID,
			Data: map[string]interface{}{
				"sdp":  offer.SDP,
				"type": offer.Type.String(),
			},
		}
		
		offerBytes, err := json.Marshal(offerMsg)
		if err != nil {
			c.logger.WithError(err).Error("Failed to marshal renegotiation offer")
			return
		}
		
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
		}).Info("Sending renegotiation offer to client")
		
		c.send <- offerBytes
	})

	// Set remote description from offer
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.logger.Error("Invalid offer data format")
		return
	}

	sdpStr, ok := dataMap["sdp"].(string)
	if !ok {
		c.logger.Error("Invalid SDP in offer")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
		"sdpLength": len(sdpStr),
	}).Info("Setting remote description from offer")
	
	err = pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdpStr,
	})
	if err != nil {
		c.logger.WithError(err).Error("Failed to set remote description")
		return
	}
	
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
		"signalingState": pc.SignalingState().String(),
		"connectionState": pc.ConnectionState().String(),
		"iceConnectionState": pc.ICEConnectionState().String(),
	}).Info("Remote description set successfully, waiting for tracks")
	
	// Log transceivers to see if tracks are expected
	transceivers := pc.GetTransceivers()
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
		"transceiversCount": len(transceivers),
	}).Info("Transceivers after setting remote description")
	for i, tr := range transceivers {
		c.logger.WithFields(logrus.Fields{
			"roomID": c.roomID,
			"peerID": c.peerID,
			"transceiverIndex": i,
			"direction": tr.Direction().String(),
			"kind": tr.Kind().String(),
			"receiver": tr.Receiver() != nil,
			"sender": tr.Sender() != nil,
		}).Info("Transceiver info")
	}

	// Add existing tracks from other peers BEFORE creating answer
	// This ensures all tracks are included in the initial SDP
	existingTracks := room.GetPeerTracks()
	for existingPeerID, tracks := range existingTracks {
		if existingPeerID != c.peerID {
			for _, track := range tracks {
				// Use existingPeerID (the original sender) so that the
				// forwarded track IDs remain consistent for all receivers.
				if err := peer.AddTrack(track, existingPeerID); err != nil {
					c.logger.WithFields(logrus.Fields{
						"existingPeerID": existingPeerID,
						"trackID":        track.ID(),
					}).Error("Failed to add existing track before answer")
				} else {
					c.logger.WithFields(logrus.Fields{
						"existingPeerID": existingPeerID,
						"trackID":        track.ID(),
					}).Info("Added existing track before answer")
				}
			}
		}
	}

	// Create answer (will include all added tracks)
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		c.logger.WithError(err).Error("Failed to create answer")
		return
	}

	err = pc.SetLocalDescription(answer)
	if err != nil {
		c.logger.WithError(err).Error("Failed to set local description")
		return
	}

	// Send answer back to client
	answerMsg := Message{
		Type:   "answer",
		RoomID: c.roomID,
		PeerID: c.peerID,
		Data: map[string]interface{}{
			"sdp":  answer.SDP,
			"type": answer.Type.String(),
		},
	}

	answerBytes, err := json.Marshal(answerMsg)
	if err != nil {
		c.logger.WithError(err).Error("Failed to marshal answer message")
		return
	}
	
	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
		"answerSize": len(answerBytes),
	}).Info("Sending answer to client")
	
	c.send <- answerBytes

	// Notify other peers about new peer joining
	peerJoinedMsg := Message{
		Type:   "peer-joined",
		RoomID: c.roomID,
		PeerID: c.peerID,
	}
	room.BroadcastToAll(c.peerID, peerJoinedMsg)

	c.logger.WithFields(logrus.Fields{
		"roomID": c.roomID,
		"peerID": c.peerID,
	}).Info("Created peer connection and sent answer")
}

func (c *WebSocketConnection) handleAnswer(msg Message) {
	if c.peer == nil {
		c.logger.Warn("Received answer but no peer connection exists")
		return
	}

	pc := c.peer.GetPeerConnection()
	if pc == nil {
		return
	}

	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.logger.Error("Invalid answer data format")
		return
	}

	sdpStr, ok := dataMap["sdp"].(string)
	if !ok {
		c.logger.Error("Invalid SDP in answer")
		return
	}

	err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdpStr,
	})
	if err != nil {
		c.logger.WithError(err).Error("Failed to set remote description from answer")
	}
}

func (c *WebSocketConnection) handleICECandidate(msg Message) {
	if c.peer == nil {
		c.logger.Warn("Received ICE candidate but no peer connection exists")
		return
	}

	pc := c.peer.GetPeerConnection()
	if pc == nil {
		return
	}

	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.logger.Error("Invalid ICE candidate data format")
		return
	}

	candidateStr, ok := dataMap["candidate"].(string)
	if !ok {
		c.logger.Error("Invalid candidate in ICE candidate message")
		return
	}

	if ignore, reason := shouldIgnoreRemoteCandidate(candidateStr); ignore {
		c.logger.WithFields(logrus.Fields{
			"roomID":        c.roomID,
			"peerID":        c.peerID,
			"reason":        reason,
			"candidateType": extractCandidateType(candidateStr),
			"candidate":     truncateCandidate(candidateStr),
		}).Info("Ignoring remote ICE candidate")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"roomID":        c.roomID,
		"peerID":        c.peerID,
		"candidateType": extractCandidateType(candidateStr),
		"candidate":     truncateCandidate(candidateStr),
	}).Info("Adding remote ICE candidate to peer connection")

	iceCandidate := webrtc.ICECandidateInit{
		Candidate: candidateStr,
	}

	if sdpMid, ok := dataMap["sdpMid"].(string); ok {
		iceCandidate.SDPMid = &sdpMid
	}

	if sdpMLineIndex, ok := dataMap["sdpMLineIndex"].(float64); ok {
		index := uint16(sdpMLineIndex)
		iceCandidate.SDPMLineIndex = &index
	}

	err := pc.AddICECandidate(iceCandidate)
	if err != nil {
		c.logger.WithError(err).Error("Failed to add ICE candidate")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"roomID":        c.roomID,
		"peerID":        c.peerID,
		"candidateType": extractCandidateType(candidateStr),
	}).Info("Remote ICE candidate added successfully")
}

func (c *WebSocketConnection) handleBatchedICECandidates(msg Message) {
	// Handle batched ICE candidates: expand into individual ice-candidate
	// messages and apply them to this peer's server-side PeerConnection,
	// just like in handleICECandidate. We DO NOT broadcast these candidates
	// to other peers, they are only for the SFU <-> client connection.

	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		c.logger.Warn("Invalid batch ICE candidates data format")
		return
	}

	candidates, ok := dataMap["candidates"].([]interface{})
	if !ok {
		c.logger.Warn("Invalid candidates array in batch message")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"roomID":         c.roomID,
		"peerID":         c.peerID,
		"candidateCount": len(candidates),
	}).Info("Processing batched ICE candidates")

	for _, candidateData := range candidates {
		candidateMap, ok := candidateData.(map[string]interface{})
		if !ok {
			c.logger.Warn("Invalid candidate data in batch")
			continue
		}

		iceMsg := Message{
			Type:   "ice-candidate",
			RoomID: msg.RoomID,
			PeerID: msg.PeerID,
			Data: map[string]interface{}{
				"candidate":      candidateMap["candidate"],
				"sdpMLineIndex": candidateMap["sdpMLineIndex"],
				"sdpMid":        candidateMap["sdpMid"],
			},
		}

		// Apply candidate to this peer's PeerConnection (same logic as handleICECandidate)
		c.handleICECandidate(iceMsg)
	}
}

func (c *WebSocketConnection) handleSubscribeMessage(msg Message) {
	// Handle stream subscription requests
	c.logger.WithFields(logrus.Fields{
		"peerID":   c.peerID,
		"roomID":   c.roomID,
		"streamID": msg.Data,
	}).Info("Stream subscription requested")

	// Implementation would handle subscribing to specific streams
}

func (c *WebSocketConnection) handleUnsubscribeMessage(msg Message) {
	// Handle stream unsubscription requests
	c.logger.WithFields(logrus.Fields{
		"peerID":   c.peerID,
		"roomID":   c.roomID,
		"streamID": msg.Data,
	}).Info("Stream unsubscription requested")

	// Implementation would handle unsubscribing from specific streams
}

func (c *WebSocketConnection) Close() {
	close(c.send)
	c.conn.Close()
}
