package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("JWT_SECRET", "s3cret")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.JWTSecret != "s3cret" {
		t.Errorf("JWTSecret = %q, want s3cret", cfg.JWTSecret)
	}
}

func TestLoadRequiresJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when JWT_SECRET is empty")
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("JWT_SECRET", "x")
	t.Setenv("PORT", "9999")
	t.Setenv("DATABASE_URL", "postgres://u@h/db")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	cfg, _ := Load()
	if cfg.Port != "9999" || cfg.DatabaseURL != "postgres://u@h/db" || cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("overrides not applied: %+v", cfg)
	}
}
