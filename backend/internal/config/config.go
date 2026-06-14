// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	CORSOrigins string

	LiveKitAPIKey    string
	LiveKitAPISecret string
	LiveKitURL       string
}

// Load reads configuration from the environment, applying defaults.
// JWT_SECRET is required.
func Load() (Config, error) {
	cfg := Config{
		Port:        envOr("PORT", "8080"),
		DatabaseURL: envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/techit_msg?sslmode=disable"),
		RedisURL:    envOr("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		CORSOrigins: envOr("CORS_ORIGINS", "*"),

		LiveKitAPIKey:    os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitURL:       os.Getenv("LIVEKIT_URL"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required")
	}
	return cfg, nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
