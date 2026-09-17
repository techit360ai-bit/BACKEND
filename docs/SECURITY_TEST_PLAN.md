# Security Test Plan

Automated suites must cover:

- User/workspace/organization BOLA and property-level authorization
- Role escalation and stale/forged JWT claims
- Expired/revoked session and refresh-token replay
- MFA and admin boundary enforcement
- Unauthorized AI tools, prompt injection containment, and RAG scope
- Malicious upload rejection and private object access
- Private URL/metadata SSRF blocking
- Rate limits, credit insufficiency, concurrent reservation, duplicate settlement
- Webhook signature/idempotency and payment fulfillment replay
- MCP approval requirements and audit immutability
- Secret redaction and dependency/secret/container scanning

Evidence must include test output, configuration, and (for production-only
controls) a recorded AWS verification run.
