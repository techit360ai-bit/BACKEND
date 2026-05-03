import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle, Home, ArrowLeft, Zap } from 'lucide-react'
import { Button } from '../components/ui'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="orb orb-violet w-96 h-96 -top-20 -left-20 opacity-30 fixed" />
      <div className="orb orb-cyan w-80 h-80 bottom-0 right-0 opacity-20 fixed" />
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg gap-6">
        <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h1 className="font-bold text-8xl gradient-text leading-none mb-2">404</h1>
          <h2 className="font-bold text-2xl mb-3">Page Not Found</h2>
          <p className="text-[color:var(--muted-foreground)] text-base leading-relaxed">
            The page you're trying to access doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Go Back</Button>
          <Button onClick={() => navigate('/')}><Home className="h-4 w-4" /> Back to Home</Button>
        </div>
        <div className="pt-4 border-t border-[color:var(--border)] w-full">
          <p className="text-xs text-[color:var(--muted-foreground)] mb-3">Quick links:</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {[{label:'Home',href:'/'},{label:'Sign In',href:'/login'},{label:'Dashboard',href:'/dashboard'}].map(l => (
              <Link key={l.href} to={l.href} className="text-xs px-4 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40 hover:text-[color:var(--primary)] transition-all text-[color:var(--muted-foreground)]">{l.label}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] font-mono">
          <Zap className="h-3 w-3 text-[color:var(--primary)]" /> TechIT Network
        </div>
      </div>
    </div>
  )
}
