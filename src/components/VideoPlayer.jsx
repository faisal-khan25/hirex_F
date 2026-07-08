/**
 * VideoPlayer.jsx
 * Renders any MediaStream into a <video> element.
 * Re-attaches srcObject whenever `stream` changes.
 *
 * PRODUCTION HARDENING:
 *  - video.play() returns a Promise; browsers' autoplay policies can reject
 *    it (e.g. NotAllowedError before any user gesture). Previously this was
 *    an unhandled promise rejection that spammed the console and could look
 *    like a broken stream. It's now caught and surfaced as a subtle
 *    "tap to play" affordance instead of failing silently.
 *  - Shows a brief connecting spinner between "we have a stream" and
 *    "the first frame actually painted" (onLoadedData), since a MediaStream
 *    can exist for a moment with no decodable frames yet.
 *  - Adds an accessible label so screen readers announce the video's purpose.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

function VideoPlayer({
  stream,
  muted = false,
  mirror = false,
  className = '',
  placeholder = null,
  autoPlay = true,
  playsInline = true,
  label = 'Live video feed',
}) {
  const videoRef = useRef(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasFrame(false);
    setNeedsUserGesture(false);

    if (stream) {
      video.srcObject = stream;
      if (autoPlay) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => {
            // Autoplay was blocked — this is expected/benign in some browsers
            // until the user interacts with the page. Offer a manual play
            // control rather than leaving a frozen black box with no cue.
            if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
              setNeedsUserGesture(true);
            } else {
              console.warn('[VideoPlayer] play() failed:', err);
            }
          });
        }
      }
    } else {
      video.srcObject = null;
    }
  }, [stream, autoPlay]);

  const handleManualPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => setNeedsUserGesture(false)).catch(() => {});
  }, []);

  if (!stream && placeholder) {
    return placeholder;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        className={className}
        aria-label={label}
        onLoadedData={() => setHasFrame(true)}
        onWaiting={() => setHasFrame(false)}
        onPlaying={() => setHasFrame(true)}
        style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      />

      {stream && !hasFrame && !needsUserGesture && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(17,24,39,0.35)', color: '#fff', fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          <span className="loading-spinner" aria-hidden="true" />
          <span style={{ marginLeft: 8 }}>Loading video…</span>
        </div>
      )}

      {needsUserGesture && (
        <button
          type="button"
          onClick={handleManualPlay}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, background: 'rgba(17,24,39,0.55)',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
          aria-label="Click to start video playback"
        >
          <span style={{ fontSize: 28 }}>▶</span>
          Click to play
        </button>
      )}
    </div>
  );
}

export default VideoPlayer;
