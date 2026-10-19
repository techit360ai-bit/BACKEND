#!/usr/bin/env node
import fs from 'node:fs'
import { evaluatePaymentReadiness, parseEnvFile } from '../../backend/src/config/paymentReadiness.js'

const target = process.argv[2] || 'backend/.env'
const values = parseEnvFile(fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '')
const readiness = evaluatePaymentReadiness(values)
const required = process.env.PAYMENT_CONFIGURATION_REQUIRED === 'true'

console.log(JSON.stringify({
  event: 'payment_readiness',
  required,
  ready: readiness.ok,
  providers: Object.fromEntries(Object.entries(readiness.providers).map(([name, ok]) => [name, ok ? 'ready' : 'missing'])),
  gatewaySecret: readiness.gatewaySecret,
  redirects: readiness.redirects,
}))
if (!readiness.ok) {
  console.error(JSON.stringify({
    event: required ? 'payment_readiness_failed' : 'payment_readiness_incomplete',
    required,
    failures: readiness.failures,
  }))
  if (required) process.exit(1)
}
