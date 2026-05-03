import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { PieChart } from 'lucide-react'

export default function Portfolio() {
  return (
    <DashboardLayout title="Portfolio">
      <div className="max-w-5xl mx-auto space-y-6 page-enter">
        <Card className="p-12 text-center">
          <PieChart className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mx-auto mb-4" />
          <h3 className="font-bold text-lg mb-2">No investments yet</h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
            Browse the deal pipeline and connect with founders you want to invest in.
          </p>
          <Link to="/investor/pipeline"><Button>Browse Deal Pipeline</Button></Link>
        </Card>
      </div>
    </DashboardLayout>
  )
}
