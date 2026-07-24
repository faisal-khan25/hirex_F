import React from 'react';
import { useInterview } from '../context/Interviewcontext';

/**
 * ProgressTracker
 * Shows the list of interview questions and marks each as pending,
 * current, or completed. Displayed in the left sidebar.
 */
const ProgressTracker = () => {
  const { state } = useInterview();
  const { questions, currentQuestionIndex, answers } = state;

  if (!questions || questions.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '13px',
        }}
      >
        Loading questions...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.4)',
          marginBottom: '12px',
        }}
      >
        Progress — {currentQuestionIndex + 1} / {questions.length}
      </div>

      {/* Question list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map((q, idx) => {
          const isCurrent   = idx === currentQuestionIndex;
          const isCompleted = answers && answers[q.id];
          const isPending   = idx > currentQuestionIndex;

          const dotColor = isCompleted
            ? '#10b981'
            : isCurrent
            ? '#818cf8'
            : 'rgba(255,255,255,0.2)';

          const textColor = isCompleted
            ? 'rgba(255,255,255,0.6)'
            : isCurrent
            ? 'rgba(255,255,255,0.95)'
            : 'rgba(255,255,255,0.3)';

          return (
            <div
              key={q.id || idx}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                padding: isCurrent ? '8px 10px' : '6px 10px',
                borderRadius: '8px',
                background: isCurrent
                  ? 'rgba(99, 102, 241, 0.1)'
                  : 'transparent',
                border: isCurrent
                  ? '1px solid rgba(99, 102, 241, 0.25)'
                  : '1px solid transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  flexShrink: 0,
                  marginTop: '3px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: dotColor,
                  boxShadow: isCurrent
                    ? '0 0 6px rgba(129,140,248,0.6)'
                    : isCompleted
                    ? '0 0 4px rgba(16,185,129,0.4)'
                    : 'none',
                  transition: 'background 0.2s',
                }}
              />

              {/* Question label */}
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? 600 : 400,
                    color: textColor,
                    lineHeight: '1.4',
                  }}
                >
                  Q{idx + 1}
                  {q.type && (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        opacity: 0.6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {q.type}
                    </span>
                  )}
                </div>

                {isCompleted && answers[q.id]?.score != null && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#10b981',
                      marginTop: '2px',
                    }}
                  >
                    Score: {answers[q.id].score}/10
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTracker;
