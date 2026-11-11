import {
  requestScaffoldGeneration,
  requestScaffoldRetrieval,
  requestScaffoldDeploy,
  requestScaffoldStatus,
  requestScaffoldLiveUrl,
  requestScaffoldStacks,
} from '../services/aiRouterClient.js'

export async function generate(req, res) {
  const result = await requestScaffoldGeneration(req.user.token, req.body)
  return result ? res.json(result) : res.status(503).json({ error: 'scaffold_generation_unavailable' })
}

export async function getByProject(req, res) {
  const result = await requestScaffoldRetrieval(req.user.token, req.params.projectId)
  return result ? res.json(result) : res.status(404).json({ error: 'scaffold_not_found' })
}

export async function deploy(req, res) {
  const result = await requestScaffoldDeploy(req.user.token, req.params.scaffoldId)
  return result ? res.json(result) : res.status(503).json({ error: 'scaffold_deployment_unavailable' })
}

export async function status(req, res) {
  const result = await requestScaffoldStatus(req.user.token, req.params.scaffoldId)
  return result ? res.json(result) : res.status(404).json({ error: 'scaffold_status_not_found' })
}

export async function liveUrl(req, res) {
  const result = await requestScaffoldLiveUrl(req.user.token, req.params.scaffoldId)
  return result ? res.json(result) : res.status(404).json({ error: 'scaffold_live_url_not_found' })
}

export async function stacks(req, res) {
  const result = await requestScaffoldStacks(req.user.token)
  return result ? res.json(result) : res.status(503).json({ error: 'scaffold_stacks_unavailable' })
}
