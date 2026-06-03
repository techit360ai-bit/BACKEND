import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  MessageCircle,
  Share2,
  Bookmark,
  ArrowUp,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { ShareModal } from './ShareModal';

// ─── Milestone Card ────────────────────────────────────────────────────────────
export function MilestoneCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [fired, setFired] = useState(false);
  const [fireCount, setFireCount] = useState(23);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const toggleFire = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFired((f) => !f);
    setFireCount((c) => (fired ? c - 1 : c + 1));
  };
  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((b) => !b);
  };

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-score-green card-hover animate-slide-in group cursor-pointer"
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-score-green to-score-amber flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary">Adaeze Okonkwo</h4>
              <p className="text-xs text-text-secondary">Co-founder · HealthTech · MVP Stage</p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-2.5 py-1 rounded-md border text-xs font-mono mb-1"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderColor: 'var(--score-green)',
                color: 'var(--score-green)',
              }}
            >
              GSIS 68
            </div>
            <p className="text-text-muted text-xs">2h ago</p>
          </div>
        </div>

        <div>
          <div
            className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-2"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.10)', color: 'var(--score-green)' }}
          >
            🏆 MILESTONE HIT
          </div>
          <h3 className="text-[15px] font-medium text-text-primary mb-3">
            Shipped MVP — First 50 beta users onboarded across 3 clinics
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div
                className="px-2 py-1 rounded text-xs"
                style={{ backgroundColor: 'rgba(34,197,94,0.10)', color: 'var(--score-green)' }}
              >
                Idea ✓
              </div>
              <span className="text-text-muted">→</span>
              <div
                className="px-2 py-1 rounded text-xs"
                style={{ backgroundColor: 'rgba(34,197,94,0.10)', color: 'var(--score-green)' }}
              >
                Validation ✓
              </div>
              <span className="text-text-muted">→</span>
              <div
                className="px-2 py-1 rounded text-xs animate-pulse"
                style={{ backgroundColor: 'rgba(34,197,94,0.20)', color: 'var(--score-green)' }}
              >
                MVP ✓
              </div>
            </div>
            <div
              className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1"
              style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--score-green)' }}
            >
              <ArrowUp className="w-3 h-3" />+7 GSIS
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">Beta Users</p>
              <p className="font-mono text-[16px] font-semibold text-text-primary">50</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">MRR</p>
              <p className="font-mono text-[16px] font-semibold text-text-primary">$0</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">GSIS Delta</p>
              <p className="font-mono text-[16px] font-semibold text-score-green">+7</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">Days to Next</p>
              <p className="font-mono text-[16px] font-semibold text-text-primary">14</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFire}
              className="flex items-center gap-1.5 hover:scale-105 transition-all"
              style={{ color: fired ? 'var(--score-red)' : 'var(--text-secondary)' }}
            >
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">{fireCount}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">6 comments</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium">Share</span>
            </button>
            <button
              onClick={toggleBookmark}
              className="flex items-center gap-1.5 hover:scale-105 transition-all"
              style={{ color: bookmarked ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/feed/build-log'); }}
            className="text-accent-primary text-xs hover:underline"
          >
            View Build Log →
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="Shipped MVP — First 50 beta users onboarded across 3 clinics"
          postType="🏆 Milestone Hit"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Insight Card ──────────────────────────────────────────────────────────────
export function InsightCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [fired, setFired] = useState(false);
  const [fireCount, setFireCount] = useState(41);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const toggleFire = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFired((f) => !f);
    setFireCount((c) => (fired ? c - 1 : c + 1));
  };

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-accent-primary card-hover animate-slide-in cursor-pointer"
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-primary to-score-blue flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary">Kwame Mensah</h4>
              <p className="text-xs text-text-secondary">Co-founder · FinTech · Beta Stage · Lagos</p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-2.5 py-1 rounded-md border text-xs font-mono mb-1"
              style={{
                backgroundColor: 'rgba(34,197,94,0.15)',
                borderColor: 'var(--score-green)',
                color: 'var(--score-green)',
              }}
            >
              GSIS 74
            </div>
            <p className="text-text-muted text-xs">5h ago</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div
              className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase"
              style={{ backgroundColor: 'rgba(79,110,247,0.10)', color: 'var(--accent-primary)' }}
            >
              💡 INSIGHT
            </div>
            <div
              className="px-2 py-1 rounded text-[11px] font-mono"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
            >
              Quality 88
            </div>
          </div>
          <p className="text-sm text-text-primary leading-relaxed mb-3">
            Pricing lesson from 30 customer interviews in West Africa: Annual contracts closed 3×
            faster than monthly. Healthcare buyers want certainty, not flexibility.
          </p>
          <div className="flex flex-wrap gap-2">
            {['#pricing', '#b2b', '#healthtech'].map((tag) => (
              <span
                key={tag}
                className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFire}
              className="flex items-center gap-1.5 hover:scale-105 transition-all"
              style={{ color: fired ? 'var(--score-red)' : 'var(--text-secondary)' }}
            >
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">{fireCount}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">12 comments</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium">Share</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setBookmarked((b) => !b);
              }}
              className="flex items-center gap-1.5 hover:scale-105 transition-all"
              style={{ color: bookmarked ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
              <span className="text-xs font-medium">{bookmarked ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="Annual contracts closed 3× faster than monthly — pricing insight"
          postType="💡 Insight"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Collab Call Card ──────────────────────────────────────────────────────────
export function CollabCallCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [interested, setInterested] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-score-purple card-hover animate-slide-in cursor-pointer"
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-score-purple to-accent-primary flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary">Fatima Al-Hassan</h4>
              <p className="text-xs text-text-secondary">Co-founder · EdTech · Idea Stage</p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-2.5 py-1 rounded-md border text-xs font-mono mb-1"
              style={{
                backgroundColor: 'rgba(245,158,11,0.15)',
                borderColor: 'var(--score-amber)',
                color: 'var(--score-amber)',
              }}
            >
              GSIS 61
            </div>
            <p className="text-text-muted text-xs">1d ago</p>
          </div>
        </div>

        <div>
          <div
            className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-3"
            style={{ backgroundColor: 'rgba(168,85,247,0.10)', color: 'var(--score-purple)' }}
          >
            🤝 COLLAB CALL
          </div>
          <div className="mb-3">
            <p className="text-xs text-text-muted mb-2">Looking for:</p>
            <div
              className="inline-block px-3 py-1.5 rounded-full border text-sm"
              style={{
                backgroundColor: 'rgba(168,85,247,0.15)',
                borderColor: 'var(--score-purple)',
                color: 'var(--score-purple)',
              }}
            >
              Technical Co-founder
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs text-text-muted mb-2">Skills needed:</p>
            <div className="flex flex-wrap gap-2">
              {['React', 'Python', 'Mobile'].map((skill) => (
                <span
                  key={skill}
                  className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Your match:</span>
              <span className="font-mono text-sm font-semibold text-score-green">82%</span>
            </div>
            <div className="h-1 bg-bg-base rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-score-green rounded-full" style={{ width: '82%' }} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInterested((i) => !i);
            }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              backgroundColor: interested ? 'var(--score-green)' : 'var(--score-purple)',
            }}
          >
            {interested ? (
              <>
                <CheckCheck className="w-4 h-4" />
                Interest Sent!
              </>
            ) : (
              'Express Interest'
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
            className="p-2.5 rounded-lg border border-border-default text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="Looking for a Technical Co-founder — EdTech startup"
          postType="🤝 Collab Call"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Build Update Card ─────────────────────────────────────────────────────────
export function BuildUpdateCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [fired, setFired] = useState(false);
  const [fireCount, setFireCount] = useState(67);
  const [shareOpen, setShareOpen] = useState(false);

  const toggleFire = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFired((f) => !f);
    setFireCount((c) => (fired ? c - 1 : c + 1));
  };

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-score-amber card-hover animate-slide-in cursor-pointer"
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-score-amber to-score-red flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary">David Osei</h4>
              <p className="text-xs text-text-secondary">Founder · FinTech · Beta Stage</p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-2.5 py-1 rounded-md border text-xs font-mono mb-1"
              style={{
                backgroundColor: 'rgba(34,197,94,0.15)',
                borderColor: 'var(--score-green)',
                color: 'var(--score-green)',
              }}
            >
              GSIS 79
            </div>
            <p className="text-text-muted text-xs">3h ago</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase"
              style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: 'var(--score-amber)' }}
            >
              📊 BUILD UPDATE
            </div>
            <div className="flex items-center gap-1 text-score-green text-xs">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Platform Verified</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">Beta Users</p>
              <p className="font-mono text-[16px] font-semibold text-text-primary">247</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">MRR</p>
              <p className="font-mono text-[16px] font-semibold text-score-green">$3,200</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">Burn</p>
              <p className="font-mono text-[16px] font-semibold text-score-red">$4,100</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-muted text-[11px] mb-1">Runway</p>
              <p className="font-mono text-[16px] font-semibold text-score-amber">8mo</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFire}
              className="flex items-center gap-1.5 hover:scale-105 transition-all"
              style={{ color: fired ? 'var(--score-red)' : 'var(--text-secondary)' }}
            >
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">{fireCount}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">14 comments</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium">Share</span>
            </button>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/feed/build-log'); }}
            className="text-accent-primary text-xs hover:underline"
          >
            📈 See full Build Log
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="Build Update — 247 users · $3,200 MRR · 8mo runway"
          postType="📊 Build Update"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Problem Signal Card ───────────────────────────────────────────────────────
export function ProblemSignalCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [eyeCount, setEyeCount] = useState(18);
  const [watched, setWatched] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-score-red card-hover animate-slide-in cursor-pointer"
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="px-2 py-0.5 rounded text-[10px] font-medium uppercase"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--score-red)' }}
          >
            AI DISCOVERED
          </div>
          <p className="text-text-muted text-xs">Discussion active</p>
        </div>

        <div>
          <div
            className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: 'var(--score-red)' }}
          >
            🌍 PROBLEM SIGNAL
          </div>
          <h3 className="text-[15px] font-medium text-text-primary mb-3">
            Rural maternal mortality rate 3× urban average in West Africa
          </h3>
          <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
            <span>📍 West Africa</span>
            <span>·</span>
            <span>🏥 Health</span>
          </div>
          <div className="bg-bg-elevated rounded-lg p-2.5 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary">Impact Score:</span>
              <span className="font-mono text-sm font-semibold text-score-green">75/100</span>
            </div>
            <div className="h-1 bg-bg-base rounded-full overflow-hidden">
              <div className="h-full bg-score-green rounded-full" style={{ width: '75%' }} />
            </div>
          </div>
          <div
            className="inline-block px-2 py-1 rounded text-[11px] font-medium"
            style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--score-amber)' }}
          >
            🟠 HIGH PRIORITY
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border-default">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
            className="flex-1 text-accent-primary text-sm font-medium hover:underline text-left"
          >
            Explore Solutions →
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            Join Discussion
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
            className="p-2 rounded-lg border border-border-default text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setWatched((w) => !w);
              setEyeCount((c) => (watched ? c - 1 : c + 1));
            }}
            className="flex items-center gap-1.5 transition-all"
            style={{ color: watched ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          >
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">{eyeCount}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
            className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">23 comments</span>
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="Rural maternal mortality rate 3× urban average in West Africa"
          postType="🌍 Problem Signal"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Question Card ─────────────────────────────────────────────────────────────
export function QuestionCard({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div
        className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] card-hover animate-slide-in cursor-pointer"
        style={{ borderLeftColor: '#EC4899' }}
        onClick={() => navigate(`/feed/post/${postId}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text-primary">Chioma Eze</h4>
              <p className="text-xs text-text-secondary">Founder · AgriTech · Validation Stage</p>
            </div>
          </div>
          <p className="text-text-muted text-xs">6h ago</p>
        </div>

        <div>
          <div
            className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-3"
            style={{ backgroundColor: 'rgba(236,72,153,0.10)', color: '#EC4899' }}
          >
            ❓ QUESTION
          </div>
          <h3 className="text-[15px] font-medium text-text-primary mb-3">
            How do you validate demand in rural markets with limited internet access?
          </h3>
          <div className="bg-bg-elevated rounded-lg p-3 mb-3">
            <p className="text-xs text-text-secondary">
              <span className="font-medium">Stage:</span> Validation ·{' '}
              <span className="font-medium">Industry:</span> AgriTech ·{' '}
              <span className="font-medium">Stack:</span> React/Node.js
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#EC4899' }}>
            <span>🚀</span>
            <span className="bg-gradient-to-r from-accent-primary to-score-purple bg-clip-text text-transparent font-medium">
              AI routing to 3 experts
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
              className="flex items-center gap-1.5 text-text-secondary hover:scale-105 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">8 answers</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
              className="flex items-center gap-1.5 text-text-secondary hover:text-accent-primary hover:scale-105 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium">Share</span>
            </button>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/feed/post/${postId}`); }}
            className="text-sm font-medium hover:underline"
            style={{ color: '#EC4899' }}
          >
            Answer this question →
          </button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          postId={postId}
          postTitle="How do you validate demand in rural markets with limited internet access?"
          postType="❓ Question"
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
