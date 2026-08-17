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

function requireProductionEmailSender(env, name) {
  const value = requireValue(env, name);
  if (/@resend\.dev\b/i.test(value)) {
    fail(`${name} must use a verified sender domain, not resend.dev, in production/staging`);
  }
}

function requireMcpEncryptionKey(env) {
  const raw = requireValue(env, "MCP_SECRET_KEY");
  const value = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (value.length !== 32) fail("MCP_SECRET_KEY must encode exactly 32 bytes");
  if (new Set(value).size < 8) fail("MCP_SECRET_KEY does not have sufficient diversity");
}

function validateProductionMcp(env) {
  if (requireValue(env, "MCP_ENABLED") !== "true") fail("MCP_ENABLED must be true for the production-ready MCP contract");
  if (requireValue(env, "MCP_STORE") !== "postgres") fail("MCP_STORE must be postgres in production/staging");
  requireUrl(env, "MCP_DATABASE_URL", ["postgres:", "postgresql:"]);
  requireMcpEncryptionKey(env);
  const connectors = requireValue(env, "MCP_ENABLED_CONNECTORS").split(",").map((x) => x.trim()).filter(Boolean);
  if (connectors.length === 0) fail("MCP_ENABLED_CONNECTORS must not be empty");
  const requirements = {
    github: ["GITHUB_CONNECTOR_MODE", "MCP_GITHUB_TOKEN"],
    notion: ["NOTION_CONNECTOR_MODE", "NOTION_TOKEN"],
    figma: ["FIGMA_CONNECTOR_MODE", "FIGMA_TOKEN"],
    web3: ["WEB3_CONNECTOR_MODE", "SIWE_EXPECTED_DOMAIN", "SIWE_EXPECTED_URI", "SIWE_EXPECTED_CHAIN_ID"],
    ai: ["AI_HARNESS_CONNECTOR_MODE", "AI_ROUTER_URL", "AI_ROUTER_TOKEN"],
  };
  for (const connector of connectors) {
    const names = requirements[connector];
    if (!names) fail(`unsupported MCP connector ${connector}`);
    if (requireValue(env, names[0]) !== "real") fail(`${names[0]} must be real`);
    for (const name of names.slice(1)) requireValue(env, name);
  }
  if (connectors.includes("web3")) {
    if (!env.WEB3_RPC_URL && !env.ALCHEMY_API_KEY) fail("WEB3_RPC_URL or ALCHEMY_API_KEY is required");
    if (env.WEB3_RPC_URL) requireUrl(env, "WEB3_RPC_URL");
  }
  if (connectors.includes("ai")) requireUrl(env, "AI_ROUTER_URL");
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
  requireProductionEmailSender(env, "FROM_EMAIL");
  for (const name of ["JWT_ISSUER", "JWT_AUDIENCE"]) requireValue(env, name);
  for (const name of ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) {
    const value = requireValue(env, name);
    if (/test-github|replace/i.test(value)) fail(`${name} must be configured for production`);
  }
  requireUrl(env, "GITHUB_REDIRECT_URI");
  for (const name of [
    "GITHUB_TOKEN_ENCRYPTION_KEY",
    "OTP_HASH_SECRET",
    "AI_ROUTER_SETTLEMENT_SECRET",
    "AI_USAGE_GRANT_SERVICE_SECRET",
    "AI_EXECUTION_GRANT_SECRET",
  ]) {
    const value = requireValue(env, name);
    if (value.length < 32 || /change|replace|test-secret/i.test(value)) {
      fail(`${name} must be at least 32 characters and non-placeholder`);
    }
  }
  validateProductionMcp(env);
}

function validatePluginsMcp(env) {
  assertStrongSharedSecret(env);
  validateProductionMcp(env);
  if (requireValue(env, "MCP_ALLOW_FILE_STORE") !== "false") {
    fail("MCP_ALLOW_FILE_STORE must be false in production/staging");
  }
  if (requireValue(env, "MCP_ALLOW_STUB_CONNECTORS") !== "false") {
    fail("MCP_ALLOW_STUB_CONNECTORS must be false in production/staging");
  }
  if (requireValue(env, "MCP_SEED_DEMO_ACTIVITY") !== "false") {
    fail("MCP_SEED_DEMO_ACTIVITY must be false in production/staging");
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
  requireValue(env, "JWT_ISSUER");
  requireValue(env, "JWT_AUDIENCE");
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
