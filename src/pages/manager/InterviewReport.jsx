import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useHooks';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/**
 * Confirmation dialog shown before a recruiter finalizes a hire.
 */
function HireConfirmDialog({ candidateName, onConfirm, onCancel, submitting }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: '24px 26px', maxWidth: 380, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
          Are you sure you want to hire this candidate?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          {candidateName} will be marked as <strong>Hired</strong> and moved to the Hired Candidates list. This action cannot be undone from here.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: submitting ? '#86efac' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? 'Hiring…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * InterviewReport — recruiter-facing view of a completed AI interview.
 * Route: /manager/interview/:sessionId/report
 *
 * Also hosts the manual hiring workflow: a "Hire" button is shown only to
 * the recruiter/manager, only once every prior stage (ATS screening ->
 * Recruiter Conversation -> AI Interview -> Interview Evaluation) has
 * completed successfully. Hiring is never automatic.
 */
export default function InterviewReport() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { user }       = useAuth();
  const { data: report, loading, error, refetch } = useFetch(`/api/interview/${sessionId}/report`);

  const [showConfirm, setShowConfirm] = useState(false);
  const [hiring,       setHiring]     = useState(false);
  const [hireError,    setHireError]  = useState('');
  const [hireSuccess,  setHireSuccess] = useState('');
  // Optimistic local overrides so the button disappears / badge appears
  // immediately after a successful hire, without waiting on a full refetch.
  const [localApplicationStatus, setLocalApplicationStatus] = useState(null);
  const [localHiredAt, setLocalHiredAt] = useState(null);
  const [localHiredBy, setLocalHiredBy] = useState(null);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:32 }}>⏳</div>
        <p style={{ color:'#6b7280' }}>Loading report…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <p style={{ color:'#dc2626' }}>{error || 'Report not found.'}</p>
        <button onClick={() => navigate(-1)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', cursor:'pointer' }}>← Back</button>
      </div>
    );
  }

  const session    = report.session    || {};
  const evaluation = report.evaluation || {};
  const questions  = report.questions  || [];
  const answers    = report.answers    || [];

  const score = evaluation.overallRating;
  const scoreColor = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  // Effective hiring state = server value, overridden locally right after a
  // successful hire (before the underlying report is refetched/reloaded).
  const applicationStatus = localApplicationStatus || session.applicationStatus;
  const hiredAt = localHiredAt || session.hiredAt;
  const hiredBy = localHiredBy || session.hiredBy;

  const isRecruiter = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isHired      = applicationStatus === 'HIRED';
  const isRejected   = applicationStatus === 'REJECTED';
  // All prior stages (ATS -> Recruiter Conversation -> AI Interview ->
  // Interview Evaluation) completed successfully only when the backend has
  // advanced the application to INTERVIEW_PASSED.
  const canHire = isRecruiter && !isHired && !isRejected &&
    (session.canHire === true || applicationStatus === 'INTERVIEW_PASSED');

  const handleConfirmHire = async () => {
    if (!session.applicationId) return;
    setHiring(true);
    setHireError('');
    try {
      const res = await api.post(`/api/applications/${session.applicationId}/hire`);
      const updated = res.data;
      setLocalApplicationStatus(updated.status || 'HIRED');
      setLocalHiredAt(updated.hiredAt || new Date().toISOString());
      setLocalHiredBy(updated.hiredBy || user?.name || user?.email || null);
      setHireSuccess('Candidate hired successfully.');
      setShowConfirm(false);
      // Refresh in the background so the report reflects the authoritative
      // server state (harmless if it fails — local state already updated).
      refetch();
    } catch (e) {
      setHireError(e.response?.data?.error || 'Failed to hire candidate. Please try again.');
    } finally {
      setHiring(false);
    }
  };

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 24px' }}>

      {showConfirm && (
        <HireConfirmDialog
          candidateName={session.candidateName}
          submitting={hiring}
          onCancel={() => { if (!hiring) setShowConfirm(false); }}
          onConfirm={handleConfirmHire}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#111827' }}>
            Interview Report
          </h1>
          <p style={{ margin:0, fontSize:13, color:'#6b7280' }}>
            {session.candidateName} · {session.positionTitle}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {isHired && (
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'7px 14px', borderRadius:999, background:'#dcfce7', color:'#16a34a',
              fontSize:13, fontWeight:700,
            }}>
              🏆 Hired{hiredAt ? ` · ${new Date(hiredAt).toLocaleDateString()}` : ''}
            </span>
          )}
          {canHire && (
            <button
              onClick={() => setShowConfirm(true)}
              style={{
                padding:'9px 18px', borderRadius:8, border:'none',
                background:'#16a34a', color:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer',
              }}
            >
              ✅ Hire Candidate
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', cursor:'pointer', fontSize:13, color:'#374151' }}
          >
            ← Back
          </button>
        </div>
      </div>

      {hireSuccess && (
        <div style={{ padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', color:'#15803d', borderRadius:10, fontSize:13, fontWeight:600, marginBottom:20 }}>
          ✅ {hireSuccess}
          {hiredBy && <span style={{ fontWeight:400 }}> — recorded by {hiredBy}.</span>}
        </div>
      )}
      {hireError && (
        <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', borderRadius:10, fontSize:13, fontWeight:600, marginBottom:20 }}>
          ⚠️ {hireError}
        </div>
      )}
      {!canHire && !isHired && !isRejected && isRecruiter && (
        <div style={{ padding:'12px 16px', background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', borderRadius:10, fontSize:13, marginBottom:20 }}>
          ℹ️ The Hire action unlocks once ATS screening, the recruiter conversation, the AI interview, and the interview evaluation have all completed successfully.
        </div>
      )}
      {isRejected && isRecruiter && (
        <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', borderRadius:10, fontSize:13, marginBottom:20 }}>
          ✕ This candidate has been rejected and cannot be hired.
        </div>
      )}

      {/* Score card */}
      {score != null && (
        <div style={{
          display:'flex', alignItems:'center', gap:20,
          padding:'20px 24px', background:'#f9fafb',
          border:'1px solid #e5e7eb', borderRadius:12, marginBottom:24,
        }}>
          <div style={{
            width:72, height:72, borderRadius:'50%',
            border:`4px solid ${scoreColor}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, fontWeight:800, color:scoreColor, flexShrink:0,
          }}>
            {Math.round(score)}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:4 }}>
              Overall Score
            </div>
            <div style={{ fontSize:13, color:'#6b7280' }}>
              Recommendation: <strong style={{ color: scoreColor }}>
                {evaluation.finalRecommendation || '—'}
              </strong>
            </div>
            {evaluation.completionPercentage != null && (
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                Completion: {Math.round(evaluation.completionPercentage)}% ·{' '}
                {evaluation.totalQuestionsAnswered}/{evaluation.totalQuestionsAsked} questions answered
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill breakdown */}
      {evaluation.communicationScore != null && (
        <div style={{ padding:'20px 24px', border:'1px solid #e5e7eb', borderRadius:12, marginBottom:24 }}>
          <h2 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#111827' }}>Skill Breakdown</h2>
          {[
            ['Communication',    evaluation.communicationScore],
            ['Technical Skills', evaluation.technicalSkillsScore],
            ['Domain Knowledge', evaluation.domainKnowledgeScore],
            ['Confidence',       evaluation.confidenceScore],
            ['Problem Solving',  evaluation.problemSolvingScore],
          ].map(([label, val]) => val != null && (
            <div key={label} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                <span style={{ color:'#374151' }}>{label}</span>
                <span style={{ fontWeight:600, color:'#111827' }}>{Math.round(val)}%</span>
              </div>
              <div style={{ height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${val}%`, background: val >= 75 ? '#16a34a' : val >= 50 ? '#d97706' : '#dc2626', borderRadius:99 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strengths / Weaknesses */}
      {(evaluation.strengths || evaluation.weaknesses) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          {evaluation.strengths && (
            <div style={{ padding:'16px 20px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12 }}>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:700, color:'#15803d' }}>✅ Strengths</h3>
              <p style={{ margin:0, fontSize:13, color:'#166534', lineHeight:1.6, whiteSpace:'pre-line' }}>{evaluation.strengths}</p>
            </div>
          )}
          {evaluation.weaknesses && (
            <div style={{ padding:'16px 20px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12 }}>
              <h3 style={{ margin:'0 0 10px', fontSize:14, fontWeight:700, color:'#b91c1c' }}>⚠️ Areas to Improve</h3>
              <p style={{ margin:0, fontSize:13, color:'#991b1b', lineHeight:1.6, whiteSpace:'pre-line' }}>{evaluation.weaknesses}</p>
            </div>
          )}
        </div>
      )}

      {/* Q&A transcript */}
      {questions.length > 0 && (
        <div style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
          <div style={{ padding:'14px 20px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'#111827' }}>Interview Transcript</h2>
          </div>
          {questions.map((q, idx) => {
            const ans = answers.find(a => a.questionId === q.id);
            return (
              <div key={q.id} style={{ padding:'16px 20px', borderBottom: idx < questions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ fontSize:12, color:'#6366f1', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Q{idx + 1} · {q.questionType}
                </div>
                <p style={{ margin:'0 0 10px', fontSize:14, fontWeight:600, color:'#111827', lineHeight:1.5 }}>
                  {q.questionText}
                </p>
                {ans ? (
                  <div style={{ padding:'10px 14px', background:'#f8faff', border:'1px solid #e0e7ff', borderRadius:8 }}>
                    <p style={{ margin:'0 0 6px', fontSize:13, color:'#374151', lineHeight:1.6 }}>{ans.answerText}</p>
                    {ans.evaluationFeedback && (
                      <p style={{ margin:0, fontSize:12, color:'#6b7280', fontStyle:'italic' }}>
                        💬 {ans.evaluationFeedback}
                      </p>
                    )}
                    <div style={{ display:'flex', gap:16, marginTop:8, fontSize:11, color:'#9ca3af' }}>
                      {ans.durationSeconds  != null && <span>⏱ {ans.durationSeconds}s</span>}
                      {ans.wordCount        != null && <span>📝 {ans.wordCount} words</span>}
                      {ans.relevanceScore   != null && <span>🎯 Relevance {Math.round(ans.relevanceScore * 100)}%</span>}
                      {ans.clarityScore     != null && <span>💡 Clarity {Math.round(ans.clarityScore * 100)}%</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:'#9ca3af', fontStyle:'italic' }}>No answer recorded.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}