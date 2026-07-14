/**
 * webrtcService.js
 *
 * Manages an RTCPeerConnection lifecycle for two-way video streaming:
 *   Candidate (sender/receiver) ↔ Recruiter (receiver/sender)
 *
 * FIXES:
 *  FIX-WR1: createOffer() now sets offerToReceiveVideo/Audio to TRUE so both
 *            sides can receive the remote stream.
 *  FIX-WR2: Exposed `peerConnection` as a getter alias for `pc` so room
 *            components can call webrtcService.peerConnection.getSenders().
 */

let ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function configureIceServers(servers) {
  ICE_SERVERS = servers && servers.length ? servers : ICE_SERVERS;
}

// PRODUCTION FIX: this used to unconditionally `.push()` the env-configured
// TURN server onto the module-level ICE_SERVERS array. Under Vite HMR (or
// any re-evaluation of this module) that push would repeat, silently
// accumulating duplicate TURN entries. Guard with a dedicated flag so it
// only ever gets added once, and only when a URL is actually configured —
// without a TURN server, connections behind symmetric NATs/restrictive
// corporate firewalls will fail silently (STUN alone isn't enough there).
let turnConfigured = false;
if (import.meta.env.VITE_TURN_URL && !turnConfigured) {
  ICE_SERVERS.push({
    urls:       import.meta.env.VITE_TURN_URL,
    username:   import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  });
  turnConfigured = true;
}

class WebRTCService {
  constructor() {
    this.pc = null;
    this.onTrackCallback          = null;
    this.onIceCandidateCallback   = null;
    this.onConnectionStateChange  = null;
    this.onNegotiationNeeded      = null;
  }

  /** FIX-WR2: alias so room components can use webrtcService.peerConnection */
  get peerConnection() {
    return this.pc;
  }

  createPeerConnection() {
    if (this.pc) this.closeConnection();

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(candidate);
      }
    };

    this.pc.ontrack = (event) => {
      if (this.onTrackCallback) {
        this.onTrackCallback(event.streams[0] ?? event.track);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.onnegotiationneeded = () => {
      if (this.onNegotiationNeeded) this.onNegotiationNeeded();
    };

    this.pc.onicegatheringstatechange = () => {
      console.debug('[WebRTC] ICE gathering:', this.pc.iceGatheringState);
    };

    return this.pc;
  }

  addStream(stream) {
    if (!this.pc) throw new Error('PeerConnection not created');
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
  }

  async createOffer() {
    if (!this.pc) throw new Error('PeerConnection not created');
    // FIX-WR1: must be TRUE so the recruiter's stream can be received
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer() {
    if (!this.pc) throw new Error('PeerConnection not created');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp, type) {
    if (!this.pc) throw new Error('PeerConnection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp, type }));
  }

  async addIceCandidate(candidate, sdpMid, sdpMLineIndex) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(
        new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex })
      );
    } catch (e) {
      console.warn('[WebRTC] addIceCandidate (benign):', e.message);
    }
  }

  closeConnection() {
    if (this.pc) {
      this.pc.onicecandidate         = null;
      this.pc.ontrack                = null;
      this.pc.onconnectionstatechange = null;
      this.pc.onnegotiationneeded    = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    // PRODUCTION FIX: this service is a module-level singleton (one instance
    // shared by the whole app). Without clearing these, a callback captured
    // in one component's closure (e.g. a recruiter's viewer for candidate A)
    // could keep a reference alive after that component unmounts, and — if
    // the singleton were reused for a different session before garbage
    // collection — fire stale UI updates for the wrong session.
    this.onTrackCallback         = null;
    this.onIceCandidateCallback  = null;
    this.onConnectionStateChange = null;
    this.onNegotiationNeeded     = null;
  }

  get connectionState() {
    return this.pc?.connectionState ?? 'closed';
  }

  get signalingState() {
    return this.pc?.signalingState ?? 'closed';
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;