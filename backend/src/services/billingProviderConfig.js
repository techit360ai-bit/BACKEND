// Which hosted checkout providers are actually configured for this deployment.
// Booleans only — no secrets, no keys — so the wallet UI can pick a provider it
// can really reach instead of guessing and failing at redirect time.

const configured = value => typeof value === 'string' && value.trim().length > 0

export function providerAvailability() {
  return {
    stripe: configured(process.env.STRIPE_SECRET_KEY) && configured(process.env.STRIPE_WEBHOOK_SECRET),
    paystack: configured(process.env.PAYSTACK_SECRET_KEY),
    flutterwave: configured(process.env.FLUTTERWAVE_SECRET_KEY) && configured(process.env.FLUTTERWAVE_SECRET_HASH),
  }
}

export function enabledCheckoutProviders() {
  return Object.entries(providerAvailability()).filter(([, enabled]) => enabled).map(([provider]) => provider)
}
