import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const MANIFEST_PATH = path.join(ROOT, "docs", "deployment-manifest.json");
const REQUIRED_SERVICES = new Set(["node-backend", "plugins-mcp", "messaging-backend"]);
const PROD_ENVS = new Set(["production", "staging"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseEnvKeys(filePath) {
  const keys = new Set();
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function fail(message) {
  throw new Error(message);
}

function requireValue(env, name) {
  const value = env[name];
  if (value === undefined || value === "") fail(`${name} is required`);
  return value;
}

function requireUrl(env, name, protocols = ["https:"]) {
  const value = requireValue(env, name);
  const parsed = new URL(value);
  if (!protocols.includes(parsed.protocol)) {
    fail(`${name} must use ${protocols.join(" or ")}`);
  }
  if (PROD_ENVS.has(currentEnvironment(env)) && parsed.hostname === "localhost") {
    fail(`${name} cannot point at localhost in production/staging`);
  }
  return parsed;
}

function requireOriginList(env, name) {
  const origins = requireValue(env, name)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) fail(`${name} must include at least one origin`);
  for (const origin of origins) {
    if (origin === "*") fail(`${name} cannot contain * in production/staging`);
    const parsed = new URL(origin);
    if (PROD_ENVS.has(currentEnvironment(env)) && parsed.protocol !== "https:") {
      fail(`${name} origin ${origin} must use https:// in production/staging`);
    }
  }
}

function currentEnvironment(env) {
  return (env.ENV_CONTRACT_ENV || env.ENVIRONMENT || env.NODE_ENV || "production").toLowerCase();
}

function assertStrongSharedSecret(env) {
  const secret = requireValue(env, "JWT_SECRET");
  if (secret.length < 32) fail("JWT_SECRET must be at least 32 characters");
  if (/change|replace|secret|test-secret/i.test(secret)) {
    fail("JWT_SECRET must not be a placeholder or weak demo value");
  }
}

function requireAbsolutePath(env, name) {
  const value = requireValue(env, name);
  if (!path.isAbsolute(value)) fail(`${name} must be an absolute path to persistent storage`);
}

function validateManifest() {
  const manifest = readJson(MANIFEST_PATH);
  if (manifest.version !== 1) fail("deployment manifest version must be 1");
  if (!Array.isArray(manifest.services)) fail("deployment manifest must list services");

  const names = new Set(manifest.services.map((service) => service.name));
  for (const required of REQUIRED_SERVICES) {
    if (!names.has(required)) fail(`deployment manifest is missing ${required}`);
  }

  for (const service of manifest.services) {
    if (!service.name) fail("deployment manifest service is missing name");
    if (service.requiredEnv && !service.envFile) {
      fail(`${service.name} lists requiredEnv without envFile`);
    }
    if (service.envFile) {
      const envPath = path.join(ROOT, service.envFile);
      const keys = parseEnvKeys(envPath);
      for (const key of service.requiredEnv || []) {
        if (!keys.has(key)) fail(`${service.envFile} is missing ${key}`);
      }
    }
    if (service.requiredEnv && !service.healthCheck) {
      fail(`${service.name} must declare a healthCheck`);
    }
  }
}

function validateNodeBackend(env) {
  if (currentEnvironment(env) !== "production") fail("NODE_ENV/ENVIRONMENT must be production for this contract");
  assertStrongSharedSecret(env);
  requireValue(env, "PORT");
  requireOriginList(env, "CORS_ORIGINS");
  requireUrl(env, "FRONTEND_URL");
  if (requireValue(env, "DB_DRIVER").toLowerCase() !== "sqlite") {
    fail("DB_DRIVER must be sqlite in production");
  }
  requireAbsolutePath(env, "SQLITE_DB_PATH");
  requireValue(env, "RESEND_API_KEY");
  requireValue(env, "FROM_EMAIL");
  requireAbsolutePath(env, "MCP_DATA_FILE");
}

function validatePluginsMcp(env) {
  assertStrongSharedSecret(env);
  requireAbsolutePath(env, "MCP_DATA_FILE");
  if (requireValue(env, "MCP_ALLOW_FILE_STORE") !== "true") {
    fail("MCP_ALLOW_FILE_STORE=true must be explicit for the current single-replica file store");
  }
  if (requireValue(env, "MCP_ALLOW_STUB_CONNECTORS") !== "true") {
    fail("MCP_ALLOW_STUB_CONNECTORS=true must be explicit until real connector wiring is deployed");
  }
  const ttl = Number(requireValue(env, "MCP_APPROVAL_TTL_MS"));
  if (!Number.isInteger(ttl) || ttl < 60_000) {
    fail("MCP_APPROVAL_TTL_MS must be an integer >= 60000");
  }
}

function validateMessagingBackend(env) {
  if (requireValue(env, "ENVIRONMENT").toLowerCase() !== "production") {
    fail("ENVIRONMENT must be production for messaging-backend");
  }
  assertStrongSharedSecret(env);
  requireValue(env, "PORT");
  requireUrl(env, "DATABASE_URL", ["postgres:", "postgresql:"]);
  requireUrl(env, "REDIS_URL", ["redis:", "rediss:"]);
  requireOriginList(env, "CORS_ORIGINS");
  if (env.ENABLE_DEV_TOKEN === "1" || env.ENABLE_DEV_TOKEN === "true") {
    fail("ENABLE_DEV_TOKEN must be disabled in production");
  }

  const livekit = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"];
  const enabled = livekit.some((name) => env[name]);
  if (enabled) {
    for (const name of livekit) requireValue(env, name);
    requireUrl(env, "LIVEKIT_URL", ["wss:", "https:"]);
  }
}

try {
  validateManifest();
  validateNodeBackend(process.env);
  validatePluginsMcp(process.env);
  validateMessagingBackend(process.env);
  console.log("BACKEND deployment env contract OK");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
