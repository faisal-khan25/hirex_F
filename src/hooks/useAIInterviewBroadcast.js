/**
 * useAIInterviewBroadcast.js
 *
 * Candidate-side hook: automatically broadcasts the candidate's webcam to
 * the recruiter for the duration of the AI interview.
 *
 * PRODUCTION FIX (critical): this file used to be empty while
 * `AIInterview .jsx` imported `useAIInterviewBroadcast` from this exact path
 * — every render of the AI interview page threw
 * "useAIInterviewBroadcast is not a function" and crashed the candidate's
 * interview screen. The working implementation now lives here (the hooks/
 * folder is the correct home for a hook); `services/useAIInterviewBroadcast.js`
 * re-exports this module for backward compatibility.
 *
 * The backend already auto-creates/starts the broadcast session the moment
 * the candidate calls POST /api/interview/{sessionId}/start (see
 * AIInterviewController -> liveInterviewService.startBroadcastForAIInterview)
 * and auto-ends it on /complete. This hook only has to:
 *   1. Discover the broadcast's sessionToken (GET /candidate/{applicationId}).
 *   2. Grab the candidate's camera/mic.
 *   3. Open a STOMP + WebRTC connection and act as the CANDIDATE (offerer),
 *      exactly like CandidateInterviewRoom.jsx does for the manual flow —
 *      same signaling contract, same backend, same unicast queues.
 *
 * The candidate never sees a "room" UI for this — it's a silent background
 * broadcast. Callers can render a small non-intrusive status badge using
 * the returned `status`.
 *
 * status values: 'idle' | 'connecting' | 'waiting' | 'live' | 'reconnecting'
 *                | 'ended' | 'error'
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import liveInterviewApi from '../services/liveInterviewApi';
import stompService from '../services/stompService';
import webrtcService, { configureIceServers } from '../services/webrtcService';

const TOKEN_POLL_ATTEMPTS = 6;
const TOKEN_POLL_DELAY_MS = 1200;

// Production hardening: cap consecutive ICE restarts so a persistently
// broken network path can't spin the offer/restart loop forever and flood
// the signaling channel — after this many attempts we surface a real error
// instead of silently retrying forever.
const MAX_ICE_RESTART_ATTEMPTS = 5;

/** Turns getUserMedia rejection reasons into copy a candidate can act on. */
function describeMediaError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera/microphone access was blocked. Please allow camera and microphone permissions and refresh.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera or microphone was found on this device.';
    case 'NotReadableError':
      return 'Your camera or microphone is already in use by another application.';
    default:
      return 'Camera/microphone access is required so the recruiter can watch your interview live.';
  }
}

export function useAIInterviewBroadcast({ applicationId, active }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Mutable state that doesn't need to trigger re-renders.
  const ref = useRef({
    started: false,
    cancelled: false,
    sessionToken: null,
    liveSessionId: null,
    mediaStream: null,
    offerSent: false,
    everActive: false,
    iceRestartAttempts: 0,
    cleanupFns: [],
  });

  const teardownSignaling = useCallback(() => {
    const r = ref.current;
    r.cleanupFns.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
    r.cleanupFns = [];
    webrtcService.closeConnection();
  }, []);

  const stop = useCallback(() => {
    const r = ref.current;
    r.cancelled = true;
    teardownSignaling();
    if (r.mediaStream) {
      r.mediaStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* ignore */ } });
      r.mediaStream = null;
    }
    stompService.disconnect();
    r.offerSent = false;
    r.started = false;
    setStatus('ended');
  }, [teardownSignaling]);

  useEffect(() => {
    if (!active || !applicationId) return undefined;
    const r = ref.current;
    if (r.started) return undefined;
    r.started = true;
    r.cancelled = false;

    const wireSignaling = ({ isReconnect } = {}) => {
      teardownSignaling();
      webrtcService.createPeerConnection();
      webrtcService.addStream(r.mediaStream);

      webrtcService.onConnectionStateChange = (state) => {
        if (r.cancelled) return;
        if (state === 'connected') {
          setStatus('live');
          r.everActive = true;
          r.iceRestartAttempts = 0; // reset once a healthy connection is confirmed
        } else if (state === 'disconnected' || state === 'failed') {
          setStatus('reconnecting');
          // Try an ICE restart first — this recovers most transient network
          // blips (Wi-Fi handoff, brief packet loss) WITHOUT ever touching
          // the STOMP/session layer, which is important here: a real STOMP
          // disconnect on the candidate side marks the broadcast ABANDONED
          // server-side and it can't be reactivated. Restarting ICE keeps
          // the same signaling session alive.
          if (r.iceRestartAttempts < MAX_ICE_RESTART_ATTEMPTS) {
            r.iceRestartAttempts += 1;
            restartIce();
          } else {
            setStatus('error');
            setError('Lost the live video connection to the recruiter. Your interview is unaffected.');
          }
        }
      };

      webrtcService.onIceCandidateCallback = (candidate) => {
        stompService.sendIce(
          r.sessionToken, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex, 'CANDIDATE'
        );
      };

      const unsubStatus = stompService.subscribe(
        `/topic/session/${r.liveSessionId}/status`,
        (msg) => {
          if (r.cancelled) return;
          if (msg.sessionStatus === 'ACTIVE') {
            sendOffer();
          } else if (msg.sessionStatus === 'ENDED') {
            setStatus('ended');
            stop();
          }
          // ABANDONED is intentionally not treated as fatal here — the
          // candidate side keeps broadcasting; if the recruiter reconnects
          // the offer/answer/ICE relay still works regardless of status.
        }
      );

      const unsubAnswer = stompService.subscribe('/user/queue/answer', async (msg) => {
        if (r.cancelled) return;
        if (msg.senderRole === 'RECRUITER') {
          try {
            await webrtcService.setRemoteDescription(msg.sdp, 'answer');
          } catch (err) {
            console.error('[AIBroadcast] setRemoteDescription(answer) failed:', err);
          }
        }
      });

      const unsubIce = stompService.subscribe('/user/queue/ice', async (msg) => {
        if (r.cancelled) return;
        if (msg.senderRole === 'RECRUITER') {
          await webrtcService.addIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
        }
      });

      r.cleanupFns.push(unsubStatus, unsubAnswer, unsubIce);

      stompService.sendJoin(r.sessionToken, 'CANDIDATE');

      if (isReconnect && r.everActive) {
        // We've already been through a full handshake once; the backend
        // won't necessarily re-broadcast an ACTIVE transition, so proactively
        // renegotiate instead of waiting for one.
        sendOffer(true);
      } else {
        setStatus('waiting'); // waiting for the recruiter to open the viewer
      }
    };

    const sendOffer = async (forceNew = false) => {
      if (r.offerSent && !forceNew) return;
      r.offerSent = true;
      try {
        const offer = await webrtcService.createOffer();
        stompService.sendOffer(r.sessionToken, offer.sdp, 'CANDIDATE');
      } catch (err) {
        console.error('[AIBroadcast] Failed to create/send offer:', err);
      }
    };

    const restartIce = async () => {
      try {
        if (!webrtcService.peerConnection) return;
        const offer = await webrtcService.peerConnection.createOffer({ iceRestart: true });
        await webrtcService.peerConnection.setLocalDescription(offer);
        stompService.sendOffer(r.sessionToken, offer.sdp, 'CANDIDATE');
      } catch (err) {
        console.warn('[AIBroadcast] ICE restart failed:', err.message);
      }
    };

    /** Try to get camera+mic; gracefully fall back to audio-only if no camera exists. */
    const acquireMedia = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          // No camera available — try audio-only so the broadcast still
          // conveys *something* rather than failing outright.
          return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        }
        throw err;
      }
    };

    const start = async () => {
      setStatus('connecting');
      setError(null);

      // 1. Poll briefly for the broadcast token (created synchronously by
      //    /start, but poll defensively in case of a race/replica lag).
      let token = null;
      for (let i = 0; i < TOKEN_POLL_ATTEMPTS && !r.cancelled; i++) {
        try {
          const { data } = await liveInterviewApi.getForCandidate(applicationId);
          if (data && data.sessionToken) { token = data.sessionToken; break; }
        } catch (_) { /* not ready yet — retry */ }
        if (i < TOKEN_POLL_ATTEMPTS - 1) {
          await new Promise((res) => setTimeout(res, TOKEN_POLL_DELAY_MS));
        }
      }
      if (r.cancelled) return;
      if (!token) {
        console.warn('[AIBroadcast] No broadcast session available — continuing without live view.');
        setStatus('idle');
        return;
      }

      let sessionMeta;
      try {
        const { data } = await liveInterviewApi.joinByToken(token);
        sessionMeta = data;
      } catch (err) {
        setStatus('error');
        setError('Could not open the live broadcast session.');
        return;
      }
      if (r.cancelled) return;
      if (sessionMeta.sessionStatus === 'ENDED') {
        setStatus('ended');
        return;
      }
      r.sessionToken = token;
      r.liveSessionId = sessionMeta.liveSessionId;

      try {
        const { data: servers } = await liveInterviewApi.getIceServers();
        configureIceServers(servers);
      } catch (_) { /* fall back to defaults already configured in webrtcService */ }

      let mediaStream;
      try {
        mediaStream = await acquireMedia();
      } catch (err) {
        setStatus('error');
        setError(describeMediaError(err));
        return;
      }
      if (r.cancelled) { mediaStream.getTracks().forEach((t) => t.stop()); return; }
      r.mediaStream = mediaStream;

      const jwt = localStorage.getItem('token');
      try {
        await stompService.connect(jwt);
      } catch (err) {
        setStatus('error');
        setError('Could not connect to the broadcast server.');
        return;
      }
      if (r.cancelled) return;

      wireSignaling();

      // Re-wire on every future STOMP reconnect (network drop + recovery).
      const unregisterOnConnect = stompService.onConnect(() => {
        if (r.cancelled || !r.mediaStream) return;
        setStatus('connecting');
        r.offerSent = false;
        wireSignaling({ isReconnect: true });
      });
      const unregisterOnDisconnect = stompService.onDisconnect(() => {
        if (r.cancelled) return;
        setStatus('reconnecting');
      });
      r.cleanupFns.push(unregisterOnConnect, unregisterOnDisconnect);
    };

    start();

    return () => {
      r.cancelled = true;
      teardownSignaling();
      if (r.mediaStream) {
        r.mediaStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* ignore */ } });
        r.mediaStream = null;
      }
      stompService.disconnect();
      r.offerSent = false;
      r.started = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, applicationId]);

  return { status, error, stop };
}

export default useAIInterviewBroadcast;
