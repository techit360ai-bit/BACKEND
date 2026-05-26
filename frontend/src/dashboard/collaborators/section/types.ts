// Type definitions for TechIT Collaborator Dashboard

export interface Project {
  id: string;
  name: string;
  logo: string;
  role: string;
  progress: number;
  deadline: string;
  status: 'healthy' | 'risk' | 'critical';
  sprintGoal: string;
  tasksAssigned: number;
  recentActivity: string;
  lastActivity: string;
  blockers: string[];
  nextAction: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline: string;
  impactScore: number;
  dependencies: string[];
  aiReason: string;
  status: 'pending' | 'in-progress' | 'completed';
  aiRank: number;
}

export interface Metric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Earning {
  projectId: string;
  projectName: string;
  earned: number;
  pending: number;
  equity: number;
  revenueShare: number;
  contributionValue: string;
}

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  type: 'project' | 'gig' | 'advisory' | 'testing';
  reward: string;
  timeCommitment: string;
  riskLevel: 'low' | 'medium' | 'high';
  teamQuality: number;
  matchScore: number;
  skills: string[];
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  icon: string;
}

export interface CollaboratorProfile {
  name: string;
  roles: string[];
  reputationScore: number;
  executionScore: number;
  lifetimeEarnings: number;
  pendingEarnings: number;
  activeProjectsCount: number;
  completedProjects: number;
  endorsements: number;
  reliabilityScore: number;
}
