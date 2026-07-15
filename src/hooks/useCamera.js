/**
 * useCamera.js
 *
 * Manages camera access, permissions, and stream lifecycle.
 * Detects:
 *   - Permission denial
 *   - No camera device
 *   - Camera unplugging
 *   - Temporary network/hardware issues
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [permissionError, setPermissionError] = useState(null);
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const streamRef = useRef(null);
  const tracksRef = useRef([]);

  /**
   * Request camera and optional audio; returns MediaStream or null on error.
   * This is the only entry point to getUserMedia.
   */
  const startCamera = useCallback(async (constraints = { video: true, audio: true }) => {
    if (stream) return stream; // Already have a stream

    setIsStarting(true);
    setPermissionError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Wire up track-ended detection for camera disconnection
      mediaStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setCameraDisconnected(true);
          stopCamera();
        };
      });

      mediaStream.getAudioTracks().forEach((track) => {
        track.onended = () => setCameraDisconnected(true);
      });

      streamRef.current = mediaStream;
      tracksRef.current = mediaStream.getTracks();
      setStream(mediaStream);
      setCameraOn(true);
      setIsStarting(false);
      return mediaStream;
    } catch (err) {
      setIsStarting(false);
      setCameraDisconnected(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const msg = 'Camera permission denied. Please enable camera in browser settings.';
        setPermissionError(msg);
        console.error('[useCamera]', msg);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        const msg = 'No camera device found. Please check your hardware.';
        setPermissionError(msg);
        console.error('[useCamera]', msg);
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        const msg = 'Camera is in use or unavailable. Try closing other apps.';
        setPermissionError(msg);
        console.error('[useCamera]', msg);
      } else {
        const msg = `Camera error: ${err.message}`;
        setPermissionError(msg);
        console.error('[useCamera]', msg);
      }
      return null;
    }
  }, [stream]);

  /**
   * Stop all tracks and nullify the stream
   */
  const stopCamera = useCallback(() => {
    tracksRef.current.forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn('[useCamera] Error stopping track:', e.message);
      }
    });
    tracksRef.current = [];
    streamRef.current = null;
    setStream(null);
    setCameraOn(false);
    setCameraDisconnected(false);
  }, []);

  /**
   * Toggle camera on/off (disable/enable video track)
   * Returns the new state
   */
  const toggleCamera = useCallback(() => {
    if (!stream) return false;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return cameraOn;

    const newState = !videoTracks[0].enabled;
    videoTracks.forEach((track) => { track.enabled = newState; });
    setCameraOn(newState);
    return newState;
  }, [stream, cameraOn]);

  /**
   * Turn camera off (disable video track, but keep stream alive)
   */
  const turnCameraOff = useCallback(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = false; });
    setCameraOn(false);
  }, [stream]);

  /**
   * Turn camera on (enable video track)
   */
  const turnCameraOn = useCallback(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = true; });
    setCameraOn(true);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        tracksRef.current.forEach((track) => {
          try { track.stop(); } catch (e) { /* ignore */ }
        });
        streamRef.current = null;
        tracksRef.current = [];
      }
    };
  }, []);

  return {
    stream,
    cameraOn,
    permissionError,
    cameraDisconnected,
    isStarting,
    startCamera,
    toggleCamera,
    turnCameraOff,
    turnCameraOn,
    stopCamera,
  };
}

export default useCamera;