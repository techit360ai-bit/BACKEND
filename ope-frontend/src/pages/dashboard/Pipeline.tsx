import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { Target } from 'lucide-react'

export default function Pipeline() {
  return (
    <DashboardLayout title="Deal Pipeline">
      <div className="max-w-6xl mx-auto space-y-5 page-enter">
        <Card className="p-12 text-center">
          <Target className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mx-auto mb-4" />
          <p className="font-semibold mb-1 text-lg">Deal Pipeline</p>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
            Browse and discover startup deals from the TechIT Network.
          </p>
          <Link to="/projects"><Button>Browse Projects</Button></Link>
        </Card>
      </div>
    </DashboardLayout>
  )
}
