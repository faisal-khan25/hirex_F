/**
 * LiveBroadcastBadge.jsx
 *
 * A small, unobtrusive floating badge shown on the candidate's AI Interview
 * page indicating whether their camera is currently being broadcast live to
 * the recruiter. Purely informational — no controls (the candidate can't
 * stop the recruiter from watching, matching the "view-only for recruiter,
 * automatic for candidate" requirement).
 */

import React from 'react';

const CONFIG = {
  idle:         null, // nothing to show — no broadcast available/needed
  connecting:   { label: 'Connecting…',        dot: '#f59e0b', pulse: true  },
  waiting:      { label: 'Live — Ready',       dot: '#10b981', pulse: true  },
  live:         { label: 'Live — Recruiter Watching', dot: '#ef4444', pulse: true },
  reconnecting: { label: 'Reconnecting…',      dot: '#f59e0b', pulse: true  },
  ended:        { label: 'Broadcast Ended',    dot: '#6b7280', pulse: false },
  error:        { label: 'Broadcast Unavailable', dot: '#ef4444', pulse: false },
};

function LiveBroadcastBadge({ status = 'idle' }) {
  const cfg = CONFIG[status];
  if (!cfg) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 16,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(13,14,26,0.85)',
        border: '1px solid rgba(99,102,241,0.25)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        fontSize: 12.5,
        fontWeight: 600,
        color: '#f0f0f8',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      title="Your camera is broadcast live to your recruiter during this interview."
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: cfg.dot,
          boxShadow: cfg.pulse ? `0 0 0 rgba(0,0,0,0)` : 'none',
          animation: cfg.pulse ? 'hirex-live-dot-pulse 1.6s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      />
      <span>{cfg.label}</span>
      <style>{`
        @keyframes hirex-live-dot-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}

export default LiveBroadcastBadge;