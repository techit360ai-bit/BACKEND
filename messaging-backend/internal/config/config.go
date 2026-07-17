// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	RedisURL       string
	JWTSecret      string
	CORSOrigins    string
	Environment    string
	EnableDevToken bool

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
		Port:           envOr("PORT", "8080"),
		DatabaseURL:    databaseURL,
		RedisURL:       redisURL,
		JWTSecret:      os.Getenv("JWT_SECRET"),
		CORSOrigins:    envOr("CORS_ORIGINS", "*"),
		Environment:    environment,
		EnableDevToken: os.Getenv("ENABLE_DEV_TOKEN") == "1",

		LiveKitAPIKey:    os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitURL:       os.Getenv("LIVEKIT_URL"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required")
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

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return ""
}
