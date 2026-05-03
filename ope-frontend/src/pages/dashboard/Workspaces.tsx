import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Code2, Rocket, Users, Plus, Terminal, UserPlus } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'

function getLS(key: string) { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }

export default function Workspaces() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const allProjects = getLS('techit_projects')
    setProjects(allProjects.filter((p: any) => p.status === 'active'))
    setLoading(false)
  }, [profile?.id])

  return (
    <DashboardLayout title="Development Workspaces">
      <div className="max-w-5xl mx-auto space-y-6 page-enter">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[color:var(--card)] p-6 rounded-2xl border border-[color:var(--border)] shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="font-bold text-2xl flex items-center gap-2"><Terminal className="h-6 w-6 text-[color:var(--primary)]" /> Project Workspaces</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1">Manage your code, collaborate in real-time, and invite developers.</p>
          </div>
          <Link to="/idea-submit" className="relative z-10"><Button className="gap-2"><Plus className="h-4 w-4" /> New Project</Button></Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 rounded-full border-2 border-[color:var(--primary)] border-t-transparent animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[color:var(--border)] rounded-2xl bg-[color:var(--card)]/50">
            <Code2 className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mb-4" />
            <h3 className="font-bold text-lg mb-1">No Workspaces Found</h3>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-4 max-w-sm">Submit an idea to create a project before accessing a development workspace.</p>
            <Link to="/idea-submit"><Button variant="outline">Submit an Idea</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map(project => (
              <Card key={project.id} className="p-5 flex flex-col h-full hover:border-[color:var(--primary)]/40 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[color:var(--primary)]/20 to-blue-500/20 flex items-center justify-center text-[color:var(--primary)] font-bold text-lg">
                    {project.title.charAt(0).toUpperCase()}
                  </div>
                  <Badge variant="cyan">Active</Badge>
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-1">{project.title}</h3>
                <p className="text-xs text-[color:var(--muted-foreground)] mb-4 line-clamp-2 flex-1">{project.pitch}</p>
                <div className="flex items-center gap-4 text-xs text-[color:var(--muted-foreground)] mb-5 border-y border-[color:var(--border)] py-3">
                  <div className="flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /><span className="font-medium">{project.stage || 'Idea'}</span></div>
                  <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><span className="font-medium">{project.industry}</span></div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link to={`/workspace/${project.id}`} className="flex-1">
                    <Button className="w-full gap-2"><Code2 className="h-4 w-4" /> Open IDE</Button>
                  </Link>
                  <Button variant="outline" title="Invite Collaborators" className="px-3"><UserPlus className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
