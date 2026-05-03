import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { Search } from 'lucide-react'

export default function TalentSearch() {
  return (
    <DashboardLayout title="Talent Search">
      <div className="max-w-5xl mx-auto space-y-5 page-enter">
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mx-auto mb-4" />
          <p className="font-semibold text-lg mb-1">Talent Search</p>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
            Browse collaborators and find the perfect talent for your organisation.
          </p>
          <Link to="/people"><Button>Browse People</Button></Link>
        </Card>
      </div>
    </DashboardLayout>
  )
}
