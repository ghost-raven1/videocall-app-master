package main

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"streaming-node/sfu"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// DjangoEvent represents an event from Django backend
type DjangoEvent struct {
	Type      string                 `json:"type"`
	RoomID    string                 `json:"room_id"`
	UserID    string                 `json:"user_id,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// RoomEvent represents a room-related event
type RoomEvent struct {
	Action   string `json:"action"`   // "created", "joined", "left", "deleted"
	RoomID   string `json:"room_id"`
	UserID   string `json:"user_id,omitempty"`
	UserName string `json:"user_name,omitempty"`
}

// DjangoClient manages WebSocket connection to Django backend
type DjangoClient struct {
	djangoURL   string
	conn        *websocket.Conn
	sfu         *sfu.SFU
	logger      *logrus.Logger
	send        chan []byte
	receive     chan DjangoEvent
	done        chan struct{}
	reconnectInterval time.Duration
	maxReconnects     int
	mutex       sync.RWMutex
	connected   bool
}

// NewDjangoClient creates a new Django WebSocket client
func NewDjangoClient(djangoURL string, sfuInstance *sfu.SFU, logger *logrus.Logger) *DjangoClient {
	return &DjangoClient{
		djangoURL:         djangoURL,
		sfu:              sfuInstance,
		logger:           logger,
		send:             make(chan []byte, 256),
		receive:          make(chan DjangoEvent, 256),
		done:             make(chan struct{}),
		reconnectInterval: 5 * time.Second,
		maxReconnects:     10,
	}
}

// Connect establishes WebSocket connection to Django backend
func (dc *DjangoClient) Connect() error {
	dc.mutex.Lock()
	defer dc.mutex.Unlock()

	if dc.connected {
		return nil // Already connected
	}

    // Construct WebSocket URL for Django SFU endpoint
    wsURL := fmt.Sprintf("ws://%s/ws/sfu/", dc.djangoURL)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to Django WebSocket: %w", err)
	}

	dc.conn = conn
	dc.connected = true

	dc.logger.Info("Connected to Django WebSocket")

	// Start goroutines
	go dc.readPump()
	go dc.writePump()
	go dc.eventHandler()

	return nil
}

// Disconnect closes the WebSocket connection
func (dc *DjangoClient) Disconnect() error {
	dc.mutex.Lock()
	defer dc.mutex.Unlock()

	if !dc.connected {
		return nil
	}

	dc.connected = false
	close(dc.done)

	if dc.conn != nil {
		return dc.conn.Close()
	}

	return nil
}

// SendMessage sends a message to Django backend
func (dc *DjangoClient) SendMessage(message interface{}) error {
	dc.mutex.RLock()
	defer dc.mutex.RUnlock()

	if !dc.connected {
		return fmt.Errorf("not connected to Django backend")
	}

	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	select {
	case dc.send <- data:
		return nil
	case <-time.After(5 * time.Second):
		return fmt.Errorf("timeout sending message")
	}
}

// IsConnected returns connection status
func (dc *DjangoClient) IsConnected() bool {
	dc.mutex.RLock()
	defer dc.mutex.RUnlock()

	return dc.connected
}

// GetReceiveChannel returns the channel for receiving Django events
func (dc *DjangoClient) GetReceiveChannel() <-chan DjangoEvent {
	return dc.receive
}

// readPump handles incoming messages from Django
func (dc *DjangoClient) readPump() {
	defer func() {
		dc.Disconnect()
	}()

	dc.conn.SetReadLimit(512)
	dc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	dc.conn.SetPongHandler(func(string) error {
		dc.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		select {
		case <-dc.done:
			return
		default:
			_, message, err := dc.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					dc.logger.WithError(err).Error("Django WebSocket error")
				}
				return
			}

			dc.handleDjangoMessage(message)
		}
	}
}

// writePump handles outgoing messages to Django
func (dc *DjangoClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		dc.conn.Close()
	}()

	for {
		select {
		case message, ok := <-dc.send:
			dc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				dc.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := dc.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			w.Close()

		case <-ticker.C:
			dc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := dc.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-dc.done:
			return
		}
	}
}

// handleDjangoMessage processes messages from Django
func (dc *DjangoClient) handleDjangoMessage(message []byte) {
	var event DjangoEvent
	if err := json.Unmarshal(message, &event); err != nil {
		dc.logger.WithError(err).Error("Failed to unmarshal Django message")
		return
	}

	dc.logger.WithFields(logrus.Fields{
		"type":   event.Type,
		"roomID": event.RoomID,
		"userID": event.UserID,
	}).Debug("Received Django event")

	// Send event to processing channel
	select {
	case dc.receive <- event:
	case <-time.After(time.Second):
		dc.logger.Warn("Timeout sending Django event to channel")
	}
}

// eventHandler processes Django events and updates SFU accordingly
func (dc *DjangoClient) eventHandler() {
	for {
		select {
		case event := <-dc.receive:
			dc.processDjangoEvent(event)
		case <-dc.done:
			return
		}
	}
}

// processDjangoEvent processes a Django event and updates SFU state
func (dc *DjangoClient) processDjangoEvent(event DjangoEvent) {
	switch event.Type {
	case "room_created":
		dc.handleRoomCreated(event)
	case "room_deleted":
		dc.handleRoomDeleted(event)
	case "user_joined":
		dc.handleUserJoined(event)
	case "user_left":
		dc.handleUserLeft(event)
	case "room_event":
		dc.handleRoomEvent(event)
	default:
		dc.logger.WithField("type", event.Type).Debug("Unknown Django event type")
	}
}

// handleRoomCreated handles room creation events from Django
func (dc *DjangoClient) handleRoomCreated(event DjangoEvent) {
	roomID, ok := event.Data["room_id"].(string)
	if !ok {
		dc.logger.Error("Invalid room_created event: missing room_id")
		return
	}

	// Create room in SFU
	_, err := dc.sfu.CreateRoom(roomID)
	if err != nil {
		dc.logger.WithFields(logrus.Fields{
			"roomID": roomID,
			"error":  err,
		}).Error("Failed to create room in SFU")
		return
	}

	dc.logger.WithField("roomID", roomID).Info("Room created in SFU via Django event")

	// Notify Django that SFU is ready for this room
	response := map[string]interface{}{
		"type":    "sfu_room_ready",
		"room_id": roomID,
		"status":  "ready",
	}

	dc.SendMessage(response)
}

// handleRoomDeleted handles room deletion events from Django
func (dc *DjangoClient) handleRoomDeleted(event DjangoEvent) {
	roomID, ok := event.Data["room_id"].(string)
	if !ok {
		dc.logger.Error("Invalid room_deleted event: missing room_id")
		return
	}

	// Remove room from SFU
	dc.sfu.RemoveRoom(roomID)

	dc.logger.WithField("roomID", roomID).Info("Room deleted in SFU via Django event")

	// Notify Django that room has been cleaned up
	response := map[string]interface{}{
		"type":    "sfu_room_deleted",
		"room_id": roomID,
		"status":  "deleted",
	}

	dc.SendMessage(response)
}

// handleUserJoined handles user join events from Django
func (dc *DjangoClient) handleUserJoined(event DjangoEvent) {
	roomID, ok := event.Data["room_id"].(string)
	if !ok {
		dc.logger.Error("Invalid user_joined event: missing room_id")
		return
	}

	userID, ok := event.Data["user_id"].(string)
	if !ok {
		dc.logger.Error("Invalid user_joined event: missing user_id")
		return
	}

	// Get or create room
	_, err := dc.sfu.CreateRoom(roomID)
	if err != nil {
		dc.logger.WithFields(logrus.Fields{
			"roomID": roomID,
			"userID": userID,
			"error":  err,
		}).Error("Failed to get/create room for user join")
		return
	}

	dc.logger.WithFields(logrus.Fields{
		"roomID": roomID,
		"userID": userID,
	}).Info("User joined room via Django event")

	// SFU will wait for WebSocket connection from the user
	// The actual peer setup happens when the client connects via WebSocket
}

// handleUserLeft handles user leave events from Django
func (dc *DjangoClient) handleUserLeft(event DjangoEvent) {
	roomID, ok := event.Data["room_id"].(string)
	if !ok {
		dc.logger.Error("Invalid user_left event: missing room_id")
		return
	}

	userID, ok := event.Data["user_id"].(string)
	if !ok {
		dc.logger.Error("Invalid user_left event: missing user_id")
		return
	}

	// Get room
	room, err := dc.sfu.GetRoom(roomID)
	if err != nil {
		dc.logger.WithFields(logrus.Fields{
			"roomID": roomID,
			"userID": userID,
		}).Warn("Room not found for user leave event")
		return
	}

	// Find and remove the peer
	// Note: In a real implementation, you'd need to map user IDs to peer IDs
	// For now, we'll remove all peers (this is a simplified implementation)

	peers := room.GetPeers()
	for peerID := range peers {
		room.RemovePeer(peerID)
		break // Remove only one peer for now
	}

	dc.logger.WithFields(logrus.Fields{
		"roomID": roomID,
		"userID": userID,
	}).Info("User left room via Django event")
}

// handleRoomEvent handles generic room events from Django
func (dc *DjangoClient) handleRoomEvent(event DjangoEvent) {
	// Handle other room-related events
	dc.logger.WithFields(logrus.Fields{
		"type":   event.Type,
		"roomID": event.RoomID,
	}).Debug("Processing room event from Django")
}

// StartAutoReconnect starts automatic reconnection on connection loss
func (dc *DjangoClient) StartAutoReconnect() {
	go func() {
		reconnectCount := 0
		for {
			select {
			case <-dc.done:
				return
			default:
				if !dc.IsConnected() && reconnectCount < dc.maxReconnects {
					dc.logger.Info("Attempting to reconnect to Django backend")
					if err := dc.Connect(); err != nil {
						reconnectCount++
						dc.logger.WithError(err).Error("Failed to reconnect")
						time.Sleep(dc.reconnectInterval)
					} else {
						reconnectCount = 0 // Reset on successful connection
					}
				}
				time.Sleep(dc.reconnectInterval)
			}
		}
	}()
}
