import { Routes, Route, Navigate } from "react-router";
import Landing from "@/components/Landing";
import { FounderStep1 } from "@/dashboard/founders/onboarding/FounderStep1";
import { FounderStep2 } from "@/dashboard/founders/onboarding/FounderStep2";
import { FounderStep3 } from "@/dashboard/founders/onboarding/FounderStep3";
import { FounderStep4 } from "@/dashboard/founders/onboarding/FounderStep4";
import { FounderStep5 } from "@/dashboard/founders/onboarding/FounderStep5";
import { FounderStep6 } from "@/dashboard/founders/onboarding/FounderStep6";
import { FounderLayout } from "@/dashboard/founders/section/components/founder/FounderLayout";
import { Dashboard } from "@/dashboard/founders/section/components/founder/Dashboard";
import { FounderProfile } from "@/dashboard/founders/section/components/founder/FounderProfile";
import { Settings as FounderSettings } from "@/dashboard/founders/section/components/founder/Settings";
import { CollabLayout } from "@/dashboard/collaborators/section/components/collab/CollabLayout";
import { Dashboard as CollabDashboard } from "@/dashboard/collaborators/section/components/collab/Dashboard";
import { Equity as CollabEquity } from "@/dashboard/collaborators/section/components/collab/Equity";
import { Tasks as CollabTasks } from "@/dashboard/collaborators/section/components/collab/Tasks";
import { Performance as CollabPerformance } from "@/dashboard/collaborators/section/components/collab/Performance";
import { Earnings as CollabEarnings } from "@/dashboard/collaborators/section/components/collab/Earnings";
import { Opportunities as CollabOpportunities } from "@/dashboard/collaborators/section/components/collab/Opportunities";
import { Reputation as CollabReputation } from "@/dashboard/collaborators/section/components/collab/Reputation";
import { Messages as CollabMessages } from "@/dashboard/collaborators/section/components/collab/Messages";
import { Tools as CollabTools } from "@/dashboard/collaborators/section/components/collab/Tools";
import { CollabProfile } from "@/dashboard/collaborators/section/components/collab/CollabProfile";
import { Settings as CollabSettings } from "@/dashboard/collaborators/section/components/collab/Settings";
import IncubationHub from "@/dashboard/incubationHub";
import MatchResults from "@/dashboard/matchResults";
import OpportunityHub from "@/dashboard/founders/section/components/founder/OpportunityHub";
import OpportunityDetail from "@/dashboard/founders/section/components/founder/OpportunityDetail";
import InviteAcceptPage from "@/dashboard/founders/section/components/founder/InviteAcceptPage";
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
import { OrgLayout } from "@/dashboard/organization/section/components/org/OrgLayout";
import { Dashboard as OrgDashboard } from "@/dashboard/organization/section/components/org/Dashboard";
import { Teams as OrgTeams } from "@/dashboard/organization/section/components/org/Teams";
import { Projects as OrgProjects } from "@/dashboard/organization/section/components/org/Projects";
import { Incubator as OrgIncubator } from "@/dashboard/organization/section/components/org/Incubator";
import { TalentPool as OrgTalentPool } from "@/dashboard/organization/section/components/org/TalentPool";
import { AIOps as OrgAIOps } from "@/dashboard/organization/section/components/org/AIOps";
import { Analytics as OrgAnalytics } from "@/dashboard/organization/section/components/org/Analytics";
import { Marketplace as OrgMarketplace } from "@/dashboard/organization/section/components/org/Marketplace";
import { MarketReady as OrgMarketReady } from "@/dashboard/organization/section/components/org/MarketReady";
import { Hangout as OrgHangout } from "@/dashboard/organization/section/components/org/Hangout";
import { Integrations as OrgIntegrations } from "@/dashboard/organization/section/components/org/Integrations";
import { Billing as OrgBilling } from "@/dashboard/organization/section/components/org/Billing";
import { Settings as OrgSettings } from "@/dashboard/organization/section/components/org/Settings";
import { Hackathons as OrgHackathons } from "@/dashboard/organization/section/components/org/Hackathons";
import { HackathonCreate as OrgHackathonCreate } from "@/dashboard/organization/section/components/org/HackathonCreate";
import { HackathonDetail as OrgHackathonDetail } from "@/dashboard/organization/section/components/org/HackathonDetail";
import { OrgProfile } from "@/dashboard/organization/section/components/org/OrgProfile";
import { OrgStep1 } from "@/dashboard/organization/onboarding/OrgStep1";
import { OrgStep2 } from "@/dashboard/organization/onboarding/OrgStep2";
import { OrgStep3 } from "@/dashboard/organization/onboarding/OrgStep3";
import { OrgStep4 } from "@/dashboard/organization/onboarding/OrgStep4";
import { OrgStep5 } from "@/dashboard/organization/onboarding/OrgStep5";
import { CollabStep1 } from "@/dashboard/collaborators/onboarding/CollabStep1";
import { CollabStep2 } from "@/dashboard/collaborators/onboarding/CollabStep2";
import { CollabStep3 } from "@/dashboard/collaborators/onboarding/CollabStep3";
import { CollabStep4 } from "@/dashboard/collaborators/onboarding/CollabStep4";
import { CollabStep5 } from "@/dashboard/collaborators/onboarding/CollabStep5";
import { CollabStep6 } from "@/dashboard/collaborators/onboarding/CollabStep6";
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

        <Route path="/founder/onboarding/step-1" element={<FounderStep1 />} />
        <Route path="/founder/onboarding/step-2" element={<FounderStep2 />} />
        <Route path="/founder/onboarding/step-3" element={<FounderStep3 />} />
        <Route path="/founder/onboarding/step-4" element={<FounderStep4 />} />
        <Route path="/founder/onboarding/step-5" element={<FounderStep5 />} />
        <Route path="/founder/onboarding/step-6" element={<FounderStep6 />} />
        <Route path="/founder/setup"   element={<Navigate to="/founder/onboarding/step-1" replace />} />
        <Route path="/founder/summary" element={<Navigate to="/dashboard" replace />} />

        <Route path="/collaborator/onboarding/step-1" element={<CollabStep1 />} />
        <Route path="/collaborator/onboarding/step-2" element={<CollabStep2 />} />
        <Route path="/collaborator/onboarding/step-3" element={<CollabStep3 />} />
        <Route path="/collaborator/onboarding/step-4" element={<CollabStep4 />} />
        <Route path="/collaborator/onboarding/step-5" element={<CollabStep5 />} />
        <Route path="/collaborator/onboarding/step-6" element={<CollabStep6 />} />

        <Route path="/collaborator" element={<CollabLayout />}>
          <Route index element={<Navigate to="/collaborator/dashboard" replace />} />
          <Route path="dashboard" element={<CollabDashboard />} />
          <Route path="equity" element={<CollabEquity />} />
          <Route path="tasks" element={<CollabTasks />} />
          <Route path="performance" element={<CollabPerformance />} />
          <Route path="earnings" element={<CollabEarnings />} />
          <Route path="opportunities" element={<CollabOpportunities />} />
          <Route path="reputation" element={<CollabReputation />} />
          <Route path="messages" element={<CollabMessages />} />
          <Route path="tools" element={<CollabTools />} />
          <Route path="profile" element={<CollabProfile />} />
          <Route path="settings" element={<CollabSettings />} />
        </Route>

        {/* Legacy redirects — Landing.tsx still navigates to /collaborator/setup */}
        <Route path="/collaborator/setup"   element={<Navigate to="/collaborator/onboarding/step-1" replace />} />
        <Route path="/collaborator/summary" element={<Navigate to="/collaborator/dashboard" replace />} />

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
        <Route element={<FounderLayout />}>
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/founder/profile"  element={<FounderProfile />} />
          <Route path="/founder/settings" element={<FounderSettings />} />
          <Route path="/incubation-hub"   element={<IncubationHub />} />
          <Route path="/opportunity-hub"  element={<OpportunityHub />} />
          <Route path="/opportunity-hub/:opportunityId" element={<OpportunityDetail />} />
          <Route path="/h/:hackathonId/team/:teamId" element={<InviteAcceptPage />} />
          <Route path="/chat"             element={<Chat />} />
          <Route path="/matches"          element={<MatchResults />} />
        </Route>
        <Route path="/wallet" element={<Wallet />} />
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

        {/* Organization onboarding (flat, outside layout) */}
        <Route path="/org/onboarding/step-1" element={<OrgStep1 />} />
        <Route path="/org/onboarding/step-2" element={<OrgStep2 />} />
        <Route path="/org/onboarding/step-3" element={<OrgStep3 />} />
        <Route path="/org/onboarding/step-4" element={<OrgStep4 />} />
        <Route path="/org/onboarding/step-5" element={<OrgStep5 />} />

        {/* Organization section */}
        <Route path="/org" element={<OrgLayout />}>
          <Route index element={<OrgDashboard />} />
          <Route path="dashboard" element={<OrgDashboard />} />
          <Route path="teams" element={<OrgTeams />} />
          <Route path="projects" element={<OrgProjects />} />
          <Route path="incubator" element={<OrgIncubator />} />
          <Route path="hackathons" element={<OrgHackathons />} />
          <Route path="hackathons/new" element={<OrgHackathonCreate />} />
          <Route path="hackathons/:id" element={<OrgHackathonDetail />} />
          <Route path="talent" element={<OrgTalentPool />} />
          <Route path="ai-ops" element={<OrgAIOps />} />
          <Route path="analytics" element={<OrgAnalytics />} />
          <Route path="marketplace" element={<OrgMarketplace />} />
          <Route path="market-ready" element={<OrgMarketReady />} />
          <Route path="hangout" element={<OrgHangout />} />
          <Route path="integrations" element={<OrgIntegrations />} />
          <Route path="billing" element={<OrgBilling />} />
          <Route path="settings" element={<OrgSettings />} />
          <Route path="profile" element={<OrgProfile />} />
        </Route>

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
