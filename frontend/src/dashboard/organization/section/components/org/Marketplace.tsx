import {
  ShoppingBag,
  Search,
  Filter,
  Star,
  Download,
  TrendingUp,
  Zap,
  Shield,
  Plus,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

const featuredProducts = [
  {
    id: 1,
    name: "NeuralFlow AI Platform",
    vendor: "TechCore Labs",
    category: "AI/ML",
    description: "End-to-end ML pipeline automation and deployment",
    price: "$499/mo",
    rating: 4.9,
    reviews: 234,
    downloads: 1240,
    verified: true,
  },
  {
    id: 2,
    name: "ChainVault Security Suite",
    vendor: "SecureChain Inc",
    category: "Web3",
    description: "Enterprise-grade blockchain security and auditing",
    price: "$799/mo",
    rating: 4.8,
    reviews: 189,
    downloads: 890,
    verified: true,
  },
  {
    id: 3,
    name: "DataPulse Analytics",
    vendor: "Insight Systems",
    category: "Analytics",
    description: "Real-time data visualization and business intelligence",
    price: "$349/mo",
    rating: 4.7,
    reviews: 456,
    downloads: 2100,
    verified: true,
  },
  {
    id: 4,
    name: "CloudSync Pro",
    vendor: "SyncTech",
    category: "SaaS",
    description: "Multi-cloud data synchronization and backup",
    price: "$299/mo",
    rating: 4.6,
    reviews: 312,
    downloads: 1560,
    verified: false,
  },
];

const categories = [
  { name: "All Products", count: 127 },
  { name: "AI/ML", count: 34 },
  { name: "Web3", count: 28 },
  { name: "SaaS Tools", count: 45 },
  { name: "Analytics", count: 20 },
];

const partnerships = [
  {
    company: "TechCore Labs",
    type: "Technology Partner",
    since: "2025",
    projects: 12,
  },
  {
    company: "SecureChain Inc",
    type: "Security Partner",
    since: "2024",
    projects: 8,
  },
  {
    company: "Insight Systems",
    type: "Data Partner",
    since: "2025",
    projects: 15,
  },
];

const deployedSolutions = [
  {
    product: "NeuralFlow AI",
    project: "Project Alpha",
    status: "Active",
    usage: "High",
  },
  {
    product: "DataPulse Analytics",
    project: "Beta Commerce",
    status: "Active",
    usage: "Medium",
  },
  {
    product: "CloudSync Pro",
    project: "Gamma Analytics",
    status: "Active",
    usage: "Low",
  },
];

export function Marketplace() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground mt-2">
            Discover tools, solutions, and partnership opportunities
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" />
          List Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <ShoppingBag className="w-6 h-6 text-blue-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">127</p>
          <p className="text-sm text-muted-foreground mt-1">Available Products</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <Download className="w-6 h-6 text-green-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">5.8K</p>
          <p className="text-sm text-muted-foreground mt-1">Total Deployments</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <Star className="w-6 h-6 text-yellow-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">4.7</p>
          <p className="text-sm text-muted-foreground mt-1">Avg Rating</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <TrendingUp className="w-6 h-6 text-purple-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">23</p>
          <p className="text-sm text-muted-foreground mt-1">Active Partnerships</p>
        </div>
      </div>

      {/* Search and Categories */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search products, vendors, or categories..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filters</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.name}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                cat.name === "All Products"
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                  : "bg-background text-foreground hover:bg-muted/40"
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Featured Products</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {featuredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-background rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {product.name}
                    </h3>
                    {product.verified && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{product.vendor}</p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200">
                  {product.category}
                </span>
              </div>

              <p className="text-sm text-foreground mb-4">{product.description}</p>

              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold text-foreground">
                    {product.rating}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({product.reviews})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Download className="w-4 h-4" />
                  {product.downloads} deployments
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Starting at</p>
                  <p className="text-xl font-bold text-foreground">{product.price}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium">
                    Details
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    Deploy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Partnerships */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Active Partnerships</h2>
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-4">
            {partnerships.map((partner, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between pb-4 border-b border-border last:border-0"
              >
                <div>
                  <h4 className="font-medium text-foreground">{partner.company}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {partner.type} • Since {partner.since}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    {partner.projects}
                  </p>
                  <p className="text-xs text-muted-foreground">projects</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deployed Solutions */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Deployed Solutions</h2>
            <Zap className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-4">
            {deployedSolutions.map((solution, idx) => (
              <div
                key={idx}
                className="bg-background rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{solution.product}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{solution.project}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      solution.usage === "High"
                        ? "bg-green-50 text-green-700"
                        : solution.usage === "Medium"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-muted/40 text-foreground"
                    }`}
                  >
                    {solution.usage}
                  </span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
