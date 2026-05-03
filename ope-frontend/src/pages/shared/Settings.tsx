import { useState, useEffect } from 'react'
import { User, Lock, Shield, Palette, ChevronRight, Check, AlertCircle, Sun, Moon, Rocket, Zap, TrendingUp, Building2 } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Input, Avatar, Progress } from '../../components/ui'
import { useAuth, type Role } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { cn, avatarGradient, initials, roleColor } from '../../lib/utils'

const TABS = [
  { id: 'profile',    label: 'Profile',    Icon: User },
  { id: 'security',   label: 'Security',   Icon: Lock },
  { id: 'role',       label: 'Role',       Icon: Shield },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
]

const ROLES: { id: Role; label: string; Icon: React.ComponentType<{className?:string}>; desc: string }[] = [
  { id: 'founder',      label: 'Founder',      Icon: Rocket,    desc: 'Launch startups and find your team' },
  { id: 'collaborator', label: 'Collaborator',  Icon: Zap,       desc: 'Join projects and earn credits' },
  { id: 'investor',     label: 'Investor',      Icon: TrendingUp,desc: 'Discover and fund startups' },
  { id: 'organisation', label: 'Organisation',  Icon: Building2, desc: 'Find talent and post challenges' },
]

export default function Settings() {
  const { profile, updateProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [tab, setTab]         = useState('profile')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [roleChanging, setRC] = useState(false)
  const [pwd, setPwd]         = useState({ next: '', confirm: '' })

  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', bio: '', phone: '',
    linkedinUrl: '', githubUrl: '', portfolioUrl: '', timezone: '',
    skills: '', weeklyHours: 20, riskTolerance: 'Medium',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        firstName:    profile.firstName ?? '',
        lastName:     profile.lastName  ?? '',
        username:     profile.username  ?? '',
        bio:          profile.bio       ?? '',
        phone:        profile.phone     ?? '',
        linkedinUrl:  profile.linkedinUrl  ?? '',
        githubUrl:    profile.githubUrl    ?? '',
        portfolioUrl: profile.portfolioUrl ?? '',
        timezone:     profile.timezone     ?? '',
        skills:       (profile.skills ?? []).join(', '),
        weeklyHours:  profile.weeklyHours  ?? 20,
        riskTolerance:profile.riskTolerance ?? 'Medium',
      })
    }
  }, [profile])

  const flash = (err?: string) => {
    if (err) { setError(err); setSaving(false); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500); setSaving(false)
  }

  const saveProfile = async () => {
    setSaving(true); setError(''); setSaved(false)
    const { error: err } = await updateProfile({
      firstName:    form.firstName,
      lastName:     form.lastName,
      username:     form.username  || null,
      bio:          form.bio       || null,
      phone:        form.phone,
      linkedinUrl:  form.linkedinUrl  || null,
      githubUrl:    form.githubUrl    || null,
      portfolioUrl: form.portfolioUrl || null,
      timezone:     form.timezone     || null,
      skills:       form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      weeklyHours:  form.weeklyHours,
      riskTolerance:form.riskTolerance,
    } as any)
    flash(err?.message)
  }

  const changePassword = async () => {
    if (pwd.next !== pwd.confirm) { setError('Passwords do not match'); return }
    if (pwd.next.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true); setError('')
    // In production: call backend password change endpoint
    await new Promise(r => setTimeout(r, 800))
    setPwd({ next: '', confirm: '' })
    flash()
  }

  const switchRole = async (role: Role) => {
    setRC(true)
    await updateProfile({ role } as any)
    setRC(false)
  }

  const name = profile ? `${profile.firstName} ${profile.lastName}` : 'User'
  const profilePct = Math.round(([profile?.bio, profile?.skills?.length, profile?.linkedinUrl, profile?.avatarUrl, profile?.githubUrl, profile?.phone].filter(Boolean).length / 6) * 100)
  const rc = roleColor(profile?.role ?? 'founder')

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-4xl mx-auto page-enter">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-1">
            <Card className="p-4 mb-4 flex flex-col items-center text-center gap-2">
              <div className={cn('h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-lg font-bold overflow-hidden', avatarGradient(name))}>
                {profile?.avatarUrl
                  ? <img src={profile.avatarUrl} alt={name} className="h-full w-full object-cover" />
                  : initials(name)
                }
              </div>
              <p className="font-semibold text-sm">{name}</p>
              <span className={cn('px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase border', rc.bg, rc.text, rc.border)}>{profile?.role}</span>
              <p className="text-xs text-[color:var(--muted-foreground)]">Score: {Math.round(profile?.credibilityScore ?? 0)}</p>
            </Card>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn('w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all', tab === id ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]')}>
                <Icon className="h-4 w-4" />{label}
                {tab === id && <ChevronRight className="h-4 w-4 ml-auto" />}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                <Check className="h-4 w-4 flex-shrink-0" /> Changes saved successfully.
              </div>
            )}

            {/* Profile Tab */}
            {tab === 'profile' && (
              <div className="space-y-5">
                <Card className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                    <Input label="Last Name"  value={form.lastName}  onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                  </div>
                  <Input label="Username" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="yourhandle" hint="Your public @handle" />
                  <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234 800 000 0000" />
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Bio</label>
                    <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Tell the community about yourself…" rows={3}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none" />
                  </div>
                </Card>

                <Card className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">Social Links</h3>
                  <Input label="LinkedIn"  value={form.linkedinUrl}  onChange={e => setForm(p => ({ ...p, linkedinUrl: e.target.value }))}  placeholder="https://linkedin.com/in/handle" />
                  <Input label="GitHub"    value={form.githubUrl}    onChange={e => setForm(p => ({ ...p, githubUrl: e.target.value }))}    placeholder="https://github.com/handle" />
                  <Input label="Portfolio" value={form.portfolioUrl} onChange={e => setForm(p => ({ ...p, portfolioUrl: e.target.value }))} placeholder="https://yoursite.com" />
                </Card>

                <Card className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">Skills & Availability</h3>
                  <Input label="Skills (comma-separated)" value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} placeholder="React, Node.js, Python, Design…" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Weekly Hours</label>
                      <span className="text-sm font-semibold text-[color:var(--primary)]">{form.weeklyHours}h / week</span>
                    </div>
                    <input type="range" min={5} max={60} value={form.weeklyHours} onChange={e => setForm(p => ({ ...p, weeklyHours: +e.target.value }))} className="w-full accent-[color:var(--primary)]" />
                    <div className="flex justify-between text-xs text-[color:var(--muted-foreground)]"><span>Part-time (5h)</span><span>Full-time (60h)</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Risk Tolerance</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Low','Medium','High'].map(r => (
                        <button key={r} onClick={() => setForm(p => ({ ...p, riskTolerance: r }))}
                          className={cn('py-2 rounded-xl border text-sm font-medium transition-all', form.riskTolerance === r ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] border-[color:var(--primary)]/40' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/30')}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Progress value={profilePct} label={`Profile ${profilePct}% complete`} />
                </Card>

                <Button onClick={saveProfile} loading={saving} className="w-full">
                  {saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save Changes'}
                </Button>
              </div>
            )}

            {/* Security Tab */}
            {tab === 'security' && (
              <div className="space-y-5">
                <Card className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">Account Email</h3>
                  <Input value={profile?.email ?? ''} disabled />
                  <p className="text-xs text-[color:var(--muted-foreground)]">Contact support to change your email address.</p>
                </Card>
                <Card className="p-5 space-y-4">
                  <h3 className="font-bold text-sm">Change Password</h3>
                  <Input label="New Password" type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} placeholder="At least 8 characters" />
                  <Input label="Confirm Password" type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
                  <Button onClick={changePassword} loading={saving} disabled={!pwd.next || pwd.next !== pwd.confirm || pwd.next.length < 8}>
                    Update Password
                  </Button>
                </Card>
              </div>
            )}

            {/* Role Tab */}
            {tab === 'role' && (
              <Card className="p-5">
                <h3 className="font-bold text-sm mb-1">Switch Role</h3>
                <p className="text-sm text-[color:var(--muted-foreground)] mb-5">Change your primary role. Your history and data are always preserved.</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(role => (
                    <button key={role.id} onClick={() => switchRole(role.id)} disabled={roleChanging}
                      className={cn('p-4 rounded-2xl border text-left transition-all', profile?.role === role.id ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40')}>
                      <role.Icon className={cn('h-5 w-5 mb-2', profile?.role === role.id ? 'text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)]')} />
                      <div className="font-semibold text-sm">{role.label}</div>
                      <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{role.desc}</div>
                      {profile?.role === role.id && (
                        <div className="mt-2 text-xs text-[color:var(--primary)] font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Current</div>
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Appearance Tab */}
            {tab === 'appearance' && (
              <Card className="p-5">
                <h3 className="font-bold text-sm mb-4">Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[{ id: 'dark', label: 'Dark Mode', Icon: Moon, desc: 'Easy on the eyes' }, { id: 'light', label: 'Light Mode', Icon: Sun, desc: 'Clean and bright' }].map(t => (
                    <button key={t.id} onClick={() => theme !== t.id && toggleTheme()}
                      className={cn('p-4 rounded-2xl border text-left transition-all', theme === t.id ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40')}>
                      <t.Icon className={cn('h-5 w-5 mb-2', theme === t.id ? 'text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)]')} />
                      <div className="font-semibold text-sm">{t.label}</div>
                      <div className="text-xs text-[color:var(--muted-foreground)]">{t.desc}</div>
                      {theme === t.id && <div className="mt-2 text-xs text-[color:var(--primary)] font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Active</div>}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
