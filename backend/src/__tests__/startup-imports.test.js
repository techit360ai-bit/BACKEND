import { describe, expect, it } from 'vitest'

describe('production startup import contracts', () => {
  it('loads the app and startup services without missing named exports', async () => {
    await expect(import('../app.js')).resolves.toBeTruthy()
    const routerClient = await import('../services/aiRouterClient.js')
    expect(routerClient).toHaveProperty('analyzeVerificationEvidence')
    await expect(routerClient.analyzeVerificationEvidence('', '', {})).resolves.toBeNull()
    await expect(import('../services/trustVerificationService.js')).resolves.toHaveProperty('analyzeEvidence')
  })
})
