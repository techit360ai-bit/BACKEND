import { Router } from 'express'
import { signup, signin, session, signout } from '../controllers/authController.js'
import { sendOtp, verifyOtp } from '../controllers/otpController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.post('/signup',      signup)
router.post('/signin',      signin)
router.get('/session',      requireAuth, session)
router.post('/signout',     requireAuth, signout)

// OTP email verification
router.post('/send-otp',    sendOtp)
router.post('/verify-otp',  verifyOtp)

export default router
