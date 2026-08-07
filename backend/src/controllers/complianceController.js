import {
  addRegistryRecord, createRequest, eraseUserData, exportUserData, getResidency,
  listConsents, listRegistry, listRequests, recordConsent, saveResidency,
} from '../services/complianceService.js'

export const dataExport = (req, res) => res.json(exportUserData(req.user.id))
export const dataErase = (req, res) => res.json(eraseUserData(req.user.id))
export const consents = (req, res) => res.json({ consents: listConsents(req.user.id) })
export const consentCreate = (req, res) => res.status(201).json({ consent: recordConsent(req.user.id, req.body) })
export const requests = (req, res) => res.json({ requests: listRequests(req.user.id) })
export const requestCreate = (req, res) => res.status(201).json({ request: createRequest(req.user.id, req.body) })
export const residency = (req, res) => res.json({ residency: getResidency(req.user.id) })
export const residencySave = (req, res) => res.json({ residency: saveResidency(req.user.id, req.body) })
export const subprocessors = (_req, res) => res.json({ subprocessors: listRegistry('subprocessors') })
export const subprocessorCreate = (req, res) => res.status(201).json({ subprocessor: addRegistryRecord('subprocessors', req.body, req.user.id, 'subprocessor') })
export const breaches = (_req, res) => res.json({ breaches: listRegistry('breachRecords') })
export const breachCreate = (req, res) => res.status(201).json({ breach: addRegistryRecord('breachRecords', req.body, req.user.id, 'breach') })
