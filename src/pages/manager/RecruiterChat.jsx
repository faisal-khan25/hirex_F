import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import api, { assignInterviewToAll, generateInterviewLink } from '../../services/api';

import ChatWindow from '../../components/chat/ChatWindow';
import './RecruiterChat.css';

// ─── Module-level conversation cache ─────────────────────────
let convCache    = null;
let stubsFetched = false;

export function invalidateConvCache() {
  convCache    = null;
  stubsFetched = false;
}

/* ─── ConvItem ───────────────────────────────────────────────── */
const ConvItem = memo(function ConvItem({ conv, isActive, onSelect, formatTime }) {
  return (
    <div
      className={`rc-conv-item ${isActive ? 'rc-conv-item--active' : ''} ${conv.unreadCount > 0 ? 'rc-conv-item--unread' : ''}`}
      onClick={() => onSelect(conv)}
    >
      <div className="rc-conv-avatar">{conv.candidateName?.charAt(0)?.toUpperCase()}</div>
      <div className="rc-conv-info">
        <div className="rc-conv-top">
          <span className="rc-conv-name">{conv.candidateName}</span>
          <span className="rc-conv-time">{formatTime(conv.lastMessageAt)}</span>
        </div>
        <div className="rc-conv-job">{conv.jobTitle}</div>
        <div className="rc-conv-bottom">
          <span className="rc-conv-preview">
            {conv.lastMessage || (conv._fromApplicants
              ? '✅ Shortlisted — start the conversation'
              : 'No messages yet')}
          </span>
          {conv.unreadCount > 0 && (
            <span className="rc-unread-badge">{conv.unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ─── Main Component ─────────────────────────────────────────── */
export default function RecruiterChat() {
  const [conversations, setConversations] = useState(() =>
    convCache ? [...convCache.values()] : []
  );
  const [loading,  setLoading]  = useState(!convCache);
  const [error,    setError]    = useState('');
  const [selected, setSelected] = useState(null);

  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMsg,       setBulkMsg]       = useState('');
  const [bulkModal,     setBulkModal]     = useState(false);

  // ── Dropdown state: which job groups are expanded ──────────────
  // Keyed by the same `key` used in groupedByJob (jobId, or a title
  // fallback). Starts empty so every job group renders collapsed.
  const [expandedJobs, setExpandedJobs] = useState(() => new Set());

  const toggleJobGroup = useCallback((key) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Generate Interview Link (chat-based — no popup) ──────────────────
  // Recruiter clicks "Generate Interview Link" inside a shortlisted
  // candidate's conversation. The backend creates the secure session AND
  // sends it as a chat message in the same call — ChatWindow's existing
  // WebSocket subscription picks it up and renders the "Join Interview"
  // button automatically, so no extra state is needed here beyond
  // loading/error feedback on the button itself.
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [linkError,      setLinkError]      = useState('');

  const handleGenerateInterviewLink = useCallback(async () => {
    if (!selected) return;
    setLinkGenerating(true);
    setLinkError('');
    try {
      await generateInterviewLink(selected.applicationId);
    } catch (err) {
      console.error('Error generating interview link:', err);
      setLinkError(err.response?.data?.error || err.message || 'Could not generate interview link.');
    } finally {
      setLinkGenerating(false);
    }
  }, [selected]);

  const mergeRef = useRef(new Map(convCache || []));

  // ── Merge helper ─────────────────────────────────────────────
  const applyMerge = useCallback((serverList, stubs) => {
    const map = mergeRef.current;

    for (const conv of serverList) {
      const existing = map.get(conv.applicationId);
      map.set(conv.applicationId, {
        ...(existing || {}),
        ...conv,
        unreadCount: conv.unreadCount ?? existing?.unreadCount ?? 0,
      });
    }

    for (const stub of (stubs || [])) {
      if (!map.has(stub.applicationId)) {
        map.set(stub.applicationId, stub);
      }
    }

    convCache = new Map(map);

    const sorted = [...map.values()].sort((a, b) => {
      if (a.lastMessage && !b.lastMessage) return -1;
      if (!a.lastMessage && b.lastMessage)  return  1;
      return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
    });

    setConversations(sorted);
  }, []);

  // ── Fetch conversations ───────────────────────────────────────
  const fetchConversations = useCallback(async (stubs) => {
    try {
      const { data } = await api.get('/api/chat/manager/conversations');
      applyMerge(data, stubs ?? [...(mergeRef.current.values())].filter(c => c._fromApplicants));
      setError('');
    } catch {
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [applyMerge]);

  // ── Fetch applicant stubs ─────────────────────────────────────
  const fetchStubs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/manager/shortlisted-applicants');
      return data.map(a => ({
        applicationId:     a.id,
        candidateName:     a.applicantName,
        candidateEmail:    a.applicantEmail,
        candidateId:       a.applicantId,
        jobTitle:          a.jobTitle,
        jobId:             a.jobId,
        applicationStatus: a.status,
        lastMessage:       null,
        lastMessageAt:     a.appliedAt || null,
        unreadCount:       0,
        _fromApplicants:   true,
      }));
    } catch {
      // Fallback: per-job fetch
      try {
        const { data: jobs } = await api.get('/api/manager/jobs');
        const results = await Promise.all(
          jobs.map(j =>
            api.get(`/api/manager/jobs/${j.id}/applicants`)
               .then(r => ({ job: j, apps: r.data || [] }))
               .catch(() => ({ job: j, apps: [] }))
          )
        );
        const stubs = [];
        for (const { job, apps } of results) {
          for (const a of apps) {
            if (a.status === 'SHORTLISTED' || a.status === 'HIRED') {
              stubs.push({
                applicationId:     a.id,
                candidateName:     a.applicantName,
                candidateEmail:    a.applicantEmail,
                candidateId:       a.applicantId,
                jobTitle:          job.title,
                jobId:             job.id,
                applicationStatus: a.status,
                lastMessage:       null,
                lastMessageAt:     a.appliedAt || null,
                unreadCount:       0,
                _fromApplicants:   true,
              });
            }
          }
        }
        return stubs;
      } catch {
        return [];
      }
    }
  }, []);

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    // Always clear the module-level cache on mount so conversations are
    // re-fetched with the latest API response (which now includes jobId).
    convCache    = null;
    stubsFetched = false;

    let cancelled    = false;
    let pollInterval = null;

    const init = async () => {
      if (convCache) {
        mergeRef.current = new Map(convCache);
        setLoading(false);
        fetchConversations();
        return;
      }

      const [, stubs] = await Promise.all([
        fetchConversations(),
        stubsFetched
          ? Promise.resolve([])
          : fetchStubs()
              .then(data => { stubsFetched = true; return data; })
              .catch(() => [])
      ]);

      if (cancelled) return;

      applyMerge([], stubs);

      pollInterval = setInterval(() => {
        if (!cancelled) fetchConversations();
      }, 30000);
    };

    init();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applyMerge, fetchConversations, fetchStubs]);

  // ── Handle selection ────────────────────────────────────────
  const handleSelect = useCallback((conv) => {
    setSelected(conv);
    setLinkError('');
  }, []);

  // ── Bulk assign ─────────────────────────────────────────────
  const handleBulkAssign = async () => {
    setBulkAssigning(true);
    try {
      const uniqueJobIds = new Set(conversations.map(c => c.jobId).filter(Boolean));
      const results = await Promise.allSettled(
        [...uniqueJobIds].map(jobId => assignInterviewToAll(jobId))
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        setBulkMsg(`⚠️ ${failed} job(s) failed. Check logs.`);
      } else {
        setBulkMsg('success');
      }
    } catch (err) {
      console.error('Bulk assign error:', err);
      setBulkMsg(err.message || 'Failed to assign interviews.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const formatTime = useCallback((iso) => {
    if (!iso) return '';
    const d    = new Date(iso);
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, []);

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  // ── Requirement #3: group conversations by job posting ─────────────
  // The backend already exposes /api/chat/manager/conversations/grouped
  // for this, but the existing flat `conversations` list here already
  // carries jobId/jobTitle per item (and drives the unread/cache/merge
  // logic above), so grouping is derived client-side from the same
  // source of truth — no extra request, and it can never drift out of
  // sync with the flat list used elsewhere on this page (interview-link
  // button, WS updates, etc).
  const groupedByJob = useMemo(() => {
    const map = new Map();
    for (const conv of conversations) {
      const key = conv.jobId ?? `title:${conv.jobTitle || 'Unknown role'}`;
      if (!map.has(key)) {
        map.set(key, { key, jobId: conv.jobId, jobTitle: conv.jobTitle || 'Untitled role', candidates: [] });
      }
      map.get(key).candidates.push(conv);
    }
    return [...map.values()].sort((a, b) => (a.jobTitle || '').localeCompare(b.jobTitle || ''));
  }, [conversations]);

  // Keep the group containing the currently selected candidate expanded,
  // so opening a conversation never hides it behind a collapsed dropdown.
  useEffect(() => {
    if (!selected) return;
    const key = selected.jobId ?? `title:${selected.jobTitle || 'Unknown role'}`;
    setExpandedJobs(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, [selected]);

  const assignedIds = new Set(
    typeof window !== 'undefined' && window.localStorage
      ? (localStorage.getItem('hirex_interview_assigned') || '[]')
          .split(',')
          .map(s => s.replace(/["\[\]]/g, '').trim())
          .filter(Boolean)
      : []
  );

  return (
    <div className="rc-page">
      <div className="rc-header">
        <div className="rc-header-top">
          <div>
            <h1 className="rc-title">Recruiter Conversations</h1>
            <p className="rc-subtitle">
              Chat with shortlisted candidates regarding interviews and hiring updates
            </p>
          </div>
          {conversations.length > 0 && (
            <button
              className="rc-bulk-assign-btn"
              onClick={() => { setBulkModal(true); setBulkMsg(''); }}
              disabled={bulkAssigning}
              title="Assign AI interview to all shortlisted candidates at once"
            >
              {bulkAssigning ? '⏳ Assigning…' : '🤖 Assign AI Interview to All'}
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Assign Modal ────────────────────────────────── */}
      {bulkModal && (
        <div className="rc-modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="rc-modal" onClick={e => e.stopPropagation()}>
            <div className="rc-modal-header">
              <span className="rc-modal-icon">🤖</span>
              <h3>Assign AI Interview to All</h3>
              <button className="rc-modal-close" onClick={() => setBulkModal(false)}>×</button>
            </div>
            {bulkMsg === 'success' ? (
              <div className="rc-modal-success">
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <p>AI interviews have been assigned to <strong>all shortlisted candidates</strong>.</p>
                <p className="rc-modal-hint">Each candidate will see a <em>"Start AI Interview"</em> button on their My Applications page.</p>
                <button className="rc-modal-done-btn" onClick={() => { setBulkModal(false); setBulkMsg(''); }}>Done</button>
              </div>
            ) : (
              <>
                <div className="rc-modal-body">
                  <p>This will assign an AI interview to all <strong>{conversations.length} shortlisted candidates</strong> at once.</p>
                  <p className="rc-modal-hint">Candidates who already have an interview assigned will be skipped automatically.</p>
                  {bulkMsg && bulkMsg !== 'success' && (
                    <div className="rc-modal-error">⚠️ {bulkMsg}</div>
                  )}
                </div>
                <div className="rc-modal-footer">
                  <button className="rc-modal-cancel-btn" onClick={() => setBulkModal(false)} disabled={bulkAssigning}>Cancel</button>
                  <button className="rc-modal-confirm-btn" onClick={handleBulkAssign} disabled={bulkAssigning}>
                    {bulkAssigning ? '⏳ Assigning…' : '🤖 Assign to All'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rc-layout">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <div className="rc-sidebar">
          <div className="rc-sidebar-header">
            <span>Conversations</span>
            {totalUnread > 0 && <span className="rc-badge">{totalUnread}</span>}
          </div>

          {loading && <div className="rc-loading">Loading…</div>}
          {error   && <div className="rc-error">{error}</div>}

          {!loading && conversations.length === 0 && (
            <div className="rc-empty">
              <div className="rc-empty-icon">💬</div>
              <p>No shortlisted candidates yet.</p>
              <p className="rc-empty-hint">
                Shortlisted candidates appear here automatically.
              </p>
            </div>
          )}

          <div className="rc-conv-list">
            {groupedByJob.map(group => {
              const isOpen = expandedJobs.has(group.key);
              return (
                <div key={group.key} className="rc-job-group">
                  <button
                    type="button"
                    className={`rc-job-group-header ${isOpen ? 'rc-job-group-header--open' : ''}`}
                    onClick={() => toggleJobGroup(group.key)}
                    aria-expanded={isOpen}
                  >
                    <span className="rc-job-group-title">💼 {group.jobTitle}</span>
                    <span className="rc-job-group-header-right">
                      <span className="rc-job-group-count">{group.candidates.length}</span>
                      <span className="rc-job-group-chevron">▾</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="rc-job-group-body">
                      {group.candidates.map(conv => (
                        <ConvItem
                          key={conv.applicationId}
                          conv={conv}
                          isActive={selected?.applicationId === conv.applicationId}
                          onSelect={handleSelect}
                          formatTime={formatTime}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Chat Panel ──────────────────────────────────── */}
        <div className="rc-chat-panel">
          {!selected ? (
            <div className="rc-no-selection">
              <div className="rc-no-selection-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a candidate from the left to start chatting.</p>
            </div>
          ) : (
            <div className="rc-chat-wrap">
              <div className="rc-chat-info-bar">
                <div className="rc-info-left">
                  <strong>{selected.candidateName}</strong>
                  <span className="rc-info-email">{selected.candidateEmail}</span>
                </div>
                <div className="rc-info-right">
                  <span className="rc-info-job">{selected.jobTitle}</span>
                  <span className={`rc-status-badge ${
                    selected.applicationStatus === 'HIRED' ? 'rc-status-hired' :
                    selected.applicationStatus === 'REJECTED' ? 'rc-status-rejected' :
                    'rc-status-shortlisted'
                  }`}>
                    {selected.applicationStatus === 'HIRED' ? '🏆 HIRED' : selected.applicationStatus}
                  </span>
                  {assignedIds.has(String(selected.applicationId)) && (
                    <span className="rc-interview-assigned-badge">
                      ✅ Interview Assigned
                    </span>
                  )}
                  <button
                    onClick={handleGenerateInterviewLink}
                    disabled={linkGenerating || selected.applicationStatus !== 'SHORTLISTED'}
                    title={
                      selected.applicationStatus !== 'SHORTLISTED'
                        ? 'Only shortlisted candidates can be sent an interview link'
                        : 'Create a secure interview link and send it in this chat'
                    }
                    style={{
                      display:       'inline-flex',
                      alignItems:    'center',
                      gap:           '6px',
                      background:    (linkGenerating || selected.applicationStatus !== 'SHORTLISTED') ? '#93c5fd' : '#2563eb',
                      color:         '#fff',
                      border:        'none',
                      borderRadius:  '8px',
                      padding:       '7px 14px',
                      fontSize:      '13px',
                      fontWeight:    500,
                      cursor:        (linkGenerating || selected.applicationStatus !== 'SHORTLISTED') ? 'not-allowed' : 'pointer',
                      whiteSpace:    'nowrap',
                      transition:    'background 0.2s',
                    }}
                  >
                    {linkGenerating ? '⏳ Generating…' : '🎥 Generate Interview Link'}
                  </button>
                  {linkError && (
                    <span style={{
                      fontSize:   '12px',
                      color:      '#dc2626',
                      marginTop:  '4px',
                      display:    'block',
                      maxWidth:   '220px',
                      lineHeight: 1.4,
                    }}>
                      ⚠️ {linkError}
                    </span>
                  )}
                </div>
              </div>

              <ChatWindow
                key={selected.applicationId}
                applicationId={selected.applicationId}
                recipientName={selected.candidateName}
                embedded={true}
                onConversationUpdate={(lastMsg) => {
                  const updated = {
                    ...selected,
                    lastMessage:   lastMsg.content || `📎 ${lastMsg.fileName}`,
                    lastMessageAt: lastMsg.sentAt,
                  };
                  mergeRef.current.set(selected.applicationId, updated);
                  convCache = new Map(mergeRef.current);
                  setConversations(prev =>
                    prev.map(c =>
                      c.applicationId === selected.applicationId ? updated : c
                    ).sort((a, b) => {
                      if (a.lastMessage && !b.lastMessage) return -1;
                      if (!a.lastMessage && b.lastMessage)  return  1;
                      return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
                    })
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}