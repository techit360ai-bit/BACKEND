import fs from "node:fs";

const report = JSON.parse(fs.readFileSync("/tmp/npm-audit.json", "utf8"));
const baseline = JSON.parse(fs.readFileSync(".github/dependency-audit-baseline.json", "utf8"));
if (new Date().toISOString().slice(0, 10) > baseline.expires) {
  throw new Error(`Dependency audit baseline expired on ${baseline.expires}`);
}
const blocking = Object.entries(report.vulnerabilities ?? {})
  .filter(([, value]) => ["high", "critical"].includes(value.severity))
  .filter(([name]) => !Object.hasOwn(baseline.knownPackages, name));
if (blocking.length) {
  console.error("New high/critical npm vulnerabilities detected:");
  for (const [name, value] of blocking) console.error(`- ${name}: ${value.severity}`);
  process.exit(1);
}
console.log("npm audit regression gate passed; existing findings are documented with an expiry.");
