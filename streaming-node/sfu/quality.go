package sfu

import (
	"math"
	"sync"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
	"github.com/sirupsen/logrus"
)

// QualityController manages stream quality and bandwidth adaptation
type QualityController struct {
	track             *webrtc.TrackRemote
	logger            *logrus.Logger
	bitrate           int
	targetBitrate     int
	packetLoss        float64
	rtt               time.Duration
	lastUpdate        time.Time
	mutex             sync.RWMutex
	qualityMetrics    *QualityMetrics
	adaptationActive  bool
}

// QualityMetrics holds quality measurement data
type QualityMetrics struct {
	PacketsSent     int64
	PacketsLost     int64
	BytesSent       int64
	LastPacketTime  time.Time
	AverageRTT      time.Duration
	PacketLossRate  float64
	Bitrate         int
	TargetBitrate   int
}

// NewQualityController creates a new quality controller
func NewQualityController(track *webrtc.TrackRemote, logger *logrus.Logger) *QualityController {
	return &QualityController{
		track:         track,
		logger:        logger,
		targetBitrate: 1000000, // 1 Mbps default
		bitrate:       1000000,
		lastUpdate:    time.Now(),
		qualityMetrics: &QualityMetrics{
			LastPacketTime: time.Now(),
		},
	}
}

// UpdateWithRTPPacket updates quality metrics with a new RTP packet
func (qc *QualityController) UpdateWithRTPPacket(packet *rtp.Packet) {
	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	now := time.Now()

	// Update packet metrics
	qc.qualityMetrics.PacketsSent++
	qc.qualityMetrics.BytesSent += int64(len(packet.Payload))
	qc.qualityMetrics.LastPacketTime = now

	// Calculate bitrate every second
	if now.Sub(qc.lastUpdate) >= time.Second {
		qc.calculateBitrate()
		qc.lastUpdate = now
	}

	// Log quality metrics periodically
	if qc.qualityMetrics.PacketsSent%1000 == 0 {
		qc.logQualityMetrics()
	}
}

// UpdateRTT updates the RTT measurement
func (qc *QualityController) UpdateRTT(rtt time.Duration) {
	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	qc.rtt = rtt
	qc.qualityMetrics.AverageRTT = rtt
}

// UpdatePacketLoss updates packet loss rate
func (qc *QualityController) UpdatePacketLoss(lossRate float64) {
	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	qc.packetLoss = lossRate
	qc.qualityMetrics.PacketLossRate = lossRate
}

// AdaptQuality adapts stream quality based on current conditions
func (qc *QualityController) AdaptQuality() {
	qc.mutex.Lock()
	defer qc.mutex.Unlock()

	if qc.adaptationActive {
		return // Adaptation already in progress
	}

	qc.adaptationActive = true
	defer func() { qc.adaptationActive = false }()

	oldBitrate := qc.targetBitrate
	newBitrate := qc.calculateOptimalBitrate()

	if newBitrate != oldBitrate {
		qc.targetBitrate = newBitrate
		qc.logger.WithFields(logrus.Fields{
			"trackID":      qc.track.ID(),
			"oldBitrate":   oldBitrate,
			"newBitrate":   newBitrate,
			"packetLoss":   qc.packetLoss,
			"rtt":         qc.rtt,
		}).Info("Adapted stream quality")

		// Apply quality changes to the track if possible
		qc.applyQualityConstraints()
	}
}

// GetQualityMetrics returns current quality metrics
func (qc *QualityController) GetQualityMetrics() *QualityMetrics {
	qc.mutex.RLock()
	defer qc.mutex.RUnlock()

	// Return a copy of the metrics
	metrics := &QualityMetrics{
		PacketsSent:    qc.qualityMetrics.PacketsSent,
		PacketsLost:    qc.qualityMetrics.PacketsLost,
		BytesSent:      qc.qualityMetrics.BytesSent,
		LastPacketTime: qc.qualityMetrics.LastPacketTime,
		AverageRTT:     qc.qualityMetrics.AverageRTT,
		PacketLossRate: qc.qualityMetrics.PacketLossRate,
		Bitrate:        qc.bitrate,
		TargetBitrate:  qc.targetBitrate,
	}

	return metrics
}

// GetTargetBitrate returns the current target bitrate
func (qc *QualityController) GetTargetBitrate() int {
	qc.mutex.RLock()
	defer qc.mutex.RUnlock()

	return qc.targetBitrate
}

// calculateBitrate calculates current bitrate based on sent bytes
func (qc *QualityController) calculateBitrate() {
	elapsed := time.Since(qc.lastUpdate).Seconds()
	if elapsed == 0 {
		return
	}

	bytesPerSecond := float64(qc.qualityMetrics.BytesSent) / elapsed
	qc.bitrate = int(bytesPerSecond * 8) // Convert to bits per second
	qc.qualityMetrics.Bitrate = qc.bitrate
}

// calculateOptimalBitrate determines the optimal bitrate based on network conditions
func (qc *QualityController) calculateOptimalBitrate() int {
	baseBitrate := 1000000 // 1 Mbps base

	// Adjust for packet loss
	lossMultiplier := 1.0
	if qc.packetLoss > 0.01 { // 1% packet loss
		lossMultiplier = math.Max(0.3, 1.0-qc.packetLoss*10)
	}

	// Adjust for RTT
	rttMultiplier := 1.0
	if qc.rtt > 100*time.Millisecond {
		rttMultiplier = math.Max(0.5, 100.0/float64(qc.rtt.Milliseconds()))
	}

	// Calculate new bitrate
	newBitrate := float64(baseBitrate) * lossMultiplier * rttMultiplier

	// Clamp bitrate between 100kbps and 5Mbps
	minBitrate := 100000  // 100 kbps
	maxBitrate := 5000000 // 5 Mbps

	finalBitrate := int(math.Max(float64(minBitrate), math.Min(float64(maxBitrate), newBitrate)))

	return finalBitrate
}

// applyQualityConstraints applies quality constraints to the track
func (qc *QualityController) applyQualityConstraints() {
	// This would implement quality adaptation by:
	// 1. Sending RTCP feedback to the sender
	// 2. Adjusting simulcast layers
	// 3. Applying bandwidth constraints

	// For now, we'll log the intended changes
	qc.logger.WithFields(logrus.Fields{
		"trackID":       qc.track.ID(),
		"targetBitrate": qc.targetBitrate,
		"currentBitrate": qc.bitrate,
	}).Debug("Applying quality constraints")

	// TODO: Implement actual quality adaptation mechanisms:
	// - Send RTCP REMB (Receiver Estimated Maximum Bitrate) packets
	// - Adjust simulcast layer subscriptions
	// - Apply bandwidth limits to peer connections
}

// logQualityMetrics logs current quality metrics
func (qc *QualityController) logQualityMetrics() {
	qc.mutex.RLock()
	defer qc.mutex.RUnlock()

	qc.logger.WithFields(logrus.Fields{
		"trackID":       qc.track.ID(),
		"packetsSent":   qc.qualityMetrics.PacketsSent,
		"bytesSent":     qc.qualityMetrics.BytesSent,
		"bitrate":       qc.bitrate,
		"targetBitrate": qc.targetBitrate,
		"packetLoss":    qc.packetLoss,
		"rtt":          qc.rtt,
	}).Debug("Quality metrics updated")
}

// GetAdaptationScore returns a score indicating how well the stream is adapting
func (qc *QualityController) GetAdaptationScore() float64 {
	qc.mutex.RLock()
	defer qc.mutex.RUnlock()

	// Calculate score based on how close current bitrate is to target
	// and network conditions
	bitrateScore := 1.0 - math.Abs(float64(qc.bitrate-qc.targetBitrate))/float64(qc.targetBitrate)

	// Penalize for packet loss
	lossScore := math.Max(0, 1.0-qc.packetLoss*10)

	// Penalize for high RTT
	rttScore := 1.0
	if qc.rtt > 50*time.Millisecond {
		rttScore = math.Max(0.3, 50.0/float64(qc.rtt.Milliseconds()))
	}

	return (bitrateScore + lossScore + rttScore) / 3.0
}