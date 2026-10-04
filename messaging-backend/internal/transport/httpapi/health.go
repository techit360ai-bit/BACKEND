package httpapi

import (
	"net/http"
	"os"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/buildinfo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/config"
)

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	body := buildinfo.Info()
	body["status"] = "ok"
	writeJSON(w, http.StatusOK, body)
}

// handleReady is the readiness probe. It re-runs the same fail-closed config
// validation the process starts with (JWT, CORS, database/redis outside
// development), so a deployed instance can prove its configuration matches the
// contract. The expected SPA origin is reported as a warning until the AWS env
// is finalized.
func handleReady(w http.ResponseWriter, _ *http.Request) {
	checks := []map[string]any{}
	if _, err := config.Load(); err != nil {
		checks = append(checks, map[string]any{"name": "config", "ok": false, "detail": err.Error()})
	} else {
		checks = append(checks, map[string]any{"name": "config", "ok": true, "detail": "valid"})
	}

	originPresent := buildinfo.OriginAllowed(os.Getenv("CORS_ORIGINS"), buildinfo.ExpectedProductionOrigin)
	warnings := []map[string]any{{
		"name":   "cors.expected_origin",
		"ok":     originPresent,
		"detail": buildinfo.ExpectedProductionOrigin + map[bool]string{true: " present", false: " missing from CORS_ORIGINS"}[originPresent],
	}}

	ok := true
	for _, check := range checks {
		if passed, _ := check["ok"].(bool); !passed {
			ok = false
			break
		}
	}

	body := buildinfo.Info()
	body["status"] = map[bool]string{true: "ready", false: "not_ready"}[ok]
	body["checks"] = checks
	body["warnings"] = warnings
	writeJSON(w, map[bool]int{true: http.StatusOK, false: http.StatusServiceUnavailable}[ok], body)
}
