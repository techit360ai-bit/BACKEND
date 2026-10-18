import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../middlewares/auth.js', async importOriginal => ({
  ...(await importOriginal()),
  requireAuth: (_req, _res, next) => next(),
}))

import app from '../app.js'

const token = () => jwt.sign({ sub: 'user-1', role: 'founder' }, 'test_jwt_secret_do_not_use_in_production', { expiresIn: '1h' })

describe('TVCE payment security routes', () => {
  it('does not expose user-triggered payment fulfillment', async () => {
    const res = await request(app)
      .post('/api/tvce/payments/pay_1/fulfill')
      .set('Authorization', `Bearer ${token()}`)
      .send({ verified: true })
    expect(res.status).toBe(404)
  })
})
