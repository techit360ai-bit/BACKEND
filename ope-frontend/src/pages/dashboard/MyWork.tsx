import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { Briefcase } from 'lucide-react'

export default function MyWork() {
  return (
    <DashboardLayout title="My Work">
      <div className="max-w-4xl mx-auto space-y-5 page-enter">
        <Card className="p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Briefcase className="h-7 w-7 text-[color:var(--muted-foreground)]/40" />
          </div>
          <h3 className="font-bold text-lg mb-2">No projects yet</h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-4">Accept collaboration requests to start working on projects</p>
          <Link to="/collaborator/opportunities"><Button size="sm">Browse Opportunities</Button></Link>
        </Card>
      </div>
    </DashboardLayout>
  )
}
