import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFetch, useDebouncedValue } from '../../hooks/useHooks';
import api, { getAuthenticatedBlobUrl } from '../../services/api';
import CandidateDetailModal, { ScoreBadge } from '../../components/manager/CandidateDetailModal';
import useSEO from '../../hooks/useSeo';
import './Applicants.css';

const PAGE_SIZE = 10;

function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={`ats-toast ats-toast--${type}`}>
      <span>{message}</span>
      <button className="ats-toast-close" onClick={onClose}>×</button>
    </div>
  );
}

const STATUS_CFG = {
  HIRED:               { label: 'Hired', class: 'hired' },
  SHORTLISTED:         { label: 'Shortlisted', class: 'shortlisted' },
  REJECTED:            { label: 'Archived', class: 'rejected' },
  APPLIED:             { label: 'New Application', class: 'applied' },
  PENDING:             { label: 'Pending Review', class: 'applied' },
  UNDER_REVIEW:        { label: 'Under Review', class: 'review' },
  INTERVIEW_SCHEDULED: { label: 'Interview Lineup', class: 'interview' },
  INTERVIEW_COMPLETED: { label: 'Interview Met', class: 'completed' },
};

export default function Applicants() {
  useSEO({ title: 'Candidate Pipeline Workspace', description: 'Enterprise structural application screening terminal.' });
  const { data: jobs, loading: jobsLoading } = useFetch('/api/manager/jobs');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const [activeApplicant, setActiveApplicant] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [scoreRange, setScoreRange] = useState('ALL');
  const [sortField, setSortField] = useState('appliedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQ, setSearchQ] = useState('');
  const debouncedSearch = useDebouncedValue(searchQ, 250);
  const [page, setPage] = useState(1);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const openResume = async (resumeId) => {
    if (!resumeId) return;
    try {
      const blobUrl = await getAuthenticatedBlobUrl(`/api/manager/resume/${resumeId}/download`);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      showToast('Failed to stream resume pipeline.', 'error');
    }
  };

  const loadApplicants = useCallback(async (job) => {
    setSelectedJob(job);
    setLoadingApps(true);
    setLoadError('');
    setFilterStatus('ALL');
    setScoreRange('ALL');
    setSortField('appliedAt');
    setSortDir('desc');
    setSearchQ('');
    setPage(1);
    try {
      const res = await api.get(`/api/jobs/${job.id}/applicants`);
      setApplicants(res.data || []);
    } catch (e) {
      setApplicants([]);
      setLoadError(e.response?.data?.error || 'Failed to populate core list.');
    } finally {
      setLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    const jobIdParam = searchParams.get('jobId');
    if (!jobIdParam || !jobs?.length || selectedJob) return;
    const job = jobs.find(j => String(j.id) === String(jobIdParam));
    if (job) loadApplicants(job);
  }, [jobs, searchParams, selectedJob, loadApplicants]);

  const performStatusUpdate = async (applicant, newStatus, successMsg) => {
    setBusyIds(prev => new Set(prev).add(applicant.applicationId));
    try {
      const res = await api.patch(`/api/applications/${applicant.applicationId}/status`, { status: newStatus });
      setApplicants(prev => prev.map(a => a.applicationId == res.data.applicationId ? res.data : a));
      showToast(successMsg, 'success');
    } catch (e) {
      showToast('Pipeline mutation failed.', 'error');
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(applicant.applicationId); return s; });
      setConfirmAction(null);
    }
  };

  const counts = useMemo(() => ({
    ALL: applicants.length,
    PENDING: applicants.filter(a => ['APPLIED', 'UNDER_REVIEW'].includes(a.status)).length,
    SHORTLISTED: applicants.filter(a => a.status === 'SHORTLISTED').length,
    INTERVIEW_SCHEDULED: applicants.filter(a => a.status === 'INTERVIEW_SCHEDULED').length,
    HIRED: applicants.filter(a => a.status === 'HIRED').length,
    REJECTED: applicants.filter(a => a.status === 'REJECTED').length,
  }), [applicants]);

  const filtered = useMemo(() => {
    return applicants
      .filter(a => filterStatus === 'ALL' || (filterStatus === 'PENDING' ? ['APPLIED', 'UNDER_REVIEW'].includes(a.status) : a.status === filterStatus))
      .filter(a => scoreRange === 'ALL' || (scoreRange === 'HIGH' ? (a.atsScore >= 80) : scoreRange === 'MID' ? (a.atsScore >= 60 && a.atsScore < 80) : (a.atsScore < 60)))
      .filter(a => !debouncedSearch || a.candidateName?.toLowerCase().includes(debouncedSearch.toLowerCase()) || a.candidateEmail?.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .sort((a, b) => {
        const mul = sortDir === 'desc' ? -1 : 1;
        if (sortField === 'atsScore') return mul * ((a.atsScore ?? 0) - (b.atsScore ?? 0));
        return mul * (a.appliedAt || '').localeCompare(b.appliedAt || '');
      });
  }, [applicants, filterStatus, scoreRange, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="naukri-workspace">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Control Navigation Strip */}
      <div className="naukri-sidebar">
        <div className="sidebar-title">RECRUITMENT DESK</div>
        {jobs?.map(job => (
          <div key={job.id} className={`job-node ${selectedJob?.id === job.id ? 'active' : ''}`} onClick={() => loadApplicants(job)}>
            <div className="job-node-title">{job.title}</div>
            <div className="job-node-meta">📍 {job.location}</div>
          </div>
        ))}
      </div>

      <div className="naukri-panel">
        {selectedJob ? (
          <>
            <div className="naukri-hdr">
              <div>
                <h1>{selectedJob.title} <span className="hdr-id">Ref ID: NX-{selectedJob.id}</span></h1>
                <p>{selectedJob.location} • Functional Assessment Feed</p>
              </div>
            </div>

            {/* Application Filters Tracking Ribbon */}
            <div className="naukri-tabs-ribbon">
              {[
                { id: 'ALL', label: 'All Profiles', count: counts.ALL },
                { id: 'PENDING', label: 'Undecided / New', count: counts.PENDING },
                { id: 'SHORTLISTED', label: 'Shortlisted', count: counts.SHORTLISTED },
                { id: 'INTERVIEW_SCHEDULED', label: 'Lineups', count: counts.INTERVIEW_SCHEDULED },
                { id: 'HIRED', label: 'Hired Record', count: counts.HIRED },
                { id: 'REJECTED', label: 'Archived', count: counts.REJECTED },
              ].map(tab => (
                <button key={tab.id} className={`ribbon-tab ${filterStatus === tab.id ? 'active' : ''}`} onClick={() => { setFilterStatus(tab.id); setPage(1); }}>
                  {tab.label} <span className="tab-badge">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Control Filters Area */}
            <div className="naukri-filter-bar">
              <input 
                className="nk-search" 
                placeholder="Search candidates by exact text string context match (Name, Email)..." 
                value={searchQ} 
                onChange={e => setSearchQ(e.target.value)} 
              />
              <select className="nk-select" value={scoreRange} onChange={e => setScoreRange(e.target.value)}>
                <option value="ALL">All Scores Indices</option>
                <option value="HIGH">Highly Matched (&gt;80%)</option>
                <option value="MID">Partial Overlap (60-79%)</option>
              </select>
              <select className="nk-select" value={`${sortField}:${sortDir}`} onChange={e => { const [f, d] = e.target.value.split(':'); setSortField(f); setSortDir(d); }}>
                <option value="appliedAt:desc">Sort: Date Applied (Recent First)</option>
                <option value="atsScore:desc">Sort: Highest Match Index</option>
              </select>
            </div>

            {/* Profiles Feed Block */}
            <div className="profiles-feed">
              {loadingApps ? <div className="feed-status-msg">Streaming matching profile frames from system directory...</div> : null}
              
              {!loadingApps && !pageItems.length && (
                <div className="empty-feed-card">No records match the active parameter matrices configured.</div>
              )}

              {!loadingApps && pageItems.map(app => {
                const busy = busyIds.has(app.applicationId);
                const statusMeta = STATUS_CFG[app.status] || { label: app.status, class: 'applied' };
                
                return (
                  <div key={app.applicationId} className={`candidate-profile-card ${app.status === 'REJECTED' ? 'archived-dim' : ''}`}>
                    
                    {/* Header Matrix Block */}
                    <div className="card-top-row">
                      <div className="applicant-primary-info" onClick={() => setActiveApplicant(app)}>
                        <div className="nk-avatar">{app.candidateName?.[0]}</div>
                        <div>
                          <h3 className="candidate-headline-name">{app.candidateName} <span className="verified-badge">✔ Verified Identity</span></h3>
                          <p className="candidate-subtext">Registered Window: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Recent'}</p>
                        </div>
                      </div>
                      
                      <div className="metric-rating-badges">
                        <div className="rating-pill">
                          <span className="lbl">ATS Fit</span>
                          <span className="val">{app.atsScore ? `${app.atsScore}%` : '—'}</span>
                        </div>
                        <span className={`state-badge ${statusMeta.class}`}>{statusMeta.label}</span>
                      </div>
                    </div>

                    {/* Meta Parameter Block Table Representation */}
                    <div className="candidate-structural-specs">
                      <div className="spec-unit">
                        <span className="spec-lbl">Primary Contact</span>
                        <span className="spec-val user-email">{app.candidateEmail}</span>
                      </div>
                      <div className="spec-unit">
                        <span className="spec-lbl">Notice Period Timeline</span>
                        <span className="spec-val">Immediate / Active</span>
                      </div>
                      <div className="spec-unit">
                        <span className="spec-lbl">Structural Match Vector</span>
                        <span className="spec-val text-truncate">Core Infrastructure Frameworks Layer</span>
                      </div>
                    </div>

                    {/* Action Execution Tray */}
                    <div className="card-action-tray">
                      <div className="tray-left">
                        {app.resumeId ? (
                          <button type="button" className="action-link-btn primary-stream" onClick={() => openResume(app.resumeId)}>
                            📥 Pull Document Payload
                          </button>
                        ) : <span className="no-payload-lbl">Document String Fragment Missing</span>}

                        {app.aiInterviewSessionId && (
                          <button type="button" className="action-link-btn" onClick={() => navigate(`/manager/interview/${app.aiInterviewSessionId}/report`)}>
                            📊 Deep System Evaluation
                          </button>
                        )}
                      </div>

                      <div className="tray-right-controls">
                        <button 
                          className="tray-btn btn-success-action" 
                          disabled={busy || ['SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(app.status)}
                          onClick={() => performStatusUpdate(app, 'SHORTLISTED', 'Profile advanced to Shortlist.')}
                        >
                          Advance Candidate
                        </button>
                        <button 
                          className="tray-btn btn-danger-action" 
                          disabled={busy || ['REJECTED', 'HIRED'].includes(app.status)}
                          onClick={() => performStatusUpdate(app, 'REJECTED', 'Profile moved to passive archive matrix.')}
                        >
                          Archive
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Standard Pagination Bar */}
            {filtered.length > PAGE_SIZE && (
              <div className="naukri-pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous Set</button>
                <span>Stack Segment {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next Set →</button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-panel-prompt">Select an open requisition workflow leftwards to stream verified candidates.</div>
        )}
      </div>
    </div>
  );
}