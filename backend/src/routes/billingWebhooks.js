import { Router } from 'express'
import { handleBillingWebhook } from '../services/tvceBillingService.js'

const router = Router()
router.post('/:provider', async (req, res) => {
  const result = await handleBillingWebhook(req.params.provider, req.body, req.headers, req.rawBody)
  return res.status(result.status || (result.ok ? 200 : 400)).json(result)
})
export default router
