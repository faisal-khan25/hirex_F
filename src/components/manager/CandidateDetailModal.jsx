import { useNavigate } from 'react-router-dom';
import './CandidateDetailModal.css';

/* ─── ATS score badge with color coding ─────────────────────────── */
export function ScoreBadge({ score, size = 'md' }) {
  // FIX: null/undefined means "not analyzed yet" — must NOT render as 0%/red.
  if (score === null || score === undefined) {
    return (
      <span className={`score-badge score-badge--gray score-badge--${size}`}>
        Not Analyzed
      </span>
    );
  }
  const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
  return (
    <span className={`score-badge score-badge--${color} score-badge--${size}`}>
      {score}%
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
  return (
    <div className="score-bar-track">
      <div className={`score-bar-fill score-bar-fill--${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export default function CandidateDetailModal({
  applicant,
  onClose,
  onShortlist,
  onReject,
  onScheduleInterview,
  onAnalyzeAts,
  analyzing = false,
  resumeUrl,
}) {
  const navigate = useNavigate();
  if (!applicant) return null;
  const ats = applicant.atsBreakdown || {};
  const isShortlisted = applicant.status === 'SHORTLISTED' || applicant.status === 'INTERVIEW_SCHEDULED';
  const canSchedule = applicant.canScheduleInterview;

  return (
    <div className="cdm-overlay" onClick={onClose}>
      <div className="cdm-panel" onClick={(e) => e.stopPropagation()}>
        <button className="cdm-close" onClick={onClose} aria-label="Close">×</button>

        {/* Header */}
        <div className="cdm-header">
          <div className="cdm-avatar">{applicant.candidateName?.[0]?.toUpperCase() || '?'}</div>
          <div className="cdm-header-info">
            <h2>{applicant.candidateName}</h2>
            <div className="cdm-header-meta">
              <span>{applicant.candidateEmail}</span>
              {applicant.candidatePhone && <span>· {applicant.candidatePhone}</span>}
              {applicant.candidateLocation && <span>· {applicant.candidateLocation}</span>}
            </div>
          </div>
          <div className="cdm-header-score">
            <ScoreBadge score={applicant.atsScore} size="lg" />
            <span className="cdm-score-label">Overall ATS Score</span>
          </div>
        </div>

        <div className="cdm-body">
          {/* Left column: profile */}
          <div className="cdm-col">
            {applicant.candidateBio && (
              <section className="cdm-section">
                <h3>About</h3>
                <p className="cdm-bio">{applicant.candidateBio}</p>
              </section>
            )}

            <section className="cdm-section">
              <h3>Skills</h3>
              <div className="cdm-pill-row">
                {applicant.skills?.length
                  ? applicant.skills.map((s, i) => <Pill key={i}>{s}</Pill>)
                  : <span className="cdm-empty">No skills listed</span>}
              </div>
            </section>

            <section className="cdm-section">
              <h3>Education</h3>
              <p>{applicant.education || 'Not provided'}</p>
            </section>

            <section className="cdm-section">
              <h3>Experience</h3>
              <p>{applicant.experience || 'Not provided'}</p>
            </section>

            <section className="cdm-section">
              <h3>Projects</h3>
              {applicant.projects?.length ? (
                <ul className="cdm-list">
                  {applicant.projects.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              ) : (
                <span className="cdm-empty">No projects extracted from resume</span>
              )}
            </section>

            <section className="cdm-section">
              <h3>Resume</h3>
              {resumeUrl ? (
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="cdm-resume-link">
                  📎 {applicant.resumeFileName || 'View resume'} ↗
                </a>
              ) : (
                <span className="cdm-empty">No resume uploaded</span>
              )}
            </section>
          </div>

          {/* Right column: ATS breakdown */}
          <div className="cdm-col">
            <section className="cdm-section cdm-ats-card">
              <h3>ATS Breakdown</h3>

              <div className="cdm-ats-row">
                <span>Keyword Match</span>
                <span>{ats.keywordMatchPercent ?? 0}%</span>
              </div>
              <ScoreBar score={ats.keywordMatchPercent ?? 0} />

              <div className="cdm-ats-grid">
                <div>
                  <h4>✅ Matched Skills</h4>
                  <div className="cdm-pill-row">
                    {ats.matchedSkills?.length
                      ? ats.matchedSkills.map((s, i) => <Pill key={i} tone="green">{s}</Pill>)
                      : <span className="cdm-empty">None matched</span>}
                  </div>
                </div>
                <div>
                  <h4>⚠️ Missing Skills</h4>
                  <div className="cdm-pill-row">
                    {ats.missingSkills?.length
                      ? ats.missingSkills.map((s, i) => <Pill key={i} tone="red">{s}</Pill>)
                      : <span className="cdm-empty">No gaps found</span>}
                  </div>
                </div>
              </div>

              <div className="cdm-match-row">
                <div className={`cdm-match-item ${ats.experienceMatch ? 'is-match' : 'is-gap'}`}>
                  <span>{ats.experienceMatch ? '✅' : '✕'} Experience Match</span>
                  <small>{ats.experienceNote}</small>
                </div>
                <div className={`cdm-match-item ${ats.educationMatch ? 'is-match' : 'is-gap'}`}>
                  <span>{ats.educationMatch ? '✅' : '✕'} Education Match</span>
                  <small>{ats.educationNote}</small>
                </div>
              </div>
            </section>

            <section className="cdm-section cdm-suggestions-card">
              <h3>🤖 AI Suggestions</h3>
              {ats.aiSuggestions?.length ? (
                <ul className="cdm-list">
                  {ats.aiSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              ) : (
                <span className="cdm-empty">No suggestions available.</span>
              )}
            </section>
          </div>
        </div>

        {/* Action bar */}
        <div className="cdm-actions">
          {onAnalyzeAts && (
            <button
              className="cdm-btn cdm-btn--analyze"
              disabled={analyzing || !applicant.resumeId}
              title={!applicant.resumeId ? 'Candidate has no resume uploaded' : undefined}
              onClick={() => onAnalyzeAts(applicant)}
            >
              {analyzing ? '⏳ Analyzing…' : (applicant.atsScore != null ? '🔄 Re-Analyze ATS' : '🎯 Analyze ATS')}
            </button>
          )}
          <button
            className="cdm-btn cdm-btn--reject"
            disabled={applicant.status === 'REJECTED'}
            onClick={() => onReject(applicant)}
          >
            ✕ Reject
          </button>
          <button
            className="cdm-btn cdm-btn--shortlist"
            disabled={isShortlisted}
            onClick={() => onShortlist(applicant)}
          >
            ✅ {isShortlisted ? 'Shortlisted' : 'Shortlist'}
          </button>
          <button
            className="cdm-btn cdm-btn--interview"
            disabled={!canSchedule || applicant.status === 'INTERVIEW_SCHEDULED'}
            title={!canSchedule ? 'Shortlist this candidate first' : undefined}
            onClick={() => onScheduleInterview(applicant)}
          >
            📅 {applicant.status === 'INTERVIEW_SCHEDULED' ? 'Interview Scheduled' : 'Schedule Live Interview'}
          </button>
          {applicant.aiInterviewSessionId && (
            <button
              className="cdm-btn cdm-btn--interview"
              onClick={() => navigate(`/manager/interview/${applicant.aiInterviewSessionId}/report`)}
            >
              📊 View AI Interview Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
