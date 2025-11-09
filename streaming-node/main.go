package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"streaming-node/config"
	"streaming-node/server"
	"streaming-node/sfu"

	"github.com/sirupsen/logrus"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "config.yaml", "Path to configuration file")
    // Default to docker-compose service name for production/dev containers
    djangoURL := flag.String("django-url", "backend:8000", "Django backend URL")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Override Django URL if provided
	if *djangoURL != "" {
		cfg.Django.URL = *djangoURL
	}

	// Create SFU instance
	sfuInstance := sfu.NewSFU(cfg)

	// Create Django client for WebSocket integration
	djangoClient := NewDjangoClient(cfg.Django.URL, sfuInstance, logrus.New())

	// Connect to Django backend
	if err := djangoClient.Connect(); err != nil {
		log.Printf("Warning: Failed to connect to Django backend: %v", err)
		log.Println("Starting SFU server without Django integration...")
	} else {
		log.Println("Connected to Django backend")
		// Start auto-reconnection in background
		djangoClient.StartAutoReconnect()
	}

	// Create and start server
	srv := server.NewServer(cfg, sfuInstance)

	// Start server
	go func() {
		log.Printf("Starting SFU server on %s", cfg.GetAddress())
		if err := srv.Start(); err != nil {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Cleanup resources
	djangoClient.Disconnect()
	sfuInstance.Close()
	srv.Close()

	log.Println("Server shutdown complete")
}
