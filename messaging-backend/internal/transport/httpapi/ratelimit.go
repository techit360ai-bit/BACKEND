package httpapi

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RateLimiter is a keyed token-bucket limiter for the messaging service. Each
// process enforces its own ceiling: rate-limit state is not shared across
// replicas, because a per-process ceiling still contains a single abusive
// caller without adding a shared cache dependency. Buckets refill continuously
// and the key space is capped so a flood of distinct keys cannot grow memory
// without bound.
type RateLimiter struct {
	mu        sync.Mutex
	buckets   map[string]*rateBucket
	perSecond float64
	burst     float64
	maxKeys   int
	now       func() time.Time
}

type rateBucket struct {
	tokens float64
	last   time.Time
}

// RateLimitResult reports the outcome of one Allow call.
type RateLimitResult struct {
	Allowed           bool
	Remaining         int
	RetryAfterSeconds int
}

// NewRateLimiter builds a limiter that admits perMinute requests per key with a
// burst equal to one minute's allowance. A non-positive perMinute disables the
// limiter, which is how tests and local development opt out.
func NewRateLimiter(perMinute, maxKeys int) *RateLimiter {
	if maxKeys <= 0 {
		maxKeys = 20000
	}
	limiter := &RateLimiter{buckets: map[string]*rateBucket{}, maxKeys: maxKeys, now: time.Now}
	if perMinute > 0 {
		limiter.perSecond = float64(perMinute) / 60.0
		limiter.burst = float64(perMinute)
	}
	return limiter
}

// Allow consumes one token for key and reports whether the caller may proceed.
func (l *RateLimiter) Allow(key string) RateLimitResult {
	if l == nil || l.burst == 0 {
		return RateLimitResult{Allowed: true, Remaining: -1}
	}
	now := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()

	bucket, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= l.maxKeys {
			l.evictLocked(now)
		}
		bucket = &rateBucket{tokens: l.burst, last: now}
		l.buckets[key] = bucket
	}
	if elapsed := now.Sub(bucket.last).Seconds(); elapsed > 0 {
		bucket.tokens += elapsed * l.perSecond
		if bucket.tokens > l.burst {
			bucket.tokens = l.burst
		}
		bucket.last = now
	}
	if bucket.tokens < 1 {
		needed := (1 - bucket.tokens) / l.perSecond
		retry := int(needed) + 1
		if retry < 1 {
			retry = 1
		}
		return RateLimitResult{Allowed: false, Remaining: 0, RetryAfterSeconds: retry}
	}
	bucket.tokens--
	return RateLimitResult{Allowed: true, Remaining: int(bucket.tokens)}
}

// evictLocked bounds the key space: idle buckets are dropped first, and if the
// map is still full the least-recently-used key is removed.
func (l *RateLimiter) evictLocked(now time.Time) {
	for key, bucket := range l.buckets {
		if now.Sub(bucket.last) > time.Minute {
			delete(l.buckets, key)
		}
	}
	if len(l.buckets) < l.maxKeys {
		return
	}
	var oldestKey string
	var oldest time.Time
	for key, bucket := range l.buckets {
		if oldestKey == "" || bucket.last.Before(oldest) {
			oldestKey, oldest = key, bucket.last
		}
	}
	if oldestKey != "" {
		delete(l.buckets, oldestKey)
	}
}

// ClientIPKey keys a limiter by the caller's address. X-Forwarded-For is only
// consulted when TRUST_PROXY_HOPS is positive, so a client cannot reset its own
// bucket by spoofing the header on a directly exposed service. The hop count
// mirrors the Node backend's `app.set('trust proxy', TRUST_PROXY_HOPS)`.
func ClientIPKey(r *http.Request) string {
	if hops := trustProxyHops(); hops > 0 {
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			parts := strings.Split(forwarded, ",")
			index := len(parts) - hops
			if index < 0 {
				index = 0
			}
			if candidate := strings.TrimSpace(parts[index]); candidate != "" {
				return candidate
			}
		}
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func trustProxyHops() int {
	raw := strings.TrimSpace(os.Getenv("TRUST_PROXY_HOPS"))
	if raw == "" {
		return 0
	}
	hops, err := strconv.Atoi(raw)
	if err != nil || hops < 0 {
		return 0
	}
	return hops
}

// rateLimitMiddleware rejects the caller with 429 once its bucket is empty.
// A nil limiter or key function is a no-op so callers can disable limiting.
func rateLimitMiddleware(l *RateLimiter, key func(*http.Request) string) func(http.Handler) http.Handler {
	if l == nil || key == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			result := l.Allow(key(r))
			if result.Remaining >= 0 {
				w.Header().Set("RateLimit-Remaining", strconv.Itoa(result.Remaining))
			}
			if !result.Allowed {
				w.Header().Set("Retry-After", strconv.Itoa(result.RetryAfterSeconds))
				writeCodeErr(w, http.StatusTooManyRequests, "rate_limit_exceeded", "Too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimited wraps an http.HandlerFunc — including the WebSocket upgrade —
// with the same limiter used by the REST surface.
func RateLimited(l *RateLimiter, key func(*http.Request) string, handler http.HandlerFunc) http.HandlerFunc {
	return rateLimitMiddleware(l, key)(handler).ServeHTTP
}
