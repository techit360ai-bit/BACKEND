// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	JWTIssuer   string
	JWTAudience string
	// JWTPublicKey is the PEM RSA public key used to verify RS256 platform
	// tokens. Required outside development/test, where the platform signs with
	// RS256 and HS256 is rejected.
	JWTPublicKey    string
	CORSOrigins     string
	Environment     string
	EnableDevToken  bool
	DiscoveryAPIURL string
	// RateLimitPerMinute caps requests per caller address. <= 0 disables it.
	RateLimitPerMinute int

	LiveKitAPIKey    string
	LiveKitAPISecret string
	LiveKitURL       string
}

// Load reads configuration from the environment, applying defaults.
// JWT_SECRET is required.
func Load() (Config, error) {
	environment := firstEnv("ENVIRONMENT", "APP_ENV", "NODE_ENV")
	if environment == "" {
		environment = "development"
	}
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	redisURL := strings.TrimSpace(os.Getenv("REDIS_URL"))
	if requiresDurableStores(environment) {
		if databaseURL == "" {
			return Config{}, errors.New("DATABASE_URL is required outside development and test")
		}
		if redisURL == "" {
			return Config{}, errors.New("REDIS_URL is required outside development and test")
		}
	}
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/techit_msg?sslmode=disable"
	}
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	cfg := Config{
		Port:               envOr("PORT", "8080"),
		DatabaseURL:        databaseURL,
		RedisURL:           redisURL,
		JWTSecret:          os.Getenv("JWT_SECRET"),
		JWTIssuer:          os.Getenv("JWT_ISSUER"),
		JWTAudience:        os.Getenv("JWT_AUDIENCE"),
		JWTPublicKey:       strings.TrimSpace(os.Getenv("JWT_PUBLIC_KEY")),
		CORSOrigins:        envOr("CORS_ORIGINS", ""),
		Environment:        environment,
		EnableDevToken:     os.Getenv("ENABLE_DEV_TOKEN") == "1",
		DiscoveryAPIURL:    strings.TrimRight(strings.TrimSpace(os.Getenv("DISCOVERY_API_URL")), "/"),
		RateLimitPerMinute: envInt("MESSAGING_RATE_LIMIT_PER_MINUTE", 120),

		LiveKitAPIKey:    os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitURL:       os.Getenv("LIVEKIT_URL"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required")
	}
	if !requiresDurableStores(environment) && strings.TrimSpace(cfg.CORSOrigins) == "" {
		// Mirror the Node backend's development default so the Vite dev server
		// (5173) and `vite preview` (4173) can reach the messaging API with
		// credentials. Outside development CORS_ORIGINS is required explicitly
		// and validated below, so this never widens a deployed service.
		cfg.CORSOrigins = "http://localhost:5173,http://localhost:4173"
	}
	if requiresDurableStores(environment) && len(cfg.JWTSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 characters outside development and test")
	}
	if requiresDurableStores(environment) && (cfg.JWTIssuer == "" || cfg.JWTAudience == "") {
		return Config{}, errors.New("JWT_ISSUER and JWT_AUDIENCE are required outside development and test")
	}
	if requiresDurableStores(environment) && cfg.JWTPublicKey == "" {
		return Config{}, errors.New("JWT_PUBLIC_KEY is required outside development and test")
	}
	if requiresDurableStores(environment) && strings.TrimSpace(cfg.CORSOrigins) == "" {
		return Config{}, errors.New("CORS_ORIGINS is required outside development and test")
	}
	if requiresDurableStores(environment) {
		for _, origin := range strings.Split(cfg.CORSOrigins, ",") {
			origin = strings.TrimSpace(origin)
			if origin == "*" {
				return Config{}, errors.New("CORS_ORIGINS cannot be wildcard outside development and test")
			}
			if !strings.HasPrefix(origin, "https://") {
				return Config{}, errors.New("CORS_ORIGINS must use https outside development and test")
			}
		}
	}
	if cfg.EnableDevToken && strings.EqualFold(cfg.Environment, "production") {
		return Config{}, errors.New("ENABLE_DEV_TOKEN=1 is forbidden in production")
	}
	return cfg, nil
}

func requiresDurableStores(environment string) bool {
	switch strings.ToLower(strings.TrimSpace(environment)) {
	case "development", "dev", "test", "testing", "local":
		return false
	default:
		return true
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// envInt parses a positive integer environment variable, falling back to def on
// anything unset, non-numeric or negative.
func envInt(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		return def
	}
	return value
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return ""
}
