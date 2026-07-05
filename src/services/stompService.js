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
 *
 * Subscribe topics from backend (FIX BUG-C4: point-to-point unicast):
 *   /user/queue/offer       (recruiter receives offers from candidate)
 *   /user/queue/answer      (candidate receives answers from recruiter)
 *   /user/queue/ice         (either party receives ICE candidates)
 *   /topic/session/{id}/status  (both parties receive session updates)
 *   /topic/camera/{id}      (both parties receive camera status)
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
  }

  /** Connect to the STOMP server with JWT authentication */
  connect(token) {
    return new Promise((resolve, reject) => {
      if (this.client && this.isConnected) {
        resolve();
        return;
      }

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
          reject(new Error(frame.headers?.message || 'STOMP connection error'));
        },

        onWebSocketError: (event) => {
          console.error('[STOMP] WebSocket error:', event);
          reject(new Error('WebSocket connection failed'));
        },
      });

      this.client.activate();
    });
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

  onConnect(cb) { this.connectCallbacks.push(cb); }
  onDisconnect(cb) { this.disconnectCallbacks.push(cb); }
}

// Singleton – one WebSocket connection per app session
export const stompService = new StompService();
export default stompService;