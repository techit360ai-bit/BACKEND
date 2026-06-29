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
	if cfg.Environment != "development" {
		t.Errorf("Environment = %q, want development", cfg.Environment)
	}
	if cfg.EnableDevToken {
		t.Error("EnableDevToken = true, want false")
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
	t.Setenv("ENVIRONMENT", "staging")
	t.Setenv("ENABLE_DEV_TOKEN", "1")
	cfg, _ := Load()
	if cfg.Port != "9999" || cfg.DatabaseURL != "postgres://u@h/db" || cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("overrides not applied: %+v", cfg)
	}
	if cfg.Environment != "staging" || !cfg.EnableDevToken {
		t.Errorf("environment overrides not applied: %+v", cfg)
	}
}

func TestLoadRejectsDevTokenInProduction(t *testing.T) {
	t.Setenv("JWT_SECRET", "x")
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("ENABLE_DEV_TOKEN", "1")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when ENABLE_DEV_TOKEN is on in production")
	}
}
