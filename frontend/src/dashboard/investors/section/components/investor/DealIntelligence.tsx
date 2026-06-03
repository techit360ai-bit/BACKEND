import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockStartups, type Startup } from '../../data/mockData';
import {
  Filter,
  Grid3x3,
  List,
  Eye,
  MapPin,
  ChevronDown,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';

export function DealIntelligence() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState({
    minReadiness: 0,
    minExecutionVelocity: 0,
    minBetaRetention: 0,
    minRevenueGrowth: 0,
    complianceVerified: false,
    minFounderReliability: 0,
    region: 'all',
    sector: 'all',
    maxBurnEfficiency: 10,
  });

  const [expandedFilters, setExpandedFilters] = useState({
    execution: true,
    risk: false,
    behavioral: false,
  });

  const filteredStartups = mockStartups.filter((startup) => {
    if (startup.readinessScore < filters.minReadiness) return false;
    if (startup.executionVelocity < filters.minExecutionVelocity) return false;
    if (startup.betaRetention < filters.minBetaRetention) return false;
    if (startup.revenueGrowth < filters.minRevenueGrowth) return false;
    if (filters.complianceVerified && !startup.complianceVerified) return false;
    if (startup.founderReliability < filters.minFounderReliability) return false;
    if (filters.region !== 'all' && startup.region !== filters.region) return false;
    if (filters.sector !== 'all' && startup.sector !== filters.sector) return false;
    if (startup.burnEfficiency > filters.maxBurnEfficiency) return false;
    return true;
  });

  const toggleFilterSection = (section: keyof typeof expandedFilters) => {
    setExpandedFilters((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Deal Intelligence Engine</h1>
        <p className="text-muted-foreground/70 mt-1">
          Bloomberg Terminal for startup execution · Signal &gt; Noise
        </p>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Filter Sidebar */}
        <aside className="w-80 bg-[#111111] border-r border-border overflow-y-auto p-6">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Advanced Filters</h2>
          </div>

          <div className="space-y-4">
            {/* Execution Metrics */}
            <FilterSection
              title="Execution Metrics"
              isExpanded={expandedFilters.execution}
              onToggle={() => toggleFilterSection('execution')}
            >
              <SliderFilter
                label="Market Readiness"
                value={filters.minReadiness}
                onChange={(value) => setFilters({ ...filters, minReadiness: value })}
                min={0}
                max={100}
              />
              <SliderFilter
                label="Execution Velocity"
                value={filters.minExecutionVelocity}
                onChange={(value) => setFilters({ ...filters, minExecutionVelocity: value })}
                min={0}
                max={100}
              />
              <SliderFilter
                label="Beta Retention %"
                value={filters.minBetaRetention}
                onChange={(value) => setFilters({ ...filters, minBetaRetention: value })}
                min={0}
                max={100}
              />
              <SliderFilter
                label="Revenue Growth %"
                value={filters.minRevenueGrowth}
                onChange={(value) => setFilters({ ...filters, minRevenueGrowth: value })}
                min={0}
                max={100}
              />
            </FilterSection>

            {/* Risk Controls */}
            <FilterSection
              title="Risk Controls"
              isExpanded={expandedFilters.risk}
              onToggle={() => toggleFilterSection('risk')}
            >
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.complianceVerified}
                    onChange={(e) =>
                      setFilters({ ...filters, complianceVerified: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-border bg-card text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-sm text-muted-foreground/50">Compliance Verified Only</span>
                </label>
                <SliderFilter
                  label="Founder Reliability"
                  value={filters.minFounderReliability}
                  onChange={(value) => setFilters({ ...filters, minFounderReliability: value })}
                  min={0}
                  max={100}
                />
                <SliderFilter
                  label="Max Burn Efficiency"
                  value={filters.maxBurnEfficiency}
                  onChange={(value) => setFilters({ ...filters, maxBurnEfficiency: value })}
                  min={1}
                  max={10}
                />
              </div>
            </FilterSection>

            {/* Behavioral Patterns */}
            <FilterSection
              title="Behavioral Patterns"
              isExpanded={expandedFilters.behavioral}
              onToggle={() => toggleFilterSection('behavioral')}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground/70 mb-2 block">Region</label>
                  <select
                    value={filters.region}
                    onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Regions</option>
                    <option value="North America">North America</option>
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground/70 mb-2 block">Sector</label>
                  <select
                    value={filters.sector}
                    onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Sectors</option>
                    <option value="SaaS">SaaS</option>
                    <option value="AI/ML">AI/ML</option>
                    <option value="FinTech">FinTech</option>
                    <option value="BioTech">BioTech</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Security">Security</option>
                  </select>
                </div>
              </div>
            </FilterSection>

            {/* Reset Button */}
            <button
              onClick={() =>
                setFilters({
                  minReadiness: 0,
                  minExecutionVelocity: 0,
                  minBetaRetention: 0,
                  minRevenueGrowth: 0,
                  complianceVerified: false,
                  minFounderReliability: 0,
                  region: 'all',
                  sector: 'all',
                  maxBurnEfficiency: 10,
                })
              }
              className="w-full py-2 bg-card hover:bg-card text-muted-foreground/50 text-sm font-medium rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </aside>

        {/* Results Panel */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-muted-foreground/70 text-sm">
                Showing <span className="text-white font-mono">{filteredStartups.length}</span> of{' '}
                <span className="text-white font-mono">{mockStartups.length}</span> startups
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-card text-muted-foreground/70 hover:text-white'
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-card text-muted-foreground/70 hover:text-white'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Results Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStartups.map((startup) => (
                <StartupCard key={startup.id} startup={startup} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStartups.map((startup) => (
                <StartupListItem key={startup.id} startup={startup} />
              ))}
            </div>
          )}

          {filteredStartups.length === 0 && (
            <div className="text-center py-16">
              <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No startups match your filters</h3>
              <p className="text-muted-foreground/70">Try adjusting your filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, isExpanded, onToggle, children }: FilterSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-card/50 flex items-center justify-between text-white hover:bg-card transition-colors"
      >
        <span className="font-medium text-sm">{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

interface SliderFilterProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

function SliderFilter({ label, value, onChange, min, max }: SliderFilterProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm text-muted-foreground/70">{label}</label>
        <span className="text-sm font-mono text-emerald-400">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

interface StartupCardProps {
  startup: Startup;
}

function StartupCard({ startup }: StartupCardProps) {
  return (
    <div className="bg-[#111111] border border-border rounded-lg p-5 hover:border-border transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white text-lg mb-1">{startup.name}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-mono text-xs">
              {startup.sector}
            </span>
            <span className="text-muted-foreground/70 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {startup.region}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <MetricRow label="Readiness" value={startup.readinessScore} isScore />
        <MetricRow label="EVI" value={startup.executionVelocity} isScore />
        <MetricRow
          label="Revenue"
          value={`$${(startup.mrr / 1000).toFixed(0)}K MRR`}
          valueColor="text-emerald-400"
        />
        <MetricRow
          label="Risk Level"
          value={startup.riskLevel}
          valueColor={
            startup.riskLevel === 'low'
              ? 'text-emerald-400'
              : startup.riskLevel === 'moderate'
              ? 'text-amber-400'
              : 'text-red-400'
          }
        />
        <MetricRow label="Founder" value={startup.founderReliability} isScore />
      </div>

      <div className="flex gap-2">
        <Link
          to={`/investor/risk-radar/${startup.id}`}
          className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded transition-all text-center"
        >
          Analyze
        </Link>
        <button className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded transition-all flex items-center justify-center gap-1">
          <Eye className="w-4 h-4" />
          Watch
        </button>
        <Link
          to="/investor/allocation"
          className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded transition-all text-center"
        >
          Simulate
        </Link>
      </div>
    </div>
  );
}

function StartupListItem({ startup }: StartupCardProps) {
  return (
    <div className="bg-[#111111] border border-border rounded-lg p-5 hover:border-border transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 flex-1">
          <div className="min-w-48">
            <h3 className="font-semibold text-white mb-1">{startup.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-mono text-xs">
                {startup.sector}
              </span>
              <span className="text-muted-foreground/70">{startup.region}</span>
            </div>
          </div>

          <div className="flex gap-8 flex-1">
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70 mb-1">Readiness</p>
              <p className="text-lg font-bold font-mono text-emerald-400">{startup.readinessScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70 mb-1">EVI</p>
              <p className="text-lg font-bold font-mono text-purple-400">{startup.executionVelocity}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70 mb-1">Revenue</p>
              <p className="text-lg font-bold font-mono text-emerald-400">
                ${(startup.mrr / 1000).toFixed(0)}K
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground/70 mb-1">Risk</p>
              <p
                className={`text-sm font-medium capitalize ${
                  startup.riskLevel === 'low'
                    ? 'text-emerald-400'
                    : startup.riskLevel === 'moderate'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {startup.riskLevel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/investor/risk-radar/${startup.id}`}
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded transition-all"
          >
            Analyze
          </Link>
          <button className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded transition-all flex items-center gap-1">
            <Eye className="w-4 h-4" />
            Watch
          </button>
        </div>
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string | number;
  isScore?: boolean;
  valueColor?: string;
}

function MetricRow({ label, value, isScore, valueColor }: MetricRowProps) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground/70">{label}</span>
      <span className={`font-mono font-medium ${isScore ? 'text-white' : valueColor || 'text-white'} capitalize`}>
        {value}
      </span>
    </div>
  );
}
