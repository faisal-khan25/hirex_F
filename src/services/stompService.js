/**
 * stompService.js
 *
 * Wraps @stomp/stompjs (which works over SockJS) to match the backend's
 * WebSocketConfig exactly:
 *   - Endpoint:   /ws  (with SockJS fallback)
 *   - Auth:       JWT passed as STOMP `login` header on CONNECT
 *   - App prefix: /app
 *   - Broker:     /topic, /queue, /user
 *
 * STOMP destinations → backend:
 *   /app/live/join
 *   /app/live/offer
 *   /app/live/answer
 *   /app/live/ice
 *   /app/live/camera
 *   /app/live/mic
 *
 * Subscribe topics from backend (FIX BUG-C4: point-to-point unicast):
 *   /user/queue/offer       (recruiter receives offers from candidate)
 *   /user/queue/answer      (candidate receives answers from recruiter)
 *   /user/queue/ice         (either party receives ICE candidates)
 *   /topic/session/{id}/status  (both parties receive session updates)
 *   /topic/camera/{id}      (both parties receive camera status)
 *   /topic/mic/{id}         (both parties receive microphone mute status)
 */

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

class StompService {
  constructor() {
    this.client = null;
    this.subscriptions = new Map();
    this.connectCallbacks = [];
    this.disconnectCallbacks = [];
    this.isConnected = false;
    // BUG FIX: tracks an in-flight connect() attempt so overlapping calls
    // reuse the same promise instead of spinning up a second competing
    // STOMP Client. Without this, React 18 StrictMode's dev-mode double
    // effect invocation (mount -> cleanup -> mount) — or any component
    // simply re-rendering/re-mounting before the first handshake finishes —
    // would call connect() again while a previous attempt was still
    // mid-handshake. The first, now-orphaned client would keep negotiating
    // in the background (its own reconnectDelay/backoff still running)
    // while a second one raced it, producing exactly the kind of
    // inconsistent tens-of-seconds "eventually connects" delay this was
    // built to fix.
    this._connectingPromise = null;
  }

  /** Connect to the STOMP server with JWT authentication */
  connect(token) {
    if (this.client && this.isConnected) {
      return Promise.resolve();
    }
    if (this._connectingPromise) {
      return this._connectingPromise;
    }

    this._connectingPromise = new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS(`${BACKEND_URL}/ws`),
        connectHeaders: {
          login: token, // JWT for backend authentication
        },
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        reconnectDelay: 3000,

        onConnect: () => {
          this.isConnected = true;
          this._connectingPromise = null;
          this.connectCallbacks.forEach((cb) => cb());
          resolve();
        },

        onDisconnect: () => {
          this.isConnected = false;
          this.subscriptions.clear();
          this.disconnectCallbacks.forEach((cb) => cb());
        },

        onStompError: (frame) => {
          console.error('[STOMP] Error:', frame.headers?.message);
          this._connectingPromise = null;
          reject(new Error(frame.headers?.message || 'STOMP connection error'));
        },

        onWebSocketError: (event) => {
          console.error('[STOMP] WebSocket error:', event);
          this._connectingPromise = null;
          reject(new Error('WebSocket connection failed'));
        },
      });

      this.client.activate();
    });

    return this._connectingPromise;
  }

  /** Disconnect and clean up all subscriptions */
  disconnect() {
    this.subscriptions.forEach((sub) => {
      try { sub.unsubscribe(); } catch (_) { /* ignore */ }
    });
    this.subscriptions.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.isConnected = false;
    this._connectingPromise = null;
  }

  /** Subscribe to a topic; returns an unsubscribe function */
  subscribe(destination, callback) {
    if (!this.client || !this.isConnected) {
      console.warn('[STOMP] Cannot subscribe – not connected:', destination);
      return () => {};
    }
    const sub = this.client.subscribe(destination, (message) => {
      try {
        const body = JSON.parse(message.body);
        callback(body);
      } catch (e) {
        callback(message.body);
      }
    });
    this.subscriptions.set(destination, sub);
    return () => {
      sub.unsubscribe();
      this.subscriptions.delete(destination);
    };
  }

  /** Send a message to an /app/* destination */
  send(destination, payload) {
    if (!this.client || !this.isConnected) {
      console.warn('[STOMP] Cannot send – not connected:', destination);
      return;
    }
    this.client.publish({
      destination,
      body: JSON.stringify(payload),
    });
  }

  // ── Convenience methods matching backend destinations ────────────────────

  /** /app/live/join – announce presence in a session room */
  sendJoin(sessionToken, role) {
    this.send('/app/live/join', { sessionToken, role });
  }

  /** /app/live/offer – relay SDP offer */
  sendOffer(sessionToken, sdp, senderRole) {
    this.send('/app/live/offer', { sessionToken, sdp, senderRole });
  }

  /** /app/live/answer – relay SDP answer */
  sendAnswer(sessionToken, sdp, senderRole) {
    this.send('/app/live/answer', { sessionToken, sdp, senderRole });
  }

  /** /app/live/ice – relay ICE candidate */
  sendIce(sessionToken, candidate, sdpMid, sdpMLineIndex, senderRole) {
    this.send('/app/live/ice', {
      sessionToken,
      candidate,
      sdpMid,
      sdpMLineIndex,
      senderRole,
    });
  }

  /** /app/live/camera – notify of camera state change (CANDIDATE or RECRUITER role) */
  sendCameraStatus(sessionToken, role, cameraEnabled, reason = '') {
    this.send('/app/live/camera', { sessionToken, role, cameraEnabled, reason });
  }

  /** /app/live/mic – notify of microphone mute/unmute (CANDIDATE or RECRUITER role) */
  sendMicStatus(sessionToken, role, micEnabled, reason = '') {
    this.send('/app/live/mic', { sessionToken, role, micEnabled, reason });
  }

  /**
   * Register a callback fired every time the client (re)connects — including
   * automatic reconnects after a network drop. Returns an unsubscribe
   * function so callers (e.g. broadcast hooks/pages) can clean up on unmount
   * instead of leaking callbacks on this singleton across route changes.
   */
  onConnect(cb) {
    this.connectCallbacks.push(cb);
    return () => {
      this.connectCallbacks = this.connectCallbacks.filter((fn) => fn !== cb);
    };
  }

  /** Same as onConnect() but fired on every disconnect. Returns an unsubscribe fn. */
  onDisconnect(cb) {
    this.disconnectCallbacks.push(cb);
    return () => {
      this.disconnectCallbacks = this.disconnectCallbacks.filter((fn) => fn !== cb);
    };
  }
}

// Singleton – one WebSocket connection per app session
export const stompService = new StompService();
export default stompService;