import {
  addRegistryRecord, createRequest, eraseUserData, exportUserData, getResidency,
  listConsents, listRegistry, listRequests, recordConsent, saveResidency,
} from '../services/complianceService.js'
import { operationalStateEnabled, operationalStateFallbackEnabled, syncOperationalState, listOperationalState } from '../repositories/operationalStateRepository.js'

// A failed write must not be reported as 201/200 with the error nested inside.
function respond(res, key, value, success = 200) { if (value?.ok === false) return res.status(value.status || (String(value.error || '').includes('temporarily_unavailable') ? 503 : 400)).json({ [key]: value, error: value.error }); return res.status(success).json({ [key]: value }) }
async function persisted(req, value) { if (!operationalStateEnabled() || value?.ok === false) return value; try { await syncOperationalState(req.user?.id || null, ['consentRecords','dataSubjectRequests','dataResidencyPreferences','subprocessors','breachRecords']); return value } catch (error) { if (operationalStateFallbackEnabled()) return value; return { ok: false, error: 'operational_write_temporarily_unavailable' } } }

export const dataExport = async (req, res) => res.json(await exportUserData(req.user.id))
export const dataErase = async (req, res) => res.json(await eraseUserData(req.user.id))
export const consents = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ consents: await listOperationalState(req.user.id, 'consentRecords') }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ consents: await listConsents(req.user.id) }) }
export const consentCreate = async (req, res) => respond(res, 'consent', await persisted(req, await recordConsent(req.user.id, req.body)), 201)
export const requests = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ requests: await listOperationalState(req.user.id, 'dataSubjectRequests') }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ requests: await listRequests(req.user.id) }) }
export const requestCreate = async (req, res) => respond(res, 'request', await persisted(req, await createRequest(req.user.id, req.body)), 201)
export const residency = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ residency: (await listOperationalState(req.user.id, 'dataResidencyPreferences'))[0] || null }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ residency: await getResidency(req.user.id) }) }
export const residencySave = async (req, res) => respond(res, 'residency', await persisted(req, await saveResidency(req.user.id, req.body)))
export const subprocessors = async (_req, res) => res.json({ subprocessors: await listRegistry('subprocessors') })
export const subprocessorCreate = async (req, res) => respond(res, 'subprocessor', await persisted(req, await addRegistryRecord('subprocessors', req.body, req.user.id, 'subprocessor')), 201)
export const breaches = async (_req, res) => res.json({ breaches: await listRegistry('breachRecords') })
export const breachCreate = async (req, res) => respond(res, 'breach', await persisted(req, await addRegistryRecord('breachRecords', req.body, req.user.id, 'breach')), 201)
