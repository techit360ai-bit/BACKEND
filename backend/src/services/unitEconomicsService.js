import { readDb as readAuthorityDb } from '../config/database.js'

export const CREDIT_VALUE_USD = 0.025
export const DEFAULT_TARGET_MARGIN = 0.60
export const MINIMUM_MARGIN_FLOOR = 0.50

const DEFAULT_RATE_CARDS = Object.freeze({
  default: { version: 'default-v1', inputPricePerMillion: 0, outputPricePerMillion: 0, cachedInputPricePerMillion: 0, infrastructureCostUsd: 0.0015, externalCostUsd: 0, targetMargin: DEFAULT_TARGET_MARGIN, minimumChargeCredits: 1 },
  BASIC_AI_ACTION: { version: 'basic-ai-v1', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, cachedInputPricePerMillion: 0.03, infrastructureCostUsd: 0.0015, externalCostUsd: 0, targetMargin: 0.60, minimumChargeCredits: 1 },
  IDEA_DIAGNOSTICS_BASIC: { version: 'idea-basic-v1', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, cachedInputPricePerMillion: 0.03, infrastructureCostUsd: 0.002, externalCostUsd: 0, targetMargin: 0.60, minimumChargeCredits: 2 },
  CUSTOMER_VALIDATION_BASIC: { version: 'validation-basic-v1', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, cachedInputPricePerMillion: 0.03, infrastructureCostUsd: 0.003, externalCostUsd: 0, targetMargin: 0.60, minimumChargeCredits: 3 },
  MVP_PLANNING_BASIC: { version: 'mvp-basic-v1', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, cachedInputPricePerMillion: 0.03, infrastructureCostUsd: 0.005, externalCostUsd: 0, targetMargin: 0.60, minimumChargeCredits: 5 },
  workspace_creation: { version: 'workspace-v1', inputPricePerMillion: 0, outputPricePerMillion: 0, cachedInputPricePerMillion: 0, infrastructureCostUsd: 0.02, externalCostUsd: 0, targetMargin: 0.50, minimumChargeCredits: 2 },
  collaborator_matching: { version: 'matching-v1', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, cachedInputPricePerMillion: 0.01, infrastructureCostUsd: 0.01, externalCostUsd: 0, targetMargin: 0.55, minimumChargeCredits: 4 },
})

function number(value, fallback = 0) {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

function rateCardFor(taskType, db = null) {
  const configured = Array.isArray(db?.rateCards) ? db.rateCards.find(row => row.service === taskType && row.status !== 'inactive') : null
  return configured || DEFAULT_RATE_CARDS[taskType] || null
}

export function listDefaultRateCards() {
  return Object.entries(DEFAULT_RATE_CARDS).map(([service, card]) => ({ service, billingUnit: 'operation', ...card, status: 'active' }))
}

export function economicsForUsage(facts = {}, reservation = null, db = null) {
  const taskType = facts.taskType || facts.task_type
  const card = rateCardFor(taskType, db || readAuthorityDb())
  const reservedCredits = Math.max(0, number(reservation?.reservedCredits ?? facts.reservedCredits))
  // Unknown task types remain backwards-compatible until a finance owner
  // publishes a rate card. They retain the reservation and telemetry, but do
  // not invent customer revenue or margin numbers.
  if (!card) {
    const providerCostUsd = number(facts.providerCostUsd ?? facts.provider_cost_usd)
    return {
      rateCardVersion: 'unconfigured', inputTokens: Math.max(0, number(facts.promptTokens ?? facts.prompt_tokens)), outputTokens: Math.max(0, number(facts.completionTokens ?? facts.completion_tokens)), cachedTokens: Math.max(0, number(facts.cachedInputTokens ?? facts.cached_input_tokens)),
      providerCostUsd, infrastructureCostUsd: 0, externalCostUsd: 0, paymentCostUsd: 0,
      directServiceCogsUsd: providerCostUsd, totalVariableCostUsd: providerCostUsd, targetMargin: DEFAULT_TARGET_MARGIN,
      requiredRevenueUsd: 0, calculatedCredits: reservedCredits, settledCredits: facts.status === 'completed' ? reservedCredits : 0,
      allocatedRevenueUsd: 0, grossProfitUsd: -providerCostUsd, grossMargin: 0, marginStatus: 'unconfigured',
    }
  }
  const inputTokens = Math.max(0, number(facts.promptTokens ?? facts.prompt_tokens))
  const outputTokens = Math.max(0, number(facts.completionTokens ?? facts.completion_tokens))
  const cachedTokens = Math.max(0, number(facts.cachedInputTokens ?? facts.cached_input_tokens))
  const providerCostUsd = number(facts.providerCostUsd ?? facts.provider_cost_usd,
    inputTokens * number(card.inputPricePerMillion) / 1e6
      + outputTokens * number(card.outputPricePerMillion) / 1e6
      + cachedTokens * number(card.cachedInputPricePerMillion) / 1e6)
  const infrastructureCostUsd = number(facts.infrastructureCostUsd ?? facts.infrastructure_cost_usd, number(card.infrastructureCostUsd))
  const externalCostUsd = number(facts.externalCostUsd ?? facts.external_cost_usd, number(card.externalCostUsd))
  const paymentCostUsd = number(facts.paymentCostUsd ?? facts.payment_cost_usd)
  const directServiceCogsUsd = providerCostUsd + infrastructureCostUsd + externalCostUsd
  const totalVariableCostUsd = directServiceCogsUsd + paymentCostUsd
  const targetMargin = Math.min(0.95, Math.max(0, number(card.targetMargin, DEFAULT_TARGET_MARGIN)))
  const requiredRevenueUsd = directServiceCogsUsd / Math.max(0.05, 1 - targetMargin)
  const calculatedCredits = Math.max(number(card.minimumChargeCredits, 1), Math.ceil(requiredRevenueUsd / CREDIT_VALUE_USD))
  const settledCredits = facts.status === 'completed' ? Math.min(reservedCredits || calculatedCredits, calculatedCredits) : 0
  const allocatedRevenueUsd = reservation?.fundingSource === 'platform_subsidy' ? 0 : settledCredits * CREDIT_VALUE_USD
  const grossProfitUsd = allocatedRevenueUsd - totalVariableCostUsd
  const grossMargin = allocatedRevenueUsd > 0 ? grossProfitUsd / allocatedRevenueUsd : null
  return {
    rateCardVersion: card.version || 'unversioned', inputTokens, outputTokens, cachedTokens,
    providerCostUsd, infrastructureCostUsd, externalCostUsd, paymentCostUsd,
    directServiceCogsUsd, totalVariableCostUsd, targetMargin, requiredRevenueUsd,
    calculatedCredits, settledCredits, allocatedRevenueUsd, grossProfitUsd, grossMargin,
    marginStatus: grossMargin === null ? 'subsidized' : grossMargin < MINIMUM_MARGIN_FLOOR ? 'critical' : grossMargin < 0.60 ? 'warning' : 'healthy',
  }
}
