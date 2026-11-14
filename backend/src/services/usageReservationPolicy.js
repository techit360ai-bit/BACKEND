// Shared lifecycle rules for AI usage reservations (SQLite and PostgreSQL).
//
// * Every reservation expires. An execution that never settles (Router crash,
//   aborted request, read-only gateway call, rejected settlement) must not lock
//   PAYG credits forever. Rows written before expiry existed fall back to
//   createdAt + TTL.
// * A reservation is charged at most once. The first settlement closes it;
//   further executions the Router ran under the same grant are recorded as
//   zero-credit telemetry, never as an extra charge.
// * Gateway reservations are not bound to one Router task type, because one
//   proxied request can run several agents.

export function reservationTtlMs() {
  return Math.max(60, Number(process.env.USAGE_RESERVATION_TTL_SECONDS || 3600)) * 1000
}

export function reservationExpiry(createdAtIso) {
  const created = Date.parse(createdAtIso || '')
  return new Date((Number.isFinite(created) ? created : Date.now()) + reservationTtlMs()).toISOString()
}

export function reservationExpiresAtMs(row) {
  const explicit = Date.parse(row?.expiresAt || '')
  if (Number.isFinite(explicit)) return explicit
  const created = Date.parse(row?.createdAt || '')
  return Number.isFinite(created) ? created + reservationTtlMs() : Number.POSITIVE_INFINITY
}

// True while a reservation still holds credits.
export function reservationHolds(row, nowMs = Date.now()) {
  return row?.status === 'reserved' && reservationExpiresAtMs(row) > nowMs
}

export function reservationTaskUnbound(row) {
  return row?.metadata?.taskTypeBound === false || String(row?.taskType || '').startsWith('gateway:')
}

// A settlement belongs to a reservation when it is the reservation's own
// request or an additional execution the Router derived from it
// (`<requestId>:<n>`).
export function settlementBelongsToReservation(reservation, requestId) {
  const own = String(reservation?.requestId || '')
  const candidate = String(requestId || '')
  return Boolean(own) && (candidate === own || candidate.startsWith(`${own}:`))
}

// Credits a settlement may charge to the customer's ledger. Platform-subsidised
// executions are free to the user; only the first settlement of an open
// reservation charges.
export function settlementCharge({ reservation, settledCredits, closesReservation }) {
  if (!reservation || !closesReservation) return { debitCredits: 0, chargedCredits: 0, subsidizedCredits: 0 }
  const credits = Math.max(0, Number(settledCredits) || 0)
  if (reservation.fundingSource === 'platform_subsidy') return { debitCredits: 0, chargedCredits: 0, subsidizedCredits: credits }
  return { debitCredits: reservation.fundingSource === 'organization' ? 0 : credits, chargedCredits: credits, subsidizedCredits: 0 }
}
