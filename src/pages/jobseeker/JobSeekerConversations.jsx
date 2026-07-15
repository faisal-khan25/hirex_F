import { useState, useEffect, useRef, useCallback, memo } from 'react';
import api from '../../services/api';
import ChatWindow from '../../components/chat/ChatWindow';
import useSEO from '../../hooks/useSeo';
import './JobSeekerConversations.css';

/**
 * Requirement #4 — Job Seeker Conversation Page.
 *
 * Shows a conversation ONLY for jobs where the candidate has been
 * shortlisted (or moved further along the pipeline) — driven entirely by
 * GET /api/chat/jobseeker/conversations, which the backend already scopes
 * to CHAT_ELIGIBLE_STATUSES (SHORTLISTED, INTERVIEW_SCHEDULED, ...HIRED).
 * A candidate who was rejected, or hasn't been processed by ATS yet,
 * will simply never see an entry here.
 *
 * For each conversation the candidate sees: Job Title, Recruiter Name,
 * Company Name, and Conversation Status — then can open it to chat with
 * the recruiter and receive interview invitations / AI interview links /
 * live interview links (all rendered inline by ChatWindow, which already
 * knows how to render INTERVIEW_LINK messages with a role-aware
 * "Join Interview" button).
 */

const STATUS_LABEL = {
  SHORTLISTED:          { label: 'Shortlisted',           cls: 'jc-status-shortlisted' },
  INTERVIEW_SCHEDULED:  { label: 'Interview Scheduled',    cls: 'jc-status-interview' },
  INTERVIEW_COMPLETED:  { label: 'Interview Completed',    cls: 'jc-status-interview' },
  INTERVIEW_PASSED:     { label: 'Interview Passed',       cls: 'jc-status-passed' },
  INTERVIEW_FAILED:     { label: 'Interview Not Cleared',  cls: 'jc-status-failed' },
  HIRED:                { label: 'Hired',                  cls: 'jc-status-hired' },
};

const ConvItem = memo(function ConvItem({ conv, isActive, onSelect, formatTime }) {
  const statusInfo = STATUS_LABEL[conv.conversationStatus] || { label: conv.conversationStatus, cls: 'jc-status-default' };
  return (
    <div
      className={`jc-conv-item ${isActive ? 'jc-conv-item--active' : ''} ${conv.unreadCount > 0 ? 'jc-conv-item--unread' : ''}`}
      onClick={() => onSelect(conv)}
    >
      <div className="jc-conv-avatar">{conv.companyName?.charAt(0)?.toUpperCase() || conv.jobTitle?.charAt(0)?.toUpperCase() || '?'}</div>
      <div className="jc-conv-info">
        <div className="jc-conv-top">
          <span className="jc-conv-job">{conv.jobTitle}</span>
          <span className="jc-conv-time">{formatTime(conv.lastMessageAt)}</span>
        </div>
        <div className="jc-conv-company">{conv.companyName}{conv.recruiterName ? ` · ${conv.recruiterName}` : ''}</div>
        <div className="jc-conv-bottom">
          <span className="jc-conv-preview">{conv.lastMessage || 'No messages yet'}</span>
          {conv.unreadCount > 0 && <span className="jc-unread-badge">{conv.unreadCount}</span>}
        </div>
        <span className={`jc-status-pill ${statusInfo.cls}`}>{statusInfo.label}</span>
      </div>
    </div>
  );
});

export default function JobSeekerConversations() {
  useSEO({ title: 'Messages', description: 'Chat with recruiters about your job applications on HireX.' });
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const mergeRef = useRef(new Map());

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/api/chat/jobseeker/conversations');
      const map = mergeRef.current;
      for (const conv of data) {
        const existing = map.get(conv.applicationId);
        map.set(conv.applicationId, {
          ...(existing || {}),
          ...conv,
        });
      }
      const sorted = [...map.values()].sort((a, b) => {
        if (a.lastMessage && !b.lastMessage) return -1;
        if (!a.lastMessage && b.lastMessage) return 1;
        return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
      });
      setConversations(sorted);
      setError('');
    } catch {
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollInterval = null;

    fetchConversations().then(() => {
      if (cancelled) return;
      pollInterval = setInterval(() => {
        if (!cancelled) fetchConversations();
      }, 30000);
    });

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fetchConversations]);

  const handleSelect = useCallback((conv) => setSelected(conv), []);

  const formatTime = useCallback((iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, []);

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  return (
    <div className="jc-page">
      <div className="jc-header">
        <h1 className="jc-title">Conversations</h1>
        <p className="jc-subtitle">
          Chat with recruiters, and receive interview invitations and interview links here —
          shown for every job where you've been shortlisted.
        </p>
      </div>

      <div className="jc-layout">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <div className="jc-sidebar">
          <div className="jc-sidebar-header">
            <span>Shortlisted Jobs</span>
            {totalUnread > 0 && <span className="jc-badge">{totalUnread}</span>}
          </div>

          {loading && <div className="jc-loading">Loading…</div>}
          {error && <div className="jc-error">{error}</div>}

          {!loading && conversations.length === 0 && (
            <div className="jc-empty">
              <div className="jc-empty-icon">💬</div>
              <p>No conversations yet.</p>
              <p className="jc-empty-hint">
                Once a recruiter shortlists you for a job, that conversation will appear here automatically.
              </p>
            </div>
          )}

          <div className="jc-conv-list">
            {conversations.map(conv => (
              <ConvItem
                key={conv.applicationId}
                conv={conv}
                isActive={selected?.applicationId === conv.applicationId}
                onSelect={handleSelect}
                formatTime={formatTime}
              />
            ))}
          </div>
        </div>

        {/* ── Chat Panel ──────────────────────────────────── */}
        <div className="jc-chat-panel">
          {!selected ? (
            <div className="jc-no-selection">
              <div className="jc-no-selection-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a job from the left to chat with the recruiter.</p>
            </div>
          ) : (
            <div className="jc-chat-wrap">
              <div className="jc-chat-info-bar">
                <div className="jc-info-left">
                  <strong>{selected.jobTitle}</strong>
                  <span className="jc-info-sub">{selected.companyName}{selected.recruiterName ? ` · Recruiter: ${selected.recruiterName}` : ''}</span>
                </div>
                <div className="jc-info-right">
                  {(() => {
                    const statusInfo = STATUS_LABEL[selected.conversationStatus] || { label: selected.conversationStatus, cls: 'jc-status-default' };
                    return <span className={`jc-status-pill ${statusInfo.cls}`}>{statusInfo.label}</span>;
                  })()}
                </div>
              </div>

              <ChatWindow
                key={selected.applicationId}
                applicationId={selected.applicationId}
                recipientName={selected.recruiterName || selected.companyName}
                embedded={true}
                onConversationUpdate={(lastMsg) => {
                  const updated = {
                    ...selected,
                    lastMessage: lastMsg.content || `📎 ${lastMsg.fileName}`,
                    lastMessageAt: lastMsg.sentAt,
                  };
                  mergeRef.current.set(selected.applicationId, updated);
                  setConversations(prev =>
                    prev.map(c => c.applicationId === selected.applicationId ? updated : c)
                      .sort((a, b) => {
                        if (a.lastMessage && !b.lastMessage) return -1;
                        if (!a.lastMessage && b.lastMessage) return 1;
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
