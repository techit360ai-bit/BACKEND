import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'
import app from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
}))

import { readDb, writeDb } from '../config/database.js'

const MOCK_HASH = '$2a$02$test.hash.that.matches.Test.1234567890'

function makeDb(overrides = {}) {
  return {
    users: overrides.users ?? [],
    profiles: overrides.profiles ?? [],
    otps: overrides.otps ?? [],
    emailVerifications: overrides.emailVerifications ?? [],
    passwordResets: overrides.passwordResets ?? [],
  }
}

function makeUser(overrides = {}) {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    passwordHash: MOCK_HASH,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeProfile(overrides = {}) {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'founder',
    isOnboarded: false,
    ...overrides,
  }
}

function validToken(userId = 'user-uuid-1') {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function makeVerification(email = 'new@example.com', token = 'verified-token') {
  return {
    id: 'verification-1',
    email,
    tokenHash: hashToken(token),
    expiresAt: '2099-01-01T00:00:00.000Z',
    consumedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

// bcryptjs mock — avoids 12-round hashing in tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw) => `hashed::${pw}`),
    compare: vi.fn(async (pw, hash) => hash === `hashed::${pw}`),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  writeDb.mockImplementation(() => {})
})

// ── POST /api/auth/signup ──────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('returns 201 with token, user, and full profile on valid signup', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [makeVerification('new@example.com')],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'new@example.com',
      password: 'Secret@99',
      firstName: 'New',
      lastName: 'User',
      role: 'founder',
      emailVerificationToken: 'verified-token',
    })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe('new@example.com')
    expect(res.body.user.id).toBeTruthy()
    expect(res.body.profile.firstName).toBe('New')
    expect(res.body.profile.role).toBe('founder')
    expect(res.body.profile.isVerified).toBe(true)
    expect(writeDb).toHaveBeenCalledOnce()
    const written = writeDb.mock.calls[0][0]
    expect(written.emailVerifications[0].consumedAt).toBeTruthy()
  })

  it('defaults role to founder when not provided', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [makeVerification('no-role@example.com')],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'no-role@example.com',
      password: 'Secret@99',
      firstName: 'A',
      lastName: 'B',
      emailVerificationToken: 'verified-token',
    })

    expect(res.status).toBe(201)
    expect(res.body.profile.role).toBe('founder')
  })

  it('stores optional fields as empty strings when omitted', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [makeVerification('opt@example.com')],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'opt@example.com',
      password: 'Secret@99',
      firstName: 'A',
      lastName: 'B',
      emailVerificationToken: 'verified-token',
    })

    expect(res.status).toBe(201)
    expect(res.body.profile.phone).toBe('')
    expect(res.body.profile.country).toBe('')
  })

  it('initialises credit and credibility scores to 0', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [makeVerification('score@example.com')],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'score@example.com',
      password: 'Secret@99',
      firstName: 'A',
      lastName: 'B',
      emailVerificationToken: 'verified-token',
    })

    expect(res.body.profile.creditBalance).toBe(0)
    expect(res.body.profile.credibilityScore).toBe(0)
    expect(res.body.profile.isOnboarded).toBe(false)
    expect(res.body.profile.isVerified).toBe(true)
  })

  it('returns 409 when email is already registered', async () => {
    readDb.mockReturnValue(makeDb({ users: [makeUser()] }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'alice@example.com',
      password: 'Secret@99',
      firstName: 'Alice',
      lastName: 'Again',
      emailVerificationToken: 'verified-token',
    })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already in use/i)
    expect(writeDb).not.toHaveBeenCalled()
  })

  it('returns 400 when email verification proof is missing', async () => {
    readDb.mockReturnValue(makeDb())

    const res = await request(app).post('/api/auth/signup').send({
      email: 'new@example.com',
      password: 'Secret@99',
      firstName: 'New',
      lastName: 'User',
      otpVerified: true,
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/verified/i)
    expect(writeDb).not.toHaveBeenCalled()
  })

  it('returns 400 when email verification proof is invalid', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [makeVerification('new@example.com', 'real-token')],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'new@example.com',
      password: 'Secret@99',
      firstName: 'New',
      lastName: 'User',
      emailVerificationToken: 'wrong-token',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or expired/i)
    expect(writeDb).not.toHaveBeenCalled()
  })

  it('returns 400 when email verification proof was already consumed', async () => {
    readDb.mockReturnValue(makeDb({
      emailVerifications: [
        { ...makeVerification('new@example.com'), consumedAt: '2026-01-01T00:00:00.000Z' },
      ],
    }))

    const res = await request(app).post('/api/auth/signup').send({
      email: 'new@example.com',
      password: 'Secret@99',
      firstName: 'New',
      lastName: 'User',
      emailVerificationToken: 'verified-token',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or expired/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      password: 'Secret@99', firstName: 'A', lastName: 'B',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'a@b.com', firstName: 'A', lastName: 'B',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when firstName is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'a@b.com', password: 'Secret@99', lastName: 'B',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when lastName is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'a@b.com', password: 'Secret@99', firstName: 'A',
    })
    expect(res.status).toBe(400)
  })
})

// ── POST /api/auth/verify-otp ────────────────────────────────────────────────

describe('POST /api/auth/verify-otp', () => {
  it('returns a one-time verification token and stores only its hash', async () => {
    readDb.mockReturnValue(makeDb({
      otps: [{
        email: 'otp@example.com',
        code: '123456',
        expiresAt: '2099-01-01T00:00:00.000Z',
        sentAt: '2026-01-01T00:00:00.000Z',
        attempts: 0,
      }],
    }))

    const res = await request(app).post('/api/auth/verify-otp').send({
      email: 'otp@example.com',
      code: '123456',
    })

    expect(res.status).toBe(200)
    expect(res.body.verified).toBe(true)
    expect(res.body.verificationToken).toBeTruthy()
    const written = writeDb.mock.calls[0][0]
    expect(written.otps).toEqual([])
    expect(written.emailVerifications).toHaveLength(1)
    expect(written.emailVerifications[0].tokenHash).toBe(hashToken(res.body.verificationToken))
    expect(written.emailVerifications[0].verificationToken).toBeUndefined()
  })
})

// ── POST /api/auth/signin ──────────────────────────────────────────────────────

describe('POST /api/auth/signin', () => {
  it('returns 200 with token, user, and profile on correct credentials', async () => {
    const user = makeUser({ passwordHash: 'hashed::CorrectPass' })
    const profile = makeProfile()
    readDb.mockReturnValue(makeDb({ users: [user], profiles: [profile] }))

    const res = await request(app).post('/api/auth/signin').send({
      email: 'alice@example.com',
      password: 'CorrectPass',
    })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe('alice@example.com')
    expect(res.body.profile.firstName).toBe('Alice')
  })

  it('returns 401 on wrong password', async () => {
    const user = makeUser({ passwordHash: 'hashed::RightPassword' })
    readDb.mockReturnValue(makeDb({ users: [user], profiles: [makeProfile()] }))

    const res = await request(app).post('/api/auth/signin').send({
      email: 'alice@example.com',
      password: 'WrongPassword',
    })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid/i)
  })

  it('returns 401 on unknown email', async () => {
    readDb.mockReturnValue(makeDb())

    const res = await request(app).post('/api/auth/signin').send({
      email: 'ghost@example.com',
      password: 'AnyPass',
    })

    expect(res.status).toBe(401)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/signin').send({ password: 'pass' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/signin').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
  })

  it('does not reveal whether the email exists (same error for both cases)', async () => {
    readDb.mockReturnValue(makeDb())
    const unknownRes = await request(app).post('/api/auth/signin').send({
      email: 'unknown@example.com', password: 'any',
    })

    const user = makeUser({ passwordHash: 'hashed::real' })
    readDb.mockReturnValue(makeDb({ users: [user] }))
    const wrongPwdRes = await request(app).post('/api/auth/signin').send({
      email: 'alice@example.com', password: 'wrong',
    })

    expect(unknownRes.status).toBe(401)
    expect(wrongPwdRes.status).toBe(401)
    expect(unknownRes.body.error).toBe(wrongPwdRes.body.error)
  })
})

// ── GET /api/auth/session ──────────────────────────────────────────────────────

describe('GET /api/auth/session', () => {
  it('returns 200 with user when token is valid', async () => {
    const user = makeUser()
    readDb.mockReturnValue(makeDb({ users: [user] }))

    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${validToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe('user-uuid-1')
    expect(res.body.user.email).toBe('alice@example.com')
  })

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/auth/session')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', 'Bearer not.a.real.token')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token signed with the wrong secret', async () => {
    const badToken = jwt.sign({ sub: 'user-uuid-1' }, 'wrong_secret', { expiresIn: '1h' })
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${badToken}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 when user no longer exists in DB', async () => {
    readDb.mockReturnValue(makeDb({ users: [] })) // user deleted

    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${validToken()}`)
    expect(res.status).toBe(401)
  })
})

// ── POST /api/auth/signout ─────────────────────────────────────────────────────

describe('POST /api/auth/signout', () => {
  it('returns 200 with valid token', async () => {
    readDb.mockReturnValue(makeDb({ users: [makeUser()] }))

    const res = await request(app)
      .post('/api/auth/signout')
      .set('Authorization', `Bearer ${validToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBeTruthy()
  })

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/signout')
    expect(res.status).toBe(401)
  })
})

// ── Password recovery ────────────────────────────────────────────────────────

describe('Password recovery', () => {
  it('creates a reset token for an existing account without storing the raw token', async () => {
    readDb.mockReturnValue(makeDb({ users: [makeUser()] }))

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'alice@example.com',
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/if an account exists/i)
    expect(res.body.resetToken).toBeTruthy()
    expect(writeDb).toHaveBeenCalledOnce()
    const written = writeDb.mock.calls[0][0]
    expect(written.passwordResets).toHaveLength(1)
    expect(written.passwordResets[0].tokenHash).toBe(hashToken(res.body.resetToken))
    expect(written.passwordResets[0].resetToken).toBeUndefined()
  })

  it('returns the same generic response for an unknown email', async () => {
    readDb.mockReturnValue(makeDb())

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'ghost@example.com',
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/if an account exists/i)
    expect(res.body.resetToken).toBeUndefined()
    expect(writeDb).not.toHaveBeenCalled()
  })

  it('resets the password and consumes the reset token', async () => {
    const resetToken = 'reset-token'
    const reset = {
      id: 'reset-1',
      userId: 'user-uuid-1',
      email: 'alice@example.com',
      tokenHash: hashToken(resetToken),
      expiresAt: '2099-01-01T00:00:00.000Z',
      consumedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    readDb.mockReturnValue(makeDb({
      users: [makeUser()],
      passwordResets: [reset],
    }))

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'alice@example.com',
      token: resetToken,
      password: 'NewSecret@99',
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/reset successfully/i)
    const written = writeDb.mock.calls[0][0]
    expect(written.users[0].passwordHash).toBe('hashed::NewSecret@99')
    expect(written.passwordResets[0].consumedAt).toBeTruthy()
  })

  it('rejects reused password reset tokens', async () => {
    readDb.mockReturnValue(makeDb({
      users: [makeUser()],
      passwordResets: [{
        id: 'reset-1',
        userId: 'user-uuid-1',
        email: 'alice@example.com',
        tokenHash: hashToken('reset-token'),
        expiresAt: '2099-01-01T00:00:00.000Z',
        consumedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    }))

    const res = await request(app).post('/api/auth/reset-password').send({
      email: 'alice@example.com',
      token: 'reset-token',
      password: 'NewSecret@99',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or expired/i)
  })
})
