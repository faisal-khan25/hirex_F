import React, { useState, useEffect } from 'react';

/**
 * AIMessage — interviewer bubble (left-aligned, indigo tint)
 * DESIGN FIX: all text uses solid, high-contrast colors.
 * No rgba(255,255,255,0.X) opacity tricks that cause the "blur/faint" look.
 */
export const AIMessage = ({ text, isNew = false, hasTypingAnimation = false }) => {
  const [displayText, setDisplayText] = useState(hasTypingAnimation ? '' : text);

  useEffect(() => {
    if (!hasTypingAnimation || !text) {
      setDisplayText(text);
      return;
    }
    setDisplayText('');
    let i = 0;
    const speed = Math.max(12, Math.min(28, 1500 / text.length)); // adaptive speed
    const timer = setInterval(() => {
      setDisplayText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, hasTypingAnimation]);

  return (
    <div className={`ai-message${isNew ? ' is-new' : ''}`}>
      <div className="ai-message-avatar">🤖</div>
      <div className="ai-message-bubble">
        {displayText}
        {hasTypingAnimation && displayText.length < (text?.length || 0) && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '14px',
              background: '#818cf8',
              marginLeft: '2px',
              verticalAlign: 'middle',
              animation: 'cursorBlink 0.8s step-end infinite',
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

/**
 * CandidateMessage — candidate's answer bubble (right-aligned, blue tint)
 */
export const CandidateMessage = ({ text, timestamp, duration }) => {
  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="candidate-message">
      <div className="candidate-message-avatar">👤</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div className="candidate-message-bubble">{text}</div>
        <div className="candidate-message-meta">
          {timeStr && <span>{timeStr}</span>}
          {duration != null && duration > 0 && (
            <span style={{ marginLeft: '8px' }}>{duration}s</span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * TypingIndicator — animated dots while AI is thinking
 */
export const TypingIndicator = () => (
  <div className="typing-indicator">
    <div
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        flexShrink: 0,
      }}
    >
      🤖
    </div>
    <div className="typing-dots">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  </div>
);