import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendMock, reviewMock, createUploadMock, finalizeMock } = vi.hoisted(() => ({
  repoMock: {
    insertMilestoneEvidence: vi.fn(async entry => ({ ...entry, status: entry.status || 'upload_pending', id: entry.id })),
    getMilestoneEvidence: vi.fn(async () => null),
    listMilestoneEvidence: vi.fn(async () => []),
    updateMilestoneEvidence: vi.fn(async (id, patch) => ({ id, ...patch })),
    updateProofStatus: vi.fn(async (id, patch) => ({ id, ...patch })),
    getProof: vi.fn(async () => null),
    listProofs: vi.fn(async () => []),
  },
  appendMock: vi.fn(async () => ({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 9 } })),
  reviewMock: vi.fn(async () => ({ ok: true, proof: { id: 'proof-1', status: 'verified' }, score: { trustScore: 9 } })),
  createUploadMock: vi.fn(() => ({ ok: true, objectKey: 'milestone/u1/ev-1.pdf', uploadUrl: 'https://storage.example/put', requiredHeaders: { 'Content-Type': 'application/pdf' } })),
  finalizeMock: vi.fn(async () => ({ ok: true, sha256: 'sha-abc', scan: { clean: true, engine: 'clamav' } })),
}))

vi.mock('../repositories/trustRepository.js', () => repoMock)
vi.mock('../services/trustAuthority.js', () => ({ appendTrustProof: appendMock, reviewTrustProof: reviewMock }))
vi.mock('../services/evidenceStorageService.js', () => ({ createPrivateUpload: createUploadMock, finalizePrivateUpload: finalizeMock }))

const { createMilestoneEvidenceUpload, finalizeMilestoneEvidence, listMilestones, reviewMilestoneProof, submitMilestone } = await import('../services/trustMilestoneService.js')

const baseEnv = () => ({ TRUST_MILESTONES_ENABLED: 'true' })
const availableEvidence = () => ({ id: 'ev-1', status: 'available', sha256: 'sha-abc', objectKey: 'milestone/u1/ev-1.pdf', contentType: 'application/pdf', sizeBytes: 10 })

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.insertMilestoneEvidence.mockImplementation(async entry => ({ ...entry, status: entry.status || 'upload_pending', id: entry.id }))
  repoMock.getMilestoneEvidence.mockResolvedValue(null)
  repoMock.updateMilestoneEvidence.mockImplementation(async (id, patch) => ({ id, ...patch }))
  repoMock.updateProofStatus.mockImplementation(async (id, patch) => ({ id, ...patch }))
  repoMock.getProof.mockResolvedValue(null)
  repoMock.listProofs.mockResolvedValue([])
  appendMock.mockReset(); appendMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 9 } })
  reviewMock.mockReset(); reviewMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1', status: 'verified' }, score: { trustScore: 9 } })
  createUploadMock.mockReset(); createUploadMock.mockReturnValue({ ok: true, objectKey: 'milestone/u1/ev-1.pdf', uploadUrl: 'https://storage.example/put', requiredHeaders: { 'Content-Type': 'application/pdf' } })
  finalizeMock.mockReset(); finalizeMock.mockResolvedValue({ ok: true, sha256: 'sha-abc', scan: { clean: true, engine: 'clamav' } })
})

afterEach(() => { delete process.env.TRUST_WRITE_SOURCE })

describe('milestone evidence pipeline', () => {
  it('creates a private upload and stores a pending evidence row', async () => {
    const result = await createMilestoneEvidenceUpload('u1', { contentType: 'application/pdf', sizeBytes: 10 }, { env: baseEnv() })
    expect(result.ok).toBe(true)
    expect(result.uploadUrl).toBe('https://storage.example/put')
    expect(repoMock.insertMilestoneEvidence).toHaveBeenCalled()
  })

  it('keeps milestones coming soon while disabled and requires the postgres authority', async () => {
    const disabled = await createMilestoneEvidenceUpload('u1', { contentType: 'application/pdf', sizeBytes: 10 }, { env: {} })
    expect(disabled.status).toBe(409)
    expect(disabled.reason).toBe('feature_disabled')
    delete process.env.TRUST_WRITE_SOURCE
    expect((await createMilestoneEvidenceUpload('u1', {}, { env: baseEnv() })).error).toBe('milestone_requires_postgres_authority')
  })

  it('quarantines evidence that fails the malware/hash scan', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue({ ...availableEvidence(), status: 'upload_pending' })
    finalizeMock.mockResolvedValue({ ok: false, error: 'malware_detected', scan: { clean: false } })
    const result = await finalizeMilestoneEvidence('u1', 'ev-1', { env: baseEnv() })
    expect(result.status).toBe(422)
    expect(result.error).toBe('malware_detected')
    const patch = repoMock.updateMilestoneEvidence.mock.calls[0][1]
    expect(patch.status).toBe('quarantined')
    expect(patch.malwareStatus).toBe('infected_or_unavailable')
  })

  it('marks scanned evidence available with its sha256', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue({ ...availableEvidence(), status: 'upload_pending' })
    const result = await finalizeMilestoneEvidence('u1', 'ev-1', { env: baseEnv() })
    expect(result.ok).toBe(true)
    expect(result.evidence.sha256).toBe('sha-abc')
    expect(repoMock.updateMilestoneEvidence.mock.calls[0][1]).toMatchObject({ status: 'available', malwareStatus: 'clean' })
  })
})

describe('submitMilestone', () => {
  it('requires scanned evidence by default', async () => {
    const result = await submitMilestone('u1', { type: 'funding' }, { env: baseEnv() })
    expect(result.status).toBe(422)
    expect(result.error).toBe('milestone_evidence_required')
    expect(appendMock).not.toHaveBeenCalled()
  })

  it('rejects evidence that is not ready', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue({ id: 'ev-1', status: 'upload_pending' })
    const result = await submitMilestone('u1', { type: 'funding', evidenceId: 'ev-1' }, { env: baseEnv() })
    expect(result.error).toBe('milestone_evidence_not_ready')
  })

  it('mints a pending self milestone proof from hashed evidence', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue(availableEvidence())
    const result = await submitMilestone('u1', { type: 'funding', evidenceId: 'ev-1', contractId: 'c-1', revenueVerificationId: 'r-1' }, { env: baseEnv() })
    expect(result.ok).toBe(true)
    expect(result.status).toBe('pending')
    const input = appendMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'milestone', status: 'pending', method: 'milestone_funding', attestationLevel: 'self', correlationGroup: 'financials' })
    expect(input.metadata).toMatchObject({ milestoneType: 'funding', evidenceObjectId: 'ev-1', evidenceSha256: 'sha-abc', contractId: 'c-1', revenueVerificationId: 'r-1' })
    expect(repoMock.updateMilestoneEvidence).toHaveBeenCalledWith('ev-1', expect.objectContaining({ milestoneProofId: 'proof-1' }))
  })

  it('mints a verified third-party proof from a completed e-sign envelope', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue(availableEvidence())
    const env = { ...baseEnv(), DOCUSIGN_ACCESS_TOKEN: 'd' }
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'completed' }) }))
    const result = await submitMilestone('u1', { type: 'contract_loi', evidenceId: 'ev-1', attestation: { provider: 'docusign', envelopeId: 'env-1', accountId: 'acc-1' } }, { env, fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.status).toBe('verified')
    const input = appendMock.mock.calls[0][1]
    expect(input).toMatchObject({ status: 'verified', method: 'docusign_attested_milestone', attestationLevel: 'third_party_attested' })
    expect(input.metadata).toMatchObject({ attestationProvider: 'docusign', envelopeId: 'env-1' })
  })

  it('refuses an incomplete e-sign envelope and unconfigured providers', async () => {
    repoMock.getMilestoneEvidence.mockResolvedValue(availableEvidence())
    const env = { ...baseEnv(), DOCUSIGN_ACCESS_TOKEN: 'd' }
    const pendingFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'sent' }) }))
    expect((await submitMilestone('u1', { type: 'funding', evidenceId: 'ev-1', attestation: { provider: 'docusign', envelopeId: 'e', accountId: 'a' } }, { env, fetchImpl: pendingFetch })).error).toBe('milestone_attestation_incomplete')

    expect((await submitMilestone('u1', { type: 'funding', evidenceId: 'ev-1', attestation: { provider: 'docusign', envelopeId: 'e', accountId: 'a' } }, { env: baseEnv() })).error).toBe('milestone_attestation_not_configured')
  })

  it('rejects unknown and disallowed milestone types', async () => {
    expect((await submitMilestone('u1', { type: 'hackathon' }, { env: baseEnv() })).error).toBe('milestone_type_unsupported')
    expect((await submitMilestone('u1', { type: 'audit' }, { env: { ...baseEnv(), TRUST_MILESTONE_TYPES: 'funding' } })).error).toBe('milestone_type_not_allowed')
  })
})

describe('reviewMilestoneProof', () => {
  it('requires a reason code to reject', async () => {
    const result = await reviewMilestoneProof('admin-1', 'proof-1', { decision: 'rejected' }, { env: baseEnv() })
    expect(result.status).toBe(400)
    expect(result.error).toBe('milestone_rejection_reason_required')
    expect(reviewMock).not.toHaveBeenCalled()
  })

  it('only reviews milestone proofs', async () => {
    repoMock.getProof.mockResolvedValue({ id: 'p', source: 'github' })
    const result = await reviewMilestoneProof('admin-1', 'p', { decision: 'verified' }, { env: baseEnv() })
    expect(result.status).toBe(404)
    expect(result.error).toBe('milestone_proof_not_found')
  })

  it('approves a self milestone through the shared review queue', async () => {
    repoMock.getProof.mockResolvedValue({ id: 'p', source: 'milestone', attestationLevel: 'self', metadata: { milestoneType: 'funding' } })
    const result = await reviewMilestoneProof('admin-1', 'p', { decision: 'verified', note: 'ok' }, { env: baseEnv() })
    expect(result.ok).toBe(true)
    expect(reviewMock).toHaveBeenCalledWith('admin-1', 'p', expect.objectContaining({ decision: 'verified' }))
  })

  it('requires attestation for attestation-mandatory milestone types', async () => {
    repoMock.getProof.mockResolvedValue({ id: 'p', source: 'milestone', attestationLevel: 'self', metadata: { milestoneType: 'audit' } })
    const result = await reviewMilestoneProof('admin-1', 'p', { decision: 'verified' }, { env: baseEnv() })
    expect(result.status).toBe(422)
    expect(result.error).toBe('milestone_attestation_required')
    expect(reviewMock).not.toHaveBeenCalled()
  })

  it('lets an admin confirm a letter/notary and upgrade the proof to third-party', async () => {
    repoMock.getProof.mockResolvedValue({ id: 'p', source: 'milestone', attestationLevel: 'self', metadata: { milestoneType: 'funding' } })
    await reviewMilestoneProof('admin-1', 'p', { decision: 'verified', attestationLevel: 'third_party_attested' }, { env: baseEnv() })
    expect(repoMock.updateProofStatus).toHaveBeenCalledWith('p', { attestationLevel: 'third_party_attested' })
    expect(reviewMock).toHaveBeenCalled()
  })
})

describe('listMilestones', () => {
  it('returns only milestone proofs with their attestation level', async () => {
    repoMock.listProofs.mockResolvedValue([
      { id: 'm1', source: 'milestone', status: 'verified', attestationLevel: 'third_party_attested', metadata: { milestoneType: 'funding', evidenceObjectId: 'ev-1' } },
      { id: 'g1', source: 'github', status: 'verified' },
    ])
    const result = await listMilestones('u1')
    expect(result.milestones).toHaveLength(1)
    expect(result.milestones[0]).toMatchObject({ id: 'm1', type: 'funding', attestation_level: 'third_party_attested', evidence_object_id: 'ev-1' })
  })
})
