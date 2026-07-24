import React, { useMemo } from 'react';
import { useInterview } from '../context/Interviewcontext';

/**
 * AIAvatar Component
 * Futuristic holographic AI interviewer avatar with state-driven animations
 * Features: Multiple states (idle, listening, thinking, speaking, evaluating)
 */
const AIAvatar = ({ size = 'lg' }) => {
  const { state } = useInterview();

  // Determine avatar state for animations
  const avatarState = useMemo(() => {
    if (state.isSpeaking) return 'speaking';
    if (state.isThinking) return 'thinking';
    if (state.isListening) return 'listening';
    if (state.aiState === 'EVALUATING') return 'evaluating';
    return 'idle';
  }, [state.isSpeaking, state.isThinking, state.isListening, state.aiState]);

  // Size mapping
  const sizeMap = {
    sm: { container: '200px', svg: '200px' },
    md: { container: '280px', svg: '280px' },
    lg: { container: '380px', svg: '380px' },
  };

  const dimensions = sizeMap[size] || sizeMap.lg;

  return (
    <div
      className={`ai-avatar-container avatar-${avatarState}`}
      style={{
        width: dimensions.container,
        height: dimensions.container,
      }}
    >
      <svg
        viewBox="0 0 300 380"
        className="ai-avatar"
        width={dimensions.svg}
        height={dimensions.svg}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradient definitions */}
          <linearGradient id="burstGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
          </linearGradient>

          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
          </radialGradient>

          <radialGradient id="bustGrad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#4338ca" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.1" />
          </radialGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="innerGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx="150" cy="150" r="95" fill="url(#burstGrad)" filter="url(#glow)" />

        {/* Outer orbital ring (slow) */}
        <g className="orbital-ring" style={{ transformOrigin: '150px 150px' }}>
          <circle
            cx="150"
            cy="150"
            r="92"
            fill="none"
            stroke="#6366f1"
            strokeWidth="0.5"
            opacity="0.3"
          />
          <circle cx="150" cy="60" r="2" fill="#818cf8" opacity="0.7" />
        </g>

        {/* Middle orbital ring (medium) */}
        <g className="orbital-ring" style={{ transformOrigin: '150px 150px' }}>
          <circle
            cx="150"
            cy="150"
            r="75"
            fill="none"
            stroke="#818cf8"
            strokeWidth="0.5"
            opacity="0.2"
          />
          <circle cx="150" cy="80" r="2" fill="#6366f1" opacity="0.6" />
        </g>

        {/* Inner orbital ring (fast when thinking) */}
        <g className="orbital-ring" style={{ transformOrigin: '150px 150px' }}>
          <circle
            cx="150"
            cy="150"
            r="60"
            fill="none"
            stroke="#6366f1"
            strokeWidth="0.5"
            opacity="0.25"
          />
          <circle cx="150" cy="95" r="1.5" fill="#818cf8" opacity="0.8" />
        </g>

        {/* Bust silhouette - Head */}
        <ellipse
          cx="150"
          cy="100"
          rx="45"
          ry="50"
          fill="url(#bustGrad)"
          filter="url(#innerGlow)"
          opacity="0.7"
        />

        {/* Bust silhouette - Shoulders */}
        <path
          d="M 110 140 Q 110 160, 130 170 L 170 170 Q 190 160, 190 140"
          fill="url(#bustGrad)"
          filter="url(#innerGlow)"
          opacity="0.5"
        />

        {/* Core glow - Avatar's "face" */}
        <circle
          className="avatar-core"
          cx="150"
          cy="100"
          r="28"
          fill="url(#coreGrad)"
          filter="url(#glow)"
        />

        {/* Waveform visualization (when speaking) */}
        <g className="avatar-waveform" opacity="0.8">
          {[0, 1, 2, 3, 4].map((i) => {
            const xPos = 130 + i * 10;
            const height = 4 + Math.random() * 16;
            return (
              <rect
                key={i}
                x={xPos}
                y={110 - height / 2}
                width="6"
                height={height}
                fill="#818cf8"
                rx="3"
                opacity={0.6 + Math.random() * 0.4}
                style={{
                  animation: `waveform 0.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            );
          })}
        </g>

        {/* Scan line (when evaluating) */}
        <g className="scan-line" opacity="0">
          <line
            x1="120"
            y1="100"
            x2="180"
            y2="100"
            stroke="#22d3ee"
            strokeWidth="1"
            opacity="0.5"
            style={{
              filter: 'drop-shadow(0 0 3px #22d3ee)',
            }}
          />
        </g>

        {/* Thinking indicators (dots) */}
        <g className="thinking-indicator" opacity="0">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={120 + i * 15}
              cy="130"
              r="2"
              fill="#c084fc"
              style={{
                animation: `thinking-pulse 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </g>

        {/* Listening pulse ring */}
        {avatarState === 'listening' && (
          <circle
            cx="150"
            cy="150"
            r="85"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            opacity="0.3"
            style={{
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        )}

        {/* Status indicator dot */}
        <circle
          cx="185"
          cy="70"
          r="5"
          fill={
            avatarState === 'speaking'
              ? '#818cf8'
              : avatarState === 'listening'
                ? '#22d3ee'
                : avatarState === 'thinking'
                  ? '#c084fc'
                  : avatarState === 'evaluating'
                    ? '#10b981'
                    : '#6366f1'
          }
          opacity="0.8"
          style={{
            filter: 'drop-shadow(0 0 4px currentColor)',
          }}
        />
      </svg>

      {/* State indicator text below avatar */}
      <div
        style={{
          position: 'absolute',
          bottom: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255, 255, 255, 0.6)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '4px',
          }}
        >
          {avatarState}
        </div>
      </div>
    </div>
  );
};

export default AIAvatar;