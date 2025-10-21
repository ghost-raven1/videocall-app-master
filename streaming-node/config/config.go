package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pion/webrtc/v3"
	"gopkg.in/yaml.v2"
)

// Config holds the server configuration
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	WebRTC   WebRTCConfig   `yaml:"webrtc"`
	Quality  QualityConfig  `yaml:"quality"`
	Logging  LoggingConfig  `yaml:"logging"`
	Security SecurityConfig `yaml:"security"`
	Django   DjangoConfig   `yaml:"django"`
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Address         string        `yaml:"address"`
	Port            int           `yaml:"port"`
	ReadTimeout     time.Duration `yaml:"read_timeout"`
	WriteTimeout    time.Duration `yaml:"write_timeout"`
	MaxConnections  int           `yaml:"max_connections"`
	AllowedOrigins  []string      `yaml:"allowed_origins"`
	EnableProfiling bool          `yaml:"enable_profiling"`
}

// WebRTCConfig holds WebRTC-related configuration
type WebRTCConfig struct {
	ICEServers           []webrtc.ICEServer `yaml:"ice_servers"`
	EnableSimulcast      bool               `yaml:"enable_simulcast"`
	EnableBandwidthLimit bool               `yaml:"enable_bandwidth_limit"`
	MaxBitrate           int                `yaml:"max_bitrate"`
	MinBitrate           int                `yaml:"min_bitrate"`
	DefaultBitrate       int                `yaml:"default_bitrate"`
}

// QualityConfig holds quality adaptation configuration
type QualityConfig struct {
	EnableAdaptation      bool          `yaml:"enable_adaptation"`
	AdaptationInterval    time.Duration `yaml:"adaptation_interval"`
	PacketLossThreshold   float64       `yaml:"packet_loss_threshold"`
	RTTThreshold          time.Duration `yaml:"rtt_threshold"`
	QualityCheckInterval  time.Duration `yaml:"quality_check_interval"`
	BitrateIncreaseFactor float64       `yaml:"bitrate_increase_factor"`
	BitrateDecreaseFactor float64       `yaml:"bitrate_decrease_factor"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `yaml:"level"`
	File       string `yaml:"file"`
	MaxSize    int    `yaml:"max_size"`
	MaxAge     int    `yaml:"max_age"`
	MaxBackups int    `yaml:"max_backups"`
	Compress   bool   `yaml:"compress"`
}

// SecurityConfig holds security-related configuration
type SecurityConfig struct {
	EnableTLS        bool   `yaml:"enable_tls"`
	CertFile         string `yaml:"cert_file"`
	KeyFile          string `yaml:"key_file"`
	EnableAuth       bool   `yaml:"enable_auth"`
	JWTSecret        string `yaml:"jwt_secret"`
	TokenExpiryHours int    `yaml:"token_expiry_hours"`
}

// DjangoConfig holds Django backend configuration
type DjangoConfig struct {
	URL               string `yaml:"url"`
	EnableWebSocket   bool   `yaml:"enable_websocket"`
	ReconnectInterval string `yaml:"reconnect_interval"`
	MaxReconnects     int    `yaml:"max_reconnects"`
}

// Load loads configuration from a YAML file
func Load(configPath string) (*Config, error) {
	// Set default configuration
	config := getDefaultConfig()

	// Read configuration file if it exists
	if configPath != "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file %s: %w", configPath, err)
		}

		if err := yaml.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("failed to parse config file %s: %w", configPath, err)
		}
	}

	// Override with environment variables
	config = overrideFromEnv(config)

	// Validate configuration
	if err := validateConfig(config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return config, nil
}

// getDefaultConfig returns default configuration values
func getDefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Address:         "0.0.0.0",
			Port:            8080,
			ReadTimeout:     10 * time.Second,
			WriteTimeout:    10 * time.Second,
			MaxConnections:  1000,
			AllowedOrigins:  []string{"*"},
			EnableProfiling: false,
		},
		WebRTC: WebRTCConfig{
			ICEServers: []webrtc.ICEServer{
				{
					URLs: []string{"stun:stun.l.google.com:19302"},
				},
			},
			EnableSimulcast:      true,
			EnableBandwidthLimit: true,
			MaxBitrate:           5000000, // 5 Mbps
			MinBitrate:           100000,  // 100 kbps
			DefaultBitrate:       1000000, // 1 Mbps
		},
		Quality: QualityConfig{
			EnableAdaptation:      true,
			AdaptationInterval:    5 * time.Second,
			PacketLossThreshold:   0.05, // 5%
			RTTThreshold:          100 * time.Millisecond,
			QualityCheckInterval:  1 * time.Second,
			BitrateIncreaseFactor: 1.1,
			BitrateDecreaseFactor: 0.8,
		},
		Logging: LoggingConfig{
			Level:      "info",
			File:       "",
			MaxSize:    100, // MB
			MaxAge:     30,  // days
			MaxBackups: 3,
			Compress:   true,
		},
		Security: SecurityConfig{
			EnableTLS:        false,
			CertFile:         "cert.pem",
			KeyFile:          "key.pem",
			EnableAuth:       false,
			JWTSecret:        "", // Must be set via environment variable
			TokenExpiryHours: 24,
		},
		Django: DjangoConfig{
			URL:               "localhost:8000",
			EnableWebSocket:   true,
			ReconnectInterval: "5s",
			MaxReconnects:     10,
		},
	}
}

// overrideFromEnv overrides configuration values with environment variables
func overrideFromEnv(config *Config) *Config {
	// Server configuration
	if val := os.Getenv("SERVER_ADDRESS"); val != "" {
		config.Server.Address = val
	}
	if val := os.Getenv("SERVER_PORT"); val != "" {
		if port, err := strconv.Atoi(val); err == nil {
			config.Server.Port = port
		}
	}
	if val := os.Getenv("SERVER_READ_TIMEOUT"); val != "" {
		if timeout, err := time.ParseDuration(val); err == nil {
			config.Server.ReadTimeout = timeout
		}
	}
	if val := os.Getenv("SERVER_WRITE_TIMEOUT"); val != "" {
		if timeout, err := time.ParseDuration(val); err == nil {
			config.Server.WriteTimeout = timeout
		}
	}
	if val := os.Getenv("SERVER_MAX_CONNECTIONS"); val != "" {
		if maxConn, err := strconv.Atoi(val); err == nil {
			config.Server.MaxConnections = maxConn
		}
	}
	if val := os.Getenv("SERVER_ALLOWED_ORIGINS"); val != "" {
		// Support comma-separated list of origins
		origins := strings.Split(val, ",")
		var trimmedOrigins []string
		for _, origin := range origins {
			trimmedOrigins = append(trimmedOrigins, strings.TrimSpace(origin))
		}
		if len(trimmedOrigins) > 0 {
			config.Server.AllowedOrigins = trimmedOrigins
		}
	}

	// WebRTC configuration
	if val := os.Getenv("WEBRTC_MAX_BITRATE"); val != "" {
		if bitrate, err := strconv.Atoi(val); err == nil {
			config.WebRTC.MaxBitrate = bitrate
		}
	}
	if val := os.Getenv("WEBRTC_MIN_BITRATE"); val != "" {
		if bitrate, err := strconv.Atoi(val); err == nil {
			config.WebRTC.MinBitrate = bitrate
		}
	}
	if val := os.Getenv("WEBRTC_DEFAULT_BITRATE"); val != "" {
		if bitrate, err := strconv.Atoi(val); err == nil {
			config.WebRTC.DefaultBitrate = bitrate
		}
	}

	// Quality configuration
	if val := os.Getenv("QUALITY_PACKET_LOSS_THRESHOLD"); val != "" {
		if threshold, err := strconv.ParseFloat(val, 64); err == nil {
			config.Quality.PacketLossThreshold = threshold
		}
	}
	if val := os.Getenv("QUALITY_ADAPTATION_INTERVAL"); val != "" {
		if interval, err := time.ParseDuration(val); err == nil {
			config.Quality.AdaptationInterval = interval
		}
	}

	// Logging configuration
	if val := os.Getenv("LOG_LEVEL"); val != "" {
		config.Logging.Level = val
	}
	if val := os.Getenv("LOG_FILE"); val != "" {
		config.Logging.File = val
	}

	// Security configuration
	if val := os.Getenv("SECURITY_JWT_SECRET"); val != "" {
		config.Security.JWTSecret = val
	}
	if val := os.Getenv("SECURITY_TOKEN_EXPIRY_HOURS"); val != "" {
		if hours, err := strconv.Atoi(val); err == nil {
			config.Security.TokenExpiryHours = hours
		}
	}

	// Django configuration
	if val := os.Getenv("DJANGO_URL"); val != "" {
		config.Django.URL = val
	}
	if val := os.Getenv("DJANGO_RECONNECT_INTERVAL"); val != "" {
		config.Django.ReconnectInterval = val
	}
	if val := os.Getenv("DJANGO_MAX_RECONNECTS"); val != "" {
		if maxReconnects, err := strconv.Atoi(val); err == nil {
			config.Django.MaxReconnects = maxReconnects
		}
	}

	return config
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	if config.Server.Port < 1 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	if config.WebRTC.MaxBitrate < config.WebRTC.MinBitrate {
		return fmt.Errorf("max bitrate cannot be less than min bitrate")
	}

	if config.WebRTC.DefaultBitrate < config.WebRTC.MinBitrate ||
		config.WebRTC.DefaultBitrate > config.WebRTC.MaxBitrate {
		return fmt.Errorf("default bitrate must be between min and max bitrate")
	}

	if config.Quality.PacketLossThreshold < 0 || config.Quality.PacketLossThreshold > 1 {
		return fmt.Errorf("packet loss threshold must be between 0 and 1")
	}

	if config.Security.TokenExpiryHours < 1 {
		return fmt.Errorf("token expiry hours must be positive")
	}

	if config.Security.JWTSecret == "" {
		return fmt.Errorf("JWT secret must be set via SECURITY_JWT_SECRET environment variable")
	}

	// Check for insecure JWT secret patterns
	insecurePatterns := []string{
		"your-secret-key",
		"change-in-production",
		"your-secure-jwt",
		"test-secret",
		"example",
		"123456",
		"password",
		"secret",
	}

	jwtSecretLower := strings.ToLower(config.Security.JWTSecret)
	for _, pattern := range insecurePatterns {
		if strings.Contains(jwtSecretLower, pattern) {
			return fmt.Errorf("JWT secret contains insecure pattern '%s'. Please generate a secure secret using: openssl rand -hex 32", pattern)
		}
	}

	// Validate JWT secret length (minimum 32 characters for security)
	if len(config.Security.JWTSecret) < 32 {
		return fmt.Errorf("JWT secret is too short (%d chars). Minimum length is 32 characters for security", len(config.Security.JWTSecret))
	}

	return nil
}

// GetAddress returns the server address in host:port format
func (c *Config) GetAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Address, c.Server.Port)
}

// IsTLSEnabled returns whether TLS is enabled
func (c *Config) IsTLSEnabled() bool {
	return c.Security.EnableTLS
}

// GetCertFiles returns certificate file paths if TLS is enabled
func (c *Config) GetCertFiles() (string, string) {
	return c.Security.CertFile, c.Security.KeyFile
}

// Save saves the configuration to a YAML file
func (c *Config) Save(configPath string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}