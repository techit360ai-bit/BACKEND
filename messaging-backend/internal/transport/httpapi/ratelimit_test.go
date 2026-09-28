package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterBurstsThenRefills(t *testing.T) {
	limiter := NewRateLimiter(60, 10) // one token per second, burst of 60
	base := time.Now()
	limiter.now = func() time.Time { return base }

	for i := 0; i < 60; i++ {
		if !limiter.Allow("caller").Allowed {
			t.Fatalf("request %d denied inside the burst", i)
		}
	}
	if limiter.Allow("caller").Allowed {
		t.Fatal("expected the 61st request to be denied")
	}

	base = base.Add(10 * time.Second) // refill ~10 tokens
	for i := 0; i < 10; i++ {
		if !limiter.Allow("caller").Allowed {
			t.Fatalf("refilled request %d denied", i)
		}
	}
	if limiter.Allow("caller").Allowed {
		t.Fatal("expected denial once the refill was spent")
	}

	// A different key is unaffected by the first key's exhaustion.
	if !limiter.Allow("other").Allowed {
		t.Fatal("a distinct key must have its own bucket")
	}
}

func TestRateLimiterBoundsKeySpace(t *testing.T) {
	limiter := NewRateLimiter(60, 2)
	for _, key := range []string{"a", "b", "c", "d", "e"} {
		limiter.Allow(key)
	}
	if len(limiter.buckets) > 2 {
		t.Fatalf("key space grew past the cap: %d", len(limiter.buckets))
	}
}

func TestRateLimiterDisabledAllowsEverything(t *testing.T) {
	limiter := NewRateLimiter(0, 0)
	for i := 0; i < 1000; i++ {
		result := limiter.Allow("caller")
		if !result.Allowed || result.Remaining != -1 {
			t.Fatalf("disabled limiter denied a request: %#v", result)
		}
	}
}

func TestRateLimitMiddlewareFailsClosed(t *testing.T) {
	r, ver, _ := newAPIWith(t, func(d *Deps) { d.RateLimiter = NewRateLimiter(2, 0) })
	tok, _ := ver.Mint("u1", "U1", "founder")
	req := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		httpReq := httptest.NewRequest("GET", "/api/v1/conversations", nil)
		httpReq.Header.Set("Authorization", "Bearer "+tok)
		r.ServeHTTP(rec, httpReq)
		return rec
	}
	if got := req().Code; got != http.StatusOK {
		t.Fatalf("first request: want 200, got %d", got)
	}
	if got := req().Code; got != http.StatusOK {
		t.Fatalf("second request: want 200, got %d", got)
	}
	rec := req()
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("third request: want 429, got %d body=%s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("429 response is missing Retry-After")
	}
	var body map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "rate_limit_exceeded" {
		t.Fatalf("unexpected 429 body: %s", rec.Body)
	}
}

func TestRateLimitedWrapsHandler(t *testing.T) {
	limiter := NewRateLimiter(1, 0)
	handler := RateLimited(limiter, ClientIPKey, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	call := func() int {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", "/ws", nil))
		return rec.Code
	}
	if got := call(); got != http.StatusOK {
		t.Fatalf("first call: want 200, got %d", got)
	}
	if got := call(); got != http.StatusTooManyRequests {
		t.Fatalf("second call: want 429, got %d", got)
	}
}
