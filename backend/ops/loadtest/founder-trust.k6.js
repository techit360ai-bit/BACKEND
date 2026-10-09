// Founder Trust Center load profile for the 1M-user acceptance gate.
//
// RISK GATE: this is a harness, not a decision. The pass/fail thresholds below
// depend on the target DAU / concurrency and replica count, which still need
// product + platform sign-off (see loadtest README). Run only against an
// environment that has been sized for the target profile.
//
//   TARGET_VUS          concurrent virtual users (default 200)
//   BASE_URL            API base, e.g. https://api.example.com/api
//   AUTH_TOKEN          Bearer token for a seeded test founder
//   PROJECT_ID          optional project scope
//
// Example:
//   k6 run -e BASE_URL=https://staging.example.com/api -e AUTH_TOKEN=... \
//          -e TARGET_VUS=500 ops/loadtest/founder-trust.k6.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api'
const TOKEN = __ENV.AUTH_TOKEN || ''
const PROJECT = __ENV.PROJECT_ID || ''

const readLatency = new Trend('trust_read_latency', true)

export const options = {
  scenarios: {
    trust_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Number(__ENV.TARGET_VUS || 200) },
        { duration: '5m', target: Number(__ENV.TARGET_VUS || 200) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    // Tighten once target DAU/concurrency is signed off.
    http_req_failed: ['rate<0.001'],
    trust_read_latency: ['p(95)<300', 'p(99)<800'],
  },
}

const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }
const projectQuery = PROJECT ? `?projectId=${PROJECT}` : ''

export default function () {
  const profile = http.get(`${BASE_URL}/trust/profile${projectQuery}`, { headers, tags: { endpoint: 'profile' } })
  readLatency.add(profile.timings.duration)
  check(profile, { 'profile 200': response => response.status === 200 })

  const history = http.get(`${BASE_URL}/trust/history?limit=30`, { headers, tags: { endpoint: 'history' } })
  readLatency.add(history.timings.duration)
  check(history, { 'history 200': response => response.status === 200 })

  const integrations = http.get(`${BASE_URL}/trust/integrations`, { headers, tags: { endpoint: 'integrations' } })
  readLatency.add(integrations.timings.duration)
  check(integrations, { 'integrations 200': response => response.status === 200 })

  sleep(1)
}
