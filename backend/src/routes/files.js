import { Router } from 'express'
import { createFile, deleteFile, listFiles } from '../controllers/fileController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/', requireAuth, listFiles)
router.post('/', requireAuth, createFile)
router.delete('/:id', requireAuth, deleteFile)

export default router
