/**
 * useMicrophone.js
 *
 * Manages microphone mute/unmute on an existing MediaStream.
 * Also detects if the microphone track ends unexpectedly.
 */

import { useState, useCallback, useEffect } from 'react';

export function useMicrophone(stream) {
  const [micOn, setMicOn] = useState(true);
  const [micDisconnected, setMicDisconnected] = useState(false);

  // Wire up track-ended detection whenever the stream changes
  useEffect(() => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.onended = () => setMicDisconnected(true);
    });
    // Reset disconnected flag if we get a new stream
    setMicDisconnected(false);
  }, [stream]);

  /** Toggle audio track enabled state */
  const toggleMic = useCallback(() => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const newState = !audioTracks[0].enabled;
    audioTracks.forEach((t) => { t.enabled = newState; });
    setMicOn(newState);
    return newState;
  }, [stream]);

  /** Mute (disable audio) */
  const muteMic = useCallback(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    setMicOn(false);
  }, [stream]);

  /** Unmute (enable audio) */
  const unmuteMic = useCallback(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = true; });
    setMicOn(true);
  }, [stream]);

  return { micOn, micDisconnected, toggleMic, muteMic, unmuteMic };
}

export default useMicrophone;
