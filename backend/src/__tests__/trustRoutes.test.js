import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import trustRouter from '../routes/trust.js'

// Express 5 exposes route layers on router.stack. This proves the routes that
// the frontend trust client calls actually exist, so no dead client function
// silently 404s.
function registeredPaths(router) {
  return new Set(
    router.stack
      .filter(layer => layer.route)
      .map(layer => layer.route.path),
  )
}

describe('trust route coverage', () => {
  it('exposes every endpoint the frontend trust client calls', () => {
    const paths = registeredPaths(trustRouter)
    for (const expected of [
      '/profile',
      '/badges',
      '/history',
      '/integrations',
      '/refresh/:source',
      '/verify/:source',
      '/disconnect/:source',
      '/notifications/preview',
      '/domain/challenge',
      '/domain/challenge/:challengeId/verify',
      '/proofs',
      '/adapters/:provider/verify',
      '/refresh-plan',
      '/continuous-verification/run',
      '/milestone',
      '/milestone/review',
      '/team/invite',
      '/team/verify',
      '/share-profile/preview',
      '/admin/operations',
      '/admin/metrics',
      '/admin/proofs/:proofId/review',
      '/admin/overrides',
      '/admin/users/:userId/overrides',
      '/admin/users/:userId/overrides/:overrideId',
      '/reverification/due',
      '/internal/reverification/run',
      '/internal/adapters/:provider/ingest',
      '/revenue/credentials',
      '/revenue/connect',
      '/revenue/verify',
      '/revenue/:provider/verify',
      '/revenue/:provider',
      '/internal/revenue/refresh',
      '/analytics/credentials',
      '/analytics/connect',
      '/analytics/verify',
      '/analytics/:provider/verify',
      '/analytics/:provider',
      '/internal/analytics/refresh',
      '/shipping/credentials',
      '/shipping/connect',
      '/shipping/verify',
      '/shipping/:provider/verify',
      '/shipping/:provider',
      '/internal/shipping/refresh',
      '/team/credentials',
      '/team/connect',
      '/team/work-email/challenge',
      '/team/work-email/verify',
      '/team/registry/verify',
      '/team/registry/:provider/verify',
      '/team/hris/verify',
      '/team/hris/:provider/verify',
      '/team/credential/:provider',
      '/internal/team/refresh',
      '/identity',
      '/identity/connect',
      '/identity/credentials',
      '/identity/verify',
      '/identity/registry/verify',
      '/identity/screening',
      '/identity/:provider',
      '/internal/identity/refresh',
      '/milestone/evidence',
      '/milestone/evidence/:evidenceId/finalize',
    ]) {
      expect(paths.has(expected), `missing route ${expected}`).toBe(true)
    }
  })

  it('keeps the frontend client and backend in sync on the advanced endpoints', () => {
    const clientPath = fileURLToPath(new URL('../../../../new-frontend/frontend/src/lib/api/trustRoutes.ts', import.meta.url))
    const source = readFileSync(clientPath, 'utf8')
    for (const fragment of ['/trust/adapters/', '/trust/refresh-plan', '/trust/continuous-verification/run', '/trust/milestone', '/trust/milestone/review', '/trust/team/invite', '/trust/team/verify', '/trust/share-profile/preview', '/trust/revenue/connect', '/trust/revenue/verify', '/trust/revenue/credentials', '/trust/analytics/connect', '/trust/analytics/verify', '/trust/analytics/credentials', '/trust/shipping/connect', '/trust/shipping/verify', '/trust/shipping/credentials', '/trust/team/connect', '/trust/team/credentials', '/trust/team/work-email/challenge', '/trust/team/work-email/verify', '/trust/team/registry/verify', '/trust/team/hris/verify', '/trust/team/credential/', '/trust/milestone/evidence', '/trust/milestone/evidence/', '/trust/identity/connect', '/trust/identity/credentials', '/trust/identity/verify', '/trust/identity/registry/verify', '/trust/identity/screening', '/trust/identity/']) {
      expect(source.includes(fragment), `frontend trust route registry no longer declares ${fragment}`).toBe(true)
    }
  })
})
