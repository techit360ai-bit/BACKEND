export interface StartupAbout {
  summary: string;
  useCase: string;
  marketSize: string;
  marketSizeValue: string;
}

export interface Startup {
  id: string;
  name: string;
  sector: string;
  region: string;
  readinessScore: number;
  executionVelocity: number;
  betaRetention: number;
  revenueGrowth: number;
  mrr: number;
  riskLevel: 'low' | 'moderate' | 'high';
  founderReliability: number;
  complianceVerified: boolean;
  aiGovernanceVerified: boolean;
  burnEfficiency: number;
  pivotFrequency: number;
  experimentVelocity: number;
  velocityDelta: number;
  revenueDelta: number;
  investorsWatching: number;
  milestones: Milestone[];
  riskMetrics: RiskMetrics;
  about: StartupAbout;
  lat?: number;
  lng?: number;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  type: 'beta' | 'revenue' | 'pivot' | 'certification' | 'governance';
  status: 'completed' | 'in-progress' | 'upcoming';
}

export interface RiskMetrics {
  product: number;
  market: number;
  team: number;
  compliance: number;
  financial: number;
  execution: number;
}

export interface InvestorMetrics {
  watchlistedStartups: number;
  highReadiness: number;
  highExecution: number;
  revenueValidated: number;
  aiGovernanceVerified: number;
}

export interface AllocationSimulation {
  totalCapital: number;
  minReadiness: number;
  maxRisk: string;
  regionPreference: string;
  sectorWeights: Record<string, number>;
  expectedIRR: { min: number; max: number };
  survivalLikelihood: number;
  exitProbability: { min: number; max: number };
}

export interface CapitalPool {
  id: string;
  name: string;
  totalCapital: number;
  deployed: number;
  startups: number;
  milestonesHit: number;
  fundsReleased: number;
  roiSimulation: number;
  rules: {
    minReadiness: number;
    maxPerStartup: number;
    milestoneTrigger: boolean;
  };
}

export const mockStartups: Startup[] = [
  {
    id: '1',
    name: 'QuantumAPI',
    sector: 'SaaS',
    region: 'North America',
    readinessScore: 86,
    executionVelocity: 79,
    betaRetention: 87,
    revenueGrowth: 45,
    mrr: 120000,
    riskLevel: 'low',
    founderReliability: 91,
    complianceVerified: true,
    aiGovernanceVerified: true,
    burnEfficiency: 2.4,
    pivotFrequency: 1,
    experimentVelocity: 8.2,
    velocityDelta: 24,
    revenueDelta: 18,
    investorsWatching: 7,
    lat: 37.7749,
    lng: -122.4194,
    milestones: [
      { id: 'm1', title: 'Beta Launch', date: '2025-08-15', type: 'beta', status: 'completed' },
      { id: 'm2', title: 'First Revenue', date: '2025-10-03', type: 'revenue', status: 'completed' },
      { id: 'm3', title: 'AI Certification', date: '2026-01-12', type: 'certification', status: 'completed' },
    ],
    riskMetrics: {
      product: 85,
      market: 72,
      team: 88,
      compliance: 92,
      financial: 78,
      execution: 89,
    },
    about: {
      summary: 'Zero-ops API infrastructure platform enabling enterprises to deploy, monitor, and scale REST and GraphQL APIs with AI-driven performance optimization and automatic failover built in.',
      useCase: 'Enterprise dev teams replacing fragmented API management toolchains with a single unified platform — reducing integration overhead by 70% and accelerating API go-to-market from weeks to hours.',
      marketSize: '$6.2B API management market growing at 23% CAGR, expanding to $28B across the broader developer tooling market by 2027.',
      marketSizeValue: '$28B',
    },
  },
  {
    id: '2',
    name: 'NeuralEdge AI',
    sector: 'AI/ML',
    region: 'Europe',
    readinessScore: 92,
    executionVelocity: 88,
    betaRetention: 91,
    revenueGrowth: 67,
    mrr: 245000,
    riskLevel: 'low',
    founderReliability: 94,
    complianceVerified: true,
    aiGovernanceVerified: true,
    burnEfficiency: 3.1,
    pivotFrequency: 0,
    experimentVelocity: 12.5,
    velocityDelta: 31,
    revenueDelta: 42,
    investorsWatching: 12,
    lat: 51.5074,
    lng: -0.1278,
    milestones: [
      { id: 'm4', title: 'Beta Launch', date: '2025-06-20', type: 'beta', status: 'completed' },
      { id: 'm5', title: 'First Revenue', date: '2025-08-11', type: 'revenue', status: 'completed' },
      { id: 'm6', title: 'Governance Validation', date: '2025-12-05', type: 'governance', status: 'completed' },
    ],
    riskMetrics: {
      product: 92,
      market: 84,
      team: 91,
      compliance: 95,
      financial: 86,
      execution: 93,
    },
    about: {
      summary: 'Edge-native AI inference engine that runs large language model-grade intelligence on low-power IoT and mobile devices — no cloud dependency, sub-5ms latency, full data sovereignty.',
      useCase: 'Manufacturing lines, autonomous vehicles, and medical diagnostics devices requiring real-time AI decisions with strict privacy and latency constraints that cloud AI cannot meet.',
      marketSize: '$61B edge AI semiconductor market by 2028, with a $15B TAM in industrial edge inference addressable by 2026.',
      marketSizeValue: '$61B',
    },
  },
  {
    id: '3',
    name: 'FinFlow',
    sector: 'FinTech',
    region: 'Asia',
    readinessScore: 78,
    executionVelocity: 72,
    betaRetention: 74,
    revenueGrowth: 28,
    mrr: 68000,
    riskLevel: 'moderate',
    founderReliability: 82,
    complianceVerified: true,
    aiGovernanceVerified: false,
    burnEfficiency: 1.8,
    pivotFrequency: 2,
    experimentVelocity: 5.7,
    velocityDelta: 12,
    revenueDelta: 9,
    investorsWatching: 4,
    lat: 1.3521,
    lng: 103.8198,
    milestones: [
      { id: 'm7', title: 'Beta Launch', date: '2025-09-10', type: 'beta', status: 'completed' },
      { id: 'm8', title: 'Pivot to B2B', date: '2025-11-22', type: 'pivot', status: 'completed' },
      { id: 'm9', title: 'First Revenue', date: '2026-01-08', type: 'revenue', status: 'completed' },
    ],
    riskMetrics: {
      product: 76,
      market: 65,
      team: 79,
      compliance: 88,
      financial: 62,
      execution: 74,
    },
    about: {
      summary: 'B2B embedded finance platform enabling any SaaS company to instantly offer lending, buy-now-pay-later, and insurance products to their SME customer base without a banking license.',
      useCase: 'SaaS platforms in Southeast Asia monetizing their proprietary user data by embedding financial products directly into their workflows, driving revenue uplift of 3–5x per customer.',
      marketSize: '$7.2T embedded finance market globally by 2030, with $350B addressable SME lending opportunity in Southeast Asia alone.',
      marketSizeValue: '$7.2T',
    },
  },
  {
    id: '4',
    name: 'BioSynth',
    sector: 'BioTech',
    region: 'Europe',
    readinessScore: 84,
    executionVelocity: 76,
    betaRetention: 82,
    revenueGrowth: 52,
    mrr: 156000,
    riskLevel: 'moderate',
    founderReliability: 87,
    complianceVerified: true,
    aiGovernanceVerified: true,
    burnEfficiency: 2.2,
    pivotFrequency: 1,
    experimentVelocity: 9.4,
    velocityDelta: 18,
    revenueDelta: 24,
    investorsWatching: 6,
    lat: 48.8566,
    lng: 2.3522,
    milestones: [
      { id: 'm10', title: 'Beta Launch', date: '2025-07-05', type: 'beta', status: 'completed' },
      { id: 'm11', title: 'First Revenue', date: '2025-09-18', type: 'revenue', status: 'completed' },
    ],
    riskMetrics: {
      product: 81,
      market: 73,
      team: 85,
      compliance: 91,
      financial: 74,
      execution: 82,
    },
    about: {
      summary: 'AI-driven synthetic biology platform that automates gene circuit design for therapeutic protein production at industrial scale — compressing drug R&D timelines from years to months.',
      useCase: 'Pharmaceutical companies and contract manufacturing organizations using BioSynth to automate biology R&D, reducing therapeutic candidate design cycles from 8 years to under 3.',
      marketSize: '$38B synthetic biology market by 2030, underpinned by a $500B+ global biopharmaceutical production market seeking productivity gains.',
      marketSizeValue: '$38B',
    },
  },
  {
    id: '5',
    name: 'CloudMesh',
    sector: 'Infrastructure',
    region: 'North America',
    readinessScore: 88,
    executionVelocity: 83,
    betaRetention: 89,
    revenueGrowth: 58,
    mrr: 198000,
    riskLevel: 'low',
    founderReliability: 89,
    complianceVerified: true,
    aiGovernanceVerified: true,
    burnEfficiency: 2.7,
    pivotFrequency: 0,
    experimentVelocity: 10.8,
    velocityDelta: 27,
    revenueDelta: 33,
    investorsWatching: 9,
    lat: 40.7128,
    lng: -74.0060,
    milestones: [
      { id: 'm12', title: 'Beta Launch', date: '2025-05-12', type: 'beta', status: 'completed' },
      { id: 'm13', title: 'First Revenue', date: '2025-07-28', type: 'revenue', status: 'completed' },
      { id: 'm14', title: 'AI Certification', date: '2025-11-15', type: 'certification', status: 'completed' },
    ],
    riskMetrics: {
      product: 87,
      market: 79,
      team: 86,
      compliance: 93,
      financial: 81,
      execution: 88,
    },
    about: {
      summary: 'Intelligent mesh networking layer that unifies multi-cloud environments with self-healing connectivity, ML-driven traffic optimization, and zero-config service discovery across AWS, Azure, and GCP.',
      useCase: 'Enterprises running workloads across multiple cloud providers eliminating egress costs, reducing network latency by up to 60%, and achieving vendor-agnostic infrastructure resilience.',
      marketSize: '$168B multi-cloud management market by 2028, with a rapidly growing $4.2B cloud networking optimization segment.',
      marketSizeValue: '$168B',
    },
  },
  {
    id: '6',
    name: 'DataVault',
    sector: 'Security',
    region: 'Europe',
    readinessScore: 81,
    executionVelocity: 74,
    betaRetention: 79,
    revenueGrowth: 38,
    mrr: 92000,
    riskLevel: 'moderate',
    founderReliability: 84,
    complianceVerified: true,
    aiGovernanceVerified: true,
    burnEfficiency: 2.0,
    pivotFrequency: 1,
    experimentVelocity: 7.1,
    velocityDelta: 15,
    revenueDelta: 14,
    investorsWatching: 5,
    lat: 52.5200,
    lng: 13.4050,
    milestones: [
      { id: 'm15', title: 'Beta Launch', date: '2025-08-22', type: 'beta', status: 'completed' },
      { id: 'm16', title: 'First Revenue', date: '2025-11-05', type: 'revenue', status: 'completed' },
    ],
    riskMetrics: {
      product: 79,
      market: 71,
      team: 82,
      compliance: 94,
      financial: 69,
      execution: 77,
    },
    about: {
      summary: 'Zero-trust data governance platform with automated compliance enforcement, real-time data lineage tracking across cloud and on-prem systems, and AI-powered anomaly detection for insider threats.',
      useCase: 'Financial institutions and healthcare operators achieving continuous GDPR, SOC2, and HIPAA compliance without manual auditing overhead — turning compliance from a cost center into a competitive moat.',
      marketSize: '$54B data governance and security market by 2027, with a $12B compliance automation segment growing at 31% CAGR.',
      marketSizeValue: '$54B',
    },
  },
];

export const investorMetrics: InvestorMetrics = {
  watchlistedStartups: 12,
  highReadiness: 8,
  highExecution: 6,
  revenueValidated: 11,
  aiGovernanceVerified: 9,
};
