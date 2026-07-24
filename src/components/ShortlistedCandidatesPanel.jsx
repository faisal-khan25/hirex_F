import React, { useState, useEffect } from 'react';
import {
  getShortlistedCandidates,
  assignAllInterviews,
  runJobAts,
} from './atsService';
import './ShortlistedCandidatesPanel.css';

/**
 * ShortlistedCandidatesPanel Component
 * 
 * Displays:
 * - ATS Score for each candidate
 * - Status Badge (SHORTLISTED/REJECTED)
 * - Matched and Missing Skills
 * - Counts of shortlisted/rejected candidates
 * - Button to assign AI interviews to all shortlisted candidates
 */
const ShortlistedCandidatesPanel = ({ jobId, jobTitle, onSuccess }) => {
  const [candidates, setC] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningAts, setRunningAts] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [stats, setStats] = useState({
    shortlisted: 0,
    rejected: 0,
    total: 0,
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch shortlisted candidates on component mount or when jobId changes
  useEffect(() => {
    if (jobId) {
      fetchShortlistedCandidates();
    }
  }, [jobId]);

  /**
   * Fetch all shortlisted candidates for the job
   */
  const fetchShortlistedCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getShortlistedCandidates(jobId);
      setC(response.candidates || []);
      setStats({
        shortlisted: response.shortlisted || 0,
        rejected: response.rejected || 0,
        total: response.totalProcessed || 0,
      });
    } catch (err) {
      setError(`Failed to load candidates: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Run ATS analysis for the job
   */
  const handleRunAts = async () => {
    setRunningAts(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await runJobAts(jobId);
      setC(response.candidates || []);
      setStats({
        shortlisted: response.shortlisted || 0,
        rejected: response.rejected || 0,
        total: response.totalProcessed || 0,
      });
      setSuccessMessage(`ATS analysis complete. ${response.shortlisted} candidates shortlisted.`);
    } catch (err) {
      setError(`ATS analysis failed: ${err.message}`);
    } finally {
      setRunningAts(false);
    }
  };

  /**
   * Assign AI interviews to all shortlisted candidates
   */
  const handleAssignAllInterviews = async () => {
    if (stats.shortlisted === 0) {
      setError('No shortlisted candidates to assign interviews to.');
      return;
    }

    setAssigning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await assignAllInterviews(jobId);

      if (response.success) {
        setSuccessMessage(
          `✓ ${response.assigned} AI interviews assigned successfully! ` +
          (response.alreadyAssigned > 0 ? `(${response.alreadyAssigned} already assigned, ${response.skipped} skipped)` : '')
        );
        onSuccess && onSuccess(response);
        // Refresh the list
        await fetchShortlistedCandidates();
      } else {
        setError(`Interview assignment failed: ${response.message}`);
      }
    } catch (err) {
      setError(`Error assigning interviews: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="shortlisted-candidates-panel">
      <div className="panel-header">
        <h2>ATS Shortlisting - {jobTitle}</h2>
        <div className="panel-actions">
          <button
            className="btn btn-primary"
            onClick={handleRunAts}
            disabled={runningAts || loading}
          >
            {runningAts ? '🔄 Running ATS...' : '▶ Run ATS Analysis'}
          </button>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-label">Total Applicants</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card highlight-success">
          <div className="stat-label">Shortlisted</div>
          <div className="stat-value">{stats.shortlisted}</div>
        </div>
        <div className="stat-card highlight-danger">
          <div className="stat-label">Rejected</div>
          <div className="stat-value">{stats.rejected}</div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">✕</span>
          {error}
          <button
            className="alert-close"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          {successMessage}
          <button
            className="alert-close"
            onClick={() => setSuccessMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk Assign Button */}
      {stats.shortlisted > 0 && (
        <div className="assign-section">
          <button
            className="btn btn-success btn-large"
            onClick={handleAssignAllInterviews}
            disabled={assigning}
          >
            {assigning ? (
              <>
                <span className="spinner"></span> Assigning Interviews...
              </>
            ) : (
              <>
                📋 Assign AI Interview to All {stats.shortlisted} Shortlisted
              </>
            )}
          </button>
          <p className="assign-description">
            Click to automatically assign AI interviews to all {stats.shortlisted} shortlisted candidates
          </p>
        </div>
      )}

      {/* Candidates List */}
      <div className="candidates-list-section">
        <h3>Candidates ({candidates.length})</h3>

        {loading && <div className="loading">Loading candidates...</div>}

        {!loading && candidates.length === 0 ? (
          <div className="empty-state">
            <p>No candidates found. Run ATS analysis to get started.</p>
          </div>
        ) : (
          <div className="candidates-list">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.applicationId} candidate={candidate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Individual candidate card component
 */
const CandidateCard = ({ candidate }) => {
  const isShortlisted = candidate.atsStatus === 'SHORTLISTED';
  const statusClass = isShortlisted ? 'status-shortlisted' : 'status-rejected';

  return (
    <div className="candidate-card">
      <div className="candidate-header">
        <div className="candidate-info">
          <h4 className="candidate-name">{candidate.candidateName}</h4>
          <p className="candidate-email">{candidate.candidateEmail}</p>
        </div>
        <div className="candidate-meta">
          <div className={`status-badge ${statusClass}`}>
            {isShortlisted ? '✓' : '✕'} {candidate.atsStatus}
          </div>
          <div className="ats-score">
            <span className="score-label">ATS Score</span>
            <span className="score-value">{candidate.atsScore}</span>
          </div>
        </div>
      </div>

      <div className="candidate-body">
        {candidate.matchedSkills && candidate.matchedSkills.length > 0 && (
          <div className="skills-section">
            <div className="skills-label">✓ Matched Skills ({candidate.matchedSkills.length})</div>
            <div className="skills-list">
              {candidate.matchedSkills.map((skill, idx) => (
                <span key={idx} className="skill-tag skill-matched">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {candidate.missingSkills && candidate.missingSkills.length > 0 && (
          <div className="skills-section">
            <div className="skills-label">✕ Missing Skills ({candidate.missingSkills.length})</div>
            <div className="skills-list">
              {candidate.missingSkills.map((skill, idx) => (
                <span key={idx} className="skill-tag skill-missing">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {candidate.note && (
          <div className="candidate-note">
            <strong>Note:</strong> {candidate.note}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShortlistedCandidatesPanel;