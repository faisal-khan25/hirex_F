/**
 * CandidatePanel.jsx
 * Header bar shown above the candidate's self-view.
 */

import React from 'react';
import ConnectionStatus from './ConnectionStatus';
import InterviewTimer from './InterviewTimer';

function CandidatePanel({ connectionState, timerRunning, timerOffset, warnings }) {
  return (
    <div className="candidate-panel">
      <div className="candidate-panel__left">
        <span className="panel-logo">HireX</span>
        <span className="panel-separator">|</span>
        <span className="panel-label">Live Interview</span>
      </div>
      <div className="candidate-panel__center">
        <InterviewTimer
          running={timerRunning}
          startOffset={timerOffset}
          className="candidate-timer"
        />
      </div>
      <div className="candidate-panel__right">
        <ConnectionStatus state={connectionState} />
      </div>

      {/* Warnings (camera/mic disconnected) */}
      {warnings.length > 0 && (
        <div className="warning-bar">
          {warnings.map((w, i) => (
            <span key={i} className="warning-chip">⚠ {w}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default CandidatePanel;
