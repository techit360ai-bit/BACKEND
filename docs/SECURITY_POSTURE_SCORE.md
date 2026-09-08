# TechIT Security Posture Score (TSPS)

The backend endpoint `GET /api/admin/security/posture` calculates a defensive
posture score from identity, authorization, API, AI, data, infrastructure,
supply-chain, monitoring, and incident-readiness evidence. It is an internal
operational indicator, not a certification.

Scores are accompanied by domain scores, severity-ranked findings,
implementation status, test status, and recommended remediation. Production
configuration findings intentionally reduce the score until verified.
