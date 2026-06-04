import { useState, useEffect, useRef } from "react";
import { ArrowRight, Zap, ChevronDown, Boxes } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useActiveRoles } from "@/contexts/UserContext";
import "@/Landing.css";

interface RoleCard {
  key: string;
  emoji: string;
  iconBg: string;
  accentColor: string;
  tagline: string;
  features: string[];
  linkLabel: string;
}

interface FeedPost {
  initials: string;
  name: string;
  location: string;
  badge: string;
  badgeColor: string;
  text: string;
  likes: number;
  comments: number;
}

const ROLE_CARDS: RoleCard[] = [
  {
    key: "Founder",
    emoji: "🚀",
    iconBg: "linear-gradient(135deg, #7c3aed, #a855f7)",
    accentColor: "#a855f7",
    tagline:
      "Launch your startup, validate ideas with AI, find your dream team",
    features: [
      "AI Idea Evaluation",
      "Smart Team Matching",
      "Investor Connect",
      "Built-in Workspace",
    ],
    linkLabel: "Join as Founder",
  },
  {
    key: "Collaborator",
    emoji: "⚡",
    iconBg: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
    accentColor: "#06b6d4",
    tagline: "Join exciting startups, earn credits & equity, build your legacy",
    features: [
      "Skill-matched Opportunities",
      "Paid & Equity Deals",
      "Credibility Score",
      "In-platform Code Editor",
    ],
    linkLabel: "Join as Collaborator",
  },
  {
    key: "Investor",
    emoji: "💎",
    iconBg: "linear-gradient(135deg, #10b981, #06b6d4)",
    accentColor: "#10b981",
    tagline: "Discover pre-vetted startups, access AI-scored deal flow",
    features: [
      "AI-Scored Pipeline",
      "Direct Founder Access",
      "Portfolio Dashboard",
      "Deal Analytics",
    ],
    linkLabel: "Join as Investor",
  },
  {
    key: "Organisation",
    emoji: "🏢",
    iconBg: "linear-gradient(135deg, #f43f5e, #ec4899)",
    accentColor: "#f43f5e",
    tagline:
      "Post challenges, find tech talent, partner with builder community",
    features: [
      "Talent Marketplace",
      "Innovation Challenges",
      "Incubation Partnerships",
      "Brand Visibility",
    ],
    linkLabel: "Join as Organisation",
  },
];

const FEATURE_CARDS = [
  {
    emoji: "🧠",
    title: "AI Matching Engine",
    desc: "Our model analyzes skills, certifications, availability, risk appetite, and timezone to surface your most compatible collaborators.",
  },
  {
    emoji: "💻",
    title: "Web Code Editor",
    desc: "Full in-platform coding environment with Monaco Editor. Write, run, and collaborate on code without leaving TechIT Network.",
  },
  {
    emoji: "📡",
    title: "Social Feed",
    desc: "Post updates, share milestones, discover projects, and engage with the builder community. Built for builders, not vanity.",
  },
  {
    emoji: "⭐",
    title: "Credibility Score",
    desc: "Every shipped feature, delivered milestone, and positive review contributes to your transparent public trust score.",
  },
  {
    emoji: "🤝",
    title: "Paid Collaborations",
    desc: "Send paid or equity collaboration requests secured by the credit system. Founders set terms, collaborators negotiate.",
  },
  {
    emoji: "🔑",
    title: "Credit Economy",
    desc: "A fair economy built for builders. Earn credits by contributing, purchase bundles, or subscribe for unlimited access.",
  },
];

const FEED_POSTS: FeedPost[] = [
  {
    initials: "AK",
    name: "Amara Kone",
    location: "Lagos, NG",
    badge: "HIRING",
    badgeColor: "#7c3aed",
    text: "Just hit 500 beta signups for NeuralDocs 🎉 Looking for a senior React dev — equity + credits available.",
    likes: 48,
    comments: 12,
  },
  {
    initials: "MR",
    name: "Marcus Reid",
    location: "London, UK",
    badge: "OPEN",
    badgeColor: "#10b981",
    text: "Credibility score hit 94 🔥 Open to new paid collaborations. Node.js, React, ML integrations. DM or request.",
    likes: 31,
    comments: 7,
  },
  {
    initials: "VT",
    name: "Vikram Thakur",
    location: "Mumbai, IN",
    badge: "INVESTING",
    badgeColor: "#06b6d4",
    text: "Looking at early-stage FinTech & HealthTech in Africa & SE Asia. AI score above 80 gets my attention. Drop your pitch.",
    likes: 87,
    comments: 24,
  },
];

// Doubled so the CSS marquee loop is seamless (first half scrolls out, second half takes over)
const MARQUEE_ITEMS = [
  "AI-Powered Matching",
  "Global Founders Network",
  "Built-in Code Editor",
  "Social Feed",
  "Investor Connect",
  "Credibility Score",
  "Credit Economy",
  "AI-Powered Matching",
  "Global Founders Network",
  "Built-in Code Editor",
  "Social Feed",
  "Investor Connect",
  "Credibility Score",
  "Credit Economy",
];

function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Navbar({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  // Plugins & MCP is an owner/admin control panel — only surface the link to
  // workspace-owner personas (founder/org), matching the /plugins route guard.
  const { activeRoles } = useActiveRoles();
  const canAccessPlugins = activeRoles.has("founder") || activeRoles.has("org");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="landing-nav"
      style={{
        background: scrolled
          ? "var(--nav-bg-scrolled)"
          : "var(--nav-bg-default)",
        borderBottomColor: scrolled
          ? "var(--nav-border-scrolled)"
          : "var(--nav-border-default)",
        color: scrolled ? "#ffffff" : "var(--nav-text-default)",
      }}
    >
      {/* Logo mark + wordmark */}
      <div className="nav-logo">
        <div className="nav-logo-icon">
          <Zap size={18} color="white" />
        </div>
        <div>
          <div
            className="nav-logo-name"
            style={{ color: scrolled ? "#ffffff" : "var(--nav-text-default)" }}
          >
            TECHIT
          </div>
          <div
            className="nav-logo-sub"
            style={{
              color: scrolled
                ? "rgba(255,255,255,0.6)"
                : "var(--nav-text-secondary-default)",
            }}
          >
            NETWORK
          </div>
        </div>
      </div>

      {/* Centre links — hidden below 960px via media query */}
      <div className="nav-links">
        {["Features", "Roles", "Credits", "AI Matching"].map((item) => (
          <a
            key={item}
            href="#"
            className="nav-link"
            style={{
              color: scrolled
                ? "rgba(255,255,255,0.7)"
                : "var(--nav-text-secondary-default)",
            }}
          >
            {item}
          </a>
        ))}
      </div>

      {/* Sign In + Get Started */}
      <div className="nav-actions">
        {canAccessPlugins && (
          <Link
            to="/plugins"
            className="nav-plugins"
            aria-label="Open the Plugins & MCP control panel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              border: `1px solid ${scrolled ? "rgba(255,255,255,0.35)" : "rgba(99,102,241,0.35)"}`,
              background: scrolled ? "rgba(255,255,255,0.10)" : "rgba(99,102,241,0.08)",
              color: scrolled ? "#ffffff" : "#4f46e5",
              transition: "all 150ms ease",
            }}
          >
            <Boxes size={14} /> Plugins
          </Link>
        )}
        <Link
          to="/signin"
          className="nav-signin"
          style={{
            color: scrolled
              ? "rgba(255,255,255,0.7)"
              : "var(--nav-text-secondary-default)",
          }}
        >
          Sign In
        </Link>
        <button onClick={onGetStarted} className="nav-cta">
          Get Started <ArrowRight size={14} />
        </button>
      </div>
    </nav>
  );
}

function MarqueeTicker() {
  return (
    <div className="marquee-outer">
      <div className="marquee-track">
        {MARQUEE_ITEMS.map((item, i) => (
          <span key={i} className="marquee-item">
            <span className="marquee-dot">●</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const Landing = () => {
  // ── Celebration states
  // showRegistrationCelebration: fired by the navbar "Get Started" button only
  const [showRegistrationCelebration, setShowRegistrationCelebration] =
    useState(false);
  // Role-specific celebrations fired by each role card / the final CTA section
  const [showFounderCelebration, setShowFounderCelebration] = useState(false);
  const [showCollaboratorCelebration, setShowCollaboratorCelebration] =
    useState(false);
  const [showInvestorCelebration, setShowInvestorCelebration] = useState(false);
  const [showOrganizationCelebration, setShowOrganizationCelebration] =
    useState(false);

  const navigate = useNavigate();

  // Prevents double-triggering if the user clicks multiple cards quickly
  const isCelebrationActive = () =>
    showRegistrationCelebration ||
    showFounderCelebration ||
    showCollaboratorCelebration ||
    showInvestorCelebration ||
    showOrganizationCelebration;

  // ── Navbar "Get Started" handler
  // Shows "You're starting your registration process!" then navigates to /signup
  const handleGetStarted = () => {
    if (isCelebrationActive()) return;
    setShowRegistrationCelebration(true);
    setTimeout(() => {
      navigate("/signup", { state: { celebrate: true } });
      setShowRegistrationCelebration(false);
    }, 900);
  };

  // ── Role-card handlers ───────────────────────────────────────────────────────
  const handleFounderStart = () => {
    if (isCelebrationActive()) return;
    setShowFounderCelebration(true);
    setTimeout(() => {
      navigate("/signup", { state: { celebrate: true } });
      setShowFounderCelebration(false);
    }, 900);
  };

  const handleCollaboratorStart = () => {
    if (isCelebrationActive()) return;
    setShowCollaboratorCelebration(true);
    setTimeout(() => {
      navigate("/collaborator/setup", { state: { celebrate: true } });
      setShowCollaboratorCelebration(false);
    }, 900);
  };

  const handleInvestorStart = () => {
    if (isCelebrationActive()) return;
    setShowInvestorCelebration(true);
    setTimeout(() => {
      navigate("/investor/onboarding/step-1", { state: { celebrate: true } });
      setShowInvestorCelebration(false);
    }, 900);
  };

  const handleOrganizationStart = () => {
    if (isCelebrationActive()) return;
    setShowOrganizationCelebration(true);
    setTimeout(() => {
      navigate("/org/onboarding/step-1", { state: { celebrate: true } });
      setShowOrganizationCelebration(false);
    }, 900);
  };

  // Maps role key → handler so the role-card loop stays clean
  const getHandlerForRole = (key: string) => {
    switch (key) {
      case "Founder":
        return handleFounderStart;
      case "Collaborator":
        return handleCollaboratorStart;
      case "Investor":
        return handleInvestorStart;
      case "Organisation":
        return handleOrganizationStart;
      default:
        return handleFounderStart;
    }
  };

  return (
    <>
      {/* Navbar receives handleGetStarted — NOT handleFounderStart */}
      <Navbar onGetStarted={handleGetStarted} />

      <div
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflowX: "hidden",
          transition: "background-color 0.3s ease, color 0.3s ease",
        }}
      >
        {/* 
            HERO
            Full-viewport height. padding-bottom: 100px creates the gap
            between the "Join the Network" button and the stats card below.
        */}
        <section className="hero-section">
          <div className="hero-glow-purple" />
          <div className="hero-glow-cyan" />

          <div className="hero-inner">
            {/* Animated live badge */}
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Now live globally · 60+ countries · Growing fast
            </div>

            {/* Headline — each span is a block so it stacks vertically,
                and the nth-child delays stagger the fade-up animation */}
            <h1 className="hero-headline">
              <span
                className="hero-line"
                style={{ color: "var(--text-primary)" }}
              >
                Where Builders,
              </span>
              <span className="hero-line gradient-purple-cyan">
                Investors &
              </span>
              <span className="hero-line gradient-cyan-teal">Experts</span>
              <span
                className="hero-line"
                style={{ color: "var(--text-primary)" }}
              >
                Connect & Ship.
              </span>
            </h1>

            <p className="hero-subtext">
              TechIT Network is the global platform where founders find
              collaborators, investors discover deals, and tech experts build
              their legacy — powered by AI matching and a real credit economy.
            </p>

            {/* CTA buttons. The section's padding-bottom handles the gap below. */}
            <div className="hero-cta-row">
              <button className="btn-primary" onClick={handleGetStarted}>
                Join the Network <ArrowRight size={16} />
              </button>
              <button className="btn-ghost">
                Explore Roles <ChevronDown size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* STATS BAR:padding-top: 20px gives a small gap from the hero's bottom edge.*/}
        <Reveal>
          <div className="stats-wrapper">
            <div className="stats-grid">
              {[
                { value: "12K+", label: "Builders" },
                { value: "3.4K", label: "Projects Launched" },
                { value: "$2.1M", label: "Funded via Platform" },
                { value: "60+", label: "Countries" },
              ].map((stat) => (
                <div key={stat.label} className="stat-cell">
                  <div className="stat-value gradient-purple-cyan">
                    {stat.value}
                  </div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* MARQUEE TICKER*/}
        <MarqueeTicker />

        {/* 
            ROLES — "One Platform. Every Role."
            4 cols → 2 cols (tablet) → 1 col (mobile)
        */}
        <section className="section">
          <Reveal>
            <div className="section-header">
              <p className="section-label">// WHO IT'S FOR</p>
              <h2 className="section-title">One Platform. Every Role.</h2>
              <p
                className="section-sub"
                style={{ maxWidth: 420, margin: "14px auto 0" }}
              >
                Choose your path and switch anytime. TechIT Network adapts to
                how you build.
              </p>
            </div>
          </Reveal>

          <div className="max-w">
            <div className="roles-grid">
              {ROLE_CARDS.map((card, i) => (
                <Reveal key={card.key} delay={i * 70}>
                  <div className="role-card">
                    <div
                      className="role-icon"
                      style={{ background: card.iconBg }}
                    >
                      {card.emoji}
                    </div>
                    <h3 className="role-name">{card.key}</h3>
                    <p className="role-tagline">{card.tagline}</p>
                    <ul className="role-features">
                      {card.features.map((f) => (
                        <li key={f} className="role-feature-item">
                          <span
                            className="role-feature-dot"
                            style={{ background: card.accentColor }}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {/* Each card's handler is looked up from the map above */}
                    <button
                      className="role-cta"
                      style={{ color: card.accentColor }}
                      onClick={getHandlerForRole(card.key)}
                    >
                      {card.linkLabel} <ArrowRight size={13} />
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 
            FEATURES — "Everything You Need to Build"
            3 cols → 2 cols → 1 col
        */}
        <section className="section section-alt">
          <Reveal>
            <div className="section-header">
              <p className="section-label">// PLATFORM FEATURES</p>
              <h2 className="section-title">Everything You Need to Build</h2>
            </div>
          </Reveal>

          <div className="max-w">
            <div className="features-grid">
              {FEATURE_CARDS.map((card, i) => (
                <Reveal key={card.title} delay={i * 55}>
                  <div className="feature-card">
                    <div className="feature-emoji">{card.emoji}</div>
                    <h3 className="feature-title">{card.title}</h3>
                    <p className="feature-desc">{card.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/*SOCIAL FEED — "Build in Public. Connect in Real-Time." 2-col split → stacks on tablet/mobile*/}
        <section className="section">
          <div className="max-w">
            <div className="feed-layout">
              {/* Left — headline + tag pills */}
              <Reveal>
                <div>
                  <p className="section-label">// SOCIAL FEED</p>
                  <h2
                    className="section-title"
                    style={{ fontSize: "clamp(28px, 4vw, 52px)" }}
                  >
                    Build in Public. Connect in Real-Time.
                  </h2>
                  <p className="section-sub">
                    Post wins, seek feedback, share milestones. Send
                    collaboration requests — paid or free — directly from any
                    post or profile.
                  </p>
                  <div className="feed-tags">
                    {[
                      {
                        label: "⚡ PAID COLLAB",
                        bg: "rgba(124,58,237,0.18)",
                        border: "#7c3aed",
                      },
                      {
                        label: "🤝 FREE COLLAB",
                        bg: "rgba(234,179,8,0.14)",
                        border: "#eab308",
                      },
                      {
                        label: "🚀 HIRING",
                        bg: "rgba(236,72,153,0.14)",
                        border: "#ec4899",
                      },
                    ].map((tag) => (
                      <span
                        key={tag.label}
                        className="feed-tag"
                        style={{
                          background: tag.bg,
                          border: `1px solid ${tag.border}`,
                        }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>

              {/* Right — mock posts */}
              <div className="feed-posts">
                {FEED_POSTS.map((post, i) => (
                  <Reveal key={post.name} delay={i * 90}>
                    <div className="feed-post">
                      <div className="feed-post-header">
                        <div className="feed-post-meta">
                          <div className="feed-avatar">{post.initials}</div>
                          <div>
                            <div className="feed-post-name">{post.name}</div>
                            <div className="feed-post-location">
                              {post.location}
                            </div>
                          </div>
                        </div>
                        <span
                          className="feed-badge"
                          style={{
                            background: `${post.badgeColor}20`,
                            border: `1px solid ${post.badgeColor}`,
                            color: post.badgeColor,
                          }}
                        >
                          {post.badge}
                        </span>
                      </div>
                      <p className="feed-post-text">{post.text}</p>
                      <div className="feed-actions">
                        <span>❤️ {post.likes}</span>
                        <span>💬 {post.comments}</span>
                        <span className="feed-collab-btn">
                          <Zap size={12} /> Collaborate
                        </span>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/*CREDITS — "Power Your Growth With Credits" 2-col split → stacks on tablet/mobile*/}
        <section className="section section-alt">
          <div className="max-w">
            <div className="credits-layout">
              {/* Left — copy + pricing tiers */}
              <Reveal>
                <div>
                  <p className="section-label">// CREDIT ECONOMY</p>
                  <h2
                    className="section-title"
                    style={{ fontSize: "clamp(28px, 4vw, 50px)" }}
                  >
                    Power Your Growth With Credits
                  </h2>
                  <p className="section-sub">
                    A fair economy built for builders. Core features are always
                    free. Credits unlock the AI-powered premium features that
                    help you move faster.
                  </p>
                  <div className="pricing-tiers">
                    {[
                      {
                        emoji: "🆓",
                        name: "Starter — Free",
                        sub: "250 credits/month · Core features",
                        price: "$0",
                      },
                      {
                        emoji: "⚡",
                        name: "Pro Builder",
                        sub: "2,500 credits/month · Full AI suite",
                        price: "$19/mo",
                      },
                      {
                        emoji: "💎",
                        name: "Elite Network",
                        sub: "Unlimited credits · Investor access",
                        price: "$49/mo",
                      },
                    ].map((tier) => (
                      <div key={tier.name} className="pricing-tier">
                        <div className="pricing-tier-left">
                          <div className="pricing-tier-icon">{tier.emoji}</div>
                          <div>
                            <div className="pricing-tier-name">{tier.name}</div>
                            <div className="pricing-tier-sub">{tier.sub}</div>
                          </div>
                        </div>
                        <div className="pricing-tier-price gradient-purple-cyan">
                          {tier.price}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              {/* Right — live balance card */}
              <Reveal delay={110}>
                <div className="balance-card">
                  <div className="balance-label">YOUR BALANCE</div>
                  <div className="balance-amount gradient-purple-cyan">
                    1,250
                  </div>
                  {[
                    ["AI Matching (per search)", "50 credits"],
                    ["Idea AI Evaluation", "75 credits"],
                    ["Incubation Hub / month", "200 credits"],
                    ["Paid Collab Request", "25 credits"],
                    ["Priority Profile Boost", "100 credits"],
                  ].map(([label, cost]) => (
                    <div key={label} className="balance-row">
                      <span className="balance-row-label">{label}</span>
                      <span className="balance-row-cost">{cost}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/*FINAL CTA — "Ready to Build Something Real?"*/}
        <section className="section">
          <Reveal>
            <div className="cta-card">
              <div className="cta-star">✦</div>
              <h2 className="cta-title">Ready to Build Something Real?</h2>
              <p className="cta-sub">
                Join thousands of founders, collaborators, investors, and
                organisations already on TechIT Network.
              </p>

              {/* Role picker — each fires the right navigation handler */}
              <div className="cta-role-row">
                {[
                  {
                    emoji: "🚀",
                    label: "Founder",
                    handler: handleFounderStart,
                  },
                  {
                    emoji: "⚡",
                    label: "Collaborator",
                    handler: handleCollaboratorStart,
                  },
                  {
                    emoji: "💎",
                    label: "Investor",
                    handler: handleInvestorStart,
                  },
                  {
                    emoji: "🏢",
                    label: "Organisation",
                    handler: handleOrganizationStart,
                  },
                ].map((role) => (
                  <button
                    key={role.label}
                    className="cta-role-btn"
                    onClick={role.handler}
                  >
                    {role.emoji} {role.label}
                  </button>
                ))}
              </div>

              <button className="btn-primary" onClick={handleGetStarted}>
                Join TechIT Network <ArrowRight size={16} />
              </button>
            </div>
          </Reveal>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="max-w">
            <div className="footer-grid">
              {/* Brand */}
              <div>
                <div className="footer-brand-logo">
                  <div className="footer-brand-icon">
                    <Zap size={15} color="white" />
                  </div>
                  <span className="footer-brand-name">TECHIT NETWORK</span>
                </div>
                <p className="footer-brand-desc">
                  The global platform connecting tech founders, collaborators,
                  investors and organisations.
                </p>
              </div>

              <div>
                <div className="footer-col-label">PLATFORM</div>
                {[
                  "Features",
                  "AI Matching",
                  "Incubation Hub",
                  "Credit System",
                ].map((item) => (
                  <a key={item} href="#" className="footer-link">
                    {item}
                  </a>
                ))}
              </div>

              <div>
                <div className="footer-col-label">ROLES</div>
                {[
                  "Founders",
                  "Collaborators",
                  "Investors",
                  "Organisations",
                ].map((item) => (
                  <a key={item} href="#" className="footer-link">
                    {item}
                  </a>
                ))}
              </div>

              <div>
                <div className="footer-col-label">COMPANY</div>
                {["About", "Blog", "Privacy", "Terms"].map((item) => (
                  <a key={item} href="#" className="footer-link">
                    {item}
                  </a>
                ))}
              </div>
            </div>

            <div className="footer-bottom">
              <span className="footer-copy">
                © 2025 TechIT Network. Built for builders.
              </span>
              <span className="footer-version">v1.0.0 · Global</span>
            </div>
          </div>
        </footer>

        {/* 
            CELEBRATION OVERLAYS
            Each role card and the main "Get Started" button trigger a different overlay message, shown here.
        */}
        <CelebrationOverlay
          visible={showRegistrationCelebration}
          message="You're starting your registration process!"
          label="Registration Process"
        />
        <CelebrationOverlay
          visible={showFounderCelebration}
          message="You're starting your founder journey!"
          label="Founder Journey"
        />
        <CelebrationOverlay
          visible={showCollaboratorCelebration}
          message="You're starting your collaborator journey!"
          label="Collaborator Journey"
        />
        <CelebrationOverlay
          visible={showInvestorCelebration}
          message="You're starting your investor journey!"
          label="Investor Journey"
        />
        <CelebrationOverlay
          visible={showOrganizationCelebration}
          message="You're starting your organization journey!"
          label="Organization Journey"
        />
      </div>
      <ThemeToggle />
    </>
  );
};

export default Landing;
