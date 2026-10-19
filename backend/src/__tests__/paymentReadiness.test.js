import { describe, expect, it } from 'vitest'
import { evaluatePaymentReadiness, parseEnvFile } from '../config/paymentReadiness.js'

const base = {
  PAYMENT_GATEWAY_SERVICE_SECRET: 'a'.repeat(64),
  BILLING_SUCCESS_URL: 'https://beta.techitnetwork.com/wallet?checkout=success',
  BILLING_CANCEL_URL: 'https://beta.techitnetwork.com/wallet?checkout=cancelled',
  PAYSTACK_SECRET_KEY: 'sk_test_example',
  PURCHASE_MONTHLY_MAX_CREDITS: '100000',
  PURCHASE_VELOCITY_MAX_PER_HOUR: '10',
  PURCHASE_MAX_PENDING_INTENTS: '3',
  PAYMENT_INTENT_TTL_MINUTES: '30',
  PAYMENT_CHECKOUT_LOCK_SECONDS: '120',
  PURCHASE_KYC_VALIDITY_DAYS: '365',
}

describe('payment readiness', () => {
  it('reports incomplete payment configuration without treating it as a core boot failure', () => {
    const readiness = evaluatePaymentReadiness({})
    expect(readiness.ok).toBe(false)
    expect(readiness.providers).toEqual({ stripe: false, paystack: false, flutterwave: false })
    expect(readiness.failures).toContain('PAYMENT_GATEWAY_SERVICE_SECRET must be at least 32 characters and match the gateway PLATFORM_SERVICE_TOKEN')
  })

  it('accepts one complete provider plus redirects and purchase limits', () => {
    expect(evaluatePaymentReadiness(base)).toMatchObject({
      ok: true,
      failures: [],
      providers: { stripe: false, paystack: true, flutterwave: false },
      gatewaySecret: 'set',
      redirects: 'set',
    })
  })

  it('rejects non-https redirects', () => {
    const readiness = evaluatePaymentReadiness({ ...base, BILLING_SUCCESS_URL: 'http://example.com/success' })
    expect(readiness.ok).toBe(false)
    expect(readiness.failures).toContain('BILLING_SUCCESS_URL must be https')
  })

  it('parses quoted env-file values', () => {
    expect(parseEnvFile('A="quoted value"\nB=plain\n# ignored\n')).toEqual({ A: 'quoted value', B: 'plain' })
  })
})
