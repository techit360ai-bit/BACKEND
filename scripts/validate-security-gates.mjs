import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const WORKFLOW = path.join(ROOT, ".github", "workflows", "backend.yml");
const PACKAGE = path.join(ROOT, "package.json");

function fail(message) {
  throw new Error(message);
}

function requireIncludes(content, needle, message) {
  if (!content.includes(needle)) fail(message);
}

try {
  const workflow = fs.readFileSync(WORKFLOW, "utf8");
  const pkg = JSON.parse(fs.readFileSync(PACKAGE, "utf8"));

  requireIncludes(workflow, "plugins-mcp:", "backend workflow must define plugins-mcp job");
  requireIncludes(workflow, "npm test --prefix Plugins-MCP", "backend workflow must run MCP tests");
  requireIncludes(workflow, "npm run typecheck --prefix Plugins-MCP", "backend workflow must run MCP typecheck");
  requireIncludes(
    workflow,
    "needs: [node-backend, go-messaging-unit, go-messaging-integration, plugins-mcp]",
    "deploy job must depend on plugins-mcp",
  );

  const securityCheck = pkg.scripts?.["security:check"];
  if (!securityCheck) fail("root package.json must define security:check");
  for (const command of [
    "npm test --prefix backend",
    "npm test --prefix Plugins-MCP",
    "npm run typecheck --prefix Plugins-MCP",
  ]) {
    if (!securityCheck.includes(command)) fail(`security:check is missing ${command}`);
  }

  console.log("BACKEND security gates OK");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
