const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10_000);

const checks = [
  { name: "node-backend", base: "BACKEND_BASE_URL", path: "/", statuses: [200] },
  { name: "mcp-auth-boundary", base: "BACKEND_BASE_URL", path: "/api/mcp/health", statuses: [401] },
  { name: "messaging-health", base: "MESSAGING_BASE_URL", path: "/health", statuses: [200] },
];

if (process.env.SMOKE_BEARER_TOKEN) {
  checks.push(
    {
      name: "node-session",
      base: "BACKEND_BASE_URL",
      path: "/api/auth/session",
      statuses: [200],
      token: process.env.SMOKE_BEARER_TOKEN,
    },
    {
      name: "mcp-authenticated",
      base: "BACKEND_BASE_URL",
      path: "/api/mcp/health",
      statuses: [200],
      token: process.env.SMOKE_BEARER_TOKEN,
    },
    {
      name: "messaging-conversations",
      base: "MESSAGING_BASE_URL",
      path: "/api/v1/conversations",
      statuses: [200],
      token: process.env.SMOKE_BEARER_TOKEN,
    },
  );
}

function joinUrl(base, path) {
  return `${base.replace(/\/$/, "")}${path}`;
}

async function probe(check) {
  const base = process.env[check.base];
  if (!base) {
    console.log(`skip ${check.name}: ${check.base} unset`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = check.token ? { Authorization: `Bearer ${check.token}` } : undefined;
  const url = joinUrl(base, check.path);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!check.statuses.includes(res.status)) {
      throw new Error(`${url} returned ${res.status}; expected ${check.statuses.join("/")}`);
    }
    console.log(`ok ${check.name} ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

try {
  for (const check of checks) {
    await probe(check);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
