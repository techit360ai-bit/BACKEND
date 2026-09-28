package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowListEchoesExactOrigin(t *testing.T) {
	r, _, _ := newAPIWith(t, func(d *Deps) { d.CORSOrigins = "https://app.example.com, https://admin.example.com" })

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("OPTIONS", "/api/v1/conversations", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight: want 204, got %d", rec.Code)
	}
	origin := rec.Header().Get("Access-Control-Allow-Origin")
	if origin != "https://app.example.com" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want the exact origin", origin)
	}
	if origin == "*" {
		t.Fatal("a credentialed response must never echo a wildcard")
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatal("expected Access-Control-Allow-Credentials: true")
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	r, _, _ := newAPIWith(t, func(d *Deps) { d.CORSOrigins = "https://app.example.com" })

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("OPTIONS", "/api/v1/conversations", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unknown origin was allowed: %q", got)
	}
}

func TestCORSActualRequestCarriesCredentialsHeaders(t *testing.T) {
	r, _, _ := newAPIWith(t, func(d *Deps) { d.CORSOrigins = "https://app.example.com" })

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/health", nil)
	req.Header.Set("Origin", "https://app.example.com")
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("health: want 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("actual request missing allow-origin: %q", got)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatal("actual request missing allow-credentials")
	}
}
