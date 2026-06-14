# WS2 Slice D1 — Live Demo Room (LiveKit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time A/V to a demo event when its host takes it live, by minting role-scoped LiveKit tokens server-side and embedding a LiveKit room in the frontend.

**Architecture:** A new Go `internal/livekit` package mints LiveKit JWTs (token-only; no media-server control). A new authed endpoint `POST /api/v1/demos/{id}/rtc-token` authorizes via the existing C1 `demo.Service`, requires `status=="live"`, and grants publish to host/presenter only. The frontend fetches the token and lazily renders a `DemoStage` (LiveKit React components) inside the existing `DemoRoom`.

**Tech Stack:** Go (chi, `github.com/livekit/protocol/auth`); React/TS (`@livekit/components-react`, `livekit-client`); `gobc` Docker test gate; FE local node test gate + `tsc`.

**Branches:** backend tasks (1–3, 6 backend) on `feat/messaging-backend`; frontend tasks (4–5) on `feat/messaging-phase1`. Spec + this plan committed to both.

**`gobc` alias** (from `backend/`):
```bash
gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
```

---

## Task 1 — `internal/livekit` package (token minting)

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/livekit/service.go`
- Test: `backend/internal/livekit/service_test.go`

- [ ] **Step 1: Write the failing test** (`backend/internal/livekit/service_test.go`)

```go
package livekit

import (
	"testing"

	"github.com/livekit/protocol/auth"
)

const (
	testKey    = "APIxxxxxxxx"
	testSecret = "secretsecretsecretsecretsecret12"
	testURL    = "wss://demo.livekit.cloud"
)

func TestTokenGrantsPerRole(t *testing.T) {
	s := New(testKey, testSecret, testURL)
	if !s.Enabled() {
		t.Fatal("service should be enabled with full config")
	}

	// host/presenter -> can publish
	tok, err := s.Token("room-1", "user-1", Grant{CanPublish: true})
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	claims := verify(t, tok)
	if claims.Identity != "user-1" {
		t.Fatalf("identity = %q", claims.Identity)
	}
	if claims.Video.Room != "room-1" || !claims.Video.RoomJoin {
		t.Fatalf("bad room grant: %+v", claims.Video)
	}
	if claims.Video.CanPublish == nil || !*claims.Video.CanPublish {
		t.Fatal("expected CanPublish=true")
	}
	if claims.Video.CanSubscribe == nil || !*claims.Video.CanSubscribe {
		t.Fatal("expected CanSubscribe=true")
	}

	// audience -> subscribe only
	tok2, err := s.Token("room-1", "user-2", Grant{CanPublish: false})
	if err != nil {
		t.Fatalf("token2: %v", err)
	}
	c2 := verify(t, tok2)
	if c2.Video.CanPublish == nil || *c2.Video.CanPublish {
		t.Fatal("expected CanPublish=false for audience")
	}
}

func TestDisabledServiceErrors(t *testing.T) {
	s := New("", "", "")
	if s.Enabled() {
		t.Fatal("service should be disabled with empty config")
	}
	if _, err := s.Token("r", "u", Grant{}); err == nil {
		t.Fatal("expected error from disabled service")
	}
}

func verify(t *testing.T, token string) *auth.ClaimGrants {
	t.Helper()
	v, err := auth.ParseAPIToken(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	claims, err := v.Verify(testSecret)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	return claims
}
```

- [ ] **Step 2: Add the dependency and run the test to verify it fails**

Run:
```bash
cd backend
gobc get github.com/livekit/protocol@latest
gobc test ./internal/livekit/
```
Expected: FAIL — `undefined: New` / `undefined: Grant` (package has no implementation yet). If `auth.ParseAPIToken`/`ClaimGrants` symbols differ for the resolved version, adjust the verify helper to that version's equivalent (`auth` is the only LiveKit symbol surface used).

- [ ] **Step 3: Write the implementation** (`backend/internal/livekit/service.go`)

```go
// Package livekit mints LiveKit access tokens for demo rooms. Token-only: it
// does not control rooms or media servers (that arrives with recording/Egress).
package livekit

import (
	"errors"
	"time"

	"github.com/livekit/protocol/auth"
)

// ErrDisabled is returned when LiveKit is not configured.
var ErrDisabled = errors.New("livekit: not configured")

// Grant is the minimal per-participant permission set we vary by room role.
type Grant struct {
	CanPublish bool
}

// Service mints LiveKit JWTs. Disabled (and returns ErrDisabled) until all of
// apiKey/apiSecret/url are set.
type Service struct {
	apiKey    string
	apiSecret string
	url       string
}

func New(apiKey, apiSecret, url string) *Service {
	return &Service{apiKey: apiKey, apiSecret: apiSecret, url: url}
}

func (s *Service) Enabled() bool {
	return s.apiKey != "" && s.apiSecret != "" && s.url != ""
}

// URL is the LiveKit ws URL clients connect to.
func (s *Service) URL() string { return s.url }

// Token mints a JWT for identity to join room with the given grant.
func (s *Service) Token(room, identity string, g Grant) (string, error) {
	if !s.Enabled() {
		return "", ErrDisabled
	}
	canPublish := g.CanPublish
	canSubscribe := true
	canData := true
	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           room,
		CanPublish:     &canPublish,
		CanSubscribe:   &canSubscribe,
		CanPublishData: &canData,
	}
	at := auth.NewAccessToken(s.apiKey, s.apiSecret).
		AddGrant(grant).
		SetIdentity(identity).
		SetValidFor(time.Hour)
	return at.ToJWT()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd backend
gobc test ./internal/livekit/
gobc vet ./internal/livekit/
```
Expected: PASS; vet clean.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/livekit/ backend/go.mod backend/go.sum
git commit -m "feat(ws2): livekit token-minting service (D1)"
```

---

## Task 2 — Config + wiring

**Branch:** `feat/messaging-backend`.
**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/internal/transport/httpapi/router.go` (add `LiveKit` to `Deps`)
- Modify: `backend/cmd/server/main.go` (construct + pass)

- [ ] **Step 1: Add config fields** (`backend/internal/config/config.go`)

Add to the `Config` struct (after `CORSOrigins string`):
```go
	LiveKitAPIKey    string
	LiveKitAPISecret string
	LiveKitURL       string
```
Add to the `cfg := Config{...}` literal in `Load` (after `CORSOrigins: ...`):
```go
		LiveKitAPIKey:    os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret: os.Getenv("LIVEKIT_API_SECRET"),
		LiveKitURL:       os.Getenv("LIVEKIT_URL"),
```
(These are optional — no validation; absence means the live-video endpoint returns 503.)

- [ ] **Step 2: Add `LiveKit` to `Deps`** (`backend/internal/transport/httpapi/router.go`)

Add the import (alongside the other internal imports):
```go
	"github.com/techit360ai-bit/new-frontend/backend/internal/livekit"
```
Add to the `Deps` struct (after `Demo *demo.Service`):
```go
	LiveKit        *livekit.Service
```

- [ ] **Step 3: Construct and pass it** (`backend/cmd/server/main.go`)

Add the import (alongside the other internal imports):
```go
	"github.com/techit360ai-bit/new-frontend/backend/internal/livekit"
```
After `demoSvc := demo.New(pg.Demo)` add:
```go
	lkSvc := livekit.New(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret, cfg.LiveKitURL)
```
In the `httpapi.NewRouter(httpapi.Deps{...})` literal, change the `Feed: feedSvc, Demo: demoSvc, Presence: presSvc,` line to:
```go
		Feed: feedSvc, Demo: demoSvc, LiveKit: lkSvc, Presence: presSvc,
```

- [ ] **Step 4: Verify it builds**

Run:
```bash
cd backend
gobc build ./...
```
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/config/config.go backend/internal/transport/httpapi/router.go backend/cmd/server/main.go
git commit -m "feat(ws2): wire livekit service into config + router (D1)"
```

---

## Task 3 — `POST /demos/{id}/rtc-token` endpoint

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/transport/httpapi/demo_rtc.go`
- Modify: `backend/internal/transport/httpapi/router.go` (mount route)
- Modify: `backend/internal/transport/httpapi/httpapi_test.go` (wire LiveKit in `newAPI`; add test)

- [ ] **Step 1: Write the failing test** (append to `backend/internal/transport/httpapi/httpapi_test.go`)

First, wire a configured LiveKit into `newAPI`. In `newAPI`, after `demoSvc := demo.New(st.Demo)` add:
```go
	lkSvc := livekit.New("APItest", "secretsecretsecretsecretsecret12", "wss://test.livekit.cloud")
```
and add `LiveKit: lkSvc,` to the `Deps{...}` literal (next to `Demo: demoSvc,`). Add the import `"github.com/techit360ai-bit/new-frontend/backend/internal/livekit"`.

Then append:
```go
func TestDemoRtcToken(t *testing.T) {
	r, ver, _ := newAPI(t)
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hostHdr := map[string]string{"Authorization": "Bearer " + hostTok}

	do := func(method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// create (draft) then go live
	rec := do("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`, hostHdr)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)

	// invite an audience member while still draft (host-only ok)
	_ = do("POST", "/api/v1/demos/"+id+"/invites", `{"userId":"aud1","roomRole":"audience"}`, hostHdr)

	// not live yet -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", hostHdr); rec.Code != 400 {
		t.Fatalf("pre-live want 400, got %d", rec.Code)
	}

	// go live
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`, hostHdr)
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`, hostHdr)

	// host -> 200, canPublish true, token present
	rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", hostHdr)
	if rec.Code != 200 {
		t.Fatalf("host token want 200, got %d body=%s", rec.Code, rec.Body)
	}
	var hostResp struct {
		Token      string `json:"token"`
		URL        string `json:"url"`
		CanPublish bool   `json:"canPublish"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &hostResp)
	if hostResp.Token == "" || hostResp.URL == "" || !hostResp.CanPublish {
		t.Fatalf("bad host resp: %+v", hostResp)
	}

	// audience -> 200, canPublish false
	audTok, _ := ver.Mint("aud1", "Aud", "founder")
	rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", map[string]string{"Authorization": "Bearer " + audTok})
	var audResp struct {
		CanPublish bool `json:"canPublish"`
	}
	if rec.Code != 200 {
		t.Fatalf("aud token want 200, got %d", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &audResp)
	if audResp.CanPublish {
		t.Fatal("audience must not be allowed to publish")
	}

	// outsider -> 403
	outTok, _ := ver.Mint("stranger", "S", "founder")
	if rec = do("POST", "/api/v1/demos/"+id+"/rtc-token", "", map[string]string{"Authorization": "Bearer " + outTok}); rec.Code != 403 {
		t.Fatalf("outsider want 403, got %d", rec.Code)
	}
}

func TestDemoRtcTokenUnconfigured(t *testing.T) {
	st := store.NewFakeStores()
	ver := auth.NewVerifier("s")
	demoSvc := demo.New(st.Demo)
	r := NewRouter(Deps{
		Verifier: ver, Users: st.Users, Demo: demoSvc,
		LiveKit: livekit.New("", "", ""), // disabled
	})
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hdr := map[string]string{"Authorization": "Bearer " + hostTok}
	mk := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		req.Header.Set("Authorization", hdr["Authorization"])
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}
	rec := mk("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)
	_ = mk("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`)
	_ = mk("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`)
	if rec = mk("POST", "/api/v1/demos/"+id+"/rtc-token", ""); rec.Code != 503 {
		t.Fatalf("unconfigured want 503, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd backend
gobc test ./internal/transport/httpapi/
```
Expected: FAIL — `handleDemoRtcToken` undefined / route not mounted (404 instead of 200/400/503).

- [ ] **Step 3: Implement the handler** (`backend/internal/transport/httpapi/demo_rtc.go`)

```go
package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/livekit"
)

// grantForRole maps a demo room role to LiveKit publish permission.
// Host and presenter publish; judge and audience are view-only.
func grantForRole(roomRole string) livekit.Grant {
	return livekit.Grant{CanPublish: roomRole == "host" || roomRole == "presenter"}
}

func handleDemoRtcToken(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		id := chi.URLParam(r, "id")

		// authorize + load event (host or rostered participant)
		ev, err := d.Demo.GetEvent(r.Context(), id, me)
		if err != nil {
			demoErr(w, err)
			return
		}
		if ev.Status != "live" {
			writeErr(w, http.StatusBadRequest, "event is not live")
			return
		}
		if d.LiveKit == nil || !d.LiveKit.Enabled() {
			writeErr(w, http.StatusServiceUnavailable, "live video not configured")
			return
		}

		// determine room role: host, else the requester's roster role
		roomRole := "audience"
		if ev.HostID == me {
			roomRole = "host"
		} else {
			roster, err := d.Demo.ListRoster(r.Context(), id, me)
			if err != nil {
				demoErr(w, err)
				return
			}
			for _, e := range roster {
				if e.UserID == me {
					roomRole = e.RoomRole
					break
				}
			}
		}

		grant := grantForRole(roomRole)
		token, err := d.LiveKit.Token(id, me, grant)
		if err != nil {
			if errors.Is(err, livekit.ErrDisabled) {
				writeErr(w, http.StatusServiceUnavailable, "live video not configured")
				return
			}
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"token": token, "url": d.LiveKit.URL(), "room": id,
			"identity": me, "canPublish": grant.CanPublish,
		})
	}
}

var _ = demo.ErrEventNotFound // keep demo import meaningful if handler trims
```

(Remove the trailing `var _ =` line if `demo` is otherwise referenced; it is only there to avoid an unused-import error if you inline differently. In the code above `demo` is not directly referenced, so either keep that line or drop the `demo` import — simplest is to delete the import and the `var _` line. Final file should import only `errors`, `net/http`, `chi`, and `livekit`.)

- [ ] **Step 4: Mount the route** (`backend/internal/transport/httpapi/router.go`)

After `r.Post("/demos/{id}/invites/respond", handleDemoRespond(d))` add:
```go
			r.Post("/demos/{id}/rtc-token", handleDemoRtcToken(d))
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd backend
gobc test ./internal/transport/httpapi/
gobc vet ./internal/transport/httpapi/
```
Expected: PASS; vet clean.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/transport/httpapi/demo_rtc.go backend/internal/transport/httpapi/router.go backend/internal/transport/httpapi/httpapi_test.go
git commit -m "feat(ws2): demo rtc-token endpoint (live-only, role-scoped) (D1)"
```

---

## Task 4 — Frontend RTC client (`lib/demo/rtc.ts`)

**Branch:** `feat/messaging-phase1`.
**Files:**
- Create: `frontend/src/lib/demo/rtc.ts`
- Test: `frontend/src/lib/demo/rtc.test.ts`

- [ ] **Step 1: Switch to the frontend branch**

```bash
cd /home/faithsax/new-frontend
git checkout feat/messaging-phase1
```

- [ ] **Step 2: Write the failing test** (`frontend/src/lib/demo/rtc.test.ts`)

```ts
import { test, expect } from "vitest";
import { fetchRtcToken } from "./rtc";

test("fetchRtcToken returns the session on success", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ token: "t", url: "wss://x", room: "e1", identity: "u1", canPublish: true }),
  })) as unknown as typeof fetch;
  try {
    const s = await fetchRtcToken("e1");
    expect(s?.token).toBe("t");
    expect(s?.canPublish).toBe(true);
  } finally {
    globalThis.fetch = orig;
  }
});

test("fetchRtcToken returns null on failure (offline-safe)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
  try {
    expect(await fetchRtcToken("e1")).toBeNull();
  } finally {
    globalThis.fetch = orig;
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/demo/rtc.test.ts
```
Expected: FAIL — cannot resolve `./rtc`.

- [ ] **Step 4: Write the implementation** (`frontend/src/lib/demo/rtc.ts`)

```ts
// Demo live-video session — fetches a LiveKit token from the messaging service.
// Offline-safe: returns null when the endpoint is unavailable or unconfigured.
import { msgPost, withFallback } from "@/lib/messaging/client";

export interface RtcSession {
  token: string;
  url: string;
  room: string;
  identity: string;
  canPublish: boolean;
}

export function fetchRtcToken(eventId: string): Promise<RtcSession | null> {
  return withFallback(
    () => msgPost<RtcSession>(`/demos/${encodeURIComponent(eventId)}/rtc-token`),
    () => null,
    "rtc token",
  );
}
```

- [ ] **Step 5: Run the test + tsc to verify they pass**

Run:
```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/demo/rtc.test.ts
npx tsc -b --noEmit 2>&1 | grep -E "lib/demo/rtc" || echo ok
```
Expected: test passes; tsc reports no errors for `lib/demo/rtc`.

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/new-frontend
git add frontend/src/lib/demo/rtc.ts frontend/src/lib/demo/rtc.test.ts
git commit -m "feat(ws2): frontend rtc token client (offline-safe) (D1)"
```

---

## Task 5 — `DemoStage` + `DemoRoom` integration

**Branch:** `feat/messaging-phase1`.
**Files:**
- Modify: `frontend/package.json` (add deps)
- Create: `frontend/src/dashboard/demos/DemoStage.tsx`
- Modify: `frontend/src/dashboard/demos/DemoRoom.tsx`

- [ ] **Step 1: Add the LiveKit frontend dependencies**

Run:
```bash
cd frontend
npm install @livekit/components-react livekit-client @livekit/components-styles
```
Expected: deps added to `package.json` + lockfile. (If the sandbox blocks npm network, add the three packages to `package.json` `dependencies` manually with current versions and note that `tsc` over `DemoStage` can only be fully checked once installed; `rtc.ts`, `DemoRoom` logic, and the test gate remain verifiable.)

- [ ] **Step 2: Create `DemoStage`** (`frontend/src/dashboard/demos/DemoStage.tsx`)

```tsx
import "@livekit/components-styles";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  useTracks,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { RtcSession } from "@/lib/demo/rtc";

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: "60vh" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** Self-contained LiveKit room. Knows nothing about demo lifecycle. */
export default function DemoStage({ session }: { session: RtcSession }) {
  return (
    <LiveKitRoom serverUrl={session.url} token={session.token} connect audio video={session.canPublish}
      style={{ borderRadius: 12, overflow: "hidden" }}>
      <Stage />
      <RoomAudioRenderer />
      {session.canPublish && <ControlBar />}
    </LiveKitRoom>
  );
}
```

- [ ] **Step 3: Integrate into `DemoRoom`** (`frontend/src/dashboard/demos/DemoRoom.tsx`)

Add imports at the top (after the existing imports):
```tsx
import { lazy, Suspense } from "react";
import { fetchRtcToken } from "@/lib/demo/client";
import type { RtcSession } from "@/lib/demo/rtc";
const DemoStage = lazy(() => import("./DemoStage"));
```
(Note: `fetchRtcToken` lives in `rtc.ts`; import it from `@/lib/demo/rtc`, not `client`. Use:
```tsx
import { fetchRtcToken } from "@/lib/demo/rtc";
```
)

Add session state + effect inside the `DemoRoom` component, after the existing `const [busy, setBusy] = useState(false);` line:
```tsx
  const [session, setSession] = useState<RtcSession | null>(null);
  useEffect(() => {
    if (event?.status !== "live") { setSession(null); return; }
    let alive = true;
    fetchRtcToken(id).then((s) => { if (alive) setSession(s); });
    return () => { alive = false; };
  }, [event?.status, id]);
```

Render the stage: immediately after the event header card (the `<div className="border border-slate-200 bg-white rounded-xl p-6">…</div>` block that shows title/description/asset), insert:
```tsx
      {event.status === "live" && (
        session ? (
          <Suspense fallback={<div className="text-sm text-slate-400">Connecting live video…</div>}>
            <DemoStage session={session} />
          </Suspense>
        ) : (
          <div className="border border-slate-200 bg-white rounded-xl p-6 text-sm text-slate-500">
            Live video is unavailable right now.
          </div>
        )
      )}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
cd frontend
npx tsc -b --noEmit 2>&1 | grep -E "dashboard/demos/(DemoStage|DemoRoom)" || echo ok
```
Expected: `ok` (no errors in the two files). If `@livekit/components-react` types are not installed (sandbox npm blocked), `DemoStage` will report missing-module; in that case confirm `DemoRoom` (logic) and `rtc.ts` are clean and note the install requirement.

- [ ] **Step 5: Run the full local test gate**

Run:
```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src
```
Expected: all tests pass (existing 18 + the new rtc test = 19).

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/new-frontend
git add frontend/package.json frontend/package-lock.json frontend/src/dashboard/demos/DemoStage.tsx frontend/src/dashboard/demos/DemoRoom.tsx
git commit -m "feat(ws2): live demo stage (LiveKit) + DemoRoom integration (D1)"
```

---

## Task 6 — Verify + docs on both branches

- [ ] **Step 1: Backend full gates** (on `feat/messaging-backend`)

```bash
cd /home/faithsax/new-frontend
git checkout feat/messaging-backend
cd backend
gobc build ./... && gobc test ./... && gobc vet ./...
```
Expected: build OK; all packages pass; vet clean. (No integration/smoke change needed — D1 adds no DB/migration and no messaging hot-path change.)

- [ ] **Step 2: Frontend full gates** (on `feat/messaging-phase1`)

```bash
cd /home/faithsax/new-frontend
git checkout feat/messaging-phase1
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src
npx tsc -b --noEmit 2>&1 | grep -E "lib/demo|dashboard/demos" | grep -v "calendar\|resizable" || echo ok
```
Expected: tests pass; no new tsc errors in demo files.

- [ ] **Step 3: Ensure spec + plan are on both branches**

The spec (`2026-06-14-ws2-slice-d1-live-demo-room-design.md`) and this plan live under `docs/superpowers/`. They are committed on `feat/messaging-backend`. Cherry-pick the doc commit(s) onto `feat/messaging-phase1` if not already present:
```bash
cd /home/faithsax/new-frontend
git checkout feat/messaging-phase1
git log --oneline feat/messaging-backend | grep -i "ws2.*d1" | grep docs
# cherry-pick the doc commit hash(es) shown above; skip any that report empty:
# git cherry-pick <hash>
```

- [ ] **Step 4: Stop. Report status; do NOT push.**

Push and PRs are user-directed. Summarize: backend gates green, frontend gates green, real A/V deferred to a LiveKit-configured env. Await the user's instruction to push.

---

## Self-Review

- **Spec coverage:** livekit Service+Token → T1; config+env → T2; endpoint (authz/live-only/role grant/503) → T3; `rtc.ts` offline-safe → T4; `DemoStage` + `DemoRoom` live embed → T5; tests in T1/T3/T4 + gates in T6; verification boundary honored (no real A/V) → T6.
- **Placeholder scan:** none — every step has concrete code/commands. The two environmental caveats (LiveKit `auth` version drift in T1; sandbox npm in T5) are explicit fallbacks, not unspecified work.
- **Type consistency:** `Grant{CanPublish}`, `Service.Token(room, identity, Grant)`, `Service.Enabled()`, `Service.URL()` used identically across T1/T2/T3. `RtcSession{token,url,room,identity,canPublish}` matches the endpoint JSON (T3) and the FE client (T4) and `DemoStage` prop (T5). `grantForRole` defined and used only in T3.
- **Scope:** single plan — one Go package, one endpoint, config, two FE files, tests. Recording/AI feedback/green-room excluded per spec.
