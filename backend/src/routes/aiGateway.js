import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../middlewares/auth.js'
import { forwardToAiRouter } from '../services/aiGatewayService.js'

const isRead = req => ['GET', 'HEAD'].includes(req.method)
const perUser = (limit, skip) => rateLimit({
  windowMs: 60_000, limit, skip, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user?.id || 'anonymous'),
  message: { error: 'ai_gateway_rate_limited' },
})

const router = Router()
router.use(requireAuth)
router.use(perUser(Number(process.env.AI_GATEWAY_READ_LIMIT_PER_MIN || '') || 240, req => !isRead(req)))
router.use(perUser(Number(process.env.AI_GATEWAY_WRITE_LIMIT_PER_MIN || '') || 30, isRead))
router.use(forwardToAiRouter)

export default router
