/**
 * CameraControls.jsx
 * Bottom control bar used by the candidate view.
 */

import React from 'react';

function CameraControls({
  cameraOn,
  micOn,
  isFullscreen,
  onToggleCamera,
  onToggleMic,
  onToggleFullscreen,
  onLeave,
  disabled = false,
}) {
  return (
    <div className="camera-controls">
      {/* Camera toggle */}
      <button
        className={`ctrl-btn ${cameraOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
        onClick={onToggleCamera}
        disabled={disabled}
        title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        aria-pressed={cameraOn}
      >
        <span className="ctrl-icon">{cameraOn ? '📹' : '🚫'}</span>
        <span className="ctrl-label">{cameraOn ? 'Camera On' : 'Camera Off'}</span>
      </button>

      {/* Microphone toggle */}
      <button
        className={`ctrl-btn ${micOn ? 'ctrl-btn--active' : 'ctrl-btn--off'}`}
        onClick={onToggleMic}
        disabled={disabled}
        title={micOn ? 'Mute microphone' : 'Unmute microphone'}
        aria-pressed={micOn}
      >
        <span className="ctrl-icon">{micOn ? '🎤' : '🔇'}</span>
        <span className="ctrl-label">{micOn ? 'Mic On' : 'Muted'}</span>
      </button>

      {/* Fullscreen toggle */}
      <button
        className="ctrl-btn ctrl-btn--neutral"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-pressed={isFullscreen}
      >
        <span className="ctrl-icon">{isFullscreen ? '⤓' : '⤢'}</span>
        <span className="ctrl-label">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
      </button>

      {/* Leave */}
      <button
        className="ctrl-btn ctrl-btn--danger"
        onClick={onLeave}
        title="Leave interview"
      >
        <span className="ctrl-icon">📵</span>
        <span className="ctrl-label">Leave</span>
      </button>
    </div>
  );
}

export default CameraControls;
