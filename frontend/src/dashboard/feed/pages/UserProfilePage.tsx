import { useParams, Link } from 'react-router-dom';
import { MessageCircle, Share2, Mail, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { BackButton } from '../components/BackButton';

export function UserProfilePage() {
  const { userId } = useParams();

  // Mock user data
  const user = {
    id: userId,
    name: userId === 'me' ? 'Adaeze Okonkwo' : 'Kwame Mensah',
    role: 'Co-founder',
    category: userId === 'me' ? 'HealthTech' : 'FinTech',
    stage: userId === 'me' ? 'MVP' : 'Beta',
    gsis: userId === 'me' ? 68 : 74,
    location: userId === 'me' ? 'Lagos, Nigeria' : 'Lagos, Nigeria',
    joinedDate: 'Jan 2026',
    email: userId === 'me' ? 'adaeze@mediconnect.africa' : 'kwame@example.com',
    bio: userId === 'me'
      ? 'Building MediConnect Africa - Patient record management for rural clinics. Passionate about healthcare access and digital transformation in Africa. Former product manager at Flutterwave.'
      : 'Building payment infrastructure for rural Africa. Former Google engineer with 8 years of experience. Focused on financial inclusion.',
    website: userId === 'me' ? 'mediconnect.africa' : 'paymentapp.com',
    avatar: userId === 'me' ? 'from-score-green to-score-amber' : 'from-accent-primary to-score-blue',
    stats: {
      decay: 0.91,
      stageProgress: 42,
      posts: 12,
      answers: 8,
      connections: 24,
    },
    skills: userId === 'me'
      ? ['React', 'Node.js', 'Supabase', 'Mobile', 'Healthcare', 'B2B SaaS']
      : ['Python', 'Django', 'Mobile Money APIs', 'Fintech', 'Payment Systems'],
    recentActivity: [
      {
        id: '1',
        type: 'milestone',
        title: 'Shipped MVP with 50 beta users',
        date: '2 days ago',
      },
      {
        id: '2',
        type: 'post',
        title: 'Shared pricing insights from customer interviews',
        date: '5 days ago',
      },
      {
        id: '3',
        type: 'answer',
        title: 'Answered question about rural market validation',
        date: '1 week ago',
      },
    ],
  };

  const gsisColor = user.gsis > 70 ? 'score-green' : user.gsis > 60 ? 'score-amber' : 'score-red';
  const isOwnProfile = userId === 'me';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20 lg:pb-6">
      {/* Back Button */}
      {!isOwnProfile && <BackButton label="Back" className="mb-6" />}

      {/* Profile Header */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${user.avatar} flex-shrink-0`}></div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3">
              <div>
                <h1 className="text-2xl font-semibold text-text-primary mb-1">{user.name}</h1>
                <p className="text-text-secondary mb-2">
                  {user.role} · {user.category} · {user.stage} Stage
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {user.location}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Joined {user.joinedDate}
                  </div>
                  {user.website && (
                    <a
                      href={`https://${user.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-accent-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {user.website}
                    </a>
                  )}
                </div>
              </div>

              {/* GSIS Badge */}
              <div
                className="px-4 py-2 rounded-lg border text-center mt-4 md:mt-0"
                style={{
                  backgroundColor: `var(--${gsisColor})/15`,
                  borderColor: `var(--${gsisColor})`,
                }}
              >
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1">GSIS</p>
                <p
                  className="font-mono text-3xl font-bold"
                  style={{ color: `var(--${gsisColor})` }}
                >
                  {user.gsis}
                </p>
              </div>
            </div>

            {/* Bio */}
            <p className="text-sm text-text-primary leading-relaxed mb-4">{user.bio}</p>

            {/* Actions */}
            {!isOwnProfile && (
              <div className="flex gap-3">
                <button className="flex-1 md:flex-initial bg-accent-primary text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium">
                  Connect
                </button>
                <Link
                  to={`/feed/messages/${userId}`}
                  className="flex items-center justify-center gap-2 bg-bg-elevated border border-border-default text-text-primary px-6 py-2.5 rounded-lg hover:border-accent-primary hover:text-accent-primary transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </Link>
                <button className="flex items-center justify-center bg-bg-elevated border border-border-default text-text-secondary px-4 py-2.5 rounded-lg hover:border-accent-primary hover:text-accent-primary transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {isOwnProfile && (
              <div className="flex gap-3">
                <button className="bg-bg-elevated border border-border-default text-text-primary px-6 py-2.5 rounded-lg hover:border-accent-primary transition-colors font-medium">
                  Edit Profile
                </button>
                <Link
                  to="/feed/build-log"
                  className="flex items-center gap-2 bg-accent-primary text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  <Share2 className="w-4 h-4" />
                  Share Build Log
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-border-default">
          <StatCard label="Decay Factor" value="0.91" color="amber" />
          <StatCard label="Stage Progress" value="42%" color="blue" />
          <StatCard label="Posts" value={user.stats.posts.toString()} color="green" />
          <StatCard label="Answers" value={user.stats.answers.toString()} color="purple" />
          <StatCard label="Connections" value={user.stats.connections.toString()} color="blue" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <div className="bg-bg-surface border border-border-default rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {user.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-2"
                    style={{
                      backgroundColor:
                        activity.type === 'milestone'
                          ? 'var(--score-green)'
                          : activity.type === 'post'
                          ? 'var(--accent-primary)'
                          : 'var(--score-purple)',
                    }}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm text-text-primary font-medium mb-1">{activity.title}</p>
                    <p className="text-xs text-text-muted">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/feed/build-log"
              className="block text-center text-accent-primary text-sm hover:underline mt-4"
            >
              View Full Build Log →
            </Link>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Skills */}
          <div className="bg-bg-surface border border-border-default rounded-xl p-6">
            <h3 className="text-base font-semibold text-text-primary mb-4">Skills & Interests</h3>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-3 py-1.5 rounded-lg"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Contact */}
          {!isOwnProfile && (
            <div className="bg-bg-surface border border-border-default rounded-xl p-6">
              <h3 className="text-base font-semibold text-text-primary mb-4">Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <a
                    href={`mailto:${user.email}`}
                    className="text-accent-primary hover:underline"
                  >
                    {user.email}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'green' | 'amber' | 'blue' | 'purple';
}) {
  const colors = {
    green: 'var(--score-green)',
    amber: 'var(--score-amber)',
    blue: 'var(--accent-primary)',
    purple: 'var(--score-purple)',
  };

  return (
    <div className="text-center">
      <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="font-mono text-xl font-bold" style={{ color: colors[color] }}>
        {value}
      </p>
    </div>
  );
}
