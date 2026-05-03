import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeToggle } from './components/ThemeToggle'
import { ProtectedRoute, SmartRedirect, Spinner } from './components/ProtectedRoute'

// ── Public pages ──────────────────────────────────────────────
const Landing        = lazy(() => import('./pages/Landing'))
const Login          = lazy(() => import('./pages/auth/Login'))
const Signup         = lazy(() => import('./pages/auth/Signup'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const NotFound       = lazy(() => import('./pages/NotFound'))

// ── Onboarding ────────────────────────────────────────────────
const FounderSetup        = lazy(() => import('./pages/onboarding/FounderSetup'))
const CollaboratorSetup   = lazy(() => import('./pages/onboarding/CollaboratorSetup'))
const InvestorSetup       = lazy(() => import('./pages/onboarding/InvestorSetup'))
const OrgSetup            = lazy(() => import('./pages/onboarding/OrgSetup'))

// ── Founder dashboard ─────────────────────────────────────────
const FounderDashboard = lazy(() => import('./pages/dashboard/FounderDashboard'))
const IdeaSubmit       = lazy(() => import('./pages/dashboard/IdeaSubmit'))
const AIEvaluation     = lazy(() => import('./pages/dashboard/AIEvaluation'))
const MatchResults     = lazy(() => import('./pages/dashboard/MatchResults'))
const IncubationHub    = lazy(() => import('./pages/dashboard/IncubationHub'))
const Workspaces       = lazy(() => import('./pages/dashboard/Workspaces'))

// ── Collaborator dashboard ────────────────────────────────────
const CollaboratorDashboard = lazy(() => import('./pages/dashboard/CollaboratorDashboard'))
const Opportunities         = lazy(() => import('./pages/dashboard/Opportunities'))
const MyWork                = lazy(() => import('./pages/dashboard/MyWork'))
const Performance           = lazy(() => import('./pages/dashboard/Performance'))
const Earnings              = lazy(() => import('./pages/dashboard/Earnings'))

// ── Investor dashboard ────────────────────────────────────────
const InvestorDashboard = lazy(() => import('./pages/dashboard/InvestorDashboard'))
const Pipeline          = lazy(() => import('./pages/dashboard/Pipeline'))
const Portfolio         = lazy(() => import('./pages/dashboard/Portfolio'))

// ── Organisation dashboard ────────────────────────────────────
const OrgDashboard  = lazy(() => import('./pages/dashboard/OrgDashboard'))
const Challenges    = lazy(() => import('./pages/dashboard/Challenges'))
const TalentSearch  = lazy(() => import('./pages/dashboard/TalentSearch'))

// ── Shared pages ──────────────────────────────────────────────
const Feed          = lazy(() => import('./pages/shared/Feed'))
const People        = lazy(() => import('./pages/shared/People'))
const Projects      = lazy(() => import('./pages/shared/Projects'))
const Messages      = lazy(() => import('./pages/shared/Messages'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Settings      = lazy(() => import('./pages/shared/Settings'))
const Wallet        = lazy(() => import('./pages/shared/Wallet'))
const Workspace     = lazy(() => import('./pages/shared/Workspace'))

export default function App() {
  return (
    <>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* ── Public ── */}
          <Route path="/"              element={<Landing />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/signup"        element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/home"          element={<SmartRedirect />} />

          {/* ── Onboarding (protected) ── */}
          <Route path="/founder/setup"      element={<ProtectedRoute><FounderSetup /></ProtectedRoute>} />
          <Route path="/collaborator/setup" element={<ProtectedRoute><CollaboratorSetup /></ProtectedRoute>} />
          <Route path="/investor/setup"     element={<ProtectedRoute><InvestorSetup /></ProtectedRoute>} />
          <Route path="/org/setup"          element={<ProtectedRoute><OrgSetup /></ProtectedRoute>} />

          {/* ── Founder ── */}
          <Route path="/dashboard"      element={<ProtectedRoute><FounderDashboard /></ProtectedRoute>} />
          <Route path="/idea-submit"    element={<ProtectedRoute><IdeaSubmit /></ProtectedRoute>} />
          <Route path="/idea-eval"      element={<ProtectedRoute><AIEvaluation /></ProtectedRoute>} />
          <Route path="/matches"        element={<ProtectedRoute><MatchResults /></ProtectedRoute>} />
          <Route path="/incubation-hub" element={<ProtectedRoute><IncubationHub /></ProtectedRoute>} />
          <Route path="/workspaces"     element={<ProtectedRoute><Workspaces /></ProtectedRoute>} />

          {/* ── Collaborator ── */}
          <Route path="/collaborator/dashboard"     element={<ProtectedRoute><CollaboratorDashboard /></ProtectedRoute>} />
          <Route path="/collaborator/opportunities" element={<ProtectedRoute><Opportunities /></ProtectedRoute>} />
          <Route path="/collaborator/work"          element={<ProtectedRoute><MyWork /></ProtectedRoute>} />
          <Route path="/collaborator/performance"   element={<ProtectedRoute><Performance /></ProtectedRoute>} />
          <Route path="/collaborator/earnings"      element={<ProtectedRoute><Earnings /></ProtectedRoute>} />

          {/* ── Investor ── */}
          <Route path="/investor/dashboard" element={<ProtectedRoute><InvestorDashboard /></ProtectedRoute>} />
          <Route path="/investor/pipeline"  element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
          <Route path="/investor/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />

          {/* ── Organisation ── */}
          <Route path="/org/dashboard"  element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
          <Route path="/org/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
          <Route path="/org/talent"     element={<ProtectedRoute><TalentSearch /></ProtectedRoute>} />

          {/* ── Shared ── */}
          <Route path="/feed"                 element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/people"               element={<ProtectedRoute><People /></ProtectedRoute>} />
          <Route path="/projects"             element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/messages"             element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/notifications"        element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/settings"             element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/wallet"               element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/workspace/:projectId" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />

          {/* ── 404 ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ThemeToggle />
    </>
  )
}
