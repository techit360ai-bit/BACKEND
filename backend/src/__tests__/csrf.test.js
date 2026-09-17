import { afterEach, describe, expect, it, vi } from 'vitest'
import { csrfProtection } from '../middlewares/csrf.js'

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
}

afterEach(() => {
  delete process.env.ENFORCE_CSRF_IN_TEST
})

describe('CSRF transport boundary', () => {
  it('allows an explicitly bearer-authenticated mutation when cookies are also present', () => {
    process.env.ENFORCE_CSRF_IN_TEST = 'true'
    const req = {
      method: 'PATCH',
      headers: { cookie: 'techit_access=cookie-token; techit_csrf=csrf-token' },
      get: name => name.toLowerCase() === 'authorization' ? 'Bearer access-token' : '',
    }
    const res = response()
    const next = vi.fn()

    csrfProtection(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('still rejects a cookie-only mutation without the matching CSRF header', () => {
    process.env.ENFORCE_CSRF_IN_TEST = 'true'
    const req = {
      id: 'request-1',
      method: 'PATCH',
      path: '/api/users/me',
      headers: { cookie: 'techit_access=cookie-token; techit_csrf=csrf-token' },
      get: () => '',
    }
    const res = response()
    const next = vi.fn()

    csrfProtection(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'csrf_token_invalid' })
  })
})
