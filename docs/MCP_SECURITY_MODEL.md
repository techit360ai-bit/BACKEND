# MCP Security Model

MCP is an explicit opt-in execution surface. Production requires the
PostgreSQL MCP store, strong encryption keys, real connectors, and disabled
demo/file-backed stores.

Every invocation must pass authentication, actor identity hydration, tool
registry policy, organization/workspace/resource scope, risk classification,
approval for sensitive/destructive actions, bounded arguments, and immutable
audit logging. Tool classes are READ, LOW-RISK WRITE, SENSITIVE, and
DESTRUCTIVE. No agent receives unrestricted tool or resource access.
