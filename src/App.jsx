import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { InterviewProvider } from './context/Interviewcontext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicRoute from './components/common/PublicRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Navbar from './components/common/Navbar';
import DashboardHeader from './components/common/DashboardHeader';
import { lazy, Suspense } from 'react';

// Layouts (eager — small, always needed)
import JobSeekerLayout from './components/jobseeker/JobSeekerLayout';
import ManagerLayout   from './components/manager/ManagerLayout';
import AdminLayout     from './components/admin/AdminLayout';

// Home is eager-loaded (not lazy): it's the landing page for the vast
// majority of first-time visits, so lazily fetching its chunk after the
// app shell mounts would add an avoidable network round-trip before any
// content appears. Every other route is only needed after a click, so
// those stay code-split.
import Home from './pages/Home';

// Lazy-loaded pages
const Login           = lazy(() => import('./pages/Login'));
const Register        = lazy(() => import('./pages/Register'));
const Contact         = lazy(() => import('./pages/Contact'));
const PrivacyPolicy      = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const BrowseJobs      = lazy(() => import('./pages/jobseeker/BrowseJobs'));
const MyApplications  = lazy(() => import('./pages/jobseeker/MyApplications'));
const JobSeekerConversations = lazy(() => import('./pages/jobseeker/JobSeekerConversations'));
const MyProfile       = lazy(() => import('./pages/jobseeker/MyProfile'));
const CompanyProfile  = lazy(() => import('./pages/manager/CompanyProfile'));
const ManageJobs      = lazy(() => import('./pages/manager/ManageJobs'));
const Applicants      = lazy(() => import('./pages/manager/Applicants'));
const AtsChecker      = lazy(() => import('./pages/manager/AtsChecker'));
const RecruiterChat   = lazy(() => import('./pages/manager/RecruiterChat'));
const InterviewReport = lazy(() => import('./pages/manager/InterviewReport'));
const LiveBroadcastDashboard = lazy(() => import('./pages/manager/LiveBroadcastDashboard'));
const LiveBroadcastViewer   = lazy(() => import('./pages/manager/LiveBroadcastViewer'));
const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard'));
// NOTE: filename has a trailing space — must match exactly
const AIInterview     = lazy(() => import('./pages/AIInterview '));

// Live Interview rooms (lazy-loaded — large, only needed when in a session)
const CandidateInterviewRoom = lazy(() => import('./pages/interview/CandidateInterviewRoom'));
const RecruiterInterviewRoom = lazy(() => import('./pages/interview/RecruiterInterviewRoom'));

const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', flexDirection: 'column', gap: '12px',
  }}>
    <div style={{
      width: '36px', height: '36px',
      border: '3px solid #e5e7eb', borderTop: '3px solid #2563eb',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</span>
  </div>
);

/**
 * Pulls :applicationId from the URL and scopes InterviewProvider to this session only.
 */
function AIInterviewRoute() {
  const { applicationId } = useParams();
  return (
    <InterviewProvider>
      <ErrorBoundary
        fallbackTitle="Interview screen hit an error"
        fallbackMessage="Your progress is saved on our servers — reloading this page will resume where you left off."
      >
        <AIInterview applicationId={applicationId} />
      </ErrorBoundary>
    </InterviewProvider>
  );
}

/**
 * Decides which header renders at the top of the page, and it's the only
 * place that decision is made — Navbar itself no longer knows or cares
 * about auth state.
 *
 * Three cases:
 *
 *  1. Already inside an authenticated layout (/jobseeker, /manager, /admin,
 *     /interview, /live-interview) — those layouts mount their own
 *     DashboardHeader already, so render nothing here to avoid duplicate
 *     chrome.
 *  2. On a public marketing page (Home, Contact, etc.):
 *       - while AuthContext is still restoring the session from
 *         localStorage (`loading === true`), render nothing. This is what
 *         prevents the Login/Register-flavored Navbar from flashing for a
 *         split second before we know the user is actually signed in.
 *       - once restored, a logged-in user gets <DashboardHeader showLogo />
 *         — the identical header used on every dashboard, so notifications,
 *         theme toggle, profile dropdown, spacing, and responsiveness all
 *         match exactly, with zero duplicated markup.
 *       - a signed-out visitor gets the marketing <Navbar />.
 */
const AUTHENTICATED_PREFIXES = ['/jobseeker', '/manager', '/admin', '/interview', '/live-interview'];

function ConditionalNavbar() {
  const location = useLocation();
  const { user, loading } = useAuth();

  const isAuthenticatedRoute = AUTHENTICATED_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  if (isAuthenticatedRoute) return null;

  if (loading) return null;

  return user ? <DashboardHeader showLogo /> : <Navbar />;
}

/**
 * Skip-to-content control, implemented as a button (not an anchor) so no
 * href/anchor navigation is used anywhere in the app shell. Moves focus
 * directly to the <main> element, which is made focusable via tabIndex={-1}.
 */
function SkipToContent() {
  return (
    <button
      type="button"
      className="skip-link"
      onClick={() => {
        const el = document.getElementById('main-content');
        el?.focus();
      }}
    >
      Skip to main content
    </button>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <SkipToContent />
            <ConditionalNavbar />
            <Suspense fallback={<PageLoader />}>
              <main id="main-content" tabIndex={-1}>
                <Routes>
              {/* Public routes */}
              <Route path="/"         element={<Home />} />
              <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/jobs"     element={<BrowseJobs />} />
              <Route path="/contact"  element={<Contact />} />
              <Route path="/privacy-policy"       element={<PrivacyPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

              {/* AI Interview — scoped InterviewProvider, jobseeker only */}
              <Route path="/interview/:applicationId" element={
                <ProtectedRoute role="JOBSEEKER">
                  <AIInterviewRoute />
                </ProtectedRoute>
              } />

              {/* ── Live Interview rooms ──────────────────────────────────────
                  These are intentionally outside the jobseeker/manager nested
                  layouts so the rooms render full-screen without any header
                  chrome. Neither the marketing Navbar nor the DashboardHeader
                  is mounted here (see AUTHENTICATED_PREFIXES above) — the
                  rooms use min-height: 100vh and their own header bars.

                  URL format: /live-interview/candidate/<sessionToken>
                              /live-interview/recruiter/<sessionToken>

                  The sessionToken is the UUID generated by the backend's
                  createLiveSession() and embedded in the candidate invite link.
              ─────────────────────────────────────────────────────────────── */}
              <Route path="/live-interview/candidate/:sessionToken" element={
                <ProtectedRoute role="JOBSEEKER">
                  <CandidateInterviewRoom />
                </ProtectedRoute>
              } />

              <Route path="/live-interview/recruiter/:sessionToken" element={
                <ProtectedRoute role="MANAGER">
                  <RecruiterInterviewRoom />
                </ProtectedRoute>
              } />

              {/* Jobseeker routes */}
              <Route path="/jobseeker/*" element={
                <ProtectedRoute role="JOBSEEKER">
                  <JobSeekerLayout>
                    <Routes>
                      <Route path="browse"       element={<BrowseJobs />} />
                      <Route path="applications" element={<MyApplications />} />
                      <Route path="conversations" element={<JobSeekerConversations />} />
                      <Route path="profile"      element={<MyProfile />} />
                      <Route path="*"            element={<Navigate to="browse" replace />} />
                    </Routes>
                  </JobSeekerLayout>
                </ProtectedRoute>
              } />

              {/* Manager routes */}
              <Route path="/manager/*" element={
                <ProtectedRoute role="MANAGER">
                  <ManagerLayout>
                    <Routes>
                      <Route path="company"                     element={<CompanyProfile />} />
                      <Route path="jobs"                        element={<ManageJobs />} />
                      <Route path="applicants"                  element={<Applicants />} />
                      <Route path="ats"                         element={<AtsChecker />} />
                      <Route path="chat"                        element={<RecruiterChat />} />
                      <Route path="interview/:sessionId/report" element={<InterviewReport />} />
                      <Route path="live-broadcasts"                          element={
                        <ErrorBoundary fallbackTitle="Live interviews unavailable" fallbackMessage="We couldn't load the live broadcasts list. Try again, or come back in a moment.">
                          <LiveBroadcastDashboard />
                        </ErrorBoundary>
                      } />
                      <Route path="live-broadcasts/:interviewSessionId"      element={
                        <ErrorBoundary fallbackTitle="Live broadcast unavailable" fallbackMessage="This live interview view hit an unexpected error. The candidate's interview itself is unaffected.">
                          <LiveBroadcastViewer />
                        </ErrorBoundary>
                      } />
                      <Route path="*"                           element={<Navigate to="jobs" replace />} />
                    </Routes>
                  </ManagerLayout>
                </ProtectedRoute>
              } />

              {/* Admin routes */}
              <Route path="/admin/*" element={
                <ProtectedRoute role="ADMIN">
                  <AdminLayout>
                    <Routes>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="*"         element={<Navigate to="dashboard" replace />} />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </Suspense>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;