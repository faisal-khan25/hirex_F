/**
 * LiveBroadcastViewer.jsx
 *
 * Route: /manager/live-broadcasts/:interviewSessionId
 *
 * View-only recruiter viewer for a candidate's AI-interview live broadcast.
 * The recruiter has NO control over the candidate's camera/mic — this page
 * never calls getUserMedia and never sends a media stream; it only receives
 * the candidate's video/audio over WebRTC and mirrors interview progress in
 * real time over STOMP.
 *
 * Signaling contract (matches the backend's LiveInterviewSignalingController
 * exactly — same one used by the manual RecruiterInterviewRoom):
 *   → /app/live/join                              { sessionToken, role: 'RECRUITER' }
 *   ← /topic/session/{liveSessionId}/status        SessionStatusNotification
 *   ← /topic/camera/{liveSessionId}                CameraStatusNotification
 *   ← /topic/live-interview/{liveSessionId}/question  QuestionUpdateNotification
 *   ← /user/queue/offer                            WebRtcOfferMessage (from CANDIDATE)
 *   → /app/live/answer                             WebRtcAnswerMessage
 *   ↔ /user/queue/ice / /app/live/ice              IceCandidateMessage
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import liveInterviewApi from '../../services/liveInterviewApi';
import stompService      from '../../services/stompService';
import webrtcService, { configureIceServers } from '../../services/webrtcService';

import VideoPlayer      from '../../components/VideoPlayer';
import ConnectionStatus from '../../components/ConnectionStatus';
import InterviewTimer   from '../../components/InterviewTimer';

import '../interview/interviewRoom.css';

const MAX_ALERTS = 4;

function elapsedSeconds(startIso) {
  if (!startIso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
}

function CandidateProgressCard({ summary, candidateCameraOn, connectionState }) {
  const isLive = summary?.sessionStatus === 'ACTIVE';
  const isCompleted = summary?.aiInterviewStatus &&
    ['COMPLETED', 'PASSED', 'FAILED', 'UNDER_REVIEW'].includes(summary.aiInterviewStatus);

  return (
    <div className="ir-info-card">
      <div className="ir-info-card__header">
        <div className="ir-info-card__avatar">
          {summary?.candidateName?.[0]?.toUpperCase() ?? 'C'}
        </div>
        <div className="ir-info-card__title">
          <span className="ir-info-card__name">{summary?.candidateName ?? 'Candidate'}</span>
          <span className="ir-info-card__badge">Applicant</span>
        </div>
      </div>

      <div className="ir-info-card__rows">
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">💼</span>
          <div>
            <div className="ir-info-card__label">Applied Job</div>
            <div className="ir-info-card__value">{summary?.jobTitle ?? '—'}</div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">📋</span>
          <div>
            <div className="ir-info-card__label">Interview Status</div>
            <div className={`ir-info-card__value ir-info-card__value--status ${isCompleted ? '' : isLive ? 'ir-val--active' : 'ir-val--waiting'}`}>
              {isCompleted ? 'Completed' : isLive ? 'Live' : 'Waiting'}
            </div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">❓</span>
          <div>
            <div className="ir-info-card__label">Current Question</div>
            <div className="ir-info-card__value">
              {summary?.currentQuestionNumber && summary?.totalQuestions
                ? `${summary.currentQuestionNumber} of ${summary.totalQuestions}`
                : '—'}
            </div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">{candidateCameraOn ? '📹' : '📵'}</span>
          <div>
            <div className="ir-info-card__label">Camera Status</div>
            <div className={`ir-info-card__value ${candidateCameraOn ? 'ir-val--on' : 'ir-val--off'}`}>
              {candidateCameraOn ? 'On' : 'Off'}
            </div>
          </div>
        </div>
      </div>

      <div className="ir-info-card__divider" />
      <div className="ir-info-card__timer-section">
        <span className="ir-info-card__label">Interview Duration</span>
        <InterviewTimer
          running={isLive}
          startOffset={elapsedSeconds(summary?.interviewStartTime)}
          className="ir-info-card__timer"
        />
      </div>

      {summary?.currentQuestionText && (
        <>
          <div className="ir-info-card__divider" />
          <div>
            <div className="ir-info-card__label" style={{ marginBottom: 6 }}>Current Question</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
              {summary.currentQuestionText}
            </div>
          </div>
        </>
      )}

      <div className="ir-info-card__divider" />
      <div className="ir-info-card__status-group">
        <div className="ir-info-card__status-row">
          <span className={`ir-dot ${connectionState === 'connected' ? 'ir-dot--green' : 'ir-dot--amber'}`} />
          <span className="ir-info-card__status-text">
            Video {connectionState === 'connected' ? 'Connected' : 'Connecting…'}
          </span>
        </div>
        <div className="ir-info-card__status-row">
          <span className="ir-dot ir-dot--green" />
          <span className="ir-info-card__status-text">View-only — no camera/mic control</span>
        </div>
      </div>
    </div>
  );
}

function LiveBroadcastViewer() {
  const { interviewSessionId } = useParams();
  const navigate = useNavigate();

  const [summary,   setSummary]   = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase,     setPhase]     = useState('loading'); // loading | error | ended | live

  const [remoteStream,      setRemoteStream]      = useState(null);
  const [candidateCameraOn, setCandidateCameraOn]  = useState(true);
  const [stompState, setStompState] = useState('disconnected');
  const [rtcState,   setRtcState]   = useState('new');
  const [alerts,     setAlerts]     = useState([]);
  const [reconnectTick, setReconnectTick] = useState(0);

  const containerRef  = useRef(null);
  const cleanupFnsRef = useRef([]);
  const tokenRef       = useRef(null);
  const liveSessionIdRef = useRef(null);

  const addAlert = useCallback((message, type = 'warning') => {
    setAlerts((prev) => [{ message, type, ts: Date.now() }, ...prev].slice(0, MAX_ALERTS));
  }, []);

  const teardownSignaling = useCallback(() => {
    cleanupFnsRef.current.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
    cleanupFnsRef.current = [];
    webrtcService.closeConnection();
  }, []);

  const fullCleanup = useCallback(() => {
    teardownSignaling();
    stompService.disconnect();
  }, [teardownSignaling]);

  /* ── 1. Load the broadcast summary (includes token — we're the recruiter) ── */
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    liveInterviewApi.getBroadcastByInterviewSession(interviewSessionId)
      .then(({ data }) => {
        if (cancelled) return;
        setSummary(data);
        tokenRef.current = data.sessionToken;
        liveSessionIdRef.current = data.liveSessionId;
        if (!data.sessionToken) {
          setLoadError('This broadcast is no longer available.');
          setPhase('error');
          return;
        }
        if (data.sessionStatus === 'ENDED') {
          setPhase('ended');
          return;
        }
        setPhase('live');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.userMessage || 'Could not load this live interview.');
        setPhase('error');
      });
    return () => { cancelled = true; };
  }, [interviewSessionId, reconnectTick]);

  /* ── 2. Signaling + WebRTC (receive-only) ── */
  useEffect(() => {
    if (phase !== 'live' || !tokenRef.current) return undefined;
    let cancelled = false;
    const token = tokenRef.current;
    const liveSessionId = liveSessionIdRef.current;

    const wireSignaling = () => {
      teardownSignaling();
      webrtcService.createPeerConnection();
      // View-only: no addStream() call — the recruiter never sends media.

      webrtcService.onConnectionStateChange = (state) => {
        if (cancelled) return;
        setRtcState(state);
        if (state === 'disconnected' || state === 'failed') {
          addAlert('Video connection interrupted. Attempting to reconnect…', 'error');
        }
      };

      webrtcService.onIceCandidateCallback = (candidate) => {
        stompService.sendIce(token, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex, 'RECRUITER');
      };

      webrtcService.onTrackCallback = (incomingStream) => {
        if (cancelled) return;
        setRemoteStream(incomingStream instanceof MediaStream ? incomingStream : new MediaStream([incomingStream]));
      };

      const unsubStatus = stompService.subscribe(`/topic/session/${liveSessionId}/status`, (msg) => {
        if (cancelled) return;
        setSummary((prev) => prev ? { ...prev, sessionStatus: msg.sessionStatus } : prev);
        if (msg.sessionStatus === 'ENDED') {
          setPhase('ended');
          fullCleanup();
        } else if (msg.sessionStatus === 'ABANDONED') {
          addAlert('The candidate disconnected unexpectedly.', 'warning');
        }
      });

      const unsubCamera = stompService.subscribe(`/topic/camera/${liveSessionId}`, (msg) => {
        if (cancelled) return;
        if (msg.participantRole === 'CANDIDATE') {
          setCandidateCameraOn(msg.cameraEnabled);
          if (!msg.cameraEnabled) addAlert('Candidate turned their camera off.', 'info');
        }
      });

      const unsubQuestion = stompService.subscribe(`/topic/live-interview/${liveSessionId}/question`, (msg) => {
        if (cancelled) return;
        setSummary((prev) => prev ? {
          ...prev,
          currentQuestionNumber: msg.questionNumber,
          currentQuestionText:   msg.questionText,
          totalQuestions:        msg.totalQuestions,
        } : prev);
      });

      const unsubOffer = stompService.subscribe('/user/queue/offer', async (msg) => {
        if (cancelled) return;
        try {
          if (msg.senderRole === 'CANDIDATE') {
            await webrtcService.setRemoteDescription(msg.sdp, 'offer');
            const answer = await webrtcService.createAnswer();
            stompService.sendAnswer(token, answer.sdp, 'RECRUITER');
          }
        } catch (err) {
          console.error('[LiveBroadcastViewer] Offer handling failed:', err);
          addAlert('Error establishing the video connection.', 'error');
        }
      });

      const unsubIce = stompService.subscribe('/user/queue/ice', async (msg) => {
        if (cancelled) return;
        if (msg.senderRole === 'CANDIDATE') {
          await webrtcService.addIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
        }
      });

      cleanupFnsRef.current.push(unsubStatus, unsubCamera, unsubQuestion, unsubOffer, unsubIce);
      stompService.sendJoin(token, 'RECRUITER');
    };

    const connectAndWire = async () => {
      setStompState('connecting');
      try {
        const { data: servers } = await liveInterviewApi.getIceServers();
        configureIceServers(servers);
      } catch (_) { /* defaults already set */ }

      const jwt = localStorage.getItem('token');
      try {
        await stompService.connect(jwt);
      } catch (err) {
        if (cancelled) return;
        setStompState('disconnected');
        setLoadError('Could not connect to the broadcast server.');
        setPhase('error');
        return;
      }
      if (cancelled) return;
      setStompState('connected');
      wireSignaling();

      // BUG FIX: onConnect is registered only AFTER the initial connect()
      // has resolved and wired signaling once. Registering it earlier (as
      // this used to do, in parallel with the in-flight connect() await)
      // raced with stompService's own onConnect callback list: both fired
      // wireSignaling() back-to-back on the very first connection, tearing
      // down and rebuilting the freshly-created peer connection a moment
      // after creating it. This mirrors the correct ordering already used
      // in useAIInterviewBroadcast.js — the callback below now only fires
      // on genuine FUTURE reconnects (network drop + recovery).
      const unregisterOnConnect = stompService.onConnect(() => {
        if (cancelled) return;
        setStompState('connected');
        wireSignaling();
      });
      cleanupFnsRef.current.push(unregisterOnConnect);
    };

    connectAndWire();

    const unregisterOnDisconnect = stompService.onDisconnect(() => {
      if (cancelled) return;
      setStompState('disconnected');
    });
    cleanupFnsRef.current.push(unregisterOnDisconnect);

    return () => {
      cancelled = true;
      teardownSignaling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, addAlert, fullCleanup, teardownSignaling]);

  useEffect(() => () => fullCleanup(), [fullCleanup]);

  const handleReconnect = useCallback(() => {
    setAlerts([]);
    fullCleanup();
    setRemoteStream(null);
    setReconnectTick((n) => n + 1);
  }, [fullCleanup]);

  const connectionState = rtcState === 'connected' ? 'connected'
    : stompState === 'connected' ? 'connecting' : 'disconnected';

  /* ── State screens ── */
  if (phase === 'loading') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="loading-spinner" />
        <h2>Opening live broadcast…</h2>
        <p>Connecting to the candidate's interview session.</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon">⚠️</div>
        <h2>Unable to Connect</h2>
        <p>{loadError}</p>
        <button onClick={() => navigate('/manager/live-broadcasts')} className="btn-primary">
          Back to Live Interviews
        </button>
      </div>
    </div>
  );

  if (phase === 'ended') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon--success state-icon">✓</div>
        <h2>Interview Completed</h2>
        {summary?.candidateName && (
          <p>The live broadcast for <strong>{summary.candidateName}</strong> has ended.</p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          <button onClick={() => navigate('/manager/live-broadcasts')} className="btn-primary">
            Back to Live Interviews
          </button>
          {summary?.interviewSessionId && (
            <button
              onClick={() => navigate(`/manager/interview/${summary.interviewSessionId}/report`)}
              className="btn-primary"
              style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
            >
              View Report
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Main viewer ── */
  return (
    <div className="interview-room interview-room--recruiter" ref={containerRef}>
      <header className="ir-header">
        <div className="ir-header__left">
          <span className="ir-logo">HireX</span>
          <div className="ir-sep" />
          <div className="ir-subject">
            <span className="ir-subject__name">{summary?.candidateName ?? 'Candidate'}</span>
            {summary?.jobTitle && <span className="ir-subject__role">{summary.jobTitle}</span>}
          </div>
        </div>

        <div className="ir-header__center">
          <InterviewTimer
            running={summary?.sessionStatus === 'ACTIVE'}
            startOffset={elapsedSeconds(summary?.interviewStartTime)}
            className="ir-timer"
          />
        </div>

        <div className="ir-header__right">
          <button
            className="ir-hdr-ctrl ir-hdr-ctrl--neutral"
            onClick={() => navigate('/manager/live-broadcasts')}
            title="Back to Live Interviews"
          >
            <span>←</span>
          </button>
          <button
            className="ir-hdr-ctrl ir-hdr-ctrl--neutral"
            onClick={handleReconnect}
            title="Reconnect"
          >
            <span>🔄</span>
          </button>
          <div className="ir-sep" />
          <ConnectionStatus state={connectionState} />
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="ir-alerts">
          {alerts.map((a) => (
            <div key={a.ts} className={`alert-banner alert-banner--${a.type}`}>
              {a.type === 'error' ? '🔴' : a.type === 'info' ? 'ℹ️' : '⚠️'} {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="ir-body">
        <div className="ir-stage" style={{ gridTemplateColumns: '1fr' }}>
          <div className="ir-video-main">
            {remoteStream ? (
              <VideoPlayer stream={remoteStream} className="remote-video" />
            ) : (
              <div className="ir-placeholder">
                <div className="ir-placeholder__avatar">
                  {summary?.candidateName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <p>
                  {stompState !== 'connected'
                    ? 'Connecting to the broadcast server…'
                    : 'Waiting for the candidate\'s video…'}
                </p>
                <div className="ir-dots"><span /><span /><span /></div>
              </div>
            )}

            {remoteStream && !candidateCameraOn && (
              <div className="ir-camera-off-overlay">
                <div className="avatar-ring">
                  {summary?.candidateName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <p>Candidate's camera is off</p>
              </div>
            )}

            {remoteStream && (
              <div className="ir-video-label">
                <span>{summary?.candidateName ?? 'Candidate'}</span>
                <span className="cam-badge">{candidateCameraOn ? '📹' : '📵'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="ir-sidebar">
          <CandidateProgressCard
            summary={summary}
            candidateCameraOn={candidateCameraOn}
            connectionState={connectionState}
          />
        </div>
      </div>
    </div>
  );
}

export default LiveBroadcastViewer;