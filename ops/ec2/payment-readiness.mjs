#!/usr/bin/env node
import fs from 'node:fs'

const target = process.argv[2] || 'backend/.env'
const values = new Map()
if (fs.existsSync(target)) {
  for (const line of fs.readFileSync(target, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=(.*)$/.exec(line)
    if (match) values.set(match[1], match[2].replace(/^"|"$/g, '').trim())
  }
}

const configured = key => Boolean(values.get(key))
const failures = []
if ((values.get('PAYMENT_GATEWAY_SERVICE_SECRET') || '').length < 32) {
  failures.push('PAYMENT_GATEWAY_SERVICE_SECRET must be at least 32 characters and match the gateway PLATFORM_SERVICE_TOKEN')
}
for (const key of ['BILLING_SUCCESS_URL', 'BILLING_CANCEL_URL']) {
  const value = values.get(key) || ''
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
  stripe: configured('STRIPE_SECRET_KEY') && configured('STRIPE_WEBHOOK_SECRET'),
  paystack: configured('PAYSTACK_SECRET_KEY'),
  flutterwave: configured('FLUTTERWAVE_SECRET_KEY') && configured('FLUTTERWAVE_SECRET_HASH'),
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
  if (!(Number(values.get(key)) > 0)) failures.push(`${key} must be a positive number`)
}

console.log(JSON.stringify({
  event: 'payment_readiness',
  providers: Object.fromEntries(Object.entries(providers).map(([name, ok]) => [name, ok ? 'ready' : 'missing'])),
  gatewaySecret: (values.get('PAYMENT_GATEWAY_SERVICE_SECRET') || '').length >= 32 ? 'set' : 'missing',
  redirects: configured('BILLING_SUCCESS_URL') && configured('BILLING_CANCEL_URL') ? 'set' : 'missing',
}))
if (failures.length) {
  console.error(JSON.stringify({ event: 'payment_readiness_failed', failures }))
  process.exit(1)
}
