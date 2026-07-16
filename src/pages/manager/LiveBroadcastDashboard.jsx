/**
 * LiveBroadcastDashboard.jsx
 *
 * Route: /manager/live-broadcasts
 *
 * Lists every AI-interview live broadcast currently WAITING or ACTIVE for
 * the logged-in recruiter, using the existing backend endpoint:
 *   GET /api/live-interview/active-broadcasts
 *
 * That endpoint also returns manual (chat-initiated) live sessions —
 * this dashboard only surfaces sessionOrigin === 'AI_INTERVIEW' entries,
 * since manual sessions already have their own entry point via the chat
 * panel (RecruiterInterviewRoom).
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import liveInterviewApi from '../../services/liveInterviewApi';
import useSEO from '../../hooks/useSeo';

const POLL_MS = 6000;

function statusMeta(item) {
  if (item.sessionStatus === 'ACTIVE') {
    return { label: 'Live', color: '#dc2626', bg: '#fee2e2', dot: '#dc2626' };
  }
  if (item.sessionStatus === 'WAITING') {
    return { label: 'Waiting for you', color: '#b45309', bg: '#fef3c7', dot: '#f59e0b' };
  }
  if (item.sessionStatus === 'ABANDONED') {
    return { label: 'Candidate disconnected', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
  }
  return { label: item.sessionStatus || 'Unknown', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
}

function timeAgo(iso) {
  if (!iso) return null;
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function BroadcastCard({ item, onWatch }) {
  const meta = statusMeta(item);
  const progressLabel = item.currentQuestionNumber && item.totalQuestions
    ? `Question ${item.currentQuestionNumber} of ${item.totalQuestions}`
    : 'Awaiting first question…';

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#265DF5,#131224)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 18,
        }}
      >
        {item.candidateName?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#131224' }}>
            {item.candidateName || 'Candidate'}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              color: meta.color, background: meta.bg, textTransform: 'uppercase', letterSpacing: '.03em',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: meta.dot,
              animation: item.sessionStatus === 'ACTIVE' ? 'lb-pulse 1.6s ease-in-out infinite' : 'none',
            }} />
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
          {item.jobTitle || 'Applied role'} {item.companyName ? `· ${item.companyName}` : ''}
        </div>
        <div style={{ fontSize: 12.5, color: '#265DF5', marginTop: 4, fontWeight: 600 }}>
          {progressLabel}
        </div>
        {item.interviewStartTime && (
          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>
            Started {timeAgo(item.interviewStartTime)}
          </div>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => onWatch(item)}
        style={{
          flexShrink: 0,
          background: '#265DF5',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '10px 20px',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <span>▶</span> Watch Live
      </button>

      <style>{`
        @keyframes lb-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
          70%  { box-shadow: 0 0 0 5px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}

/** Skeleton placeholder shown during the initial load, matching BroadcastCard's shape. */
function BroadcastCardSkeleton() {
  return (
    <div
      style={{
        background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14,
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 18,
      }}
      aria-hidden="true"
    >
      <div className="lb-skel lb-skel--circle" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="lb-skel" style={{ width: '35%', height: 14, borderRadius: 6 }} />
        <div className="lb-skel" style={{ width: '55%', height: 11, borderRadius: 6 }} />
        <div className="lb-skel" style={{ width: '30%', height: 11, borderRadius: 6 }} />
      </div>
      <div className="lb-skel" style={{ width: 108, height: 36, borderRadius: 10, flexShrink: 0 }} />
      <style>{`
        .lb-skel { background: linear-gradient(90deg,#f0f1f3 25%,#e5e7eb 37%,#f0f1f3 63%); background-size: 400% 100%; animation: lb-shimmer 1.4s ease infinite; }
        @keyframes lb-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      `}</style>
    </div>
  );
}

function LiveBroadcastDashboard() {
  useSEO({ title: 'Live Broadcasts', description: 'Monitor live AI interview broadcasts in progress on HireX.' });
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const pollRef = useRef(null);
  // Guards against setState-after-unmount: the polling interval can fire a
  // request that resolves after the user has already navigated away.
  const mountedRef = useRef(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const { data } = await liveInterviewApi.getActiveBroadcasts();
      if (!mountedRef.current) return;
      const aiOnly = (data || []).filter((s) => s.sessionOrigin === 'AI_INTERVIEW');
      setBroadcasts(aiOnly);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.userMessage || 'Could not load live broadcasts.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load(true);
    pollRef.current = setInterval(() => load(false), POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(pollRef.current);
    };
  }, [load]);

  const handleWatch = useCallback((item) => {
    if (item.interviewSessionId) {
      navigate(`/manager/live-broadcasts/${item.interviewSessionId}`);
    }
  }, [navigate]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#131224', margin: 0 }}>
            Live AI Interviews
          </h1>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: '4px 0 0' }}>
            Watch candidates' camera feeds in real time while they take their AI interview.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          title="Refresh"
          style={{
            border: '1.5px solid #e5e7eb', background: '#fff', borderRadius: 10,
            padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true" aria-label="Loading live interviews">
          <BroadcastCardSkeleton />
          <BroadcastCardSkeleton />
          <BroadcastCardSkeleton />
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            borderRadius: 10, padding: '14px 16px', fontSize: 13.5,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && broadcasts.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '70px 20px', color: '#9ca3af',
          background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: 16,
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No live interviews right now</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            When a candidate starts their AI interview, it will appear here automatically.
          </div>
        </div>
      )}

      {!loading && !error && broadcasts.length > 0 && (
        <div role="list" aria-label="Active live interviews" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {broadcasts.map((item) => (
            <div role="listitem" key={item.liveSessionId}>
              <BroadcastCard item={item} onWatch={handleWatch} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveBroadcastDashboard;