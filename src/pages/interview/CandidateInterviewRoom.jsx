/**
 * CandidateInterviewRoom.jsx
 *
 * Route: /live-interview/candidate/:sessionToken
 *
 * FIXES:
 *  FIX-CR1: Candidate now waits for sessionStatus === 'ACTIVE' (both parties
 *            joined) before creating and sending the WebRTC offer. Previously
 *            the offer was sent immediately, before the recruiter had subscribed
 *            to /user/queue/offer, so it was lost and the connection never formed.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import liveInterviewApi from '../../services/liveInterviewApi';
import stompService      from '../../services/stompService';
import webrtcService     from '../../services/webrtcService';
import useCamera         from '../../hooks/useCamera';
import useMicrophone     from '../../hooks/useMicrophone';
import useProctoring     from '../../hooks/useProctoring';
import useSEO             from '../../hooks/useSeo';

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

function RecruiterInfoCard({ session, connectionState, recruiterCamOn }) {
  const isConnected = connectionState === 'connected';
  return (
    <div className="ir-info-card">
      <div className="ir-info-card__header">
        <div className="ir-info-card__avatar">
          {session?.recruiterName?.[0]?.toUpperCase() ?? 'R'}
        </div>
        <div className="ir-info-card__title">
          <span className="ir-info-card__name">{session?.recruiterName ?? 'Interviewer'}</span>
          <span className="ir-info-card__badge">Recruiter</span>
        </div>
      </div>

      <div className="ir-info-card__rows">
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">👤</span>
          <div>
            <div className="ir-info-card__label">Designation</div>
            <div className="ir-info-card__value">{session?.recruiterDesignation ?? 'Interviewer'}</div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">🏢</span>
          <div>
            <div className="ir-info-card__label">Company</div>
            <div className="ir-info-card__value">{session?.companyName ?? '—'}</div>
          </div>
        </div>
        <div className="ir-info-card__row">
          <span className="ir-info-card__icon">💼</span>
          <div>
            <div className="ir-info-card__label">Interview Role</div>
            <div className="ir-info-card__value">{session?.jobTitle ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="ir-info-card__divider" />
      <div className="ir-info-card__status-group">
        <div className="ir-info-card__status-row">
          <span className={`ir-dot ${isConnected ? 'ir-dot--green' : 'ir-dot--red'}`} />
          <span className="ir-info-card__status-text">
            Recruiter {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="ir-info-card__status-row">
          <span className={`ir-dot ${recruiterCamOn ? 'ir-dot--green' : 'ir-dot--red'}`} />
          <span className="ir-info-card__status-text">
            Camera {recruiterCamOn ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}

function CandidateInterviewRoom() {
  useSEO({ title: 'Live Interview', description: 'Join your live video interview on HireX.' });
  const { sessionToken } = useParams();
  const navigate = useNavigate();

  const [session,   setSession]   = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase,     setPhase]     = useState('loading');

  const [stompState,     setStompState]     = useState('disconnected');
  const [rtcState,       setRtcState]       = useState('new');
  const [netQuality,     setNetQuality]     = useState('good');
  const [remoteStream,   setRemoteStream]   = useState(null);
  const [recruiterCamOn, setRecruiterCamOn] = useState(true);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [alerts,       setAlerts]       = useState([]);

  const containerRef   = useRef(null);
  const sessionRef     = useRef(null);
  const cleanupFnsRef  = useRef([]);
  // FIX-CR1: track whether the offer has already been sent
  const offerSentRef   = useRef(false);
  // FIX-CR1: hold the media stream so it's available when ACTIVE fires
  const mediaStreamRef = useRef(null);

  const {
    stream, cameraOn, permissionError,
    cameraDisconnected, isStarting,
    startCamera, toggleCamera: rawToggleCamera, stopCamera,
  } = useCamera();

  const { micOn, micDisconnected, toggleMic } = useMicrophone(stream);

  const addAlert = useCallback((message, type = 'warning') => {
    setAlerts(prev => [{ message, type, ts: Date.now() }, ...prev].slice(0, MAX_ALERTS));
  }, []);

  /* ── NEW: AI Interview Monitoring — handle a client-detected violation ──
   * Shows an immediate live warning to the candidate AND reports it to the
   * backend, which persists it in the violation log and broadcasts it to
   * the recruiter's live feed on /topic/violation/{liveSessionId}.
   */
  const handleViolation = useCallback((type, severity, message, metadata) => {
    const alertType = severity === 'CRITICAL' || severity === 'HIGH' ? 'error'
      : severity === 'MEDIUM' ? 'warning'
      : 'info';
    addAlert(message, alertType);

    if (stompService.isConnected && sessionToken) {
      stompService.sendViolation(sessionToken, type, severity, message, JSON.stringify(metadata ?? {}));
    }
  }, [addAlert, sessionToken]);

  // NEW: AI Interview Monitoring — runs entirely against the candidate's own
  // local stream, only while the interview is actually live.
  useProctoring({
    stream,
    enabled: phase === 'live',
    cameraOn,
    micOn,
    onViolation: handleViolation,
  });

  /* ── FIX-CR1: Send the WebRTC offer only once both sides are confirmed ── */
  const sendOffer = useCallback(async () => {
    if (offerSentRef.current) return;
    if (!mediaStreamRef.current) return;
    offerSentRef.current = true;

    try {
      const offer = await webrtcService.createOffer();
      stompService.sendOffer(sessionToken, offer.sdp, 'CANDIDATE');
      console.log('[CandidateRoom] Offer sent after both parties joined.');
    } catch (err) {
      console.error('[CandidateRoom] Failed to create/send offer:', err);
      addAlert('Failed to establish video connection.', 'error');
    }
  }, [sessionToken, addAlert]);

  /* ── 1. Load session metadata ── */
  useEffect(() => {
    if (!sessionToken) {
      setLoadError('No session token provided.');
      setPhase('error');
      return;
    }
    liveInterviewApi.joinByToken(sessionToken)
      .then(({ data }) => {
        setSession(data);
        sessionRef.current = data;
        // Clear stale invite from sessionStorage once we successfully join
        try { sessionStorage.removeItem('hirex_live_invite'); } catch (_) {}
        setPhase(data.sessionStatus === 'ENDED' ? 'ended' : 'ready');
      })
      .catch(err => {
        const msg = err.response?.data?.error || err.response?.data?.message || err.response?.data || '';
        // Backend returns "ENDED: ..." for completed sessions — show the
        // proper "Interview Complete" screen instead of a red error page.
        if (
          err.response?.status === 403 &&
          (typeof msg === 'string' && msg.includes('ENDED'))
        ) {
          try { sessionStorage.removeItem('hirex_live_invite'); } catch (_) {}
          setPhase('ended');
          return;
        }
        // Backend returns "EXPIRED: ..." once the link's token has expired —
        // show the exact message required by the workflow spec.
        if (
          err.response?.status === 403 &&
          (typeof msg === 'string' && msg.includes('EXPIRED'))
        ) {
          setPhase('expired');
          return;
        }
        setLoadError(typeof msg === 'string' ? msg : 'Failed to load interview session.');
        setPhase('error');
      });
  }, [sessionToken]);

  /* ── 2. Signaling + WebRTC ── */
  const initSignaling = useCallback(async (mediaStream) => {
    const token = localStorage.getItem('token');
    if (!token) { setLoadError('Not authenticated.'); setPhase('error'); return; }

    mediaStreamRef.current = mediaStream;

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

    const sess = sessionRef.current;

    // ── Session status — FIX-CR1: send offer when ACTIVE ──────────────────
    const unsubStatus = stompService.subscribe(
      `/topic/session/${sess.liveSessionId}/status`,
      (msg) => {
        if (msg.sessionStatus === 'ACTIVE') {
          // Both parties are now present — safe to send the offer
          setTimerRunning(true);
          sendOffer();
        }
        if (msg.sessionStatus === 'ENDED' || msg.sessionStatus === 'ABANDONED') {
          setPhase('ended');
          setTimerRunning(false);
          cleanup();
        }
      }
    );
    cleanupFnsRef.current.push(unsubStatus);

    // ── Camera status ──────────────────────────────────────────────────────
    const unsubCamera = stompService.subscribe(
      `/topic/camera/${sess.liveSessionId}`,
      (msg) => {
        if (msg.participantRole === 'RECRUITER') {
          setRecruiterCamOn(msg.cameraEnabled);
          if (!msg.cameraEnabled) {
            addAlert('Interviewer turned their camera off.', 'info');
          }
        }
      }
    );
    cleanupFnsRef.current.push(unsubCamera);

    // ── WebRTC setup ───────────────────────────────────────────────────────
    webrtcService.createPeerConnection();

    webrtcService.onConnectionStateChange = (state) => {
      setRtcState(state);
      if (state === 'connected') setNetQuality('good');
      if (state === 'disconnected') {
        setNetQuality('poor');
        addAlert('Video connection interrupted. Reconnecting…', 'error');
      }
      if (state === 'failed') setNetQuality('poor');
    };

    webrtcService.onIceCandidateCallback = (candidate) => {
      stompService.sendIce(
        sessionToken,
        candidate.candidate,
        candidate.sdpMid,
        candidate.sdpMLineIndex,
        'CANDIDATE'
      );
    };

    webrtcService.onTrackCallback = (incomingStream) => {
      setRemoteStream(
        incomingStream instanceof MediaStream
          ? incomingStream
          : new MediaStream([incomingStream])
      );
    };

    webrtcService.addStream(mediaStream);

    // ── Receive answer from recruiter ──────────────────────────────────────
    const unsubAnswer = stompService.subscribe('/user/queue/answer', async (msg) => {
      try {
        if (msg.senderRole === 'RECRUITER') {
          await webrtcService.setRemoteDescription(msg.sdp, 'answer');
        }
      } catch (err) {
        console.error('[CandidateRoom] SDP answer error:', err);
      }
    });
    cleanupFnsRef.current.push(unsubAnswer);

    // ── Receive ICE candidates from recruiter ──────────────────────────────
    const unsubIce = stompService.subscribe('/user/queue/ice', async (msg) => {
      try {
        if (msg.senderRole === 'RECRUITER') {
          await webrtcService.addIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
        }
      } catch (err) {
        console.warn('[CandidateRoom] ICE (benign):', err.message);
      }
    });
    cleanupFnsRef.current.push(unsubIce);

    // ── Announce presence — backend activates session when both have joined ─
    stompService.sendJoin(sessionToken, 'CANDIDATE');

    setPhase('live');

    // ── If session is already ACTIVE (recruiter joined first), send immediately
    if (sess.sessionStatus === 'ACTIVE') {
      await sendOffer();
    }
  }, [sessionToken, addAlert, sendOffer]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // FIX-WR2: use webrtcService.peerConnection (now a getter alias for .pc)
        const sender = webrtcService.peerConnection?.getSenders?.()
          ?.find(s => s.track?.kind === 'video');
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);
      } catch (e) {
        console.warn('[CandidateRoom] replaceTrack:', e);
      }
    }, 300);
  }, [stream, stopCamera, startCamera, handleStartCamera]);

  /* ── Camera toggle → notify recruiter ── */
  const handleToggleCamera = useCallback(() => {
    const newState = rawToggleCamera();
    if (sessionRef.current && stompService.isConnected) {
      stompService.sendCameraStatus(
        sessionToken, 'CANDIDATE', newState,
        newState ? 'user_enabled' : 'user_disabled'
      );
    }
  }, [rawToggleCamera, sessionToken]);

  /* ── Camera disconnect warning ── */
  useEffect(() => {
    if (cameraDisconnected) {
      addAlert('Your camera disconnected.', 'warning');
      if (stompService.isConnected) {
        stompService.sendCameraStatus(sessionToken, 'CANDIDATE', false, 'disconnected');
      }
    }
  }, [cameraDisconnected, sessionToken, addAlert]);

  /* ── Mic disconnect warning ── */
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
    offerSentRef.current  = false;
    mediaStreamRef.current = null;
  }, [stopCamera]);

  const handleLeave = useCallback(() => {
    cleanup();
    navigate('/');
  }, [cleanup, navigate]);

  useEffect(() => () => cleanup(), [cleanup]);

  /* ── Derived states ── */
  const connectionState = rtcState === 'connected'    ? 'connected'
    : stompState === 'connected'  ? 'connecting'
    : stompState === 'connecting' ? 'connecting'
    : 'disconnected';

  /* ── State screens ── */
  if (phase === 'loading') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="loading-spinner" />
        <h2>Joining interview session…</h2>
        <p>Getting everything ready for your interview.</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon">⚠️</div>
        <h2>Unable to Join</h2>
        <p>{loadError}</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go Home</button>
      </div>
    </div>
  );

  if (phase === 'expired') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon">⏳</div>
        <h2>Link Expired</h2>
        <p>This interview session has expired.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go Home</button>
      </div>
    </div>
  );

  if (phase === 'ended') return (
    <div className="ir-state-screen">
      <div className="ir-state-card">
        <div className="state-icon--success state-icon">✓</div>
        <h2>Interview Complete</h2>
        <p>This session has ended. Thank you for your time — results will be shared soon.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Return Home</button>
      </div>
    </div>
  );

  /* ── Main interview room ── */
  return (
    <div className="interview-room interview-room--candidate" ref={containerRef}>

      <header className="ir-header">
        <div className="ir-header__left">
          <span className="ir-logo">HireX</span>
          <div className="ir-sep" />
          <div className="ir-subject">
            <span className="ir-subject__name">AI Interview</span>
            {session?.jobTitle && (
              <span className="ir-subject__role">{session.jobTitle}</span>
            )}
          </div>
        </div>

        <div className="ir-header__center">
          <InterviewTimer running={timerRunning} className="ir-timer" />
        </div>

        <div className="ir-header__right">
          <button
            className={`ir-hdr-ctrl ${cameraOn ? 'ir-hdr-ctrl--on' : 'ir-hdr-ctrl--off'}`}
            onClick={stream ? handleToggleCamera : handleStartCamera}
            title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={cameraOn}
          >
            <span>{cameraOn ? '🎥' : '🚫'}</span>
          </button>

          <button
            className={`ir-hdr-ctrl ${micOn ? 'ir-hdr-ctrl--on' : 'ir-hdr-ctrl--off'}`}
            onClick={toggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={micOn}
          >
            <span>{micOn ? '🎤' : '🔇'}</span>
          </button>

          <button
            className="ir-hdr-ctrl ir-hdr-ctrl--neutral"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <span>{isFullscreen ? '⤓' : '⛶'}</span>
          </button>

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

      {alerts.length > 0 && (
        <div className="ir-alerts">
          {alerts.map(a => (
            <div key={a.ts} className={`alert-banner alert-banner--${a.type}`}>
              {a.type === 'error' ? '🔴' : a.type === 'info' ? 'ℹ️' : '⚠️'} {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="ir-body">
        <div className="ir-stage">
          <div className="ir-video-main">
            {remoteStream ? (
              <VideoPlayer stream={remoteStream} className="remote-video" />
            ) : (
              <div className="ir-placeholder">
                <div className="ir-placeholder__avatar">🎙️</div>
                <p>
                  {phase === 'ready'
                    ? 'Start your camera to connect with your interviewer.'
                    : stompState === 'connected'
                    ? 'Waiting for the interviewer to join…'
                    : 'Connecting to interview server…'}
                </p>
                {phase === 'live' && (
                  <div className="ir-dots"><span /><span /><span /></div>
                )}
              </div>
            )}

            {remoteStream && !recruiterCamOn && (
              <div className="ir-camera-off-overlay">
                <div className="avatar-ring">🎙️</div>
                <p>Interviewer camera turned off</p>
              </div>
            )}

            {remoteStream && (
              <div className="ir-video-label">
                <span>{session?.recruiterName ?? 'Interviewer'}</span>
                <span className="cam-badge">{recruiterCamOn ? '📹' : '📵'}</span>
              </div>
            )}
          </div>

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

        <div className="ir-sidebar">
          <RecruiterInfoCard
            session={session}
            connectionState={connectionState}
            recruiterCamOn={recruiterCamOn}
          />
          <div className="ir-sidebar-status">
            <h4 className="ir-sidebar-status__title">Connection Status</h4>
            <div className="ir-sidebar-status__item">
              <span className={`ir-dot ${cameraOn ? 'ir-dot--green' : 'ir-dot--red'}`} />
              <span>Camera {cameraOn ? 'ON' : 'OFF'}</span>
            </div>
            <div className="ir-sidebar-status__item">
              <span className={`ir-dot ${connectionState === 'connected' ? 'ir-dot--green' : 'ir-dot--amber'}`} />
              <span>Recruiter {connectionState === 'connected' ? 'Connected' : 'Connecting…'}</span>
            </div>
            <div className="ir-sidebar-status__item">
              <span className="ir-dot ir-dot--green" />
              <span>Candidate Connected</span>
            </div>
          </div>
        </div>
      </div>

      {phase === 'ready' && !stream && (
        <div className="ir-start-overlay">
          <div className="ir-start-card">
            <div className="ir-start-card__icon">📹</div>
            <h3>Ready to start your interview?</h3>
            <p>
              {session?.recruiterName
                ? `${session.recruiterName} is waiting for you.`
                : 'Your interviewer is ready. Allow camera and microphone access to join.'}
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

      <div className="ir-controls">
        <button
          className={`ctrl-btn ${micOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
          onClick={toggleMic}
          aria-pressed={micOn}
        >
          <span className="ctrl-icon">{micOn ? '🎤' : '🔇'}</span>
          <span className="ctrl-label">{micOn ? 'Mic On' : 'Muted'}</span>
        </button>

        <button
          className={`ctrl-btn ${cameraOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
          onClick={stream ? handleToggleCamera : handleStartCamera}
          aria-pressed={cameraOn}
        >
          <span className="ctrl-icon">{cameraOn ? '🎥' : '🚫'}</span>
          <span className="ctrl-label">{cameraOn ? 'Camera' : 'Camera Off'}</span>
        </button>

        <button
          className="ctrl-btn ctrl-btn--neutral"
          onClick={handleToggleFullscreen}
          aria-pressed={isFullscreen}
        >
          <span className="ctrl-icon">{isFullscreen ? '⤓' : '⛶'}</span>
          <span className="ctrl-label">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
        </button>

        <button className="ctrl-btn ctrl-btn--neutral" onClick={handleRefreshCamera}>
          <span className="ctrl-icon">🔄</span>
          <span className="ctrl-label">Refresh</span>
        </button>

        <div className="ctrl-divider" />

        <button className="ctrl-btn ctrl-btn--danger" onClick={handleLeave}>
          <span className="ctrl-icon">❌</span>
          <span className="ctrl-label">Leave</span>
        </button>
      </div>
    </div>
  );
}

export default CandidateInterviewRoom;