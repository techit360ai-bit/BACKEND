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
	cfg := Config{
		Port:           envOr("PORT", "8080"),
		DatabaseURL:    envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/techit_msg?sslmode=disable"),
		RedisURL:       envOr("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		CORSOrigins:    envOr("CORS_ORIGINS", "*"),
		Environment:    firstEnv("ENVIRONMENT", "APP_ENV", "NODE_ENV"),
		EnableDevToken: os.Getenv("ENABLE_DEV_TOKEN") == "1",

		LiveKitAPIKey:    os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitURL:       os.Getenv("LIVEKIT_URL"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required")
	}
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}
	if cfg.EnableDevToken && strings.EqualFold(cfg.Environment, "production") {
		return Config{}, errors.New("ENABLE_DEV_TOKEN=1 is forbidden in production")
	}
	return cfg, nil
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
