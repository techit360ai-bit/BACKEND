const text = value => typeof value === 'string' ? value.trim() : ''

export function parseEnvFile(source = '') {
  const values = {}
  for (const line of String(source).split('\n')) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=(.*)$/.exec(line)
    if (!match) continue
    values[match[1]] = match[2].replace(/^"|"$/g, '').trim()
  }
  return values
}

export function evaluatePaymentReadiness(values = process.env) {
  const get = key => text(values[key])
  const failures = []
  if (get('PAYMENT_GATEWAY_SERVICE_SECRET').length < 32) {
    failures.push('PAYMENT_GATEWAY_SERVICE_SECRET must be at least 32 characters and match the gateway PLATFORM_SERVICE_TOKEN')
  }
  for (const key of ['BILLING_SUCCESS_URL', 'BILLING_CANCEL_URL']) {
    const value = get(key)
    if (!value) failures.push(`${key} is required`)
    else {
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:') failures.push(`${key} must be https`)
      } catch {
        failures.push(`${key} is not a valid URL`)
      }
    }
  }
  const providers = {
    stripe: Boolean(get('STRIPE_SECRET_KEY') && get('STRIPE_WEBHOOK_SECRET')),
    paystack: Boolean(get('PAYSTACK_SECRET_KEY')),
    flutterwave: Boolean(get('FLUTTERWAVE_SECRET_KEY') && get('FLUTTERWAVE_SECRET_HASH')),
  }
  if (!Object.values(providers).some(Boolean)) {
    failures.push('at least one complete provider is required: stripe (secret + webhook), paystack (secret), or flutterwave (secret + hash)')
  }
  for (const key of [
    'PURCHASE_MONTHLY_MAX_CREDITS',
    'PURCHASE_VELOCITY_MAX_PER_HOUR',
    'PURCHASE_MAX_PENDING_INTENTS',
    'PAYMENT_INTENT_TTL_MINUTES',
    'PAYMENT_CHECKOUT_LOCK_SECONDS',
    'PURCHASE_KYC_VALIDITY_DAYS',
  ]) {
    if (!(Number(get(key)) > 0)) failures.push(`${key} must be a positive number`)
  }
  return {
    ok: failures.length === 0,
    failures,
    providers,
    gatewaySecret: get('PAYMENT_GATEWAY_SERVICE_SECRET').length >= 32 ? 'set' : 'missing',
    redirects: get('BILLING_SUCCESS_URL') && get('BILLING_CANCEL_URL') ? 'set' : 'missing',
  }
}
