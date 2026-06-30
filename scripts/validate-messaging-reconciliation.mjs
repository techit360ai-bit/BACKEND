import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const requiredPaths = [
  "backend/package.json",
  "backend/src/app.js",
  "Plugins-MCP/server/mount.ts",
  "messaging-backend/go.mod",
  "messaging-backend/.env.example",
  "messaging-backend/cmd/migrate/main.go",
  "messaging-backend/internal/transport/httpapi/router.go",
  "messaging-backend/internal/transport/ws/gateway.go",
  "messaging-backend/internal/store/migrations/0006_demo_questions.sql",
  "messaging-backend/internal/qa/service.go",
  "messaging-backend/internal/livekit/service.go",
];

const forbiddenPaths = [
  "backend/go.mod",
  "backend/cmd/server/main.go",
  "backend/internal/transport/httpapi/router.go",
  "backend/internal/transport/ws/gateway.go",
];

function fail(message) {
  throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function exists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function assertRequiredPaths() {
  for (const filePath of requiredPaths) {
    if (!exists(filePath)) fail(`required messaging reconciliation path is missing: ${filePath}`);
  }
}

function assertForbiddenPaths() {
  for (const filePath of forbiddenPaths) {
    if (exists(filePath)) {
      fail(`old feat/messaging-backend layout must not be restored in BACKEND: ${filePath}`);
    }
  }
}

function assertModulePath() {
  const goMod = read("messaging-backend/go.mod");
  const expected = "module github.com/techit360ai-bit/BACKEND/messaging-backend";
  if (!goMod.includes(expected)) fail(`messaging-backend/go.mod must declare ${expected}`);
}

function assertNoOldFrontendModulePath() {
  const needles = [
    "github.com/techit360ai-bit/new-frontend/backend",
    "module github.com/techit360ai-bit/new-frontend/backend",
  ];
  const roots = ["messaging-backend", ".github/workflows", "scripts", "docs"];
  for (const root of roots) {
    const start = path.join(ROOT, root);
    if (!fs.existsSync(start)) continue;
    for (const filePath of walk(start)) {
      if (path.relative(ROOT, filePath) === "scripts/validate-messaging-reconciliation.mjs") continue;
      if (!isTextCandidate(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      for (const needle of needles) {
        if (content.includes(needle)) {
          fail(`old frontend-owned Go module path found in ${path.relative(ROOT, filePath)}`);
        }
      }
    }
  }
}

function assertProductionGuards() {
  const config = read("messaging-backend/internal/config/config.go");
  if (!config.includes("EnableDevToken")) fail("messaging config must keep EnableDevToken guard");
  if (!config.includes("ENABLE_DEV_TOKEN=1 is forbidden in production")) {
    fail("messaging config must reject ENABLE_DEV_TOKEN=1 in production");
  }

  const workflow = read(".github/workflows/backend.yml");
  for (const job of ["Go Messaging Unit Tests", "Go Messaging Integration Tests"]) {
    if (!workflow.includes(job)) fail(`backend workflow is missing ${job}`);
  }
  if (!workflow.includes("go run ./cmd/migrate -mode=dry-run")) {
    fail("backend workflow must dry-run messaging PostgreSQL migrations");
  }
}

function assertFrontendIsReferenceOnly() {
  const workflow = read(".github/workflows/backend.yml");
  if (workflow.includes("frontend/**")) {
    fail("BACKEND workflow must not be triggered by reference frontend changes");
  }
  const readme = read("README.md");
  if (!readme.includes("frontend/` in this repo is migration/reference material only")) {
    fail("README must document BACKEND/frontend as reference-only material");
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function isTextCandidate(filePath) {
  return /\.(go|mod|sum|mjs|js|json|ya?ml|md|txt|sh|env|example)$/i.test(filePath);
}

try {
  assertRequiredPaths();
  assertForbiddenPaths();
  assertModulePath();
  assertNoOldFrontendModulePath();
  assertProductionGuards();
  assertFrontendIsReferenceOnly();
  console.log("messaging branch reconciliation OK");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
