/**
 * VideoPlayer.jsx
 * Renders any MediaStream into a <video> element.
 * Re-attaches srcObject whenever `stream` changes.
 */

import React, { useRef, useEffect } from 'react';

function VideoPlayer({
  stream,
  muted = false,
  mirror = false,
  className = '',
  placeholder = null,
  autoPlay = true,
  playsInline = true,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  if (!stream && placeholder) {
    return placeholder;
  }

  return (
    <video
      ref={videoRef}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
      className={className}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}

export default VideoPlayer;
