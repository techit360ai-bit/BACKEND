import { Routes, Route } from "react-router";
import Landing from "@/components/Landing";
import FounderSetup from "@/dashboard/founders/setup";
import FounderSummary from "@/dashboard/founders/summary";
import Dashboard from "@/dashboard/home";
import CollaboratorSetup from "@/dashboard/collaborators/setup";
import CollaboratorSummary from "@/dashboard/collaborators/summary";
import CollaboratorDashboard from "@/dashboard/collaborators/dashboard";
import AITaskCenter from "@/dashboard/collaborators/tasks";
import ToolsPage from "@/dashboard/collaborators/tools";
import OpportunitiesPage from "@/dashboard/collaborators/opportunities";
import PerformancePage from "@/dashboard/collaborators/performance";
import MessagesPage from "@/dashboard/collaborators/messages";
import EarningsPage from "@/dashboard/collaborators/earnings";
import IncubationHub from "@/dashboard/incubationHub";
import AIEvaluation from "@/dashboard/AIEvaluation";
import MatchResults from "@/dashboard/matchResults";
import Wallet from "@/TechitWallet/Wallet";
import NotFound from "@/dashboard/NotFound";
import { ThemeToggle } from "@/components/ThemeToggle";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/founder/setup" element={<FounderSetup />} />
        <Route path="/founder/summary" element={<FounderSummary />} />
        <Route path="/collaborator/setup" element={<CollaboratorSetup />} />
        <Route path="/collaborator/summary" element={<CollaboratorSummary />} />
        <Route
          path="/collaborator/dashboard"
          element={<CollaboratorDashboard />}
        />
        <Route path="/collaborator/tasks" element={<AITaskCenter />} />
        <Route path="/collaborator/tools" element={<ToolsPage />} />
        <Route
          path="/collaborator/opportunities"
          element={<OpportunitiesPage />}
        />
        <Route path="/collaborator/performance" element={<PerformancePage />} />
        <Route path="/collaborator/messages" element={<MessagesPage />} />
        <Route path="/collaborator/earnings" element={<EarningsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/incubation-hub" element={<IncubationHub />} />
        <Route path="/idea-eval" element={<AIEvaluation />} />
        <Route path="/matches" element={<MatchResults />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </>
  );
};

export default App;
