import { Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { createFile, deleteFile, listFiles } from '../controllers/fileController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// WS-14: file reads and deletes had no ceiling. This runs before requireAuth,
// so an unauthenticated flood is keyed by IP and an authenticated caller by
// user id, matching the shape used in routes/auth.js.
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(10, Number(process.env.FILES_REQUESTS_PER_MINUTE || 120)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  validate: { trustProxy: true, xForwardedForHeader: true },
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'rate_limit_exceeded' },
}))

router.get('/', requireAuth, listFiles)
router.post('/', requireAuth, createFile)
router.delete('/:id', requireAuth, deleteFile)

export default router
