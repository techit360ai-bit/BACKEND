import {
  addRegistryRecord, createRequest, eraseUserData, exportUserData, getResidency,
  listConsents, listRegistry, listRequests, recordConsent, saveResidency,
} from '../services/complianceService.js'
import { operationalStateEnabled, operationalStateFallbackEnabled, syncOperationalState, listOperationalState } from '../repositories/operationalStateRepository.js'

async function persisted(req, value) { if (!operationalStateEnabled() || value?.ok === false) return value; try { await syncOperationalState(req.user?.id || null, ['consentRecords','dataSubjectRequests','dataResidencyPreferences','subprocessors','breachRecords']); return value } catch (error) { if (operationalStateFallbackEnabled()) return value; return { ok: false, error: 'operational_write_temporarily_unavailable' } } }

export const dataExport = (req, res) => res.json(exportUserData(req.user.id))
export const dataErase = (req, res) => res.json(eraseUserData(req.user.id))
export const consents = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ consents: await listOperationalState(req.user.id, 'consentRecords') }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ consents: listConsents(req.user.id) }) }
export const consentCreate = async (req, res) => res.status(201).json({ consent: await persisted(req, recordConsent(req.user.id, req.body)) })
export const requests = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ requests: await listOperationalState(req.user.id, 'dataSubjectRequests') }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ requests: listRequests(req.user.id) }) }
export const requestCreate = async (req, res) => res.status(201).json({ request: await persisted(req, createRequest(req.user.id, req.body)) })
export const residency = async (req, res) => { if (operationalStateEnabled()) { try { return res.json({ residency: (await listOperationalState(req.user.id, 'dataResidencyPreferences'))[0] || null }) } catch (error) { if (!operationalStateFallbackEnabled()) throw error } } return res.json({ residency: getResidency(req.user.id) }) }
export const residencySave = async (req, res) => res.json({ residency: await persisted(req, saveResidency(req.user.id, req.body)) })
export const subprocessors = (_req, res) => res.json({ subprocessors: listRegistry('subprocessors') })
export const subprocessorCreate = async (req, res) => res.status(201).json({ subprocessor: await persisted(req, addRegistryRecord('subprocessors', req.body, req.user.id, 'subprocessor')) })
export const breaches = (_req, res) => res.json({ breaches: listRegistry('breachRecords') })
export const breachCreate = async (req, res) => res.status(201).json({ breach: await persisted(req, addRegistryRecord('breachRecords', req.body, req.user.id, 'breach')) })
