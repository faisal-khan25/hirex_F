import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useHooks';
import StatusBadge from '../../components/common/StatusBadge';
import ChatWindow from '../../components/chat/ChatWindow';
import api from '../../services/api';
import useSEO from '../../hooks/useSeo';
import './MyApplications.css';

/* ─── Interview Info Card ─────────────────────────────────────── */
function InterviewCard({ interview }) {
  if (!interview) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="interview-card">
      <div className="interview-card-header">
        <span className="interview-card-icon">📅</span>
        <strong>AI Interview Assigned</strong>
        <span className="interview-badge">
          {interview.status || 'PENDING'}
        </span>
      </div>
      <div className="interview-card-grid">
        {interview.positionTitle && (
          <div className="interview-field">
            <span className="interview-field-label">Position</span>
            <span className="interview-field-value">{interview.positionTitle}</span>
          </div>
        )}
        {interview.candidateName && (
          <div className="interview-field">
            <span className="interview-field-label">Candidate</span>
            <span className="interview-field-value">{interview.candidateName}</span>
          </div>
        )}
        {interview.scheduledAt && (
          <div className="interview-field">
            <span className="interview-field-label">📆 Scheduled</span>
            <span className="interview-field-value">{formatDate(interview.scheduledAt)}</span>
          </div>
        )}
        {interview.maxDurationMinutes && (
          <div className="interview-field">
            <span className="interview-field-label">⏱ Duration</span>
            <span className="interview-field-value">{interview.maxDurationMinutes} minutes</span>
          </div>
        )}
        {interview.interviewType && (
          <div className="interview-field">
            <span className="interview-field-label">🎥 Type</span>
            <span className="interview-field-value">{interview.interviewType}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN — Candidate Applications Page
═══════════════════════════════════════════════════ */
export default function MyApplications() {
  useSEO({ title: 'My Applications', description: 'Track the status of every job application you\u2019ve submitted on HireX.' });
  const { data: apps, loading } = useFetch('/api/jobseeker/applications');
  const [activeChat,      setActiveChat]      = useState(null);
  // Map<applicationId(string), AI InterviewSessionDto | null>
  const [interviewData,   setInterviewData]   = useState({});
  // Map<applicationId(string), live session token string | null>
  const [liveSessionData, setLiveSessionData] = useState({});
  const [expandedApp,     setExpandedApp]     = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);
  const navigate = useNavigate();

  // ─── Fetch AI interview data for shortlisted apps ───
  const fetchInterviewData = async (appsToCheck) => {
    if (!appsToCheck?.length) return;
    try {
      const results = await Promise.all(
        appsToCheck.map(app =>
          api.get(`/api/interview/application/${app.id}`)
            .then(res => ({ id: String(app.id), data: res.data }))
            .catch(() => ({ id: String(app.id), data: null }))
        )
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.data; });
      setInterviewData(map);
    } catch (err) {
      console.error('Failed to fetch interviews:', err);
    }
  };

  // ─── Fetch live interview session token for shortlisted apps ───
  // Calls GET /api/live-interview/candidate/{applicationId}
  // which returns the live session if recruiter has created one.
  const fetchLiveSessionData = async (appsToCheck) => {
    if (!appsToCheck?.length) return;
    try {
      const results = await Promise.all(
        appsToCheck.map(app =>
          api.get(`/api/live-interview/candidate/${app.id}`)
            .then(res => {
              // Backend may return the token in different fields — check all common names
              const data = res.data;
              const token =
                data?.candidateToken   ||
                data?.sessionToken     ||
                data?.liveSessionToken ||
                data?.token            ||
                null;
              return { id: String(app.id), token };
            })
            .catch(() => ({ id: String(app.id), token: null }))
        )
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.token; });
      setLiveSessionData(map);
    } catch (err) {
      console.error('Failed to fetch live sessions:', err);
    }
  };

  // ─── Initial fetch + polling every 30s ───
  useEffect(() => {
    if (!apps?.length) return;

    const toCheck = apps.filter(a =>
      a.status === 'SHORTLISTED' ||
      a.status === 'HIRED'       ||
      a.atsStatus === 'SHORTLISTED'
    );
    if (!toCheck.length) return;

    fetchInterviewData(toCheck);
    fetchLiveSessionData(toCheck);

    const interval = setInterval(() => {
      fetchInterviewData(toCheck);
      fetchLiveSessionData(toCheck);
    }, 30000);

    return () => clearInterval(interval);
  }, [apps]);

  // ─── Manual refresh ───
  const handleManualRefresh = async () => {
    if (!apps?.length) return;
    setRefreshing(true);
    const toCheck = apps.filter(a =>
      a.status === 'SHORTLISTED' ||
      a.status === 'HIRED'       ||
      a.atsStatus === 'SHORTLISTED'
    );
    await Promise.all([
      fetchInterviewData(toCheck),
      fetchLiveSessionData(toCheck),
    ]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        Loading applications…
      </div>
    );
  }

  const shortlistedApps = apps?.filter(a =>
    a.status === 'SHORTLISTED' || a.status === 'HIRED'
  ) || [];

  const openChat    = (app) => setActiveChat({ applicationId: app.id, recruiterName: app.companyName });
  const toggleExpand = (appId) => setExpandedApp(prev => prev === appId ? null : appId);

  return (
    <div className={`apps-page-layout ${activeChat ? 'apps-page-layout--chat-open' : ''}`}>

      {/* ── Left: main content ───────────────────────────────── */}
      <div className="apps-content-area">

        <div className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <h1>My Applications</h1>
              <p>Track all your job applications and interview details in one place</p>
            </div>
            {shortlistedApps.length > 0 && (
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: refreshing ? '#e5e7eb' : '#3b82f6',
                  color: refreshing ? '#6b7280' : '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: refreshing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                }}
                title="Refresh interview status from recruiter"
              >
                {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* Shortlisted banner */}
        {shortlistedApps.length > 0 && (
          <div className="shortlisted-banner">
            <span className="shortlisted-banner-icon">🎉</span>
            <div>
              <strong>Congratulations!</strong> You have been shortlisted for{' '}
              {shortlistedApps.length} position{shortlistedApps.length > 1 ? 's' : ''}.
              Check below for your interview details.
            </div>
          </div>
        )}

        {/* Empty State */}
        {apps?.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No applications yet</div>
            <div className="empty-subtitle">Browse jobs and start applying to see them here.</div>
          </div>
        )}

        {/* Applications List */}
        {apps?.length > 0 && (
          <div className="card applications-card">
            {apps.map((app) => {
              const interview       = interviewData[String(app.id)];
              const liveToken       = liveSessionData[String(app.id)];
              const hasInterview    = interview != null && typeof interview === 'object';
              const hasLiveSession  = !!liveToken;
              const isExpanded      = expandedApp === app.id;
              const isShortlisted   = app.status === 'SHORTLISTED' || app.status === 'HIRED';

              return (
                <div
                  key={app.id}
                  className={`app-row-card ${isShortlisted ? 'app-row-card--shortlisted' : ''} ${activeChat?.applicationId === app.id ? 'app-row-card--chat-active' : ''}`}
                >
                  {/* Main row */}
                  <div className="app-row-main">
                    <div className="app-row-left">
                      <div className="app-avatar">
                        {app.companyName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="app-company">{app.companyName || app.jobTitle}</div>
                        <div className="app-date">
                          {app.appliedAt
                            ? new Date(app.appliedAt).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="app-row-right">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <StatusBadge status={app.status} />
                        {hasInterview    && <StatusBadge status="INTERVIEW_SCHEDULED" />}
                        {hasLiveSession  && <StatusBadge status="LIVE_INTERVIEW_READY" />}
                      </div>

                      <div className="app-actions">

                        {/* Details toggle */}
                        {isShortlisted && (
                          <button className="btn-expand" onClick={() => toggleExpand(app.id)}>
                            {isExpanded ? '▲ Hide' : '▼ Details'}
                          </button>
                        )}

                        {/* Chat */}
                        {isShortlisted && (
                          <button
                            className={`btn-interact ${activeChat?.applicationId === app.id ? 'btn-interact--active' : ''}`}
                            onClick={() =>
                              activeChat?.applicationId === app.id
                                ? setActiveChat(null)
                                : openChat(app)
                            }
                          >
                            💬 {activeChat?.applicationId === app.id ? 'Close Chat' : 'Chat'}
                          </button>
                        )}

                        {/* AI Interview */}
                        {app.status === 'SHORTLISTED' && (
                          hasInterview ? (
                            <button
                              className="btn-interview"
                              onClick={() => navigate(`/interview/${app.id}`)}
                              title="Start your AI interview"
                            >
                              🤖 Start AI Interview
                            </button>
                          ) : (
                            interview === null ? (
                              <span className="btn-interview-pending" title="Waiting for recruiter to schedule interview">
                                ⏳ Interview Pending
                              </span>
                            ) : (
                              <span className="btn-interview-pending" style={{ opacity: 0.5 }}>
                                ⏳ Checking…
                              </span>
                            )
                          )
                        )}

                        {/* ✅ Join Live Interview — separate live session lookup */}
                        {isShortlisted && hasLiveSession && (
                          <button
                            className="btn-live-interview"
                            onClick={() => navigate(`/live-interview/candidate/${liveToken}`)}
                            title="Join your live video interview with the recruiter"
                          >
                            🎥 Join Live Interview
                          </button>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* Expanded interview details */}
                  {isShortlisted && isExpanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {hasInterview ? (
                        <InterviewCard interview={interview} />
                      ) : (
                        <div className="interview-pending-msg">
                          <span>⏳</span>
                          <div>
                            <strong>Interview Not Yet Scheduled</strong>
                            <p>Your recruiter will schedule an interview soon. Check back later or use the Refresh button above.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: docked chat panel ─────────────────────────── */}
      {activeChat && (
        <aside className="apps-chat-panel">
          <ChatWindow
            applicationId={activeChat.applicationId}
            recipientName={activeChat.recruiterName}
            onClose={() => setActiveChat(null)}
            embedded={true}
          />
        </aside>
      )}
    </div>
  );
}