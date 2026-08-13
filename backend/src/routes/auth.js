import { Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { changePassword, forgotPassword, resetPassword, signup, signin, session, signout } from '../controllers/authController.js'
import { sendOtp, verifyOtp } from '../controllers/otpController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// Per-IP rate limits on the credential-touching endpoints. The OTP controller
// already has a per-email cooldown (60s); this defends the endpoint itself
// against brute force / OTP enumeration that varies the email per request.
//
// `ipKeyGenerator` handles IPv6 normalisation that express-rate-limit v8
// requires (default behavior changed to refuse plain `req.ip` for IPv6 hosts).
//
// Test bypass: vitest sets NODE_ENV=test by default. supertest in a tight
// loop would otherwise trip the 5/min signin limit (the auth.test.js suite
// alone fires 18 POSTs). The skip predicate keeps production behaviour
// unchanged.
const IS_TEST = process.env.NODE_ENV === 'test'

const baseLimit = (opts) => rateLimit({
  ...opts,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  validate: { trustProxy: true, xForwardedForHeader: true },
  skip: () => IS_TEST,
})

const signinLimit = baseLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many sign-in attempts. Please wait a minute and try again.' },
})

const otpLimit = baseLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests. Please wait before requesting another code.' },
})

const signupLimit = baseLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many sign-up attempts from this IP. Please try again later.' },
})

const verifyLimit = baseLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Too many verification attempts. Please wait before trying again.' },
})

router.post('/signup',      signupLimit, signup)
router.post('/signin',      signinLimit, signin)
router.get('/session',      requireAuth, session)
router.post('/signout',     requireAuth, signout)
router.post('/change-password', requireAuth, changePassword)
router.post('/forgot-password', signinLimit, forgotPassword)
router.post('/reset-password',  signinLimit, resetPassword)

// OTP email verification
router.post('/send-otp',    otpLimit, sendOtp)
router.post('/verify-otp',  verifyLimit, verifyOtp)

export default router
