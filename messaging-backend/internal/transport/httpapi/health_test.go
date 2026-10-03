package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v (%s)", err, rec.Body.String())
	}
	return body
}

func TestHealthReportsBuildIdentity(t *testing.T) {
	t.Setenv("GIT_SHA", "test-sha")
	t.Setenv("SERVICE_NAME", "messaging-backend")
	r, _, _ := newAPIWith(t, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/health", nil))
	if rec.Code != 200 {
		t.Fatalf("health code=%d", rec.Code)
	}
	body := decodeBody(t, rec)
	if body["status"] != "ok" {
		t.Fatalf("status=%v", body["status"])
	}
	if body["sha"] != "test-sha" {
		t.Fatalf("sha=%v", body["sha"])
	}
}

func TestReadyValidatesConfig(t *testing.T) {
	t.Setenv("ENVIRONMENT", "test")
	t.Setenv("JWT_SECRET", "test_jwt_secret_at_least_32_chars_long")
	t.Setenv("CORS_ORIGINS", "https://beta.techitnetwork.com")
	r, _, _ := newAPIWith(t, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/ready", nil))
	if rec.Code != 200 {
		t.Fatalf("ready code=%d body=%s", rec.Code, rec.Body.String())
	}
	body := decodeBody(t, rec)
	if body["status"] != "ready" {
		t.Fatalf("status=%v", body["status"])
	}
	warnings, _ := body["warnings"].([]any)
	if len(warnings) != 1 {
		t.Fatalf("warnings=%v", body["warnings"])
	}
	first, _ := warnings[0].(map[string]any)
	if first["ok"] != true {
		t.Fatalf("expected origin warning should pass: %v", first)
	}
}

func TestReadyFailsClosedWhenProductionConfigMissing(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("JWT_SECRET", "short")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_URL", "")
	t.Setenv("CORS_ORIGINS", "")
	r, _, _ := newAPIWith(t, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/ready", nil))
	if rec.Code != 503 {
		t.Fatalf("want 503 for invalid production config, got %d body=%s", rec.Code, rec.Body.String())
	}
	body := decodeBody(t, rec)
	if body["status"] != "not_ready" {
		t.Fatalf("status=%v", body["status"])
	}
}
