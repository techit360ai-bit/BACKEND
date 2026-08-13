import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const RUNBOOK = path.join(ROOT, "docs", "PRODUCTION-RUNBOOK.md");
const APP = path.join(ROOT, "backend", "src", "app.js");
const TESTS = path.join(ROOT, "backend", "src", "__tests__", "security-observability.test.js");
const WORKFLOW = path.join(ROOT, ".github", "workflows", "backend.yml");

function fail(message) {
  throw new Error(message);
}

function requireIncludes(content, needle, message) {
  if (!content.includes(needle)) fail(message);
}

try {
  const runbook = fs.readFileSync(RUNBOOK, "utf8");
  const app = fs.readFileSync(APP, "utf8");
  const tests = fs.readFileSync(TESTS, "utf8");
  const workflow = fs.readFileSync(WORKFLOW, "utf8");

  for (const heading of [
    "## 1. Deploy order",
    "## 2. Rollback",
    "## 3. Common issues and diagnosis",
    "## 4. Smoke-test cheat sheet",
    "## 5. Known soft spots",
  ]) {
    requireIncludes(runbook, heading, `runbook is missing ${heading}`);
  }

  for (const phrase of [
    "X-Request-Id",
    "http_request",
    "http_error",
    "MCP_ENABLED=false",
    "db:rollback:dry-run",
    "do not flip DNS",
  ]) {
    requireIncludes(runbook, phrase, `runbook is missing operational guidance for ${phrase}`);
  }

  requireIncludes(app, "X-Request-Id", "backend must emit X-Request-Id response headers");
  requireIncludes(app, "event: 'http_request'", "backend must emit structured request logs");
  requireIncludes(app, "event: 'http_error'", "backend must emit structured error logs");
  requireIncludes(tests, "request id", "backend observability tests must cover request ids");
  requireIncludes(tests, "http_request", "backend observability tests must cover request logs");
  requireIncludes(tests, "http_error", "backend observability tests must cover error logs");
  requireIncludes(workflow, "npm run runbook:check", "backend workflow must validate the production runbook");

  console.log("BACKEND runbook and observability gates OK");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
