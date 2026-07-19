import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useHooks';
import StatusBadge from '../../components/common/StatusBadge';
import ChatWindow from '../../components/chat/ChatWindow';
import api from '../../services/api';
import useSEO from '../../hooks/useSeo';
import './MyApplications.css';

/* ─── Interview Data Details Dropdown Row ────────────────────── */
function InterviewCard({ interview }) {
  if (!interview) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="bj-expanded-details-panel">
      <div className="bj-panel-header">
        <span className="bj-panel-icon">📅</span>
        <strong>AI Interview Assignment Records</strong>
        <span className="bj-panel-badge">{interview.status || 'PENDING'}</span>
      </div>
      <div className="bj-panel-grid">
        {interview.positionTitle && (
          <div className="bj-panel-cell">
            <span className="bj-cell-lbl">Target Position</span>
            <span className="bj-cell-val">{interview.positionTitle}</span>
          </div>
        )}
        {interview.candidateName && (
          <div className="bj-panel-cell">
            <span className="bj-cell-lbl">Assigned Candidate</span>
            <span className="bj-cell-val">{interview.candidateName}</span>
          </div>
        )}
        {interview.scheduledAt && (
          <div className="bj-panel-cell">
            <span className="bj-cell-lbl">Scheduled Windows</span>
            <span className="bj-cell-val">{formatDate(interview.scheduledAt)}</span>
          </div>
        )}
        {interview.maxDurationMinutes && (
          <div className="bj-panel-cell">
            <span className="bj-cell-lbl">Max Duration Limit</span>
            <span className="bj-cell-val">{interview.maxDurationMinutes} Minutes</span>
          </div>
        )}
        {interview.interviewType && (
          <div className="bj-panel-cell">
            <span className="bj-cell-lbl">Platform Engine Mode</span>
            <span className="bj-cell-val">{interview.interviewType}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN — Candidate Applications Administration
   ═══════════════════════════════════════════════════ */
export default function MyApplications() {
  useSEO({ 
    title: 'My Applications', 
    description: 'Track the operational deployment and pipeline status of every job application submitted on HireX.' 
  });
  
  const { data: apps, loading } = useFetch('/api/jobseeker/applications');
  const [activeChat,      setActiveChat]      = useState(null);
  const [interviewData,   setInterviewData]   = useState({});
  const [liveSessionData, setLiveSessionData] = useState({});
  const [expandedApp,     setExpandedApp]     = useState(null);
  const [refreshing,      setRefreshing]      = useState(false);
  const navigate = useNavigate();

  // ─── Synchronize AI interview records across open pipelines ───
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
      console.error('Operational failure updating interview indices:', err);
    }
  };

  // ─── Synchronize live interview connection hooks ───
  const fetchLiveSessionData = async (appsToCheck) => {
    if (!appsToCheck?.length) return;
    try {
      const results = await Promise.all(
        appsToCheck.map(app =>
          api.get(`/api/live-interview/candidate/${app.id}`)
            .then(res => {
              const data = res.data;
              const token = data?.candidateToken || data?.sessionToken || data?.liveSessionToken || data?.token || null;
              return { id: String(app.id), token };
            })
            .catch(() => ({ id: String(app.id), token: null }))
        )
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.token; });
      setLiveSessionData(map);
    } catch (err) {
      console.error('Operational failure tracking session access indices:', err);
    }
  };

  // ─── Polling System Core initialization ───
  useEffect(() => {
    if (!apps?.length) return;

    const toCheck = apps.filter(a =>
      a.status === 'SHORTLISTED' || a.status === 'HIRED' || a.atsStatus === 'SHORTLISTED'
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

  // ─── On-Demand Registry Sync ───
  const handleManualRefresh = async () => {
    if (!apps?.length) return;
    setRefreshing(true);
    const toCheck = apps.filter(a =>
      a.status === 'SHORTLISTED' || a.status === 'HIRED' || a.atsStatus === 'SHORTLISTED'
    );
    await Promise.all([
      fetchInterviewData(toCheck),
      fetchLiveSessionData(toCheck),
    ]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="bj-loading">
        <div className="bj-spinner" />
        Syncing application database records…
      </div>
    );
  }

  const shortlistedApps = apps?.filter(a => a.status === 'SHORTLISTED' || a.status === 'HIRED') || [];
  const openChat = (app) => setActiveChat({ applicationId: app.id, recruiterName: app.companyName });
  const toggleExpand = (appId) => setExpandedApp(prev => prev === appId ? null : appId);

  return (
    <div className={`bj-page-layout ${activeChat ? 'bj-page-layout--chat-open' : ''}`}>
      
      {/* ── Left Content Context ─────────────────────────────── */}
      <div className="bj-main-content-area">
        
        <div className="bj-topbar">
          <div>
            <h1>My Applications</h1>
            <p className="bj-count">
              {apps?.length ? `${apps.length} pipeline entries currently recorded in repository` : '0 active entries found'}
            </p>
          </div>
          {shortlistedApps.length > 0 && (
            <button 
              className="bj-sync-btn"
              onClick={handleManualRefresh} 
              disabled={refreshing}
            >
              {refreshing ? '🔄 Syncing Pipelines...' : '🔄 Sync Pipeline Data'}
            </button>
          )}
        </div>

        {/* Shortlisted Broadcast Banner */}
        {shortlistedApps.length > 0 && (
          <div className="bj-broadcast-banner">
            <span className="bj-broadcast-icon">🎉</span>
            <div>
              <strong>Action Required:</strong> Internal shortlisting parameters matching your candidate profile have been triggered across <strong>{shortlistedApps.length} active process listings</strong>. Review required steps below.
            </div>
          </div>
        )}

        {/* Empty State Template */}
        {apps?.length === 0 && (
          <div className="bj-empty">
            <div className="bj-empty-icon">📂</div>
            <h3>No tracked entries found</h3>
            <p>You have not deployed applications to any active job listings yet.</p>
          </div>
        )}

        {/* Tabular Administrative Layout Frame */}
        {apps?.length > 0 && (
          <div className="bj-table-container">
            {/* Column Title Headings */}
            <div className="bj-table-header">
              <div className="bj-col-info">Company Entity / Hub</div>
              <div className="bj-col-meta">Submission Parameters</div>
              <div className="bj-col-status">Pipeline Metric Status</div>
              <div className="bj-col-actions">Operational Actions</div>
            </div>

            {/* Table Dynamic Content Nodes */}
            <div className="bj-table-body">
              {apps.map((app) => {
                const interview      = interviewData[String(app.id)];
                const liveToken      = liveSessionData[String(app.id)];
                const hasInterview    = interview != null && typeof interview === 'object';
                const hasLiveSession  = !!liveToken;
                const isExpanded      = expandedApp === app.id;
                const isShortlisted   = app.status === 'SHORTLISTED' || app.status === 'HIRED';

                return (
                  <div 
                    key={app.id} 
                    className={`bj-table-row-container ${isShortlisted ? 'bj-row--shortlisted' : ''} ${activeChat?.applicationId === app.id ? 'bj-row--chat-active' : ''}`}
                  >
                    {/* Primary Tabular Context Row Line */}
                    <div className="bj-table-row">
                      
                      {/* Column 1: Company Entity Info */}
                      <div className="bj-col-info">
                        <div className="bj-logo">
                          {app.companyName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="bj-info-text">
                          <h3 className="bj-job-title">{app.companyName || app.jobTitle}</h3>
                          <span className="bj-posted-stamp">Role Track: {app.jobTitle || 'General Application'}</span>
                        </div>
                      </div>

                      {/* Column 2: Date Parameters */}
                      <div className="bj-col-meta">
                        <div className="bj-meta-cell">
                          <span className="bj-meta-lbl">Deployed</span>
                          <span className="bj-meta-val highlight">
                            {app.appliedAt 
                              ? new Date(app.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
                              : '—'
                            }
                          </span>
                        </div>
                        <div className="bj-meta-cell">
                          <span className="bj-meta-lbl">System ID</span>
                          <span className="bj-meta-val">#{String(app.id).slice(-6).toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Column 3: Badge Status Ensembles */}
                      <div className="bj-col-status">
                        <StatusBadge status={app.status} />
                        {hasInterview && <StatusBadge status="INTERVIEW_SCHEDULED" />}
                        {hasLiveSession && <StatusBadge status="LIVE_INTERVIEW_READY" />}
                      </div>

                      {/* Column 4: Operational Layout Action Triggers */}
                      <div className="bj-col-actions">
                        {isShortlisted && (
                          <button className="bj-action-secondary-btn" onClick={() => toggleExpand(app.id)}>
                            {isExpanded ? '▲ Hide Details' : '▼ View Records'}
                          </button>
                        )}

                        {isShortlisted && (
                          <button
                            className={`bj-action-secondary-btn ${activeChat?.applicationId === app.id ? 'active' : ''}`}
                            onClick={() => activeChat?.applicationId === app.id ? setActiveChat(null) : openChat(app)}
                          >
                            💬 {activeChat?.applicationId === app.id ? 'Close Panel' : 'Chat Hub'}
                          </button>
                        )}

                        {app.status === 'SHORTLISTED' && (
                          hasInterview ? (
                            <button
                              className="bj-action-primary-btn accent"
                              onClick={() => navigate(`/interview/${app.id}`)}
                            >
                              🤖 Start AI Session
                            </button>
                          ) : (
                            <span className="bj-action-disabled-status">
                              {interview === null ? '⏳ Scheduling Pending' : '⏳ Initializing…'}
                            </span>
                          )
                        )}

                        {isShortlisted && hasLiveSession && (
                          <button
                            className="bj-action-primary-btn urgent"
                            onClick={() => navigate(`/live-interview/candidate/${liveToken}`)}
                          >
                            🎥 Enter Live Room
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Lower Drawer for Nested Interview Metrics */}
                    {isShortlisted && isExpanded && (
                      <div className="bj-table-row-drawer">
                        {hasInterview ? (
                          <InterviewCard interview={interview} />
                        ) : (
                          <div className="bj-drawer-pending-notice">
                            <span>⏳</span>
                            <div>
                              <strong>Verification Assessment Pipeline Unassigned</strong>
                              <p>The reviewing recruiter has not pushed scheduling tokens into the live ecosystem. System will keep polling.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Right Content Sidebar Panel: Docked Chat Interface ────────────────── */}
      {activeChat && (
        <aside className="bj-docked-chat-sidebar">
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