/**
 * LiveBroadcastBadge.jsx
 *
 * Small, non-intrusive indicator shown to the CANDIDATE during their AI
 * interview, reflecting the state of the background webcam broadcast to
 * the recruiter (see hooks/useAIInterviewBroadcast.js).
 *
 * This never gives the candidate any control over the broadcast — it's
 * purely informational, matching the "recruiter has view-only access,
 * candidate isn't burdened with a call UI" design of the feature.
 *
 * status values: 'idle' | 'connecting' | 'waiting' | 'live' | 'reconnecting'
 *                | 'ended' | 'error'
 */

import React from 'react';

const STATUS_META = {
  idle: null, // nothing to show — broadcast hasn't started / not applicable
  connecting: { label: 'Connecting…', dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', pulse: false },
  waiting: { label: 'Ready for recruiter', dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', pulse: false },
  live: { label: 'Live to recruiter', dot: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.35)', pulse: true },
  reconnecting: { label: 'Reconnecting…', dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', pulse: true },
  ended: null, // broadcast finished — no need to keep showing a badge
  error: { label: 'Broadcast unavailable', dot: '#9ca3af', bg: 'rgba(156,163,175,0.14)', border: 'rgba(156,163,175,0.35)', pulse: false },
};

function LiveBroadcastBadge({ status }) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      title="Your recruiter can view this broadcast; they cannot control your camera or microphone."
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 60,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: '#111827',
        fontSize: 12.5,
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(6px)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
          animation: meta.pulse ? 'lbb-pulse 1.6s ease-in-out infinite' : 'none',
        }}
      />
      <span>{meta.label}</span>
      <style>{`
        @keyframes lbb-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.45); }
          70%  { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        @media (max-width: 640px) {
          div[role="status"] { top: 10px; right: 10px; font-size: 11.5px; padding: 6px 10px; }
        }
      `}</style>
    </div>
  );
}

export default LiveBroadcastBadge;
