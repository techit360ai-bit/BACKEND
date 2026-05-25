import { Routes, Route, Navigate } from "react-router";
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
import MatchResults from "@/dashboard/matchResults";
import Wallet from "@/TechitWallet/Wallet";
import NotFound from "@/dashboard/NotFound";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InvestorStep1 } from "@/dashboard/investors/onboarding/InvestorStep1";
import { InvestorStep2 } from "@/dashboard/investors/onboarding/InvestorStep2";
import { InvestorStep3 } from "@/dashboard/investors/onboarding/InvestorStep3";
import { InvestorStep4 } from "@/dashboard/investors/onboarding/InvestorStep4";
import { InvestorStep5 } from "@/dashboard/investors/onboarding/InvestorStep5";
import { InvestorLayout } from "@/dashboard/investors/section/components/investor/InvestorLayout";
import { Dashboard as InvestorDashboard } from "@/dashboard/investors/section/components/investor/Dashboard";
import { DealIntelligence as InvestorDealIntelligence } from "@/dashboard/investors/section/components/investor/DealIntelligence";
import { RiskAnalysis as InvestorRiskAnalysis } from "@/dashboard/investors/section/components/investor/RiskAnalysis";
import { RiskRadar as InvestorRiskRadar } from "@/dashboard/investors/section/components/investor/RiskRadar";
import { AllocationEngine as InvestorAllocationEngine } from "@/dashboard/investors/section/components/investor/AllocationEngine";
import { Watchlist as InvestorWatchlist } from "@/dashboard/investors/section/components/investor/Watchlist";
import { CapitalPools as InvestorCapitalPools } from "@/dashboard/investors/section/components/investor/CapitalPools";
import { GlobalHeatmap as InvestorHeatmap } from "@/dashboard/investors/section/components/investor/GlobalHeatmap";
import { DataRoom as InvestorDataRoom } from "@/dashboard/investors/section/components/investor/DataRoom";
import { DataRooms as InvestorDataRooms } from "@/dashboard/investors/section/components/investor/DataRooms";
import { DealRoom as InvestorDealRoom } from "@/dashboard/investors/section/components/investor/DealRoom";
import { DealRooms as InvestorDealRooms } from "@/dashboard/investors/section/components/investor/DealRooms";
import { Reputation as InvestorReputation } from "@/dashboard/investors/section/components/investor/Reputation";
import { InvestorProfile } from "@/dashboard/investors/section/components/investor/InvestorProfile";
import { UserProvider } from "@/contexts/UserContext";
import Chat from "@/dashboard/chat/Chat";
import Signup from "@/components/SignUp";
import Login from "@/components/Login";
import { MainLayout as WorkspacesLayout } from "@/dashboard/workspaces/components/layout/MainLayout";
import { Build as WsBuild } from "@/dashboard/workspaces/pages/Build";
import { AIAgents as WsAIAgents } from "@/dashboard/workspaces/pages/AIAgents";
import { Reports as WsReports } from "@/dashboard/workspaces/pages/Reports";
import { Incubator as WsIncubator } from "@/dashboard/workspaces/pages/Incubator";
import { Tools as WsTools } from "@/dashboard/workspaces/pages/Tools";
import { Chat as WsChat } from "@/dashboard/workspaces/pages/Chat";
import { Files as WsFiles } from "@/dashboard/workspaces/pages/Files";
import { Notifications as WsNotifications } from "@/dashboard/workspaces/pages/Notifications";
import { Settings as WsSettings } from "@/dashboard/workspaces/pages/Settings";
import { GitHub as WsGitHub } from "@/dashboard/workspaces/pages/GitHub";
import { DevTools as WsDevTools } from "@/dashboard/workspaces/pages/DevTools";
import { ComponentLibrary as WsComponentLibrary } from "@/dashboard/workspaces/components/ComponentLibrary";
import { FeedLayout } from "@/dashboard/feed/components/FeedLayout";
import { FeedPage } from "@/dashboard/feed/pages/FeedPage";
import { TribePage } from "@/dashboard/feed/pages/TribePage";
import { BuildLogPage } from "@/dashboard/feed/pages/BuildLogPage";
import { QuestionsPage } from "@/dashboard/feed/pages/QuestionsPage";
import { ProblemsPage } from "@/dashboard/feed/pages/ProblemsPage";
import { NotificationsPage as FeedNotificationsPage } from "@/dashboard/feed/pages/NotificationsPage";
import { PostDetailPage } from "@/dashboard/feed/pages/PostDetailPage";
import { MyLogPage } from "@/dashboard/feed/pages/MyLogPage";
import { UserProfilePage } from "@/dashboard/feed/pages/UserProfilePage";

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

        {/* Investor section */}
        <Route path="/investor" element={<InvestorLayout />}>
          <Route index element={<InvestorDashboard />} />
          <Route path="dashboard" element={<InvestorDashboard />} />
          <Route path="deal-intelligence" element={<InvestorDealIntelligence />} />
          <Route path="risk-analysis" element={<InvestorRiskAnalysis />} />
          <Route path="risk-radar/:startupId" element={<InvestorRiskRadar />} />
          <Route path="allocation" element={<InvestorAllocationEngine />} />
          <Route path="watchlist" element={<InvestorWatchlist />} />
          <Route path="capital-pools" element={<InvestorCapitalPools />} />
          <Route path="heatmap" element={<InvestorHeatmap />} />
          <Route path="data-rooms" element={<InvestorDataRooms />} />
          <Route path="data-room/:startupId" element={<InvestorDataRoom />} />
          <Route path="deal-rooms" element={<InvestorDealRooms />} />
          <Route path="deal-room/:startupId" element={<InvestorDealRoom />} />
          <Route path="reputation" element={<InvestorReputation />} />
          <Route path="profile" element={<InvestorProfile />} />
        </Route>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/incubation-hub" element={<IncubationHub />} />
        <Route path="/matches" element={<MatchResults />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signin" element={<Login />} />

        {/* Collaborative Project Workspace */}
        <Route path="/workspaces" element={<WorkspacesLayout />}>
          <Route index element={<Navigate to="build" replace />} />
          <Route path="build" element={<WsBuild />} />
          <Route path="incubator" element={<WsIncubator />} />
          <Route path="tools" element={<WsTools />} />
          <Route path="dev-tools" element={<WsDevTools />} />
          <Route path="ai-agents" element={<WsAIAgents />} />
          <Route path="chat" element={<WsChat />} />
          <Route path="files" element={<WsFiles />} />
          <Route path="github" element={<WsGitHub />} />
          <Route path="reports" element={<WsReports />} />
          <Route path="notifications" element={<WsNotifications />} />
          <Route path="settings" element={<WsSettings />} />
        </Route>
        <Route path="/workspaces/components" element={<WsComponentLibrary />} />

        {/* Feed / Hangout */}
        <Route path="/feed" element={<FeedLayout />}>
          <Route index element={<FeedPage />} />
          <Route path="tribe" element={<TribePage />} />
          <Route path="build-log" element={<BuildLogPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="problems" element={<ProblemsPage />} />
          <Route path="notifications" element={<FeedNotificationsPage />} />
          <Route path="my-log" element={<MyLogPage />} />
          <Route path="post/:postId" element={<PostDetailPage />} />
          <Route path="problem/:problemId" element={<PostDetailPage />} />
          <Route path="profile/:userId" element={<UserProfilePage />} />
          <Route
            path="messages/:userId"
            element={
              <div className="p-8 text-center text-text-muted">
                Messages feature coming soon...
              </div>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </UserProvider>
  );
};

export default App;
