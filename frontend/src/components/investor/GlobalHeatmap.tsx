import { useState } from 'react';
import { mockStartups } from '../../data/mockData';
import { Globe, Filter, MapPin, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';

export function GlobalHeatmap() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('all');

  const regions = [
    { name: 'North America', startups: mockStartups.filter(s => s.region === 'North America').length, avgReadiness: 84, color: 'text-emerald-400' },
    { name: 'Europe', startups: mockStartups.filter(s => s.region === 'Europe').length, avgReadiness: 86, color: 'text-blue-400' },
    { name: 'Asia', startups: mockStartups.filter(s => s.region === 'Asia').length, avgReadiness: 78, color: 'text-purple-400' },
  ];

  const sectors = ['all', 'SaaS', 'AI/ML', 'FinTech', 'BioTech', 'Infrastructure', 'Security'];

  const filteredStartups = mockStartups.filter(startup => {
    if (selectedRegion && startup.region !== selectedRegion) return false;
    if (selectedSector !== 'all' && startup.sector !== selectedSector) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111111] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Global Startup Heatmap</h1>
        <p className="text-gray-400 mt-1">
          Track innovation acceleration across regions and sectors
        </p>
      </div>

      <div className="p-8">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter by:</span>
          </div>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-4 py-2 bg-[#111111] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {sectors.map(sector => (
              <option key={sector} value={sector}>
                {sector === 'all' ? 'All Sectors' : sector}
              </option>
            ))}
          </select>
        </div>

        {/* Heatmap Visual */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Regional Distribution</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {regions.map((region) => (
              <button
                key={region.name}
                onClick={() => setSelectedRegion(selectedRegion === region.name ? null : region.name)}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedRegion === region.name
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-800 bg-gray-800/30 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl font-semibold text-white">{region.name}</h4>
                  <MapPin className={`w-6 h-6 ${region.color}`} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Startups</span>
                    <span className="text-2xl font-bold font-mono text-white">{region.startups}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Avg Readiness</span>
                    <span className={`text-2xl font-bold font-mono ${region.color}`}>{region.avgReadiness}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                      style={{ width: `${region.avgReadiness}%` }}
                    ></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sector Growth Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Sector Growth Patterns</h3>
            <div className="space-y-3">
              {['SaaS', 'AI/ML', 'FinTech', 'BioTech', 'Infrastructure', 'Security'].map((sector) => {
                const sectorStartups = mockStartups.filter(s => s.sector === sector);
                const avgGrowth = sectorStartups.reduce((acc, s) => acc + s.revenueGrowth, 0) / sectorStartups.length;
                return (
                  <div key={sector} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-white font-medium">{sector}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{sectorStartups.length} startups</span>
                      <div className="flex items-center gap-1 text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-mono text-sm">+{avgGrowth.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Compliance Readiness by Region</h3>
            <div className="space-y-4">
              {regions.map((region) => {
                const regionStartups = mockStartups.filter(s => s.region === region.name);
                const compliantCount = regionStartups.filter(s => s.complianceVerified).length;
                const complianceRate = (compliantCount / regionStartups.length) * 100;
                
                return (
                  <div key={region.name}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white">{region.name}</span>
                      <span className="text-sm font-mono text-emerald-400">{complianceRate.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${complianceRate}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filtered Startups List */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedRegion ? `Startups in ${selectedRegion}` : 'All Startups'} 
            {selectedSector !== 'all' && ` - ${selectedSector}`}
            <span className="ml-2 text-gray-400 font-normal">({filteredStartups.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStartups.map((startup) => (
              <Link
                key={startup.id}
                to={`/risk-radar/${startup.id}`}
                className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {startup.name}
                    </h4>
                    <p className="text-sm text-gray-400">{startup.sector}</p>
                  </div>
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Readiness</span>
                    <span className="font-mono text-emerald-400">{startup.readinessScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Revenue</span>
                    <span className="font-mono text-white">${(startup.mrr / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Risk</span>
                    <span className={`capitalize ${
                      startup.riskLevel === 'low'
                        ? 'text-emerald-400'
                        : startup.riskLevel === 'moderate'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}>
                      {startup.riskLevel}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
