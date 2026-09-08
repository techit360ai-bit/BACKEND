# Role Permission Matrix

Legend: A = allowed by policy and scope, C = conditional (verification/MFA/membership/subscription), D = denied by default.

| Capability | Explorer | Founder | Collaborator | Investor | Organization | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Public discovery/profile | A | A | A | A | A | A |
| Own profile/session | A | A | A | A | A | C |
| Workspace read | D | C | C | D | D | C |
| Workspace write/code | D | C | C | D | D | C |
| Organization dashboard | D | D | D | D | C | C |
| Investor intelligence | D | D | D | C | D | C |
| Deal-room internal records | D | C | D | C | D | C |
| Trust/verification submission | C | C | C | C | C | A |
| Support self-service | A | A | A | A | A | A |
| Support sensitive/admin action | D | D | D | D | D | C |
| AI runtime capability | C | C | C | C | C | C |
| MCP read tool | D | C | C | C | C | C |
| MCP sensitive/destructive tool | D | D | D | D | C | C |
| Wallet/credits own account | D | C | C | C | C | C |
| Global configuration | D | D | D | D | D | C |

Every row is additionally constrained by user identity, organization, workspace, resource ownership, action, assurance, risk state, MFA, rate limits, and billing/credit state.
