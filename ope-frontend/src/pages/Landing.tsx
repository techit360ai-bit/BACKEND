import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Zap, Users, TrendingUp, Shield, Code2, Sparkles, ChevronDown, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { id: 'founder', label: 'Founder', color: 'from-violet-500 to-purple-600', desc: 'Launch startups, validate ideas with AI, find your dream team.', features: ['AI Idea Evaluation', 'Smart Team Matching', 'Investor Connect', 'Built-in Workspace'] },
  { id: 'collaborator', label: 'Collaborator', color: 'from-cyan-500 to-blue-600', desc: 'Join exciting startups, earn credits and equity, build your reputation.', features: ['Skill-matched Opportunities', 'Paid & Equity Deals', 'Credibility Score', 'Code Editor'] },
  { id: 'investor', label: 'Investor', color: 'from-teal-500 to-emerald-600', desc: 'Discover pre-vetted startups with AI-scored deal flow.', features: ['AI-Scored Pipeline', 'Direct Founder Access', 'Portfolio Dashboard', 'Deal Analytics'] },
  { id: 'organisation', label: 'Organisation', color: 'from-rose-500 to-pink-600', desc: 'Find tech talent, post innovation challenges, partner with builders.', features: ['Talent Marketplace', 'Innovation Challenges', 'Incubation Partnerships', 'Brand Visibility'] },
]

const STATS = [
  { value: '12K+', label: 'Builders' },
  { value: '3.4K', label: 'Projects' },
  { value: '$2.1M', label: 'Funded' },
  { value: '60+', label: 'Countries' },
]

const FEATURES = [
  { icon: Sparkles, title: 'AI Matching Engine', desc: 'Analyzes skills, certifications, availability, and working style to surface the most compatible collaborators.' },
  { icon: Code2, title: 'Web Code Editor', desc: 'Full in-platform coding environment. Write and collaborate on code without leaving TechIT Network.' },
  { icon: TrendingUp, title: 'Social Feed', desc: 'Post updates, share milestones, discover projects, and engage with the builder community.' },
  { icon: Star, title: 'Credibility Score', desc: 'Every delivered milestone and positive review contributes to your transparent public trust score.' },
  { icon: Users, title: 'Paid Collaborations', desc: 'Send paid or equity collaboration requests secured by the credit system.' },
  { icon: Shield, title: 'Credit Economy', desc: 'A fair economy built for builders. Earn credits by contributing or purchase bundles.' },
]

const ROLE_DASHBOARD: Record<string, string> = {
  founder: '/dashboard', collaborator: '/collaborator/dashboard',
  investor: '/investor/dashboard', organisation: '/org/dashboard',
}

export default function Landing() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [activeRole, setActiveRole] = useState(0)

  useEffect(() => {
    if (user && profile) {
      navigate(profile.isOnboarded ? (ROLE_DASHBOARD[profile.role] ?? '/dashboard') : `/${profile.role}/setup`, { replace: true })
    }
  }, [user, profile, navigate])

  useEffect(() => {
    const id = setInterval(() => setActiveRole(r => (r + 1) % ROLES.length), 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] overflow-x-hidden">
      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="orb orb-violet w-[600px] h-[600px] top-[-200px] left-[-100px]" />
        <div className="orb orb-cyan w-[500px] h-[500px] top-[40%] right-[-150px]" />
        <div className="orb orb-teal w-[400px] h-[400px] bottom-0 left-[30%]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 py-4 bg-[color:var(--background)]/70 backdrop-blur-xl border-b border-[color:var(--border)]/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-none">TECHIT</div>
            <div className="font-mono text-[0.55rem] text-[color:var(--primary)] leading-none mt-0.5 tracking-widest">NETWORK</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Roles', 'Credits'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors font-medium">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors px-3 py-1.5">Sign In</Link>
          <Link to="/signup" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[color:var(--primary)] to-blue-400 text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-all">
            Get Started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/8 text-[color:var(--primary)] text-sm font-medium mb-6">
          <span className="h-2 w-2 rounded-full bg-[color:var(--primary)] animate-pulse" />
          Live globally across 60+ countries
        </div>
        <h1 className="font-bold text-5xl sm:text-6xl lg:text-8xl leading-[0.92] tracking-[-3px] max-w-5xl mb-6">
          <span className="block text-[color:var(--foreground)]">Where Builders,</span>
          <span className="block gradient-text">Investors & Experts</span>
          <span className="block text-[color:var(--foreground)]">Connect & Ship.</span>
        </h1>
        <p className="text-lg sm:text-xl text-[color:var(--muted-foreground)] max-w-2xl mx-auto leading-relaxed mb-10">
          The global platform where founders find collaborators, investors discover deals, and tech experts build their legacy — powered by AI matching.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] via-blue-500 to-blue-400 text-white text-base font-bold shadow-2xl hover:opacity-95 hover:scale-[1.02] transition-all">
            Join the Network <ArrowRight className="h-5 w-5" />
          </Link>
          <a href="#roles" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 text-[color:var(--foreground)] text-base font-medium hover:bg-[color:var(--muted)] transition-all">
            Explore Roles <ChevronDown className="h-4 w-4" />
          </a>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[color:var(--border)] rounded-2xl overflow-hidden border border-[color:var(--border)] max-w-2xl w-full mx-auto">
          {STATS.map(({ value, label }) => (
            <div key={label} className="bg-[color:var(--card)] px-6 py-5 text-center">
              <div className="font-bold text-2xl gradient-text">{value}</div>
              <div className="text-xs text-[color:var(--muted-foreground)] mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest mb-4">Who It's For</div>
          <h2 className="font-bold text-4xl lg:text-5xl leading-tight tracking-tight mb-4">One Platform. Every Role.</h2>
          <p className="text-[color:var(--muted-foreground)] text-lg max-w-xl mx-auto">Choose your path and switch anytime.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map((role, i) => (
            <div key={role.id} onClick={() => setActiveRole(i)}
              className={`relative rounded-2xl border p-6 cursor-pointer transition-all duration-300 ${activeRole === i ? 'border-[color:var(--primary)]/50 bg-[color:var(--primary)]/5 shadow-lg' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/30'}`}>
              {activeRole === i && <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-[color:var(--primary)] to-transparent" />}
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${role.color} mb-4`} />
              <h3 className="font-bold text-lg mb-2">{role.label}</h3>
              <p className="text-sm text-[color:var(--muted-foreground)] mb-4 leading-relaxed">{role.desc}</p>
              <ul className="space-y-2">
                {role.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                    <span className="h-1 w-1 rounded-full bg-[color:var(--primary)] flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link to={`/signup?role=${role.id}`} className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--primary)] hover:underline">
                Join as {role.label} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6 bg-[color:var(--card)]/30 border-y border-[color:var(--border)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest mb-4">Platform Features</div>
            <h2 className="font-bold text-4xl lg:text-5xl tracking-tight">Everything You Need to Build</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[color:var(--border)] rounded-2xl overflow-hidden border border-[color:var(--border)]">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="bg-[color:var(--card)] p-8 hover:bg-[color:var(--muted)]/30 transition-colors group">
                <div className="h-10 w-10 rounded-xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center mb-4 group-hover:bg-[color:var(--primary)]/15 transition-colors">
                  <f.icon className="h-5 w-5 text-[color:var(--primary)]" />
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credits */}
      <section id="credits" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest mb-4">Credit Economy</div>
            <h2 className="font-bold text-4xl tracking-tight mb-4">Power Your Growth With Credits</h2>
            <p className="text-[color:var(--muted-foreground)] text-base leading-relaxed mb-8">A fair economy built for builders. Core features are free. Credits unlock AI-powered premium features.</p>
            <div className="space-y-3">
              {[
                { label: 'Starter — Free', desc: '250 credits · Core features', price: '$0', highlight: false },
                { label: 'Pro Builder', desc: '2,500 credits/month · Full AI suite', price: '$19/mo', highlight: true },
                { label: 'Elite Network', desc: 'Unlimited credits · Investor access', price: '$49/mo', highlight: false },
              ].map(tier => (
                <div key={tier.label} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${tier.highlight ? 'border-[color:var(--primary)]/40 bg-[color:var(--primary)]/5' : 'border-[color:var(--border)] bg-[color:var(--card)]'}`}>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{tier.label}</div>
                    <div className="text-xs text-[color:var(--muted-foreground)]">{tier.desc}</div>
                  </div>
                  <div className="font-mono font-semibold text-[color:var(--primary)] text-sm">{tier.price}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--primary)]/20 bg-gradient-to-br from-[color:var(--primary)]/10 to-blue-500/5 p-8">
            <div className="font-mono text-xs text-[color:var(--muted-foreground)] uppercase tracking-widest mb-2">Credit Costs</div>
            <div className="font-bold text-5xl gradient-text mb-6">250 free</div>
            <div className="space-y-3">
              {[['AI Collaborator Matching','50 cr'],['Idea AI Evaluation','75 cr'],['Incubation Hub/month','200 cr'],['Paid Collab Request','25 cr'],['Priority Profile Boost','100 cr']].map(([action, cost]) => (
                <div key={action} className="flex justify-between items-center py-2.5 border-b border-[color:var(--border)]/50 last:border-0">
                  <span className="text-sm text-[color:var(--muted-foreground)]">{action}</span>
                  <span className="font-mono text-xs text-[color:var(--primary)] font-medium">{cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 bg-[color:var(--card)]/30 border-t border-[color:var(--border)]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl border border-[color:var(--primary)]/20 bg-gradient-to-br from-[color:var(--primary)]/10 via-blue-500/5 to-transparent p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-[color:var(--primary)] to-transparent" />
            <h2 className="font-bold text-4xl lg:text-5xl tracking-tight mb-4">Ready to Build Something Real?</h2>
            <p className="text-[color:var(--muted-foreground)] text-lg mb-8">Join thousands of founders, collaborators, investors, and organisations already building on TechIT Network.</p>
            <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-blue-400 text-white font-bold text-base shadow-2xl hover:opacity-95 hover:scale-[1.02] transition-all">
              Join TechIT Network <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[color:var(--border)] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-sm">TECHIT NETWORK</span>
            </div>
            <p className="text-sm text-[color:var(--muted-foreground)] max-w-xs leading-relaxed">Global platform connecting tech founders, collaborators, investors and organisations.</p>
          </div>
          {[
            { title: 'Platform', links: ['Features', 'AI Matching', 'Incubation Hub', 'Credits'] },
            { title: 'Roles', links: ['Founders', 'Collaborators', 'Investors', 'Organisations'] },
            { title: 'Company', links: ['About', 'Privacy Policy', 'Terms of Service'] },
          ].map(group => (
            <div key={group.title}>
              <h5 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)] mb-4">{group.title}</h5>
              <ul className="space-y-2.5">
                {group.links.map(link => <li key={link}><a href="#" className="text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">{link}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[color:var(--border)] flex justify-between items-center text-xs text-[color:var(--muted-foreground)]">
          <span>© 2025 TechIT Network. All rights reserved.</span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}
