import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useInterview } from '../context/Interviewcontext';

/**
 * TimerBar Component
 * Top bar showing interview timer, AI status, and control buttons
 */
const TimerBar = ({
  onFullscreenToggle,
  onVoiceToggle,
  onExit,
  maxDuration = 1800, // 30 minutes default
}) => {
  const { state, setAISpeaking, setAIListening } = useInterview();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  // Timer countdown effect
  useEffect(() => {
    if (state.status !== 'IN_PROGRESS') return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1;
        if (next >= maxDuration) {
          clearInterval(interval);
          onExitRef.current?.();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, maxDuration]);

  // Format time MM:SS
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Time remaining
  const timeRemaining = maxDuration - elapsedTime;
  const isRunningOut = timeRemaining < 300; // Less than 5 minutes
  const isTimeUp = timeRemaining <= 0;

  return (
    <div className="timer-bar">
      {/* Left: Status badge */}
      <div className="timer-bar__left">
        <div
          className={`status-badge ${state.aiState.toLowerCase()}`}
          style={{
            animation:
              state.isSpeaking || state.isListening
                ? 'pulse 1.5s ease-in-out infinite'
                : 'none',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'currentColor',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <span style={{ textTransform: 'capitalize' }}>{state.aiState}</span>
        </div>
      </div>

      {/* Center: Timer */}
      <div className="timer-bar__center">
        <div
          className="timer-display"
          style={{
            color: isTimeUp ? '#ef4444' : isRunningOut ? '#f59e0b' : '#818cf8',
            textShadow: isTimeUp
              ? '0 0 10px rgba(239, 68, 68, 0.5)'
              : isRunningOut
                ? '0 0 10px rgba(245, 158, 11, 0.5)'
                : '0 0 10px rgba(129, 140, 248, 0.3)',
          }}
        >
          {formatTime(timeRemaining)}
          <span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '4px' }}>
            {isTimeUp ? '(TIME UP)' : '(remaining)'}
          </span>
        </div>
      </div>

      {/* Right: Control buttons */}
      <div className="timer-bar__right">
        {/* Voice toggle button */}
        <button
          className={`btn-icon ${voiceEnabled ? 'active' : ''}`}
          onClick={() => {
            setVoiceEnabled(!voiceEnabled);
            onVoiceToggle?.(!voiceEnabled);
          }}
          title={voiceEnabled ? 'Disable voice input' : 'Enable voice input'}
          aria-pressed={voiceEnabled}
        >
          {voiceEnabled ? '🎤' : '🔇'}
        </button>

        {/* Fullscreen toggle button */}
        <button
          className="btn-icon"
          onClick={onFullscreenToggle}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
        >
          ⛶
        </button>

        {/* Exit / Close button — always kept visible: the wrapping
            timer-bar__right group never shrinks or gets covered, it just
            wraps onto its own row on very narrow viewports (see
            Interview.css .timer-bar flex-wrap rule). */}
        <button
          className="btn-icon"
          onClick={onExit}
          title="Close interview"
          aria-label="Close interview"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TimerBar;