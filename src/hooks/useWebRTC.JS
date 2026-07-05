/**
 * useWebRTC.js
 *
 * Orchestrates the full WebRTC + STOMP signaling flow.
 *
 * Role = 'CANDIDATE' → creates offer, sends stream
 * Role = 'RECRUITER' → waits for offer, creates answer, receives stream
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import stompService from '../services/stompService';
import webrtcService from '../services/webrtcService';

export function useWebRTC({ role, sessionId, sessionToken, localStream }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new'); // new | connecting | connected | disconnected | failed | closed
  const [signalingState, setSignalingState] = useState('idle');
  const localStreamRef = useRef(localStream);
  const cleanupRef = useRef([]);

  // Keep localStream ref in sync
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const cleanup = useCallback(() => {
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];
    webrtcService.closeConnection();
    setRemoteStream(null);
    setConnectionState('closed');
  }, []);

  const initConnection = useCallback(() => {
    if (!sessionId || !sessionToken) return;

    webrtcService.createPeerConnection();

    // Wire connection state changes
    webrtcService.onConnectionStateChange = (state) => {
      setConnectionState(state);
    };

    // Recruiter: receive remote stream from candidate
    webrtcService.onTrackCallback = (stream) => {
      setRemoteStream(stream instanceof MediaStream ? stream : new MediaStream([stream]));
    };

    // Send ICE candidates via STOMP
    webrtcService.onIceCandidateCallback = (candidate) => {
      stompService.sendIce(
        sessionToken,
        candidate.candidate,
        candidate.sdpMid,
        candidate.sdpMLineIndex,
        role
      );
    };

    // Subscribe to incoming signaling messages
    const topicBase = `/topic/session/${sessionId}`;

    if (role === 'CANDIDATE') {
      // Candidate adds local stream tracks before creating offer
      if (localStreamRef.current) {
        webrtcService.addStream(localStreamRef.current);
      }

      // Listen for recruiter's SDP answer
      const unsubAnswer = stompService.subscribe(`${topicBase}/answer`, async (msg) => {
        if (msg.senderRole === 'RECRUITER') {
          await webrtcService.setRemoteDescription(msg.sdp, 'answer');
          setSignalingState('answered');
        }
      });
      cleanupRef.current.push(unsubAnswer);

      // Create and send offer
      const makeOffer = async () => {
        try {
          const offer = await webrtcService.createOffer();
          stompService.sendOffer(sessionToken, offer.sdp, 'CANDIDATE');
          setSignalingState('offer-sent');
        } catch (err) {
          console.error('[WebRTC] createOffer failed:', err);
          setConnectionState('failed');
        }
      };
      makeOffer();
    }

    if (role === 'RECRUITER') {
      // Listen for candidate's SDP offer
      const unsubOffer = stompService.subscribe(`${topicBase}/offer`, async (msg) => {
        if (msg.senderRole === 'CANDIDATE') {
          await webrtcService.setRemoteDescription(msg.sdp, 'offer');
          setSignalingState('offer-received');
          try {
            const answer = await webrtcService.createAnswer();
            stompService.sendAnswer(sessionToken, answer.sdp, 'RECRUITER');
            setSignalingState('answer-sent');
          } catch (err) {
            console.error('[WebRTC] createAnswer failed:', err);
            setConnectionState('failed');
          }
        }
      });
      cleanupRef.current.push(unsubOffer);
    }

    // Both parties handle incoming ICE candidates
    const unsubIce = stompService.subscribe(`${topicBase}/ice`, async (msg) => {
      if (msg.senderRole !== role) {
        await webrtcService.addIceCandidate(
          msg.candidate,
          msg.sdpMid,
          msg.sdpMLineIndex
        );
      }
    });
    cleanupRef.current.push(unsubIce);
  }, [role, sessionId, sessionToken]);

  // Restart connection when stream is updated (e.g., camera toggled back on)
  const restartWithStream = useCallback((newStream) => {
    if (!webrtcService.pc) return;
    const senders = webrtcService.pc.getSenders();
    newStream?.getTracks().forEach((track) => {
      const sender = senders.find((s) => s.track?.kind === track.kind);
      if (sender) sender.replaceTrack(track).catch(console.error);
    });
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    remoteStream,
    connectionState,
    signalingState,
    initConnection,
    cleanup,
    restartWithStream,
  };
}

export default useWebRTC;
