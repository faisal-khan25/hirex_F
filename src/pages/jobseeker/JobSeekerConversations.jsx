import { useState, useEffect, useRef, useCallback, memo } from 'react';
import api from '../../services/api';
import ChatWindow from '../../components/chat/ChatWindow';
import useSEO from '../../hooks/useSeo';
import './JobSeekerConversations.css';

/**
 * Requirement #4 — Job Seeker Conversation Page (Admin Dashboard Layout Overhaul).
 */

const STATUS_LABEL = {
  SHORTLISTED:          { label: 'Shortlisted',          cls: 'bj-status-shortlisted' },
  INTERVIEW_SCHEDULED:  { label: 'Interview Scheduled',    cls: 'bj-status-interview' },
  INTERVIEW_COMPLETED:  { label: 'Interview Completed',    cls: 'bj-status-interview' },
  INTERVIEW_PASSED:     { label: 'Interview Passed',       cls: 'bj-status-passed' },
  INTERVIEW_FAILED:     { label: 'Interview Not Cleared',  cls: 'bj-status-failed' },
  HIRED:                { label: 'Hired',                  cls: 'bj-status-hired' },
};

const ConvItem = memo(function ConvItem({ conv, isActive, onSelect, formatTime }) {
  const statusInfo = STATUS_LABEL[conv.conversationStatus] || { label: conv.conversationStatus, cls: 'bj-status-default' };
  return (
    <div
      className={`bj-table-row-container ${isActive ? 'bj-row--chat-active' : ''} ${conv.unreadCount > 0 ? 'bj-row--unread' : ''}`}
      onClick={() => onSelect(conv)}
    >
      <div className="bj-table-row">
        {/* Column 1: Company Entity Info */}
        <div className="bj-col-info">
          <div className="bj-logo">
            {conv.companyName?.charAt(0)?.toUpperCase() || conv.jobTitle?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="bj-info-text">
            <h3 className="bj-job-title">{conv.jobTitle}</h3>
            <span className="bj-posted-stamp">
              {conv.companyName}{conv.recruiterName ? ` · ${conv.recruiterName}` : ''}
            </span>
          </div>
        </div>

        {/* Column 2: Date & Status Parameters */}
        <div className="bj-col-meta">
          <div className="bj-meta-cell">
            <span className="bj-meta-lbl">Activity</span>
            <span className="bj-meta-val highlight">{formatTime(conv.lastMessageAt) || '—'}</span>
          </div>
          <div className="bj-meta-cell">
            <span className="bj-meta-lbl">Pipeline Metric</span>
            <span className={`bj-status-pill ${statusInfo.cls}`}>{statusInfo.label}</span>
          </div>
        </div>

        {/* Column 3: Preview Snippet & Unread Badges */}
        <div className="bj-col-preview">
          <span className="bj-conv-preview">{conv.lastMessage || 'No messages yet'}</span>
          {conv.unreadCount > 0 && <span className="bj-unread-badge">{conv.unreadCount}</span>}
        </div>
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
    <div className="bj-page-layout bj-conv-page-context">
      <div className="bj-main-content-area bj-conv-flex-wrapper">
        
        {/* Left Side: Standardized High-Density Tabular List Framework */}
        <div className="bj-conv-dashboard-table">
          <div className="bj-topbar">
            <div>
              <h1>Conversations</h1>
              <p className="bj-count">
                {conversations.length ? `${conversations.length} active process channels verified` : '0 channels recorded'}
              </p>
            </div>
          </div>

          <div className="bj-table-container">
            <div className="bj-table-header">
              <div className="bj-col-info">Shortlisted Process Track</div>
              <div className="bj-col-meta">Parameters</div>
              <div className="bj-col-preview">Transmission Log Summary</div>
            </div>

            <div className="bj-table-body bj-conv-list-scroll">
              {loading && <div className="bj-loading"><div className="bj-spinner" />Syncing channels…</div>}
              {error && <div className="bj-error-banner">{error}</div>}

              {!loading && conversations.length === 0 && (
                <div className="bj-empty">
                  <div className="bj-empty-icon">💬</div>
                  <h3>No channels initialized</h3>
                  <p>Once an internal recruiter flags your application as shortlisted, a dedicated sync path generates automatically.</p>
                </div>
              )}

              {!loading && conversations.map(conv => (
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
        </div>

        {/* Right Side: Primary Operational Viewport / Workspace Sidebar */}
        <div className="bj-conv-workspace-panel">
          {!selected ? (
            <div className="bj-empty bj-workspace-placeholder">
              <div className="bj-empty-icon">📂</div>
              <h3>Select a Pipeline Channel</h3>
              <p>Choose an entry from the tracking grid on the left to review documentation hooks, message streams, or scheduling tokens.</p>
            </div>
          ) : (
            <div className="bj-workspace-chat-wrapper">
              <div className="bj-workspace-info-header">
                <div className="bj-info-left">
                  <strong>{selected.jobTitle}</strong>
                  <span className="bj-posted-stamp">{selected.companyName}{selected.recruiterName ? ` · Recruiter Hub: ${selected.recruiterName}` : ''}</span>
                </div>
                <div className="bj-info-right">
                  {(() => {
                    const statusInfo = STATUS_LABEL[selected.conversationStatus] || { label: selected.conversationStatus, cls: 'bj-status-default' };
                    return <span className={`bj-status-pill ${statusInfo.cls}`}>{statusInfo.label}</span>;
                  })()}
                </div>
              </div>

              <div className="bj-workspace-chat-body">
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
            </div>
          )}
        </div>

      </div>
    </div>
  );
}