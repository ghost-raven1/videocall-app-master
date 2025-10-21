package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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
				for _, allowedOrigin := range s.config.Server.AllowedOrigins {
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
						"allowed_origins": s.config.Server.AllowedOrigins,
					}).Warn("WebSocket connection rejected: origin not allowed")
					return false
				}

				logger.WithFields(logrus.Fields{
					"origin": origin,
					"ip":     r.RemoteAddr,
				}).Debug("WebSocket connection accepted")

				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
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
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.WithError(err).Error("WebSocket error")
			}
			break
		}

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
	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		c.logger.WithError(err).Error("Failed to unmarshal message")
		return
	}

	c.logger.WithFields(logrus.Fields{
		"type":   msg.Type,
		"roomID": msg.RoomID,
		"peerID": msg.PeerID,
	}).Debug("Received WebSocket message")

	// Handle different message types
	switch msg.Type {
	case "offer", "answer", "ice-candidate":
		c.handleSignalingMessage(msg)
	case "subscribe":
		c.handleSubscribeMessage(msg)
	case "unsubscribe":
		c.handleUnsubscribeMessage(msg)
	default:
		c.logger.WithField("type", msg.Type).Warn("Unknown message type")
	}
}

func (c *WebSocketConnection) handleSignalingMessage(msg Message) {
	// Forward signaling messages between peers in the same room
	room, err := c.sfu.GetRoom(c.roomID)
	if err != nil {
		c.logger.WithError(err).Error("Room not found")
		return
	}

	// Broadcast to other peers in the room
	room.BroadcastToAll(c.peerID, msg)
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