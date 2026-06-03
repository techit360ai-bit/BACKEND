import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightPanel } from '../components/RightPanel';
import { BackButton } from '../components/BackButton';

export function TribePage() {
  const tribeMembers = [
    {
      id: '1',
      name: 'Kwame Mensah',
      role: 'Co-founder',
      category: 'FinTech',
      stage: 'Beta',
      gsis: 74,
      location: 'Lagos, Nigeria',
      bio: 'Building payment infrastructure for rural Africa. Former Google engineer.',
      matchScore: 85,
      commonInterests: ['B2B', 'FinTech', 'Africa'],
      avatar: 'from-accent-primary to-score-blue',
    },
    {
      id: '2',
      name: 'Chioma Eze',
      role: 'Founder',
      category: 'AgriTech',
      stage: 'MVP',
      gsis: 71,
      location: 'Nairobi, Kenya',
      bio: 'Connecting smallholder farmers to markets. Solving post-harvest losses.',
      matchScore: 78,
      commonInterests: ['AgriTech', 'Supply Chain', 'Impact'],
      avatar: 'from-score-green to-score-amber',
    },
    {
      id: '3',
      name: 'David Osei',
      role: 'Founder',
      category: 'FinTech',
      stage: 'Beta',
      gsis: 79,
      location: 'Accra, Ghana',
      bio: 'Mobile money for the unbanked. 247 beta users, $3.2k MRR.',
      matchScore: 92,
      commonInterests: ['FinTech', 'Mobile', 'B2C'],
      avatar: 'from-score-amber to-score-red',
    },
    {
      id: '4',
      name: 'Fatima Al-Hassan',
      role: 'Co-founder',
      category: 'EdTech',
      stage: 'Idea',
      gsis: 61,
      location: 'Cairo, Egypt',
      bio: 'Personalized learning for MENA region. Looking for technical co-founder.',
      matchScore: 82,
      commonInterests: ['EdTech', 'AI/ML', 'Education'],
      avatar: 'from-score-purple to-accent-primary',
    },
    {
      id: '5',
      name: 'Tunde Balogun',
      role: 'Founder',
      category: 'CleanTech',
      stage: 'Validation',
      gsis: 65,
      location: 'Lagos, Nigeria',
      bio: 'Solar energy solutions for off-grid communities. Validated with 50 customers.',
      matchScore: 70,
      commonInterests: ['CleanTech', 'Impact', 'Hardware'],
      avatar: 'from-green-500 to-blue-500',
    },
    {
      id: '6',
      name: 'Amara Nwosu',
      role: 'Co-founder',
      category: 'HealthTech',
      stage: 'MVP',
      gsis: 68,
      location: 'Kampala, Uganda',
      bio: 'Telemedicine platform for rural healthcare access. Same space as you!',
      matchScore: 95,
      commonInterests: ['HealthTech', 'Telemedicine', 'MVP'],
      avatar: 'from-pink-500 to-purple-500',
    },
  ];

  return (
    <div className="flex pb-14 lg:pb-0">
      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:max-w-[720px] lg:mx-auto w-full">
        {/* Header */}
        <div className="sticky top-14 bg-bg-surface border-b border-border-default px-6 py-4 z-40">
          <BackButton className="mb-3" />
          <h1 className="text-xl font-semibold text-text-primary mb-1">Your Tribe</h1>
          <p className="text-sm text-text-secondary">
            Connect with {tribeMembers.length} founders matched to your journey
          </p>
        </div>

        {/* Tribe Grid */}
        <div className="px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {tribeMembers.map((member) => (
            <TribeMemberCard key={member.id} member={member} />
          ))}
        </div>
      </main>

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}

function TribeMemberCard({ member }: { member: any }) {
  const gsisColor =
    member.gsis > 70 ? 'score-green' : member.gsis > 60 ? 'score-amber' : 'score-red';

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 card-hover animate-slide-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/feed/profile/${member.id}`}>
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${member.avatar} cursor-pointer hover:scale-105 transition-transform`}></div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/feed/profile/${member.id}`}>
            <h3 className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors">
              {member.name}
            </h3>
          </Link>
          <p className="text-xs text-text-secondary">
            {member.role} · {member.category} · {member.stage}
          </p>
          <p className="text-xs text-text-muted">{member.location}</p>
        </div>
        <div className="text-right">
          <div
            className="inline-block px-2 py-1 rounded-md border text-xs font-mono mb-1"
            style={{
              backgroundColor: `var(--${gsisColor})/15`,
              borderColor: `var(--${gsisColor})`,
              color: `var(--${gsisColor})`,
            }}
          >
            {member.gsis}
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-xs text-text-secondary leading-relaxed mb-3">{member.bio}</p>

      {/* Match Score */}
      <div
        className="bg-bg-elevated rounded-lg p-2.5 mb-3"
        style={{
          backgroundColor:
            member.matchScore > 90
              ? 'rgba(34, 197, 94, 0.08)'
              : member.matchScore > 80
              ? 'rgba(79, 110, 247, 0.08)'
              : 'rgba(245, 158, 11, 0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-secondary">Match Score</span>
          <span
            className="font-mono text-sm font-semibold"
            style={{
              color:
                member.matchScore > 90
                  ? 'var(--score-green)'
                  : member.matchScore > 80
                  ? 'var(--accent-primary)'
                  : 'var(--score-amber)',
            }}
          >
            {member.matchScore}%
          </span>
        </div>
        <div className="h-1 bg-bg-base rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${member.matchScore}%`,
              backgroundColor:
                member.matchScore > 90
                  ? 'var(--score-green)'
                  : member.matchScore > 80
                  ? 'var(--accent-primary)'
                  : 'var(--score-amber)',
            }}
          ></div>
        </div>
      </div>

      {/* Common Interests */}
      <div className="flex flex-wrap gap-2 mb-3">
        {member.commonInterests.map((interest: string) => (
          <span
            key={interest}
            className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded"
          >
            #{interest.toLowerCase().replace(/\s+/g, '')}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="flex-1 bg-accent-primary text-white text-sm font-medium py-2 rounded-lg hover:opacity-90 transition-opacity">
          Connect
        </button>
        <Link
          to={`/feed/messages/${member.id}`}
          className="flex items-center justify-center bg-bg-elevated border border-border-default text-text-secondary px-4 py-2 rounded-lg hover:border-accent-primary hover:text-accent-primary transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
