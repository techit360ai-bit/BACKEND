import { useState } from 'react';
import { Wallet, Plus, TrendingUp, CheckCircle } from 'lucide-react';
import type { CapitalPool } from '../../data/mockData';

export function CapitalPools() {
  const [pools] = useState<CapitalPool[]>([
    {
      id: '1',
      name: 'TechIT Micro Fund Alpha',
      totalCapital: 500000,
      deployed: 380000,
      startups: 8,
      milestonesHit: 24,
      fundsReleased: 280000,
      roiSimulation: 3.2,
      rules: {
        minReadiness: 85,
        maxPerStartup: 20,
        milestoneTrigger: true,
      },
    },
    {
      id: '2',
      name: 'AI Governance Fund',
      totalCapital: 750000,
      deployed: 520000,
      startups: 10,
      milestonesHit: 31,
      fundsReleased: 420000,
      roiSimulation: 4.1,
      rules: {
        minReadiness: 80,
        maxPerStartup: 15,
        milestoneTrigger: true,
      },
    },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Capital Pools</h1>
            <p className="text-gray-400 mt-1">
              Automated milestone-based capital deployment · Build micro funds
            </p>
          </div>
          <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create New Pool
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}

          {/* Create Pool Card */}
          <div className="bg-[#111111] border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center hover:border-emerald-500/50 transition-colors cursor-pointer group">
            <div className="p-4 bg-gray-800 group-hover:bg-emerald-500/10 rounded-full mb-4 transition-colors">
              <Plus className="w-8 h-8 text-gray-400 group-hover:text-emerald-400 transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Create New Pool</h3>
            <p className="text-gray-400 text-center text-sm">
              Set up automated capital deployment with custom rules and milestone triggers
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-8 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            How Milestone-Based Capital Deployment Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Step number="1" title="Define Pool" description="Set total capital and investment criteria" />
            <Step number="2" title="Select Startups" description="Choose eligible startups above readiness threshold" />
            <Step number="3" title="Set Milestones" description="Define trigger points for capital release" />
            <Step number="4" title="Auto-Deploy" description="Funds released automatically when milestones hit" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PoolCardProps {
  pool: CapitalPool;
}

function PoolCard({ pool }: PoolCardProps) {
  const deployedPercentage = (pool.deployed / pool.totalCapital) * 100;
  const releasedPercentage = (pool.fundsReleased / pool.deployed) * 100;

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">{pool.name}</h3>
          <p className="text-sm text-gray-400">
            {pool.startups} startups · {pool.milestonesHit} milestones completed
          </p>
        </div>
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Wallet className="w-5 h-5 text-purple-400" />
        </div>
      </div>

      {/* Capital Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Total Capital</p>
          <p className="text-2xl font-bold font-mono text-white">
            ${(pool.totalCapital / 1000).toFixed(0)}K
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400 mb-1">ROI Simulation</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{pool.roiSimulation}x</p>
        </div>
      </div>

      {/* Deployment Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Capital Deployed</span>
          <span className="text-sm font-mono text-white">{deployedPercentage.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            style={{ width: `${deployedPercentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          ${(pool.deployed / 1000).toFixed(0)}K of ${(pool.totalCapital / 1000).toFixed(0)}K deployed
        </p>
      </div>

      {/* Funds Released */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Funds Released (Milestone-Based)</span>
          <span className="text-sm font-mono text-emerald-400">{releasedPercentage.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${releasedPercentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          ${(pool.fundsReleased / 1000).toFixed(0)}K released on milestone completion
        </p>
      </div>

      {/* Rules */}
      <div className="p-4 bg-gray-800/50 rounded-lg mb-4">
        <h4 className="text-sm font-semibold text-white mb-3">Pool Rules</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Min Readiness</span>
            <span className="text-white font-mono">{pool.rules.minReadiness}+</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Max Per Startup</span>
            <span className="text-white font-mono">{pool.rules.maxPerStartup}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Milestone Trigger</span>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded transition-all">
          View Details
        </button>
        <button className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded transition-all flex items-center justify-center gap-1">
          <TrendingUp className="w-4 h-4" />
          Analytics
        </button>
      </div>
    </div>
  );
}

interface StepProps {
  number: string;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
        <span className="text-purple-400 font-bold">{number}</span>
      </div>
      <h4 className="font-semibold text-white mb-1">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
