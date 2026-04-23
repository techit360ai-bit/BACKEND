import { useState } from "react";
import { Link } from "react-router";
import { InvestorSidebar } from "@/dashboard/investors/components/InvestorSidebar";
import {
  Menu,
  X,
  Filter,
  Grid3x3,
  List,
  TrendingUp,
  Eye,
  LineChart,
  MapPin,
  DollarSign,
  Shield,
  ChevronDown,
} from "lucide-react";

interface Startup {
  id: string;
  name: string;
  sector: string;
  region: string;
  readinessScore: number;
  executionVelocity: number;
  mrr: number;
  riskLevel: "low" | "moderate" | "high";
  founderReliability: number;
  betaRetention: number;
  revenueGrowth: number;
  complianceVerified: boolean;
  burnEfficiency: number;
}

const mockStartups: Startup[] = [
  {
    id: "1",
    name: "QuantumAPI",
    sector: "SaaS",
    region: "North America",
    readinessScore: 86,
    executionVelocity: 79,
    mrr: 120000,
    riskLevel: "low",
    founderReliability: 91,
    betaRetention: 85,
    revenueGrowth: 22,
    complianceVerified: true,
    burnEfficiency: 3.2,
  },
  {
    id: "2",
    name: "NeuralEdge AI",
    sector: "AI/ML",
    region: "Europe",
    readinessScore: 92,
    executionVelocity: 88,
    mrr: 245000,
    riskLevel: "low",
    founderReliability: 94,
    betaRetention: 91,
    revenueGrowth: 38,
    complianceVerified: true,
    burnEfficiency: 2.8,
  },
  {
    id: "3",
    name: "FinFlow",
    sector: "FinTech",
    region: "Asia",
    readinessScore: 78,
    executionVelocity: 72,
    mrr: 68000,
    riskLevel: "moderate",
    founderReliability: 82,
    betaRetention: 76,
    revenueGrowth: 15,
    complianceVerified: false,
    burnEfficiency: 4.5,
  },
  {
    id: "4",
    name: "BioSynth",
    sector: "BioTech",
    region: "Europe",
    readinessScore: 84,
    executionVelocity: 76,
    mrr: 156000,
    riskLevel: "moderate",
    founderReliability: 87,
    betaRetention: 82,
    revenueGrowth: 28,
    complianceVerified: true,
    burnEfficiency: 5.1,
  },
  {
    id: "5",
    name: "CloudMesh",
    sector: "Infrastructure",
    region: "North America",
    readinessScore: 88,
    executionVelocity: 83,
    mrr: 198000,
    riskLevel: "low",
    founderReliability: 89,
    betaRetention: 88,
    revenueGrowth: 32,
    complianceVerified: true,
    burnEfficiency: 3.5,
  },
  {
    id: "6",
    name: "DataVault",
    sector: "Security",
    region: "Europe",
    readinessScore: 81,
    executionVelocity: 74,
    mrr: 92000,
    riskLevel: "moderate",
    founderReliability: 84,
    betaRetention: 79,
    revenueGrowth: 19,
    complianceVerified: false,
    burnEfficiency: 4.2,
  },
];

type ViewMode = "grid" | "list";

export function DealIntelligence() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minReadiness: 0,
    minExecutionVelocity: 0,
    minBetaRetention: 0,
    minRevenueGrowth: 0,
    complianceVerified: false,
    minFounderReliability: 0,
    region: "all",
    sector: "all",
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
    if (startup.founderReliability < filters.minFounderReliability)
      return false;
    if (filters.region !== "all" && startup.region !== filters.region)
      return false;
    if (filters.sector !== "all" && startup.sector !== filters.sector)
      return false;
    if (startup.burnEfficiency > filters.maxBurnEfficiency) return false;
    return true;
  });

  const toggleFilterSection = (section: keyof typeof expandedFilters) => {
    setExpandedFilters((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-row w-full">
      {/* Desktop Sidebar */}
      <div className="hidden xl:block w-64 shrink-0">
        <InvestorSidebar />
      </div>

      {/* Mobile Sidebar - Using InvestorSidebar component with mobile mode */}
      <InvestorSidebar
        isMobile={true}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0f1219] px-4 md:px-8 py-6 sticky top-0 z-30">
          <div className="flex items-start gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="xl:hidden p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0 mt-0.5"
            >
              {showSidebar ? (
                <X className="w-5 h-5 text-slate-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-slate-600 dark:text-gray-400" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                Deal Intelligence Engine
              </h1>
              <p className="text-slate-600 dark:text-gray-400 mt-1 text-sm md:text-base">
                Bloomberg Terminal for startup execution · Signal &gt; Noise
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden w-full">
          {/* Filter Sidebar - Desktop only */}
          <aside className="hidden md:flex md:w-80 md:flex-col bg-slate-50 dark:bg-[#0f1219] border-r border-slate-200 dark:border-gray-800 overflow-y-auto p-6 z-10">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Advanced Filters
              </h2>
            </div>

            <div className="space-y-4">
              {/* Execution Metrics */}
              <FilterSection
                title="Execution Metrics"
                isExpanded={expandedFilters.execution}
                onToggle={() => toggleFilterSection("execution")}
              >
                <SliderFilter
                  label="Market Readiness"
                  value={filters.minReadiness}
                  onChange={(value) =>
                    setFilters({ ...filters, minReadiness: value })
                  }
                  min={0}
                  max={100}
                />
                <SliderFilter
                  label="Execution Velocity"
                  value={filters.minExecutionVelocity}
                  onChange={(value) =>
                    setFilters({ ...filters, minExecutionVelocity: value })
                  }
                  min={0}
                  max={100}
                />
                <SliderFilter
                  label="Beta Retention %"
                  value={filters.minBetaRetention}
                  onChange={(value) =>
                    setFilters({ ...filters, minBetaRetention: value })
                  }
                  min={0}
                  max={100}
                />
                <SliderFilter
                  label="Revenue Growth %"
                  value={filters.minRevenueGrowth}
                  onChange={(value) =>
                    setFilters({ ...filters, minRevenueGrowth: value })
                  }
                  min={0}
                  max={100}
                />
              </FilterSection>

              {/* Risk Controls */}
              <FilterSection
                title="Risk Controls"
                isExpanded={expandedFilters.risk}
                onToggle={() => toggleFilterSection("risk")}
              >
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.complianceVerified}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          complianceVerified: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 focus:ring-offset-white dark:focus:ring-offset-gray-900"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-300">
                      Compliance Verified Only
                    </span>
                  </label>
                  <SliderFilter
                    label="Founder Reliability"
                    value={filters.minFounderReliability}
                    onChange={(value) =>
                      setFilters({ ...filters, minFounderReliability: value })
                    }
                    min={0}
                    max={100}
                  />
                  <SliderFilter
                    label="Max Burn Efficiency"
                    value={filters.maxBurnEfficiency}
                    onChange={(value) =>
                      setFilters({ ...filters, maxBurnEfficiency: value })
                    }
                    min={1}
                    max={10}
                  />
                </div>
              </FilterSection>

              {/* Behavioral Patterns */}
              <FilterSection
                title="Behavioral Patterns"
                isExpanded={expandedFilters.behavioral}
                onToggle={() => toggleFilterSection("behavioral")}
              >
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      Region
                    </label>
                    <select
                      value={filters.region}
                      onChange={(e) =>
                        setFilters({ ...filters, region: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">All Regions</option>
                      <option value="North America">North America</option>
                      <option value="Europe">Europe</option>
                      <option value="Asia">Asia</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      Sector
                    </label>
                    <select
                      value={filters.sector}
                      onChange={(e) =>
                        setFilters({ ...filters, sector: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    region: "all",
                    sector: "all",
                    maxBurnEfficiency: 10,
                  })
                }
                className="w-full py-2 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-900 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </aside>

          {/* Results Panel */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0a0a0a]">
            {/* Mobile Filter Panel - Shown inline on small screens */}
            {showFilters && (
              <div className="md:hidden bg-slate-50 dark:bg-[#0f1219] border-b border-slate-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex-1">
                    Advanced Filters
                  </h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Execution Metrics */}
                  <FilterSection
                    title="Execution Metrics"
                    isExpanded={expandedFilters.execution}
                    onToggle={() => toggleFilterSection("execution")}
                  >
                    <SliderFilter
                      label="Market Readiness"
                      value={filters.minReadiness}
                      onChange={(value) =>
                        setFilters({ ...filters, minReadiness: value })
                      }
                      min={0}
                      max={100}
                    />
                    <SliderFilter
                      label="Execution Velocity"
                      value={filters.minExecutionVelocity}
                      onChange={(value) =>
                        setFilters({ ...filters, minExecutionVelocity: value })
                      }
                      min={0}
                      max={100}
                    />
                    <SliderFilter
                      label="Beta Retention %"
                      value={filters.minBetaRetention}
                      onChange={(value) =>
                        setFilters({ ...filters, minBetaRetention: value })
                      }
                      min={0}
                      max={100}
                    />
                    <SliderFilter
                      label="Revenue Growth %"
                      value={filters.minRevenueGrowth}
                      onChange={(value) =>
                        setFilters({ ...filters, minRevenueGrowth: value })
                      }
                      min={0}
                      max={100}
                    />
                  </FilterSection>

                  {/* Risk Controls */}
                  <FilterSection
                    title="Risk Controls"
                    isExpanded={expandedFilters.risk}
                    onToggle={() => toggleFilterSection("risk")}
                  >
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.complianceVerified}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              complianceVerified: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 focus:ring-offset-white dark:focus:ring-offset-gray-900"
                        />
                        <span className="text-sm text-slate-700 dark:text-gray-300">
                          Compliance Verified Only
                        </span>
                      </label>
                      <SliderFilter
                        label="Founder Reliability"
                        value={filters.minFounderReliability}
                        onChange={(value) =>
                          setFilters({
                            ...filters,
                            minFounderReliability: value,
                          })
                        }
                        min={0}
                        max={100}
                      />
                      <SliderFilter
                        label="Max Burn Efficiency"
                        value={filters.maxBurnEfficiency}
                        onChange={(value) =>
                          setFilters({ ...filters, maxBurnEfficiency: value })
                        }
                        min={1}
                        max={10}
                      />
                    </div>
                  </FilterSection>

                  {/* Behavioral Patterns */}
                  <FilterSection
                    title="Behavioral Patterns"
                    isExpanded={expandedFilters.behavioral}
                    onToggle={() => toggleFilterSection("behavioral")}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-slate-700 dark:text-gray-400 mb-2 block">
                          Region
                        </label>
                        <select
                          value={filters.region}
                          onChange={(e) =>
                            setFilters({ ...filters, region: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="all">All Regions</option>
                          <option value="North America">North America</option>
                          <option value="Europe">Europe</option>
                          <option value="Asia">Asia</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-slate-700 dark:text-gray-400 mb-2 block">
                          Sector
                        </label>
                        <select
                          value={filters.sector}
                          onChange={(e) =>
                            setFilters({ ...filters, sector: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        region: "all",
                        sector: "all",
                        maxBurnEfficiency: 10,
                      })
                    }
                    className="w-full py-2 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-900 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="p-3 sm:p-4 md:p-8">
              {/* Top Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm">
                    Showing{" "}
                    <span className="text-slate-900 dark:text-white font-mono font-semibold">
                      {filteredStartups.length}
                    </span>{" "}
                    of{" "}
                    <span className="text-slate-900 dark:text-white font-mono font-semibold">
                      {mockStartups.length}
                    </span>{" "}
                    startups
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`md:hidden p-2 rounded-lg transition-colors ${
                      showFilters
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Toggle filters"
                  >
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "grid"
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Grid view"
                  >
                    <Grid3x3 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "list"
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="List view"
                  >
                    <List className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Results Grid/List */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStartups.map((startup) => (
                    <StartupCard key={startup.id} startup={startup} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredStartups.map((startup) => (
                    <StartupListItem key={startup.id} startup={startup} />
                  ))}
                </div>
              )}

              {filteredStartups.length === 0 && (
                <div className="text-center py-16">
                  <Filter className="w-12 h-12 text-slate-400 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    No startups match your filters
                  </h3>
                  <p className="text-slate-600 dark:text-gray-400">
                    Try adjusting your filter criteria
                  </p>
                </div>
              )}
            </div>
          </div>
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

function FilterSection({
  title,
  isExpanded,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <div className="border border-slate-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-gray-800/50 flex items-center justify-between text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-sm">{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      {isExpanded && (
        <div className="p-4 space-y-4 bg-slate-50 dark:bg-gray-800/30">
          {children}
        </div>
      )}
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
        <label className="text-sm text-slate-700 dark:text-gray-400">
          {label}
        </label>
        <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

interface StartupCardProps {
  startup: Startup;
}

function StartupCard({ startup }: StartupCardProps) {
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-gray-800 rounded-lg p-6 hover:border-slate-300 dark:hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-slate-200 dark:hover:shadow-gray-900/50">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-2 truncate">
          {startup.name}
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-semibold">
            {startup.sector}
          </span>
          <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {startup.region}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-3 mb-5 pb-5 border-b border-slate-200 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-gray-400">Readiness</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white">
            {startup.readinessScore}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-gray-400">EVI</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white">
            {startup.executionVelocity}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-gray-400">Revenue</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            ${(startup.mrr / 1000).toFixed(0)}K MRR
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-gray-400">Risk Level</span>
          <span
            className={`font-mono font-semibold capitalize ${
              startup.riskLevel === "low"
                ? "text-emerald-600 dark:text-emerald-400"
                : startup.riskLevel === "moderate"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {startup.riskLevel}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-gray-400">Founder</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white">
            {startup.founderReliability}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Link
          to={`/risk-radar/${startup.id}`}
          className="flex-1 py-2 bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded transition-all text-center"
        >
          Analyze
        </Link>
        <button className="flex-1 py-2 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded transition-all flex items-center justify-center gap-1">
          <Eye className="w-4 h-4" />
          Watch
        </button>
        <Link
          to="/allocation"
          className="flex-1 py-2 bg-purple-100 dark:bg-purple-500/10 hover:bg-purple-200 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-semibold rounded transition-all text-center"
        >
          Simulate
        </Link>
      </div>
    </div>
  );
}

function StartupListItem({ startup }: StartupCardProps) {
  return (
    <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-gray-800 rounded-lg p-4 hover:border-slate-300 dark:hover:border-gray-700 transition-all">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white text-base mb-2 truncate">
          {startup.name}
        </h3>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-semibold">
            {startup.sector}
          </span>
          <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {startup.region}
          </span>
        </div>
      </div>

      {/* Metrics Grid - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-gray-700">
        <div className="text-left">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">
            Readiness
          </p>
          <p className="text-sm sm:text-base font-mono font-semibold text-slate-900 dark:text-white">
            {startup.readinessScore}
          </p>
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">EVI</p>
          <p className="text-sm sm:text-base font-mono font-semibold text-slate-900 dark:text-white">
            {startup.executionVelocity}
          </p>
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">
            Revenue
          </p>
          <p className="text-sm sm:text-base font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            ${(startup.mrr / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">Risk</p>
          <p
            className={`text-sm font-semibold capitalize ${
              startup.riskLevel === "low"
                ? "text-emerald-600 dark:text-emerald-400"
                : startup.riskLevel === "moderate"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {startup.riskLevel}
          </p>
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">
            Founder
          </p>
          <p className="text-sm sm:text-base font-mono font-semibold text-slate-900 dark:text-white">
            {startup.founderReliability}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/risk-radar/${startup.id}`}
          className="flex-1 min-w-20 py-2 bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded transition-all text-center"
        >
          Analyze
        </Link>
        <button className="flex-1 min-w-20 py-2 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded transition-all flex items-center justify-center gap-1">
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Watch</span>
        </button>
        <Link
          to="/allocation"
          className="flex-1 min-w-20 py-2 bg-purple-100 dark:bg-purple-500/10 hover:bg-purple-200 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-semibold rounded transition-all text-center"
        >
          Simulate
        </Link>
      </div>
    </div>
  );
}
