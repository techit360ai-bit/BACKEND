import { describe, expect, it } from 'vitest'
import { assertPublicUrl } from '../services/outboundHttpService.js'
import { CAPABILITY_POLICIES, authorizeCapability } from '../services/capabilityAuthorization.js'

describe('security control contracts', () => {
  it('blocks private and metadata destinations', async () => {
    await expect(assertPublicUrl('http://127.0.0.1:8080/')).rejects.toThrow('outbound_scheme_blocked')
    await expect(assertPublicUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow('outbound_host_blocked')
  })

  it('marks sensitive capabilities as MFA protected', () => {
    expect(CAPABILITY_POLICIES['investment.indication.submit'].mfaRequired).toBe(true)
    expect(CAPABILITY_POLICIES['workspace.deployment.verify'].mfaRequired).toBe(true)
  })

  it('denies privileged capability without a valid MFA assertion', () => {
    const decision = authorizeCapability('user-1', 'workspace.deployment.verify', { role: 'founder', mfaAssertion: '' })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('mfa_required')
  })
})
