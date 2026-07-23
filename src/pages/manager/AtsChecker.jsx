import { useState, useEffect, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { List } from 'react-window';

import api, { getJobStats } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useHooks';
import useSEO from '../../hooks/useSeo';
import './AtsChecker.css';

const RESULT_ROW_HEIGHT = 64;
const VIRTUALIZE_THRESHOLD = 30;

/* ─── Score Ring ────────────────────────────────────────────────────── */
const ScoreRing = memo(function ScoreRing({ score, size = 96 }) {
  const r      = size === 64 ? 24 : 38;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  
  // High scores get the primary brand blue; standard/low scores get deep navy structure
  const color  = score >= 60 ? '#265DF5' : '#131224';

  return (
    <div className="ac-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size===64?4:6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={size===64?4:6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform:`rotate(-90deg)`, transformOrigin:`${size/2}px ${size/2}px`, transition:'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="ac-ring-label">
        <span className="ac-ring-num" style={{ color, fontSize: size===64?13:18 }}>{score}</span>
        <span className="ac-ring-denom">/100</span>
      </div>
    </div>
  );
});

/* ─── Status Badge ───────────────────────────────────────────────────── */
const StatusBadge = memo(function StatusBadge({ status }) {
  // Map core tracking targets directly to home page sky blue tints
  const isPrimary = ['HIRED', 'SHORTLISTED', 'INTERVIEW_PASSED', 'PASSED'].includes(status);
  
  return (
    <span className={`ac-status-badge ${isPrimary ? 'ac-status-sky' : 'ac-status-neutral'}`}>
      {status}
    </span>
  );
});

/* ─── Summary Card ───────────────────────────────────────────────────── */
const SummaryCard = memo(function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`ac-summary-card ${highlight ? 'ac-summary-highlighted' : ''}`}>
      <div className="ac-summary-value">{value ?? '—'}</div>
      <div className="ac-summary-label">{label}</div>
    </div>
  );
});

/* ─── Progress Bar ───────────────────────────────────────────────────── */
const ProgressBar = memo(function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="ac-progress-wrap">
      <div className="ac-progress-header">
        <span>{label}</span>
        <span>{current} / {total} ({pct}%)</span>
      </div>
      <div className="ac-progress-track">
        <div className="ac-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
});

/* ─── Interview Result Banner ────────────────────────────────────────── */
const InterviewResultBanner = memo(function InterviewResultBanner({ stats }) {
  if (!stats) return null;
  const passed      = stats.interviewPassed      ?? 0;
  const failed      = stats.interviewFailed      ?? 0;
  const underReview = stats.interviewUnderReview ?? 0;
  const completed   = stats.interviewCompleted   ?? 0;

  if (completed === 0) return null;

  return (
    <div className="ac-interview-result-banner">
      <div className="ac-interview-result-title">Interview Distribution Summary</div>
      <div className="ac-interview-result-pills">
        <span className="ac-result-pill">Passed: <strong>{passed}</strong></span>
        <span className="ac-result-pill">Failed: <strong>{failed}</strong></span>
        <span className="ac-result-pill">Under Review: <strong>{underReview}</strong></span>
        <span className="ac-result-pill ac-result-pill--total">Total Actioned: <strong>{completed}</strong></span>
      </div>
    </div>
  );
});

/* ─── Virtualized Results Row ───────────────────────────────────────── */
const ResultRow = memo(function ResultRow({ index, style, results }) {
  const r = results[index];
  return (
    <div className={`ac-vtable-row ${!r.processed ? 'ac-row-skipped' : ''}`} style={style}>
      <div className="ac-vtable-cell ac-td-num">{index + 1}</div>
      <div className="ac-vtable-cell">
        <div className="ac-candidate-cell">
          <div className="ac-avatar">{r.candidateName?.[0]?.toUpperCase()}</div>
          <span className="ac-cand-name">{r.candidateName}</span>
        </div>
      </div>
      <div className="ac-vtable-cell ac-td-email">{r.candidateEmail}</div>
      <div className="ac-vtable-cell ac-td-file">{r.fileName || '—'}</div>
      <div className="ac-vtable-cell">
        <div className="ac-score-cell">
          <ScoreRing score={r.atsScore} size={48} />
          {!r.processed && <span className="ac-no-text-warn">Unreadable text</span>}
        </div>
      </div>
      <div className="ac-vtable-cell">
        <div className="ac-match-bar-wrap">
          <div className="ac-match-bar-track">
            <div
              className="ac-match-bar-fill"
              style={{ width: `${r.matchPercentage}%` }}
            />
          </div>
          <span className="ac-match-pct">{r.matchPercentage}%</span>
        </div>
      </div>
      <div className="ac-vtable-cell"><StatusBadge status={r.status} /></div>
    </div>
  );
}, (prev, next) => prev.results === next.results && prev.index === next.index && prev.style === next.style);

/* ═══════════════════════════════════════════════════════════════════════
    MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function AtsChecker() {
  useSEO({ title: 'ATS Checker', description: 'Score resumes against your job requirements with HireX AI.' });
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobStats, setJobStats] = useState(null);
  const [jobStatsLoading, setJobStatsLoading] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkStats, setBulkStats] = useState(null);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortField, setSortField] = useState('atsScore');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQ, setSearchQ] = useState('');
  const debouncedSearchQ = useDebouncedValue(searchQ, 200);

  useEffect(() => {
    loadSummary();
    api.get('/api/manager/jobs')
      .then(res => setJobs(res.data || []))
      .catch(() => {});
  }, []);

  const loadSummary = () => {
    setSummaryLoading(true);
    api.get('/api/manager/ats/summary')
      .then(res => setSummary(res.data || {}))
      .catch(() => setSummary({}))
      .finally(() => setSummaryLoading(false));
  };

  useEffect(() => {
    if (!selectedJobId) { setJobStats(null); return; }
    setJobStatsLoading(true);
    getJobStats(selectedJobId)
      .then(res => setJobStats(res.data))
      .catch(() => setJobStats(null))
      .finally(() => setJobStatsLoading(false));
  }, [selectedJobId]);

  const handleProcessAll = async () => {
    if (bulkLoading) return;
    const confirmMsg = "Perform system scan on candidate records? Database application targets will sync automatically.";
    if (!window.confirm(confirmMsg)) return;

    setBulkLoading(true);
    setBulkError('');
    setBulkResults([]);
    setBulkStats(null);
    setBulkProgress({ current: 0, total: summary?.totalApplicants || 0 });

    try {
      const endpoint = selectedJobId
        ? `/api/manager/ats/jobs/${selectedJobId}/process`
        : '/api/manager/ats/process-all';

      const res = await api.post(endpoint);
      const data = res.data;

      setBulkResults(data.results || []);
      setBulkStats({
        totalProcessed:    data.totalProcessed,
        totalSkipped:      data.totalSkipped,
        totalHired:        data.totalHired,
        totalShortlisted:  data.totalShortlisted,
        totalRejected:     data.totalRejected,
        message:           data.message,
        saved:             true,
        processedJobId:    selectedJobId,
        processedJobTitle: jobs.find(j => String(j.id) === String(selectedJobId))?.title,
      });
      setBulkProgress({
        current: data.totalProcessed + data.totalSkipped,
        total:   data.totalProcessed + data.totalSkipped,
      });

      loadSummary();
      if (selectedJobId) {
        getJobStats(selectedJobId).then(res => setJobStats(res.data)).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('ats:shortlisted'));
    } catch (err) {
      setBulkError(err?.response?.data?.message || 'ATS operation failed. Verify system endpoints.');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const filteredResults = useMemo(() => {
    const q = debouncedSearchQ.toLowerCase();
    return bulkResults
      .filter(r => filterStatus === 'ALL' || r.status === filterStatus)
      .filter(r => q === '' || r.candidateName?.toLowerCase().includes(q) || r.candidateEmail?.toLowerCase().includes(q))
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'atsScore') return mul * (a.atsScore - b.atsScore);
        if (sortField === 'candidateName') return mul * (a.candidateName || '').localeCompare(b.candidateName || '');
        return 0;
      });
  }, [bulkResults, filterStatus, debouncedSearchQ, sortField, sortDir]);

  return (
    <div className="ac-page">
      <div className="ac-inner">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="ac-header">
          <div style={{ flex: 1 }}>
            <h1>ATS Resume Checker</h1>
            <p>Score applicant assets against defined specifications instantly without auxiliary extraction pipelines.</p>
          </div>
        </div>

        {/* ── ATS Dashboard Summary Grid ──────────────────────────────── */}
        <div className="ac-summary-grid">
          <SummaryCard label="Applied Applicants" value={summary?.totalApplicants} />
          <SummaryCard label="Hired Status" value={summary?.totalHired} />
          <SummaryCard label="Shortlisted" value={summary?.totalShortlisted} />
          <SummaryCard label="Rejected" value={summary?.totalRejected} />
          <SummaryCard label="Pending Evaluation" value={summary?.totalPending} />
          <SummaryCard label="Resumes Ingested" value={summary?.totalWithResume} />
        </div>

        {/* ── Per-Job Filter View ────────────────────────────────────── */}
        <div className="ac-job-stats-section">
          <div className="ac-job-stats-header">
            <span className="ac-job-stats-title">Interview Performance Distribution</span>
            <select
              className="ac-job-select"
              value={selectedJobId || ''}
              onChange={e => setSelectedJobId(e.target.value || null)}
            >
              <option value="">All active listings</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          {jobStatsLoading && <div className="ac-job-stats-loading"><span className="ac-btn-spinner" /> Syncing data...</div>}

          {jobStats && !jobStatsLoading && (
            <>
              <div className="ac-summary-grid ac-interview-stats-grid">
                <SummaryCard label="Assigned" value={jobStats?.interviewAssigned ?? 0} />
                <SummaryCard label="Completed" value={jobStats?.interviewCompleted ?? 0} />
                <SummaryCard label="Passed Verification" value={jobStats?.interviewPassed ?? 0} highlight />
                <SummaryCard label="Disqualified" value={jobStats?.interviewFailed ?? 0} highlight />
                <SummaryCard label="Under Review" value={jobStats?.interviewUnderReview ?? 0} highlight />
              </div>
              <InterviewResultBanner stats={jobStats} />
            </>
          )}

          {!selectedJobId && !jobStatsLoading && (
            <p className="ac-job-stats-hint">Select an individual tracking listing context to display focused assignment pipelines.</p>
          )}
        </div>

        {/* ── Action Section ─────────────────────────────────────────── */}
        <div className="ac-bulk-actions">
          <button className="ac-process-btn" onClick={handleProcessAll} disabled={bulkLoading}>
            {bulkLoading ? <span className="ac-btn-spinner" /> : null}
            Execute Automated Screening
          </button>
        </div>

        {bulkLoading && (
          <div className="ac-loading-card">
            <div className="ac-loading-spinner" />
            <h3>Processing applicant pools...</h3>
            <ProgressBar current={bulkProgress.current} total={bulkProgress.total} label="Analysis Completion Status" />
          </div>
        )}

        {bulkError && <div className="ac-error">{bulkError}</div>}

        {bulkStats && !bulkLoading && (
          <div className="ac-bulk-banner">
            <div className="ac-bulk-banner-main">System Scan Concluded Successfully</div>
            <div className="ac-bulk-banner-counts">
              <span>Hired: <b>{bulkStats.totalHired}</b></span>
              <span>Shortlisted: <b>{bulkStats.totalShortlisted}</b></span>
              <span>Rejected: <b>{bulkStats.totalRejected}</b></span>
            </div>
            {bulkStats.processedJobId && (
              <button className="ac-view-applicants-btn" onClick={() => navigate(`/manager/applicants?jobId=${bulkStats.processedJobId}`)}>
                Open Scoped Applicants List →
              </button>
            )}
          </div>
        )}

        {/* Results Data Matrix */}
        {bulkResults.length > 0 && !bulkLoading && (
          <div className="ac-table-wrap">
            <div className="ac-table-toolbar">
              <input
                className="ac-search-input"
                placeholder="Filter by keyword identifier..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <select className="ac-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="ALL">All operational statuses</option>
                <option value="HIRED">Hired</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <span className="ac-count-badge">{filteredResults.length} records matching</span>
            </div>

            <div className="ac-table-scroll">
              <div className="ac-vtable" role="table">
                <div className="ac-vtable-row ac-vtable-header" role="row">
                  <div className="ac-vtable-cell">#</div>
                  <div className="ac-vtable-cell ac-sortable" onClick={() => toggleSort('candidateName')}>
                    Candidate Identity{sortIcon('candidateName')}
                  </div>
                  <div className="ac-vtable-cell">Communication Channel</div>
                  <div className="ac-vtable-cell">Asset Origin</div>
                  <div className="ac-vtable-cell ac-sortable" onClick={() => toggleSort('atsScore')}>
                    ATS Evaluation Index{sortIcon('atsScore')}
                  </div>
                  <div className="ac-vtable-cell">Metric Match</div>
                  <div className="ac-vtable-cell">Current State</div>
                </div>

                {filteredResults.length >= VIRTUALIZE_THRESHOLD ? (
                  <List
                    style={{ height: Math.min(filteredResults.length, 8) * RESULT_ROW_HEIGHT }}
                    rowComponent={ResultRow}
                    rowCount={filteredResults.length}
                    rowHeight={RESULT_ROW_HEIGHT}
                    rowProps={{ results: filteredResults }}
                  />
                ) : (
                  filteredResults.map((r, i) => (
                    <ResultRow key={r.resumeId ?? r.applicationId ?? i} index={i} results={filteredResults} style={undefined} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}