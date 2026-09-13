import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { safeFetch } from './outboundHttpService.js'

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''
const normalizeCountry = value => text(value, 80).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const normalizeDomain = value => { try { return new URL(String(value).includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '') } catch { return null } }
const token = () => crypto.randomBytes(24).toString('base64url')

const AFRICAN_REGISTRIES = {
  algeria: ['CNRC', 'company', 'registration number'], angola: ['GUE', 'company', 'registration number'], benin: ['GUFE', 'company', 'registration number'], botswana: ['CIPA', 'company', 'registration number'], 'burkina-faso': ['CEFORE', 'company', 'registration number'], burundi: ['API', 'company', 'registration number'], 'cabo-verde': ['Cabo Verde Commercial Registry', 'company', 'registration number'], cameroon: ['CFCE', 'company', 'registration number'], 'central-african-republic': ['Guichet Unique', 'company', 'registration number'], chad: ['CNRC', 'company', 'registration number'], comoros: ['Business Registry', 'company', 'registration number'], 'democratic-republic-of-the-congo': ['GUCE', 'company', 'registration number'], 'republic-of-the-congo': ['CFE', 'company', 'registration number'], 'cote-d-ivoire': ['CEPICI', 'company', 'registration number'], djibouti: ['ODPIC', 'company', 'registration number'], egypt: ['General Authority for Investment', 'company', 'registration number'], 'equatorial-guinea': ['Business Registry', 'company', 'registration number'], eritrea: ['Business Registry', 'company', 'registration number'], eswatini: ['Eswatini Companies Registry', 'company', 'registration number'], ethiopia: ['Ministry of Trade', 'company', 'registration number'], gabon: ['ANPI', 'company', 'registration number'], gambia: ['Companies Registry', 'company', 'registration number'], ghana: ['Office of the Registrar of Companies', 'company', 'registration number'], guinea: ['APIP', 'company', 'registration number'], 'guinea-bissau': ['Business Registry', 'company', 'registration number'], kenya: ['Business Registration Service', 'company', 'registration number'], lesotho: ['Companies Registry', 'company', 'registration number'], liberia: ['Liberia Business Registry', 'company', 'registration number'], libya: ['Business Registry', 'company', 'registration number'], madagascar: ['RCS', 'company', 'registration number'], malawi: ['Registrar General', 'company', 'registration number'], mali: ['Guichet Unique', 'company', 'registration number'], mauritania: ['Business Registry', 'company', 'registration number'], mauritius: ['Corporate and Business Registration Department', 'company', 'registration number'], morocco: ['OMPIC', 'company', 'registration number'], mozambique: ['Conservatoria do Registo das Entidades Legais', 'company', 'registration number'], namibia: ['BIPA', 'company', 'registration number'], niger: ['Maison de l’entreprise', 'company', 'registration number'], nigeria: ['Corporate Affairs Commission', 'company/business-name/incorporated-trustee', 'CAC registration number'], rwanda: ['Rwanda Development Board', 'company', 'registration number'], 'sao-tome-and-principe': ['Business Registry', 'company', 'registration number'], senegal: ['APIX', 'company', 'registration number'], seychelles: ['Registrar of Companies', 'company', 'registration number'], 'sierra-leone': ['Corporate Affairs Commission', 'company', 'registration number'], somalia: ['Business Registry', 'company', 'registration number'], 'south-africa': ['CIPC', 'company', 'registration number'], 'south-sudan': ['Business Registry', 'company', 'registration number'], sudan: ['Business Registry', 'company', 'registration number'], tanzania: ['BRELA', 'company', 'registration number'], togo: ['CFE', 'company', 'registration number'], tunisia: ['RNE', 'company', 'registration number'], uganda: ['URSB', 'company', 'registration number'], zambia: ['PACRA', 'company', 'registration number'], zimbabwe: ['Companies Registry', 'company', 'registration number']
}
const INTERNATIONAL_REGISTRIES = {
  'united-kingdom': ['Companies House', 'company', 'company number'], 'united-states': ['State business registry', 'company', 'state and registration number'], india: ['Ministry of Corporate Affairs', 'company', 'CIN'], singapore: ['ACRA', 'company', 'UEN'], thailand: ['Department of Business Development', 'company', 'registration number'], canada: ['Provincial business registry', 'company', 'corporation number'], australia: ['ASIC', 'company', 'ACN'], 'new-zealand': ['Companies Office', 'company', 'company number'], germany: ['Handelsregister', 'company', 'registration number'], france: ['Registre national des entreprises', 'company', 'SIREN'], italy: ['Registro Imprese', 'company', 'REA number'], spain: ['Registro Mercantil', 'company', 'CIF'], netherlands: ['Kamer van Koophandel', 'company', 'KVK number'], belgium: ['Crossroads Bank for Enterprises', 'company', 'enterprise number'], switzerland: ['Commercial Registry', 'company', 'UID'], brazil: ['Junta Comercial', 'company', 'CNPJ'], mexico: ['Registro Público de Comercio', 'company', 'RFC'], japan: ['Legal Entity Number registry', 'company', 'corporate number'], 'south-korea': ['National Tax Service', 'company', 'business registration number'], 'united-arab-emirates': ['Department of Economy and Tourism', 'company', 'trade license number'], 'saudi-arabia': ['Ministry of Commerce', 'company', 'CR number'], israel: ['Israel Corporations Authority', 'company', 'company number'], turkey: ['Trade Registry Gazette', 'company', 'MERSIS number']
}

// The catalog covers every ISO country even when no provider adapter is
// configured. These fallback entries intentionally route to manual review.
const ISO_COUNTRY_CODES = 'AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ')

function seedConfigurations(db) {
  const rows = collection(db, 'countryRegistryConfigurations')
  const configured = { ...AFRICAN_REGISTRIES, ...INTERNATIONAL_REGISTRIES }
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  for (const code of ISO_COUNTRY_CODES) {
    const display = displayNames.of(code)
    if (display) {
      const country = normalizeCountry(display)
      if (!configured[country]) configured[country] = [`${display} business registry`, 'company', 'registration number']
    }
  }
  for (const [country, [authority, types, identifierLabel]] of Object.entries(configured)) {
    if (!rows.some(row => row.country === country)) rows.push({ id: createId('registry_config'), country, authority, organizationTypes: types.split('/'), identifierLabel, automated: Boolean(process.env[`REGISTRY_${country.toUpperCase().replace(/-/g, '_')}_URL`]), adapterEnv: `REGISTRY_${country.toUpperCase().replace(/-/g, '_')}_URL`, active: true, updatedAt: nowIso() })
  }
  return rows
}

export function registryConfigurations(country = null) {
  const db = readAuthorityDb(); const rows = seedConfigurations(db); const key = country ? normalizeCountry(country) : null
  return rows.filter(row => !key || row.country === key).map(row => ({ ...row, credentialsConfigured: Boolean(process.env[row.adapterEnv.replace(/_URL$/, '_API_KEY')]) }))
}

function actorCanManage(db, userId, organizationId) {
  return collection(db, 'organizationMemberships').some(row => row.userId === userId && row.organizationId === organizationId && row.status === 'active' && ['owner', 'admin', 'authorized_representative'].includes(row.role))
}

export function registryCheck(userId, organizationId, body = {}) {
  const country = normalizeCountry(body.country); const config = registryConfigurations(country)[0]
  if (!config) return { ok: false, error: 'country_registry_not_configured' }
  return updateAuthorityDb(db => {
    const organization = collection(db, 'organizations').find(row => row.id === organizationId)
    if (!organization) return { ok: false, error: 'organization_not_found' }
    if (!actorCanManage(db, userId, organizationId)) return { ok: false, error: 'organization_admin_required' }
    const registrationIdentifier = text(body.registrationIdentifier || body.registrationNumber, 120)
    if (!registrationIdentifier) return { ok: false, status: 400, error: 'registration_identifier_required' }
    const endpoint = process.env[config.adapterEnv]
    const apiKey = process.env[config.adapterEnv.replace(/_URL$/, '_API_KEY')]
    const check = { id: createId('registry_check'), organizationId, requestedBy: userId, country, authority: config.authority, registrationIdentifier, legalName: text(body.legalName || body.name || organization.name, 240), status: endpoint && apiKey ? 'queued' : 'manual_review_required', automated: Boolean(endpoint && apiKey), createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'organizationRegistryChecks').push(check)
    if (!check.automated) return { ok: true, check, manualReviewRequired: true, reason: 'registry_credentials_not_configured' }
    return { ok: true, check, queued: true }
  })
}

export async function runRegistryCheck(checkId) {
  const initial = readAuthorityDb(); const check = collection(initial, 'organizationRegistryChecks').find(row => row.id === checkId)
  if (!check) return { ok: false, error: 'registry_check_not_found' }
  const config = registryConfigurations(check.country)[0]; const endpoint = config && process.env[config.adapterEnv]
  const apiKey = config && process.env[config.adapterEnv.replace(/_URL$/, '_API_KEY')]
  if (!endpoint || !apiKey) return updateAuthorityDb(db => { const row = collection(db, 'organizationRegistryChecks').find(item => item.id === checkId); row.status = 'manual_review_required'; row.reason = 'registry_credentials_not_configured'; row.updatedAt = nowIso(); return { ok: true, check: row, manualReviewRequired: true } })
  try {
    const url = new URL(endpoint); url.searchParams.set('registrationIdentifier', check.registrationIdentifier); url.searchParams.set('legalName', check.legalName)
    const response = await safeFetch(url.toString(), { headers: { accept: 'application/json', 'x-api-key': apiKey }, signal: AbortSignal.timeout(15000) }, { schemes: ['https'], allowHosts: [url.hostname] })
    const payload = await response.json().catch(() => ({})); const verified = response.ok && (payload.verified === true || payload.status === 'active' || payload.match === true)
    return updateAuthorityDb(db => { const row = collection(db, 'organizationRegistryChecks').find(item => item.id === checkId); row.status = verified ? 'verified' : response.ok ? 'manual_review_required' : 'provider_error'; row.providerResponse = { verified: Boolean(verified), status: payload.status || null, source: payload.source || config.authority }; row.updatedAt = nowIso(); return { ok: true, check: row, manualReviewRequired: !verified } })
  } catch (error) { return updateAuthorityDb(db => { const row = collection(db, 'organizationRegistryChecks').find(item => item.id === checkId); row.status = 'provider_error'; row.reason = error.message.slice(0, 200); row.updatedAt = nowIso(); return { ok: true, check: row, manualReviewRequired: true } }) }
}

export function createDomainChallenge(userId, organizationId, input = {}) {
  return updateAuthorityDb(db => {
    if (!collection(db, 'organizations').some(row => row.id === organizationId)) return { ok: false, error: 'organization_not_found' }
    if (!actorCanManage(db, userId, organizationId)) return { ok: false, error: 'organization_admin_required' }
    const domain = normalizeDomain(input.domain || input.website); if (!domain) return { ok: false, error: 'organization_domain_invalid' }
    const challenge = { id: createId('domain_challenge'), organizationId, userId, domain, token: token(), recordName: `_techit-verification.${domain}`, recordType: 'TXT', status: 'pending', expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(), createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'organizationDomainChallenges').push(challenge)
    // The token is returned only to the authenticated organization administrator;
    // it is never included in the public organization profile or admin listings.
    return { ok: true, challenge: { ...challenge }, instructions: `Publish a TXT record at ${challenge.recordName} with this verification token.` }
  })
}

export async function verifyDomainChallenge(userId, challengeId) {
  const db = readAuthorityDb(); const challenge = collection(db, 'organizationDomainChallenges').find(row => row.id === challengeId)
  if (!challenge) return { ok: false, error: 'domain_challenge_not_found' }
  if (!actorCanManage(db, userId, challenge.organizationId)) return { ok: false, status: 403, error: 'organization_admin_required' }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) return updateAuthorityDb(state => { const row = collection(state, 'organizationDomainChallenges').find(item => item.id === challengeId); row.status = 'expired'; row.updatedAt = nowIso(); return { ok: false, error: 'domain_challenge_expired', challenge: { ...row, token: undefined } } })
  let values = []
  try { values = (await dns.resolveTxt(challenge.recordName)).flat().map(value => String(value).trim()) } catch { values = [] }
  const found = values.includes(challenge.token)
  return updateAuthorityDb(state => {
    const row = collection(state, 'organizationDomainChallenges').find(item => item.id === challengeId); row.lastCheckedAt = nowIso(); row.status = found ? 'verified' : 'pending'; row.updatedAt = nowIso()
    if (found) { const domain = collection(state, 'organizationDomains').find(item => item.organizationId === row.organizationId && item.domain === row.domain); if (domain) Object.assign(domain, { status: 'verified', verifiedAt: nowIso(), verifiedBy: userId }); else collection(state, 'organizationDomains').push({ id: createId('org_domain'), organizationId: row.organizationId, domain: row.domain, status: 'verified', verifiedAt: nowIso(), verifiedBy: userId, createdAt: nowIso(), updatedAt: nowIso() }) }
    return { ok: true, verified: found, challenge: { ...row, token: undefined } }
  })
}

export function verificationOperations() {
  const db = readAuthorityDb()
  return {
    registryConfigurations: registryConfigurations(),
    registryChecks: collection(db, 'organizationRegistryChecks'),
    domainChallenges: collection(db, 'organizationDomainChallenges').map(row => ({ ...row, token: undefined })),
    evidenceObjects: collection(db, 'evidenceObjects').map(row => ({ ...row, objectKey: undefined })),
    manualReviews: collection(db, 'manualReviews'),
  }
}

export function reviewVerificationOperation(adminId, kind, id, body = {}) {
  const decision = String(body.decision || body.status || '').toLowerCase()
  const statusByKind = {
    registry: new Set(['verified', 'rejected', 'manual_review_required', 'in_review']),
    domain: new Set(['verified', 'rejected', 'pending', 'expired']),
  }
  if (!statusByKind[kind]?.has(decision)) return { ok: false, status: 400, error: 'invalid_operation_review_status' }
  return updateAuthorityDb(db => {
    const name = kind === 'registry' ? 'organizationRegistryChecks' : 'organizationDomainChallenges'
    const row = collection(db, name).find(item => item.id === id)
    if (!row) return { ok: false, status: 404, error: 'verification_operation_not_found' }
    const previousStatus = row.status
    row.status = decision
    row.reviewedBy = adminId
    row.reviewedAt = nowIso()
    row.reviewNote = text(body.note || body.reason, 1000) || null
    row.updatedAt = nowIso()
    if (kind === 'domain' && decision === 'verified') {
      const domain = collection(db, 'organizationDomains').find(item => item.organizationId === row.organizationId && item.domain === row.domain)
      if (domain) Object.assign(domain, { status: 'verified', verifiedAt: nowIso(), verifiedBy: adminId, updatedAt: nowIso() })
      else collection(db, 'organizationDomains').push({ id: createId('org_domain'), organizationId: row.organizationId, domain: row.domain, status: 'verified', verifiedAt: nowIso(), verifiedBy: adminId, createdAt: nowIso(), updatedAt: nowIso() })
    }
    collection(db, 'manualReviews').push({ id: createId('manual_review'), operationKind: kind, operationId: id, adminId, decision, note: row.reviewNote, createdAt: nowIso() })
    return { ok: true, operation: { ...row, token: undefined }, previousStatus }
  })
}
