/**
 * RecruiterInterviewRoom.jsx
 *
 * Route: /interview/recruiter/:sessionToken
 *
 * Layout (Google Meet / Zoom style):
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  HireX | Interviewing: <Name>          Timer    🎥 🎤 ⛶ ⚙  Conn│  ← ir-header
 *   ├────────────────────────────────────────────────────────────────────┤
 *   │                                                │                   │
 *   │    CANDIDATE live video (main)                 │  Candidate Info   │
 *   │                                                │  Card             │
 *   │                                 ┌──────────┐   │  ─────────────    │
 *   │                                 │ You (PiP)│   │  Timer / Status   │
 *   │                                 └──────────┘   │                   │
 *   ├────────────────────────────────────────────────────────────────────┤
 *   │  🎤 Mic  📷 Camera  ⛶ Full  🔄 Refresh  |  ❌ End Interview     │  ← ir-controls
 *   └────────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import liveInterviewApi from '../../services/liveInterviewApi';
import stompService      from '../../services/stompService';
import webrtcService     from '../../services/webrtcService';
import useCamera         from '../../hooks/useCamera';
import useMicrophone     from '../../hooks/useMicrophone';

import VideoPlayer      from '../../components/VideoPlayer';
import ConnectionStatus from '../../components/ConnectionStatus';
import InterviewTimer   from '../../components/InterviewTimer';

import './interviewRoom.css';

const MAX_ALERTS = 4;

function NetworkIndicator({ quality = 'good' }) {
  return (
    <div className={`ir-network ir-network--${quality}`} title={`Network: ${quality}`}>
      <div className="ir-network__bar" />
      <div className="ir-network__bar" />
      <div className="ir-network__bar" />
    </div>
  );
}

/** Candidate Information Card shown in the right sidebar */
function CandidateInfoCard({
  session,
  connectionState,
  candidateCameraOn,
  micOn: candidateMicOn,
  timerRunning,
}) {
  const isConnected = connectionState === 'connected';
  return (
    <div className="ir-info-card">
      {/* Card header */}
      <div className="ir-info-card__header">
        <div className="ir-info-card__avatar">
          {session?.candidateName?.[0]?.toUpperCase() ?? 'C'}
        </div>
        <div className="ir-info-card__title">
          <span className="ir-info-card__name">{session?.candidateName ?? 'Candidate'}</span>
          <span className="ir-info-card__badge">Applicant</span>
        </div>
      </div>

      {/* Info rows */}
      <div className="ir-info-card__rows">
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">💼</span>
          <div>
            <div className="ir-info-card__label">Applied Job</div>
            <div className="ir-info-card__value">{session?.jobTitle ?? '—'}</div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">📋</span>
          <div>
            <div className="ir-info-card__label">Interview Status</div>
            <div className={`ir-info-card__value ir-info-card__value--status ${isConnected ? 'ir-val--active' : 'ir-val--waiting'}`}>
              {isConnected ? 'Active' : 'Waiting'}
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
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">{candidateMicOn ? '🎤' : '🔇'}</span>
          <div>
            <div className="ir-info-card__label">Microphone</div>
            <div className={`ir-info-card__value ${candidateMicOn ? 'ir-val--on' : 'ir-val--off'}`}>
              {candidateMicOn ? 'Active' : 'Muted'}
            </div>
          </div>
        </div>
      </div>

      {/* Interview timer */}
      <div className="ir-info-card__divider" />
      <div className="ir-info-card__timer-section">
        <span className="ir-info-card__label">Interview Duration</span>
        <InterviewTimer running={timerRunning} className="ir-info-card__timer" />
      </div>

      {/* Status section */}
      <div className="ir-info-card__divider" />
      <div className="ir-info-card__status-group">
        <div className="ir-info-card__status-row">
          <span className={`ir-dot ${isConnected ? 'ir-dot--green' : 'ir-dot--amber'}`} />
          <span className="ir-info-card__status-text">
            Candidate {isConnected ? 'Connected' : 'Connecting…'}
          </span>
        </div>
        <div className="ir-info-card__status-row">
          <span className={`ir-dot ${candidateCameraOn ? 'ir-dot--green' : 'ir-dot--red'}`} />
          <span className="ir-info-card__status-text">
            Camera {candidateCameraOn ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecruiterInterviewRoom() {
  const { sessionToken } = useParams();
  const navigate = useNavigate();

  /* ── Session ── */
  const [session,   setSession]   = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase,     setPhase]     = useState('loading');

  /* ── Remote camera state ── */
  const [candidateCameraOn, setCandidateCameraOn] = useState(true);
  const [remoteStream,      setRemoteStream]       = useState(null);

  /* ── Connection quality ── */
  const [stompState,  setStompState]  = useState('disconnected');
  const [rtcState,    setRtcState]    = useState('new');
  const [netQuality,  setNetQuality]  = useState('good');

  /* ── UI ── */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [alerts,       setAlerts]       = useState([]);

  const containerRef  = useRef(null);
  const sessionRef    = useRef(null);
  const cleanupFnsRef = useRef([]);

  /* ── Recruiter camera & mic ── */
  const {
    stream, cameraOn, permissionError,
    cameraDisconnected, isStarting,
    startCamera, toggleCamera: rawToggleCamera, stopCamera,
  } = useCamera();

  const { micOn, micDisconnected, toggleMic } = useMicrophone(stream);

  /* ── Alert helper ── */
  const addAlert = useCallback((message, type = 'warning') => {
    setAlerts(prev => [{ message, type, ts: Date.now() }, ...prev].slice(0, MAX_ALERTS));
  }, []);

  /* ── 1. Load session ── */
  useEffect(() => {
    if (!sessionToken) { setLoadError('No session token provided.'); setPhase('error'); return; }
    liveInterviewApi.joinByToken(sessionToken)
      .then(({ data }) => {
        setSession(data);
        sessionRef.current = data;
        setPhase(data.sessionStatus === 'ENDED' ? 'ended' : 'ready');
      })
      .catch(err => {
        const msg = err.response?.data?.error || err.userMessage || '';
        if (err.response?.status === 403 && typeof msg === 'string' && msg.includes('ENDED')) {
          setPhase('ended');
          return;
        }
        if (err.response?.status === 403 && typeof msg === 'string' && msg.includes('EXPIRED')) {
          setPhase('expired');
          return;
        }
        setLoadError(msg || 'Failed to load interview session.');
        setPhase('error');
      });
  }, [sessionToken]);

  /* ── 2. Signaling + WebRTC init ── */
  const initSignaling = useCallback(async (mediaStream) => {
    const token = localStorage.getItem('token');
    if (!token) { setLoadError('Not authenticated.'); setPhase('error'); return; }

    setStompState('connecting');
    try {
      await stompService.connect(token);
      setStompState('connected');
    } catch {
      setStompState('disconnected');
      setLoadError('Could not connect to the interview server.');
      setPhase('error');
      return;
    }

    const sess   = sessionRef.current;
    const sessId = sess.liveSessionId;

    const unsubStatus = stompService.subscribe(
      `/topic/session/${sessId}/status`,
      (msg) => {
        if (msg.sessionStatus === 'ENDED' || msg.sessionStatus === 'ABANDONED') {
          setPhase('ended');
          setTimerRunning(false);
          cleanup();
        } else if (msg.sessionStatus === 'ACTIVE') {
          setTimerRunning(true);
          setPhase('live');
        }
      }
    );
    cleanupFnsRef.current.push(unsubStatus);

    const unsubCamera = stompService.subscribe(
      `/topic/camera/${sessId}`,
      (msg) => {
        if (msg.role === 'CANDIDATE' || !msg.role) {
          setCandidateCameraOn(msg.cameraEnabled);
          if (!msg.cameraEnabled) {
            const reasons = {
              user_disabled:    'Candidate turned their camera off.',
              disconnected:     'Candidate camera disconnected.',
              permission_denied:'Candidate camera permission denied.',
            };
            addAlert(reasons[msg.reason] ?? 'Candidate camera turned off.', 'warning');
          }
        }
      }
    );
    cleanupFnsRef.current.push(unsubCamera);

    webrtcService.createPeerConnection();

    webrtcService.onConnectionStateChange = (state) => {
      setRtcState(state);
      if (state === 'connected')    setNetQuality('good');
      if (state === 'disconnected') { setNetQuality('poor'); addAlert('Video connection lost. Attempting reconnect…', 'error'); }
      if (state === 'failed')       setNetQuality('poor');
    };

    webrtcService.onIceCandidateCallback = (candidate) => {
      stompService.sendIce(sessionToken, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex, 'RECRUITER');
    };

    webrtcService.onTrackCallback = (incomingStream) => {
      setRemoteStream(incomingStream instanceof MediaStream ? incomingStream : new MediaStream([incomingStream]));
    };

    if (mediaStream) {
      webrtcService.addStream(mediaStream);
    }

    const unsubOffer = stompService.subscribe('/user/queue/offer', async (msg) => {
      try {
        if (msg.senderRole === 'CANDIDATE') {
          await webrtcService.setRemoteDescription(msg.sdp, 'offer');
          const answer = await webrtcService.createAnswer();
          stompService.sendAnswer(sessionToken, answer.sdp, 'RECRUITER');
        }
      } catch (err) {
        console.error('[RecruiterRoom] SDP offer error:', err);
        addAlert('Error establishing video connection.', 'error');
      }
    });
    cleanupFnsRef.current.push(unsubOffer);

    const unsubIce = stompService.subscribe('/user/queue/ice', async (msg) => {
      try {
        if (msg.senderRole === 'CANDIDATE') {
          await webrtcService.addIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
        }
      } catch (err) {
        console.warn('[RecruiterRoom] ICE (benign):', err.message);
      }
    });
    cleanupFnsRef.current.push(unsubIce);

    stompService.sendJoin(sessionToken, 'RECRUITER');
    setPhase('live');
    setTimerRunning(true);
  }, [sessionToken, addAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 3. Start camera ── */
  const handleStartCamera = useCallback(async () => {
    const mediaStream = await startCamera({ video: true, audio: true });
    if (!mediaStream) return;
    await initSignaling(mediaStream);
  }, [startCamera, initSignaling]);

  /* ── Refresh camera ── */
  const handleRefreshCamera = useCallback(async () => {
    if (!stream) { handleStartCamera(); return; }
    stopCamera();
    setTimeout(async () => {
      const mediaStream = await startCamera({ video: true, audio: true });
      if (!mediaStream) return;
      try {
        const [videoTrack] = mediaStream.getVideoTracks();
        const sender = webrtcService.peerConnection?.getSenders?.()
          ?.find(s => s.track?.kind === 'video');
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);
      } catch (e) {
        console.warn('[RecruiterRoom] replaceTrack:', e);
      }
    }, 300);
  }, [stream, stopCamera, startCamera, handleStartCamera]);

  /* ── Camera toggle → notify candidate ── */
  const handleToggleCamera = useCallback(() => {
    const newState = rawToggleCamera();
    if (sessionRef.current && stompService.isConnected) {
      stompService.sendCameraStatus(sessionToken, 'RECRUITER', newState, newState ? 'user_enabled' : 'user_disabled');
    }
  }, [rawToggleCamera, sessionToken]);

  /* ── Camera disconnect notice ── */
  useEffect(() => {
    if (cameraDisconnected && stompService.isConnected) {
      stompService.sendCameraStatus(sessionToken, 'RECRUITER', false, 'disconnected');
      addAlert('Your camera disconnected.', 'warning');
    }
  }, [cameraDisconnected, sessionToken, addAlert]);

  /* ── Mic disconnect notice ── */
  useEffect(() => {
    if (micDisconnected) addAlert('Microphone disconnected.', 'warning');
  }, [micDisconnected, addAlert]);

  /* ── Fullscreen ── */
  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  /* ── Cleanup ── */
  const cleanup = useCallback(() => {
    cleanupFnsRef.current.forEach(fn => fn());
    cleanupFnsRef.current = [];
    webrtcService.closeConnection?.();
    stompService.disconnect?.();
    stopCamera();
    setTimerRunning(false);
  }, [stopCamera]);

  const handleEndInterview = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await liveInterviewApi.endSession(sessionRef.current.liveSessionId, sessionToken, '');
    } catch (err) {
      addAlert('Could not end session on server: ' + (err.userMessage || err.message), 'error');
    }
    setPhase('ended');
    cleanup();
  }, [sessionToken, cleanup, addAlert]);

  useEffect(() => () => cleanup(), [cleanup]);

  /* ── Derived states ── */
  const connectionState = rtcState === 'connected' ? 'connected'
    : stompState === 'connected' ? 'connecting' : 'disconnected';

  /* ══════════════════════════════════════════════════════════════
     State screens
     ══════════════════════════════════════════════════════════════ */
  if (phase === 'loading') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="loading-spinner" />
        <h2>Setting up interview room…</h2>
        <p>Loading session details for recruiter panel.</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon">⚠️</div>
        <h2>Unable to Join</h2>
        <p>{loadError}</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go Back</button>
      </div>
    </div>
  );

  if (phase === 'expired') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon">⏳</div>
        <h2>Link Expired</h2>
        <p>This interview session has expired.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go Back</button>
      </div>
    </div>
  );

  if (phase === 'ended') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon--success state-icon">✓</div>
        <h2>Interview Ended</h2>
        {session?.candidateName && (
          <p>Session with <strong>{session.candidateName}</strong> has concluded.</p>
        )}
        <button onClick={() => navigate('/')} className="btn-primary">Back to Dashboard</button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     Main interview room
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="interview-room interview-room--recruiter" ref={containerRef}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="ir-header">
        <div className="ir-header__left">
          <span className="ir-logo">HireX</span>
          <div className="ir-sep" />
          <div className="ir-subject">
            <span className="ir-subject__name">
              {session?.candidateName ?? 'Candidate'}
            </span>
            {session?.jobTitle && (
              <span className="ir-subject__role">{session.jobTitle}</span>
            )}
          </div>
        </div>

        <div className="ir-header__center">
          <InterviewTimer running={timerRunning} className="ir-timer" />
        </div>

        {/* Header controls: camera + mic + fullscreen + settings + status */}
        <div className="ir-header__right">
          {/* Camera control in header */}
          <button
            className={`ir-hdr-ctrl ${cameraOn ? 'ir-hdr-ctrl--on' : 'ir-hdr-ctrl--off'}`}
            onClick={stream ? handleToggleCamera : handleStartCamera}
            title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={cameraOn}
          >
            <span>{cameraOn ? '🎥' : '🚫'}</span>
          </button>

          {/* Mic control in header */}
          <button
            className={`ir-hdr-ctrl ${micOn ? 'ir-hdr-ctrl--on' : 'ir-hdr-ctrl--off'}`}
            onClick={toggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={micOn}
          >
            <span>{micOn ? '🎤' : '🔇'}</span>
          </button>

          {/* Fullscreen in header */}
          <button
            className="ir-hdr-ctrl ir-hdr-ctrl--neutral"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <span>{isFullscreen ? '⤓' : '⛶'}</span>
          </button>

          {/* Settings */}
          <button
            className="ir-hdr-ctrl ir-hdr-ctrl--neutral"
            title="Settings"
            onClick={() => addAlert('Settings panel coming soon.', 'info')}
          >
            <span>⚙</span>
          </button>

          <div className="ir-sep" />
          <NetworkIndicator quality={netQuality} />
          <ConnectionStatus state={connectionState} />
        </div>
      </header>

      {/* ── Alerts ──────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="ir-alerts">
          {alerts.map(a => (
            <div key={a.ts} className={`alert-banner alert-banner--${a.type}`}>
              {a.type === 'error' ? '🔴' : '⚠️'} {a.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Main body: video stage + candidate info panel ────────── */}
      <div className="ir-body">

        {/* ── Video stage ─────────────────────────────────────────── */}
        <div className="ir-stage">

          {/* Main video: candidate's stream */}
          <div className="ir-video-main">
            {remoteStream ? (
              <VideoPlayer
                stream={remoteStream}
                className="remote-video"
              />
            ) : (
              <div className="ir-placeholder">
                <div className="ir-placeholder__avatar">
                  {session?.candidateName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <p>
                  {phase === 'ready'
                    ? 'Start your camera to connect…'
                    : stompState === 'connected'
                    ? 'Waiting for candidate to join…'
                    : 'Connecting to interview server…'}
                </p>
                {phase === 'live' && (
                  <div className="ir-dots">
                    <span /><span /><span />
                  </div>
                )}
              </div>
            )}

            {/* Candidate camera-off overlay */}
            {remoteStream && !candidateCameraOn && (
              <div className="ir-camera-off-overlay">
                <div className="avatar-ring">
                  {session?.candidateName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <p>Camera turned off</p>
              </div>
            )}

            {/* Candidate name label */}
            {remoteStream && (
              <div className="ir-video-label">
                <span>{session?.candidateName ?? 'Candidate'}</span>
                <span className="cam-badge">{candidateCameraOn ? '📹' : '📵'}</span>
              </div>
            )}
          </div>

          {/* PiP: recruiter self-view */}
          <div className={`ir-pip ${!cameraOn ? 'ir-pip--camera-off' : ''}`}>
            {stream && cameraOn ? (
              <VideoPlayer stream={stream} muted mirror />
            ) : (
              <div className="ir-placeholder" style={{ height: '100%' }}>
                <span style={{ fontSize: '1.4rem' }}>
                  {isStarting ? '⏳' : permissionError ? '🚫' : '📷'}
                </span>
              </div>
            )}
            <div className="ir-pip__label">You</div>
          </div>
        </div>

        {/* ── Candidate info sidebar ─────────────────────────────── */}
        <div className="ir-sidebar">
          <CandidateInfoCard
            session={session}
            connectionState={connectionState}
            candidateCameraOn={candidateCameraOn}
            micOn={micOn}
            timerRunning={timerRunning}
          />

          {/* Live connection status indicators */}
          <div className="ir-sidebar-status">
            <h4 className="ir-sidebar-status__title">Connection Status</h4>
            <div className="ir-sidebar-status__item">
              <span className={`ir-dot ${cameraOn ? 'ir-dot--green' : 'ir-dot--red'}`} />
              <span>My Camera {cameraOn ? 'ON' : 'OFF'}</span>
            </div>
            <div className="ir-sidebar-status__item">
              <span className="ir-dot ir-dot--green" />
              <span>Recruiter Connected</span>
            </div>
            <div className="ir-sidebar-status__item">
              <span className={`ir-dot ${connectionState === 'connected' ? 'ir-dot--green' : 'ir-dot--amber'}`} />
              <span>Candidate {connectionState === 'connected' ? 'Connected' : 'Connecting…'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Start camera prompt ──────────────────────────────────── */}
      {phase === 'ready' && !stream && (
        <div className="ir-start-overlay">
          <div className="ir-start-card">
            <div className="ir-start-card__icon">📹</div>
            <h3>Ready to start the interview?</h3>
            <p>
              {session?.candidateName
                ? `${session.candidateName} may already be waiting.`
                : 'Start your camera to begin the live session.'}
            </p>
            {permissionError && (
              <div className="permission-error">{permissionError}</div>
            )}
            <button
              className="btn-start-camera"
              onClick={handleStartCamera}
              disabled={isStarting}
            >
              {isStarting ? '⏳ Starting…' : '📹 Start Camera & Join'}
            </button>
          </div>
        </div>
      )}

      {/* ── Control bar ─────────────────────────────────────────── */}
      <div className="ir-controls">
        {/* Mic */}
        <button
          className={`ctrl-btn ${micOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
          onClick={toggleMic}
          title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={micOn}
        >
          <span className="ctrl-icon">{micOn ? '🎤' : '🔇'}</span>
          <span className="ctrl-label">{micOn ? 'Mic On' : 'Muted'}</span>
        </button>

        {/* Camera */}
        <button
          className={`ctrl-btn ${cameraOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
          onClick={stream ? handleToggleCamera : handleStartCamera}
          title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
          aria-pressed={cameraOn}
        >
          <span className="ctrl-icon">{cameraOn ? '🎥' : '🚫'}</span>
          <span className="ctrl-label">{cameraOn ? 'Camera' : 'Camera Off'}</span>
        </button>

        {/* Fullscreen */}
        <button
          className="ctrl-btn ctrl-btn--neutral"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isFullscreen}
        >
          <span className="ctrl-icon">{isFullscreen ? '⤓' : '⛶'}</span>
          <span className="ctrl-label">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
        </button>

        {/* Refresh camera */}
        <button
          className="ctrl-btn ctrl-btn--neutral"
          onClick={handleRefreshCamera}
          title="Refresh camera"
        >
          <span className="ctrl-icon">🔄</span>
          <span className="ctrl-label">Refresh</span>
        </button>

        <div className="ctrl-divider" />

        {/* End interview */}
        <button
          className="ctrl-btn ctrl-btn--danger"
          onClick={handleEndInterview}
          title="End interview"
        >
          <span className="ctrl-icon">❌</span>
          <span className="ctrl-label">End Interview</span>
        </button>
      </div>
    </div>
  );
}

export default RecruiterInterviewRoom;
