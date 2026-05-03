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
import { InvestorStep1 } from "@/dashboard/investors/onboarding/InvestorStep1";
import { InvestorStep2 } from "@/dashboard/investors/onboarding/InvestorStep2";
import { InvestorStep3 } from "@/dashboard/investors/onboarding/InvestorStep3";
import { InvestorStep4 } from "@/dashboard/investors/onboarding/InvestorStep4";
import { InvestorStep5 } from "@/dashboard/investors/onboarding/InvestorStep5";
import InvestorDashboard from "@/dashboard/investors/InvestorDashboard";
import { DealIntelligence } from "@/components/investor/DealIntelligence";
import { UserProvider } from "@/contexts/UserContext";
import Chat from "@/dashboard/chat/Chat";

const App = () => {
  return (
    <UserProvider>
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
        <Route path="/investor/onboarding/step-1" element={<InvestorStep1 />} />
        <Route path="/investor/onboarding/step-2" element={<InvestorStep2 />} />
        <Route path="/investor/onboarding/step-3" element={<InvestorStep3 />} />
        <Route path="/investor/onboarding/step-4" element={<InvestorStep4 />} />
        <Route path="/investor/onboarding/step-5" element={<InvestorStep5 />} />
        <Route path="/investor/dashboard" element={<InvestorDashboard />} />
        <Route
          path="/investor/deal-intelligence"
          element={<DealIntelligence />}
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/incubation-hub" element={<IncubationHub />} />
        <Route path="/idea-eval" element={<AIEvaluation />} />
        <Route path="/matches" element={<MatchResults />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </UserProvider>
  );
};

export default App;
