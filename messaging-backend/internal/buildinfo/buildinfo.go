// Package buildinfo exposes the deployed service identity for probes.
// Values come from the deploy workflow/platform env; none are secrets.
package buildinfo

import (
	"os"
	"strings"
	"time"
)

// ExpectedProductionOrigin is the deployed SPA origin. Readiness reports whether
// the runtime CORS allow-list actually includes it.
const ExpectedProductionOrigin = "https://beta.techitnetwork.com"

var started = time.Now()

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func Service() string {
	if value := firstEnv("SERVICE_NAME"); value != "" {
		return value
	}
	return "messaging-backend"
}

func Environment() string {
	if value := firstEnv("ENVIRONMENT", "APP_ENV", "NODE_ENV"); value != "" {
		return value
	}
	return "development"
}

func GitSHA() string {
	if value := firstEnv("GIT_SHA", "RENDER_GIT_COMMIT", "COMMIT_SHA"); value != "" {
		return value
	}
	return "unknown"
}

func BuildTime() string {
	if value := firstEnv("BUILD_TIME", "BUILD_TIMESTAMP"); value != "" {
		return value
	}
	return "unknown"
}

func Version() string {
	if value := firstEnv("APP_VERSION"); value != "" {
		return value
	}
	return "0.0.0"
}

// Info is the build identity payload included in /health and /ready.
func Info() map[string]any {
	return map[string]any{
		"service":       Service(),
		"version":       Version(),
		"sha":           GitSHA(),
		"builtAt":       BuildTime(),
		"environment":   Environment(),
		"uptimeSeconds": int(time.Since(started).Seconds()),
	}
}

// OriginAllowed reports whether origin is present in the comma-separated list.
func OriginAllowed(list, origin string) bool {
	for _, entry := range strings.Split(list, ",") {
		if strings.TrimSpace(entry) == origin {
			return true
		}
	}
	return false
}
