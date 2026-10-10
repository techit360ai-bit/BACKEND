// WS9 manual trust-score overrides.
//
// An override is an explicit, time-boxed, admin-applied adjustment to a
// founder's trust score, optionally scoped to one source. It is intentionally
// boring and safe:
//   - a reason code is mandatory and must be allowlisted,
//   - an expiry is mandatory and must be in the future,
//   - the delta is bounded so one admin action cannot nuke or max a score,
//   - it is applied on top of the computed score and surfaces in the breakdown
//     as `manual_override` with a `manual_override` signal,
//   - it never mutates a proof; removing it is a revoke (append-only audit).
//
// Pure functions only. Storage/audit live in the authority + repository.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Default allowlist. Ops can extend/restrict with TRUST_OVERRIDE_REASON_CODES.
export const DEFAULT_OVERRIDE_REASON_CODES = Object.freeze([
  'provider_outage',
  'verified_offline',
  'dispute_resolution',
  'fraud_hold',
  'goodwill_credit',
  'pilot_program',
  'legal_hold',
])

export const MAX_OVERRIDE_DELTA = 50

const normalizeCode = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)

export function allowedOverrideReasonCodes(env = process.env) {
  const configured = String(env.TRUST_OVERRIDE_REASON_CODES || '').split(',').map(item => normalizeCode(item)).filter(Boolean)
  return new Set(configured.length ? configured : DEFAULT_OVERRIDE_REASON_CODES)
}

export function validateOverrideInput(input = {}, env = process.env) {
  const reasonCode = normalizeCode(input.reasonCode || input.reason_code)
  if (!reasonCode) return { ok: false, status: 400, error: 'override_reason_code_required' }
  if (!allowedOverrideReasonCodes(env).has(reasonCode)) return { ok: false, status: 400, error: 'override_reason_code_not_allowed' }

  const rawDelta = input.delta ?? input.points
  const delta = Number(rawDelta)
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, status: 400, error: 'override_delta_invalid' }
  if (Math.abs(delta) > MAX_OVERRIDE_DELTA) return { ok: false, status: 400, error: 'override_delta_out_of_range' }

  const expiresAt = input.expiresAt || input.expires_at
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : NaN
  if (!Number.isFinite(expiryMs)) return { ok: false, status: 400, error: 'override_expiry_required' }
  if (expiryMs <= Date.now()) return { ok: false, status: 400, error: 'override_expiry_in_past' }

  const source = input.source ? normalizeCode(input.source) : null
  return {
    ok: true,
    value: {
      reasonCode,
      delta: Math.round(delta * 100) / 100,
      expiresAt: new Date(expiryMs).toISOString(),
      source,
      projectId: input.projectId || input.project_id || null,
      note: String(input.note || '').replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000),
    },
  }
}

const tierFor = score => score >= 80 ? 'Highly Trusted' : score >= 60 ? 'Verified' : score >= 30 ? 'Building' : 'Claimed'

// Active = not revoked, not expired, and either global or matching the project.
export function activeOverridesFor(overrides, { userId, projectId = null, now = Date.now() } = {}) {
  return (overrides || []).filter(override => override
    && override.userId === userId
    && !override.revokedAt
    && override.expiresAt
    && new Date(override.expiresAt).getTime() > now
    && (override.projectId == null || override.projectId === projectId))
}

export function applyScoreOverrides(result, overrides, { userId, projectId = null, now = Date.now() } = {}) {
  const active = activeOverridesFor(overrides, { userId, projectId, now })
  if (!active.length) return result
  const total = active.reduce((sum, override) => sum + Number(override.delta || 0), 0)
  if (!total) return result
  const trustScore = clamp(Math.round((Number(result.trustScore || 0) + total) * 100) / 100, 0, 100)
  return {
    ...result,
    trustScore,
    tier: tierFor(trustScore),
    verificationStatus: trustScore > 0 ? 'verified' : 'unverified',
    breakdown: { ...(result.breakdown || {}), manual_override: Math.round(total * 100) / 100 },
    signals: [...new Set([...(result.signals || []), 'manual_override'])],
    overrides: active.map(override => ({
      id: override.id,
      source: override.source || null,
      delta: Number(override.delta || 0),
      reason_code: override.reasonCode || null,
      expires_at: override.expiresAt || null,
    })),
  }
}
