const RESEND_TEST_DOMAIN = /@resend\.dev\b/i
const DEFAULT_FROM_EMAIL = 'TechIT <onboarding@resend.dev>'

export function configuredFromEmail(purpose = 'email') {
  const configured = process.env.FROM_EMAIL
  const from = configured || DEFAULT_FROM_EMAIL

  if (process.env.NODE_ENV === 'production') {
    if (!configured) {
      throw new Error(`FROM_EMAIL is required to send ${purpose} in production`)
    }
    if (RESEND_TEST_DOMAIN.test(from)) {
      throw new Error(`FROM_EMAIL must use a verified sender domain to send ${purpose} in production`)
    }
  }

  return from
}

export function describeEmailProviderError(error) {
  if (!error) return 'unknown email provider error'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message

  const details = []
  for (const key of ['message', 'name', 'code', 'statusCode']) {
    if (error[key]) details.push(`${key}=${error[key]}`)
  }
  if (details.length) return details.join(' ')

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function assertEmailAccepted(result, purpose = 'email') {
  if (!result) {
    throw new Error(`Email provider returned an empty response for ${purpose}`)
  }
  if (result.error) {
    throw new Error(`Resend rejected ${purpose}: ${describeEmailProviderError(result.error)}`)
  }
  if (Object.prototype.hasOwnProperty.call(result, 'data') && result.data === null) {
    throw new Error(`Resend did not accept ${purpose}`)
  }
}
