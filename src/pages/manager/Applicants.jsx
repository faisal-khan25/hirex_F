import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFetch, useDebouncedValue } from '../../hooks/useHooks';
import api, { getAuthenticatedBlobUrl } from '../../services/api';
import CandidateDetailModal, { ScoreBadge } from '../../components/manager/CandidateDetailModal';
import './Applicants.css';

const resumeUrlFor = (applicant) =>
  applicant?.resumeId
    ? `${import.meta.env.VITE_API_URL || ''}/api/manager/resume/${applicant.resumeId}/download`
    : null;
    const openResume = async (resumeId) => {
  if (!resumeId) return;
  try {
    const blobUrl = await getAuthenticatedBlobUrl(`/api/manager/resume/${resumeId}/download`);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  } catch (e) {
    showToast('Failed to load resume. Please try again.', 'error');
  }
};

const PAGE_SIZE = 10;

/* ─── Toast ─────────────────────────────────────────────────────── */
function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={`ats-toast ats-toast--${type}`}>
      <span>{message}</span>
      <button className="ats-toast-close" onClick={onClose}>×</button>
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────── */
const STATUS_CFG = {
  HIRED:               { bg: '#dcfce7', color: '#16a34a', icon: '🏆', label: 'Hired' },
  SHORTLISTED:         { bg: '#ede9fe', color: '#7c3aed', icon: '✅', label: 'Shortlisted' },
  REJECTED:            { bg: '#fee2e2', color: '#dc2626', icon: '✕',  label: 'Rejected' },
  APPLIED:             { bg: '#dbeafe', color: '#2563eb', icon: '📋', label: 'Applied' },
  PENDING:             { bg: '#dbeafe', color: '#2563eb', icon: '⏳', label: 'Pending' },
  UNDER_REVIEW:        { bg: '#fef9c3', color: '#a16207', icon: '🔎', label: 'Under Review' },
  INTERVIEW_SCHEDULED: { bg: '#fef9c3', color: '#b45309', icon: '📅', label: 'Interview Scheduled' },
  INTERVIEW_COMPLETED: { bg: '#e0f2fe', color: '#0369a1', icon: '🎤', label: 'Interview Completed' },
  INTERVIEW_PASSED:    { bg: '#dcfce7', color: '#15803d', icon: '✅', label: 'Interview Passed' },
  INTERVIEW_FAILED:    { bg: '#fee2e2', color: '#b91c1c', icon: '✕',  label: 'Interview Failed' },
};
function StatusBadge({ status, hiredAt }) {
  const s = STATUS_CFG[status] || { bg: '#f3f4f6', color: '#6b7280', icon: '•', label: status };
  return (
    <span className="status-pill" style={{ background: s.bg, color: s.color }}>
      {s.icon} {s.label}
      {status === 'HIRED' && hiredAt && (
        <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>
          · {new Date(hiredAt).toLocaleDateString()}
        </span>
      )}
    </span>
  );
}

/* ─── Confirm Dialog ─────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel, tone = 'default', onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className={`confirm-btn confirm-btn--${tone}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton Row ──────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="apps-skel-row">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i}><div className="apps-skel-block" /></td>
      ))}
    </tr>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN — Applicants Page (ATS-style table)
═══════════════════════════════════════════════════ */
export default function Applicants() {
  const { data: jobs, loading: jobsLoading } = useFetch('/api/manager/jobs');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedJob,  setSelectedJob]  = useState(null);
  const [applicants,   setApplicants]   = useState([]);
  const [loadingApps,  setLoadingApps]  = useState(false);
  const [loadError,    setLoadError]    = useState('');
  const [toast,        setToast]        = useState(null);
  const [activeApplicant, setActiveApplicant] = useState(null); // for detail modal
  const [confirmAction, setConfirmAction]     = useState(null); // { applicant, type }
  const [busyIds,       setBusyIds]           = useState(new Set());

  // Filters / search / sort / pagination
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [scoreRange,   setScoreRange]   = useState('ALL'); // ALL | HIGH | MID | LOW
  const [sortField,    setSortField]    = useState('appliedAt');
  const [sortDir,       setSortDir]     = useState('desc');
  const [searchQ,       setSearchQ]     = useState('');
  const debouncedSearch = useDebouncedValue(searchQ, 250);
  const [page,           setPage]       = useState(1);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Load applicants for selected job — strictly scoped by jobId ─────────
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
      setLoadError(e.userMessage || e.response?.data?.error || 'Failed to load applicants.');
      showToast('Failed to load applicants. Please try again.', 'error');
    } finally {
      setLoadingApps(false);
    }
  }, [showToast]);

  // ── Auto-select job from ?jobId= query param ────────────────────────────
  useEffect(() => {
    const jobIdParam = searchParams.get('jobId');
    if (!jobIdParam || !jobs?.length || selectedJob) return;
    const job = jobs.find(j => String(j.id) === String(jobIdParam));
    if (job) loadApplicants(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, searchParams]);

  // ── Status update workflow (Shortlist / Reject / Schedule Interview) ────
  const performStatusUpdate = async (applicant, newStatus, successMsg) => {
    setBusyIds(prev => new Set(prev).add(applicant.applicationId));
    try {
      const res = await api.patch(`/api/applications/${applicant.applicationId}/status`, { status: newStatus });
      const updated = res.data;
      // Update UI immediately — no page refresh
      setApplicants(prev => prev.map(a => a.applicationId == updated.applicationId ? updated : a));
      setActiveApplicant(prev => (prev && prev.applicationId == updated.applicationId) ? updated : prev);
      showToast(successMsg, 'success');
    } catch (e) {
      showToast(e.userMessage || e.response?.data?.error || 'Action failed. Please try again.', 'error');
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(applicant.applicationId); return s; });
      setConfirmAction(null);
    }
  };

  // Lightweight refetch — reloads applicant data for the current job WITHOUT
  // resetting filters/search/sort/page (unlike loadApplicants, which is used
  // for the initial job switch).
  const refetchApplicants = useCallback(async (job) => {
    try {
      const res = await api.get(`/api/jobs/${job.id}/applicants`);
      setApplicants(res.data || []);
    } catch (e) {
      showToast('Failed to refresh applicants. Please try again.', 'error');
    }
  }, [showToast]);

  const requestShortlist = (applicant) =>
    setConfirmAction({ applicant, type: 'SHORTLISTED' });
  const requestReject = (applicant) =>
    setConfirmAction({ applicant, type: 'REJECTED' });
  const requestSchedule = (applicant) => {
    if (!applicant.canScheduleInterview) {
      showToast('Only shortlisted candidates can have a live interview scheduled.', 'error');
      return;
    }
    setConfirmAction({ applicant, type: 'INTERVIEW_SCHEDULED' });
  };

  // ── ATS Analysis workflow (single candidate "Analyze ATS" button) ───────
  // This is the ONLY place a score is calculated for one applicant — it is
  // never computed or displayed until this is explicitly triggered.
  const performAnalyzeAts = async (applicant) => {
    setBusyIds(prev => new Set(prev).add(applicant.applicationId));
    try {
      const res = await api.post(`/api/applications/${applicant.applicationId}/analyze-ats`);
      const updated = res.data;
      let matched = false;
      setApplicants(prev => prev.map(a => {
        if (a.applicationId == updated.applicationId) { matched = true; return updated; }
        return a;
      }));
      setActiveApplicant(prev => (prev && prev.applicationId == updated.applicationId) ? updated : prev);
      showToast(`✅ ATS analysis complete for ${updated.candidateName}. Score: ${updated.atsScore}%`, 'success');
      // Safety net: if the row wasn't found in local state for any reason
      // (stale list, id mismatch, etc.), pull a fresh copy from the server
      // so counts/badges can never end up stuck out of sync.
      if (!matched && selectedJob) await refetchApplicants(selectedJob);
    } catch (e) {
      showToast(e.userMessage || e.response?.data?.error || 'ATS analysis failed. Please try again.', 'error');
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(applicant.applicationId); return s; });
    }
  };

  // ── Bulk ATS Analysis ("Analyze All" button) ─────────────────────────────
  // Runs ATS scoring for every applicant of the currently selected job in
  // one request, persists each score server-side, then refreshes the table
  // so newly calculated scores and statuses are reflected immediately.
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const performAnalyzeAll = async () => {
    if (!selectedJob || analyzingAll) return;
    setAnalyzingAll(true);
    try {
      const res = await api.post(`/api/jobs/${selectedJob.id}/ats/run`);
      const summary = res.data;
      showToast(
        summary?.message || `✅ ATS analysis complete for all applicants.`,
        'success'
      );
      // Refresh the table from the server so every score/status is current,
      // without resetting the recruiter's current filters/search/page.
      await refetchApplicants(selectedJob);
    } catch (e) {
      showToast(e.userMessage || e.response?.data?.error || 'Bulk ATS analysis failed. Please try again.', 'error');
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { applicant, type } = confirmAction;
    const messages = {
      SHORTLISTED:         `${applicant.candidateName} has been shortlisted.`,
      REJECTED:            `${applicant.candidateName} has been rejected.`,
      INTERVIEW_SCHEDULED: `Live interview scheduled for ${applicant.candidateName}.`,
    };
    performStatusUpdate(applicant, type, messages[type]);
  };

  // ── Derived: counts, filtering, sorting, pagination ─────────────────────
  const counts = useMemo(() => ({
    ALL:                 applicants.length,
    APPLIED:             applicants.filter(a => a.status === 'APPLIED').length,
    UNDER_REVIEW:        applicants.filter(a => a.status === 'UNDER_REVIEW').length,
    SHORTLISTED:         applicants.filter(a => a.status === 'SHORTLISTED').length,
    HIRED:               applicants.filter(a => a.status === 'HIRED').length,
    REJECTED:            applicants.filter(a => a.status === 'REJECTED').length,
    INTERVIEW_SCHEDULED: applicants.filter(a => a.status === 'INTERVIEW_SCHEDULED').length,
    INTERVIEW_COMPLETED: applicants.filter(a =>
      a.status === 'INTERVIEW_COMPLETED' || a.status === 'INTERVIEW_PASSED' || a.status === 'INTERVIEW_FAILED'
    ).length,
    // "Pending" = candidates not yet decided one way or the other (not
    // shortlisted, not interviewed, not hired, not rejected).
    PENDING:             applicants.filter(a => a.status === 'APPLIED' || a.status === 'UNDER_REVIEW').length,
    // FIX: computed here (same useMemo, same `applicants` dependency) so the
    // "Not Analyzed" stat card can never drift out of sync with the table —
    // both re-derive from the exact same state update.
    NOT_ANALYZED:        applicants.filter(a => a.atsScore === null || a.atsScore === undefined).length,
  }), [applicants]);

  const inScoreRange = (score, range) => {
    if (range === 'ALL') return true;
    if (score === null || score === undefined) return false; // unanalyzed never matches a specific range
    if (range === 'HIGH') return score >= 80;
    if (range === 'MID')  return score >= 60 && score < 80;
    if (range === 'LOW')  return score < 60;
    return true;
  };

  const matchesStatusFilter = (status, filter) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return status === 'APPLIED' || status === 'UNDER_REVIEW';
    if (filter === 'INTERVIEW_COMPLETED') {
      return status === 'INTERVIEW_COMPLETED' || status === 'INTERVIEW_PASSED' || status === 'INTERVIEW_FAILED';
    }
    return status === filter;
  };

  const filtered = useMemo(() => {
    return applicants
      .filter(a => matchesStatusFilter(a.status, filterStatus))
      .filter(a => inScoreRange(a.atsScore, scoreRange))
      .filter(a =>
        debouncedSearch === '' ||
        a.candidateName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.candidateEmail?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'candidateName') return mul * (a.candidateName || '').localeCompare(b.candidateName || '');
        if (sortField === 'appliedAt')     return mul * (a.appliedAt || '').localeCompare(b.appliedAt || '');
        if (sortField === 'atsScore')      return mul * ((a.atsScore ?? 0) - (b.atsScore ?? 0));
        return 0;
      });
  }, [applicants, filterStatus, scoreRange, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'atsScore' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const resumeUrlFor = (applicant) =>
    applicant?.resumeId
      ? `${import.meta.env.VITE_API_URL || ''}/api/manager/resume/${applicant.resumeId}/download`
      : null;

  if (jobsLoading) return (
    <div className="apps-loading" style={{ textAlign: 'center', padding: '3rem' }}>
      <div className="apps-spinner" style={{ margin: '0 auto 12px' }} />
      Loading jobs…
    </div>
  );

  return (
    <div className="apps-layout">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'SHORTLISTED' ? 'Shortlist this candidate?' :
            confirmAction.type === 'REJECTED'    ? 'Reject this candidate?' :
            'Schedule a live interview?'
          }
          message={
            confirmAction.type === 'SHORTLISTED'
              ? `${confirmAction.applicant.candidateName} will be moved to Shortlisted and notified of progress.`
              : confirmAction.type === 'REJECTED'
              ? `${confirmAction.applicant.candidateName} will be marked as Rejected. This can be changed later.`
              : `A live interview will be scheduled for ${confirmAction.applicant.candidateName}.`
          }
          confirmLabel={
            confirmAction.type === 'SHORTLISTED' ? 'Shortlist' :
            confirmAction.type === 'REJECTED'    ? 'Reject' : 'Schedule'
          }
          tone={confirmAction.type === 'REJECTED' ? 'danger' : 'primary'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {activeApplicant && (
        <CandidateDetailModal
          applicant={activeApplicant}
          resumeUrl={resumeUrlFor(activeApplicant)}
          onClose={() => setActiveApplicant(null)}
          onShortlist={requestShortlist}
          onReject={requestReject}
          onScheduleInterview={requestSchedule}
          onAnalyzeAts={performAnalyzeAts}
          analyzing={busyIds.has(activeApplicant.applicationId)}
        />
      )}

      {/* ── Sidebar: job postings ───────────────────────────────── */}
      <div className="apps-sidebar">
        <div className="apps-sidebar-head">
          <span className="apps-sidebar-icon">💼</span>
          <span>Your Job Postings</span>
        </div>
        {!jobs?.length && <div className="apps-sidebar-empty">No jobs posted yet</div>}
        {jobs?.map(job => (
          <div
            key={job.id}
            className={`apps-job-card ${selectedJob?.id === job.id ? 'apps-job-active' : ''}`}
            onClick={() => loadApplicants(job)}
          >
            <div className="apps-job-title">{job.title}</div>
            <div className="apps-job-loc">📍 {job.location}</div>
          </div>
        ))}
      </div>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="apps-main">

        {!selectedJob && (
          <div className="apps-empty-state">
            <div className="apps-empty-icon">👈</div>
            <h2>Select a Job</h2>
            <p>Choose a job posting from the sidebar to view its applicants.</p>
          </div>
        )}

        {selectedJob && (
          <>
            {/* Page header */}
            <div className="apps-page-header">
              <div>
                <h1>{selectedJob.title}</h1>
                <p>
                  {counts.ALL} applicant{counts.ALL === 1 ? '' : 's'} · {counts.SHORTLISTED} shortlisted · {counts.HIRED} hired
                  {counts.REJECTED > 0 ? ` · ${counts.REJECTED} rejected` : ''}
                  {' '}· {selectedJob.location}
                </p>
              </div>
              <button
                className="apps-tab-btn"
                disabled={analyzingAll || !applicants.length}
                onClick={performAnalyzeAll}
                title="Run ATS analysis for every applicant of this job and update their status (Shortlisted / Under Review / Rejected)"
              >
                {analyzingAll ? '⏳ Processing…' : '🎯 Process All Candidates'}
              </button>
            </div>

            {/* Digit stat cards — quick numeric overview of this job's applicants */}
            <div className="apps-status-tabs" style={{ marginBottom: 4 }}>
              {[
                { label: 'Total Applicants', value: counts.ALL,                                          icon: '👥' },
                { label: 'Not Analyzed',     value: counts.NOT_ANALYZED,                                  icon: '⏳' },
                { label: 'Shortlisted',      value: counts.SHORTLISTED,                                   icon: '✅' },
                { label: 'Hired',            value: counts.HIRED,                                         icon: '🏆' },
                { label: 'Rejected',         value: counts.REJECTED,                                      icon: '✕' },
              ].map(stat => (
                <div key={stat.label} className="apps-tab-btn" style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 110 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{stat.icon} {stat.label}</span>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{stat.value}</span>
                </div>
              ))}
            </div>


            {/* Status filter tabs — includes the required Pending / Interview
                Completed / Hired / Rejected filters, plus the finer-grained
                in-between stages the recruiter workflow already relies on. */}
            <div className="apps-status-tabs">
              {['ALL', 'PENDING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'].map(s => (
                (s === 'ALL' || s === 'PENDING' || counts[s] > 0) && (
                <button
                  key={s}
                  className={`apps-tab-btn ${filterStatus === s ? 'active' : ''}`}
                  onClick={() => { setFilterStatus(s); setPage(1); }}
                >
                  {STATUS_CFG[s]?.icon || '👥'} {s === 'ALL' ? 'All' : (STATUS_CFG[s]?.label || s)}{' '}
                  <span className="apps-tab-count">{counts[s] ?? 0}</span>
                </button>
                )
              ))}
            </div>

            {/* Search + filters toolbar */}
            <div className="apps-toolbar">
              <input
                className="apps-search-input"
                placeholder="🔍 Search by candidate name or email…"
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setPage(1); }}
              />
              <select className="apps-sort-select"
                value={scoreRange}
                onChange={e => { setScoreRange(e.target.value); setPage(1); }}>
                <option value="ALL">All ATS Scores</option>
                <option value="HIGH">🟢 High (80–100%)</option>
                <option value="MID">🟡 Medium (60–79%)</option>
                <option value="LOW">🔴 Low (&lt;60%)</option>
              </select>
              <select className="apps-sort-select"
                value={`${sortField}:${sortDir}`}
                onChange={e => {
                  const [f, d] = e.target.value.split(':');
                  setSortField(f); setSortDir(d); setPage(1);
                }}>
                <option value="atsScore:desc">ATS Score (Highest → Lowest)</option>
                <option value="atsScore:asc">ATS Score (Lowest → Highest)</option>
                <option value="appliedAt:desc">Applied (Newest)</option>
                <option value="appliedAt:asc">Applied (Oldest)</option>
                <option value="candidateName:asc">Name (A → Z)</option>
                <option value="candidateName:desc">Name (Z → A)</option>
              </select>
            </div>

            {loadError && !loadingApps && (
              <div className="apps-error-banner">⚠️ {loadError}</div>
            )}

            {/* ── Table ─────────────────────────────────────────── */}
            <div className="apps-table-wrap">
              <table className="apps-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('candidateName')} className="sortable">
                      Candidate {sortField === 'candidateName' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Email</th>
                    <th>Resume</th>
                    <th onClick={() => toggleSort('atsScore')} className="sortable">
                      ATS Score {sortField === 'atsScore' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => toggleSort('appliedAt')} className="sortable">
                      Applied {sortField === 'appliedAt' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingApps && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                  {!loadingApps && !pageItems.length && (
                    <tr>
                      <td colSpan={7} className="apps-no-apps-cell">
                        <div className="apps-empty-icon">📭</div>
                        <p>{applicants.length ? 'No results match your filters.' : 'No applicants yet for this position.'}</p>
                      </td>
                    </tr>
                  )}

                  {!loadingApps && pageItems.map(app => {
                    const busy = busyIds.has(app.applicationId);
                    return (
                      <tr key={app.applicationId} className="apps-row">
                        <td>
                          <button className="apps-candidate-cell" onClick={() => setActiveApplicant(app)}>
                            <span className="apps-avatar">{app.candidateName?.[0]?.toUpperCase() || '?'}</span>
                            <span className="apps-name">{app.candidateName}</span>
                          </button>
                        </td>
                        <td className="apps-email-cell">{app.candidateEmail}</td>
                        <td>
                          {app.resumeId ? (
    <button
      type="button"
      className="apps-resume-link"
      onClick={e => { e.stopPropagation(); openResume(app.resumeId); }}
    >View ⬇️</button>
  ) : (
    <span className="apps-no-resume">No resume</span>
  )}
                        </td>
                        <td><ScoreBadge score={app.atsScore} /></td>
                        <td className="apps-date-cell">
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
                        </td>
                        <td><StatusBadge status={app.status} hiredAt={app.hiredAt} /></td>
                        <td>
                          <div className="apps-actions-cell">
                            <button className="apps-action-btn" title="View Profile"
                              onClick={() => setActiveApplicant(app)}>👁️</button>
                            {app.resumeId && (
  <button
    type="button"
    className="apps-action-btn"
    title="View Resume"
    onClick={() => openResume(app.resumeId)}
  >📄</button>
)}
                            
                            <button className="apps-action-btn" title={app.atsScore != null ? 'Re-Analyze ATS' : 'Analyze ATS'}
                              disabled={busy || !app.resumeId}
                              onClick={() => performAnalyzeAts(app)}>
                              {busy ? '⏳' : '🎯'}
                            </button>
                            <button className="apps-action-btn apps-action-btn--green" title="Shortlist"
                              disabled={busy || app.status === 'SHORTLISTED' || app.status === 'INTERVIEW_SCHEDULED'}
                              onClick={() => requestShortlist(app)}>✅</button>
                            <button className="apps-action-btn apps-action-btn--red" title={app.status === 'HIRED' ? 'Hired candidates cannot be rejected' : 'Reject'}
                              disabled={busy || app.status === 'REJECTED' || app.status === 'HIRED'}
                              onClick={() => requestReject(app)}>✕</button>
                            <button className="apps-action-btn apps-action-btn--blue" title="Schedule Live Interview"
                              disabled={busy || !app.canScheduleInterview || app.status === 'INTERVIEW_SCHEDULED'}
                              onClick={() => requestSchedule(app)}>📅</button>
                            {app.aiInterviewSessionId && (
                              <button
                                type="button"
                                className="apps-action-btn"
                                title="View AI Interview Report"
                                onClick={() => navigate(`/manager/interview/${app.aiInterviewSessionId}/report`)}
                              >📊</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="apps-pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}