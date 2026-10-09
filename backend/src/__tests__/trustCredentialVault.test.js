import { describe, expect, it } from 'vitest'
import { credentialVaultConfigured, decryptCredential, encryptCredential } from '../services/trustCredentialVault.js'

const ENV = { TRUST_CREDENTIAL_ENCRYPTION_KEY: 'x'.repeat(48) }

describe('trust credential vault', () => {
  it('round-trips a credential without ever storing plaintext', () => {
    const envelope = encryptCredential('rk_live_supersecret', { env: ENV })
    expect(envelope).not.toContain('rk_live_supersecret')
    expect(envelope.split('.')).toHaveLength(3)
    expect(decryptCredential(envelope, { env: ENV })).toBe('rk_live_supersecret')
  })

  it('fails closed when the key is missing or too short', () => {
    expect(credentialVaultConfigured({})).toBe(false)
    expect(credentialVaultConfigured({ TRUST_CREDENTIAL_ENCRYPTION_KEY: 'short' })).toBe(false)
    expect(() => encryptCredential('secret', { env: {} })).toThrow('trust_credential_vault_not_configured')
  })

  it('returns null on tamper or the wrong key instead of throwing', () => {
    const envelope = encryptCredential('secret', { env: ENV })
    const wrong = { TRUST_CREDENTIAL_ENCRYPTION_KEY: 'y'.repeat(48) }
    expect(decryptCredential(envelope, { env: wrong })).toBeNull()
    expect(decryptCredential(`${envelope}tampered`, { env: ENV })).toBeNull()
    expect(decryptCredential('not-an-envelope', { env: ENV })).toBeNull()
  })
})
