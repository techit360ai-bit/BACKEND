import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const WORKFLOW = path.join(ROOT, ".github", "workflows", "backend.yml");
const MESSAGING_DEPLOY = path.join(ROOT, ".github", "workflows", "deploy-messaging-ec2.yml");
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

  // Production deploy moved from a Render hook job in backend.yml to the EC2
  // workflow. Preserve the original guarantee (deploy only runs behind the
  // security jobs) by requiring it to be triggered on CI success instead.
  const messagingDeploy = fs.readFileSync(MESSAGING_DEPLOY, "utf8");
  requireIncludes(messagingDeploy, "workflow_run:", "messaging deploy must be gated on the CI workflow, not a raw push");
  requireIncludes(
    messagingDeploy,
    "TECHIT Backend Services",
    "messaging deploy must gate on the TECHIT Backend Services CI workflow",
  );
  requireIncludes(
    messagingDeploy,
    "github.event.workflow_run.conclusion == 'success'",
    "messaging deploy must require the CI workflow to have succeeded (includes plugins-mcp)",
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
