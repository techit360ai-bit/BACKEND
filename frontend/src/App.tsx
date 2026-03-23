import { Routes, Route } from "react-router"
import Landing from "@/components/Landing"
import FounderSetup from "@/dashboard/founderSetup"
import FounderSummary from "@/dashboard/founderSummary"
import Dashboard from "@/dashboard/home"
import CollaboratorSetup from "@/dashboard/collaboratorSetup"
import CollaboratorSummary from "@/dashboard/collaboratorSummary"
import CollaboratorDashboard from "@/dashboard/collaboratorDashboard"
import NotFound from "@/dashboard/NotFound"
import { ThemeToggle } from "@/components/ThemeToggle"

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/founder/setup" element={<FounderSetup />} />
        <Route path="/founder/summary" element={<FounderSummary />} />
        <Route path="/collaborator/setup" element={<CollaboratorSetup />} />
        <Route path="/collaborator/summary" element={<CollaboratorSummary />} />
        <Route path="/collaborator/dashboard" element={<CollaboratorDashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </>
  )
}

export default App
