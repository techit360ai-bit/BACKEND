// Canonical, versioned Academy curriculum.  This file is intentionally
// deterministic: the AI Router may enrich lesson prose, but it cannot create
// phases, prerequisites, assessments, evidence, or completion state.
export const ACADEMY_CATALOG_VERSION = 2

const CASES = [
  ['Airbnb', 'success', 'The founders observed hosts directly and improved trust through hands-on learning.', 'Direct observation exposes the real problem behind the stated one.', 'Paul Graham: Airbnb', 'https://www.paulgraham.com/airbnb.html'],
  ['Juicero', 'failure', 'A polished product reached market without durable customer value relative to its cost.', 'Engineering novelty cannot replace customer value.', 'Juicero shuts down', 'https://www.theverge.com/2017/9/1/16243016/juicero-shuts-down'],
  ['Dropbox', 'success', 'A demonstration video tested demand before the full technical system was built.', 'An MVP should test the riskiest assumption quickly.', 'Dropbox: The Inside Story', 'https://www.ycombinator.com/library/4A-dropbox-the-inside-story'],
  ['Quibi', 'failure', 'Large funding and production quality did not create sustained product-market fit.', 'Capital and polish do not replace iterative evidence.', 'Quibi is shutting down', 'https://www.theverge.com/2020/10/21/21527642/quibi-shutting-down-streaming-service-short-form-video'],
  ['Stripe', 'success', 'Developer-first onboarding reduced friction and made distribution part of the product.', 'A narrow channel and fast activation create repeatable growth.', 'Do Things That Do Not Scale', 'https://www.paulgraham.com/ds.html'],
  ['Google Glass', 'failure', 'A technically impressive consumer launch lacked clear everyday value and social fit.', 'Adoption requires context, trust, and a clear user outcome.', 'Google Glass Enterprise Edition discontinued', 'https://support.google.com/glass-enterprise/customer/answer/13417888'],
  ['Slack', 'success', 'Usage-based pricing supported product-led adoption and expansion.', 'Price against measurable value and learning, not guesses.', 'Slack S-1 filing', 'https://www.sec.gov/Archives/edgar/data/1764925/000119312519161170/d557194ds1.htm'],
  ['MoviePass', 'failure', 'Rapid growth with unsustainable unit economics accelerated collapse.', 'Unprofitable pricing is not validation.', 'FTC MoviePass case', 'https://www.ftc.gov/news-events/news/press-releases/2021/06/ftc-charges-moviepass-deceptive-practices-data-security-failures'],
  ['Instagram', 'success', 'The team narrowed a broad product into a focused photo-sharing experience.', 'Removing scope can reveal a stronger wedge.', 'Instagram founders on product focus', 'https://review.firstround.com/How-Instagram-Co-Founders-Made-It-Scale'],
  ['Healthcare.gov', 'failure', 'Complex delivery lacked integration ownership, testing, and capacity readiness.', 'Launch readiness includes end-to-end ownership and testing.', 'GAO Healthcare.gov report', 'https://www.gao.gov/products/gao-14-694'],
  ['Superhuman', 'success', 'Structured product-market-fit feedback connected user signals to prioritization.', 'Feedback becomes useful when tied to a decision method.', 'Superhuman product-market fit engine', 'https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit'],
  ['Microsoft Tay', 'failure', 'A live system was manipulated because abuse preparation and controls were insufficient.', 'Feedback systems need adversarial testing and safety boundaries.', 'Learning from Tay', 'https://blogs.microsoft.com/blog/2016/03/25/learning-tays-introduction/'],
  ['Netflix', 'success', 'Controlled failure injection strengthened resilience and recovery practice.', 'Reliability is learned through observable recovery drills.', 'Netflix Chaos Engineering', 'https://netflixtechblog.com/the-netflix-simian-army-16e57fbab116'],
  ['Knight Capital', 'failure', 'A deployment failure caused severe financial loss within minutes.', 'Rollback, release controls, and telemetry are business controls.', 'SEC Knight Capital order', 'https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf'],
]

const PHASES = [
  ['01-hypothesis', 'Hypothesis and Customer', 'Define the customer, job, and falsifiable outcome.'],
  ['02-problem-evidence', 'Problem Evidence', 'Collect behavioural evidence about frequency, severity, and alternatives.'],
  ['03-segment', 'Segment and Positioning', 'Choose a reachable segment and a precise problem position.'],
  ['04-solution', 'Solution Design', 'Map the smallest solution to the highest-risk assumption.'],
  ['05-mvp', 'MVP Learning Loop', 'Ship a thin slice that produces a measurable learning signal.'],
  ['06-validation', 'Validation Experiments', 'Run interviews, tests, and experiments without confirmation bias.'],
  ['07-distribution', 'Distribution', 'Establish a repeatable path to qualified users.'],
  ['08-pricing', 'Pricing and Business Model', 'Test willingness to pay, value metrics, and sustainable economics.'],
  ['09-retention', 'Retention and Customer Success', 'Measure delivered value, activation, retention, and churn.'],
  ['10-operations', 'Operations and Reliability', 'Make delivery observable, secure, recoverable, and owned.'],
  ['11-analytics', 'Analytics and Decisions', 'Use trustworthy metrics and decision logs instead of vanity numbers.'],
  ['12-fundraising', 'Fundraising and Governance', 'Build an evidence-backed investor narrative and responsible governance.'],
  ['13-scale', 'Scale, Learning, and Leadership', 'Systematize learning, people, risk, and the next growth constraint.'],
]

const FOUNDER_FOCUS = [
  'Write a falsifiable customer hypothesis and define the decision it informs.', 'Interview customers about recent behaviour and record contradictions.', 'Select one reachable segment and explain why it has urgency.', 'Translate evidence into a narrow solution and explicit trade-offs.', 'Design an MVP that can disprove the riskiest assumption quickly.', 'Run a validation round and separate evidence, inference, and opinion.', 'Choose one acquisition channel and instrument activation.', 'Run a real pricing or willingness-to-pay test with unit economics.', 'Measure activation, retention, churn reasons, and customer outcomes.', 'Define operating risks, privacy boundaries, and incident responses.', 'Create a metric dictionary and a weekly evidence-based decision cadence.', 'Prepare an investor evidence room without overstating traction.', 'Set the next constraint, leadership habit, and responsible scale experiment.',
]
const COLLAB_FOCUS = [
  'Translate the project goal into an owned contribution and acceptance evidence.', 'Support interviews or research without leading customers or editing evidence.', 'Document segment assumptions and the implementation implications.', 'Propose a feasible solution slice with explicit technical and product trade-offs.', 'Ship a tested thin slice behind a safe boundary.', 'Connect feedback to a reversible implementation decision.', 'Instrument onboarding and remove the largest delivery or adoption friction.', 'Implement billing, entitlement, or pricing changes with auditability.', 'Build feedback, support, and retention loops that protect customer trust.', 'Operate the contribution with telemetry, rollback, runbooks, and ownership.', 'Maintain data quality, dashboards, and reproducible decision records.', 'Provide diligence-ready technical and execution evidence.', 'Mentor, document, and improve the system without creating unsafe complexity.',
]

function content(focus, caseA, caseB, role) {
  return {
    whyNow: `${focus} This phase is selected for the project's current stage and evidence gaps.`,
    overview: `Apply a short, project-specific learning loop: state the assumption, gather observable evidence, make one decision, and record what changed. ${role === 'founder' ? 'As founder, own the hypothesis and decision.' : 'As collaborator, own the contribution and its acceptance evidence.'}`,
    keyConcepts: ['falsifiable assumption', 'observable behaviour', 'decision rule', 'evidence versus inference'],
    steps: ['State the project-specific outcome and riskiest assumption.', 'Choose the smallest safe action that can produce evidence.', 'Collect and timestamp the evidence without rewriting it.', 'Compare the result with the decision rule.', 'Record the decision, owner, and next test.'],
    commonMistakes: ['Confusing opinions with behaviour', 'Expanding scope before learning', 'Ignoring negative or contradictory evidence', 'Reporting activity without a decision'],
    reflection: 'What evidence would make you change this decision, and who will review it?',
    exercise: { title: `${role === 'founder' ? 'Founder' : 'Collaborator'} phase decision record`, instructions: `Submit a project-linked record for this phase: assumption, evidence, decision rule, action, owner, and next check. Minimum 40 characters.` },
    caseStudies: [caseA, caseB],
  }
}

function makeTrack(role) {
  const focus = role === 'founder' ? FOUNDER_FOCUS : COLLAB_FOCUS
  return PHASES.map(([slug, phase], index) => {
    const id = `${role}.${slug}`
    const a = CASES[(index * 2) % CASES.length]
    const b = CASES[(index * 2 + 1) % CASES.length]
    return {
      id,
      phase,
      phaseIndex: index + 1,
      priority: index < 6 ? 'critical' : index < 10 ? 'important' : 'strategic',
      estimatedHours: 2 + (index % 3) * 0.5,
      title: `${phase}: ${role === 'founder' ? 'Founder Practice' : 'Collaborator Practice'}`,
      description: focus[index],
      objective: focus[index],
      prerequisites: index ? [`${role}.${PHASES[index - 1][0]}`] : [],
      tags: ['academy', role, slug.split('-')[1]],
      content: content(focus[index], { company: a[0], outcome: a[1], story: a[2], lesson: a[3], sourceTitle: a[4], sourceUrl: a[5] }, { company: b[0], outcome: b[1], story: b[2], lesson: b[3], sourceTitle: b[4], sourceUrl: b[5] }, role),
    }
  })
}

export function academyModulesForRole(role) {
  return makeTrack(role === 'collaborator' ? 'collaborator' : 'founder').map(module => ({ ...module, role: role === 'collaborator' ? 'collaborator' : 'founder', contentVersion: ACADEMY_CATALOG_VERSION, reviewedAt: '2026-08-26', source: 'backend_canonical_catalog' }))
}
