/**
 * ViolationFeed.jsx
 *
 * NEW: AI Interview Monitoring — recruiter-side live violation panel.
 *
 * Renders a running list of proctoring violations (phone/face/multi-face/
 * noise/tab-switch/camera/mic) reported live over
 * /topic/violation/{liveSessionId}, newest first, with a per-severity
 * summary strip. Purely presentational — the parent room component owns
 * the WebSocket subscription and passes violations down as props.
 */

import React from 'react';

const SEVERITY_META = {
  CRITICAL: { label: 'Critical', color: '#dc2626', icon: '🚨' },
  HIGH:     { label: 'High',     color: '#ea580c', icon: '⚠️' },
  MEDIUM:   { label: 'Medium',   color: '#d97706', icon: '⚠️' },
  LOW:      { label: 'Low',      color: '#6b7280', icon: 'ℹ️' },
};

const TYPE_LABELS = {
  PHONE_DETECTED: 'Phone Detected',
  MULTIPLE_FACES_DETECTED: 'Multiple Faces',
  NO_FACE_DETECTED: 'No Face Detected',
  FACE_ABSENCE_PROLONGED: 'Prolonged Face Absence',
  NOISE_DETECTED: 'Background Noise',
  TAB_SWITCH: 'Tab Switch',
  CAMERA_OFF: 'Camera Off',
  MICROPHONE_OFF: 'Microphone Off',
};

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function ViolationFeed({ violations = [] }) {
  const counts = violations.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="ir-violation-feed">
      <h4 className="ir-sidebar-status__title">
        Proctoring Alerts
        {violations.length > 0 && (
          <span className="ir-violation-feed__total">{violations.length}</span>
        )}
      </h4>

      <div className="ir-violation-feed__summary">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <div key={sev} className="ir-violation-feed__summary-item" style={{ color: SEVERITY_META[sev].color }}>
            <span className="ir-violation-feed__summary-count">{counts[sev] || 0}</span>
            <span className="ir-violation-feed__summary-label">{SEVERITY_META[sev].label}</span>
          </div>
        ))}
      </div>

      {violations.length === 0 ? (
        <p className="ir-violation-feed__empty">No violations detected yet.</p>
      ) : (
        <ul className="ir-violation-feed__list">
          {violations.map((v) => {
            const meta = SEVERITY_META[v.severity] || SEVERITY_META.LOW;
            return (
              <li key={v.id ?? v.timestamp + v.violationType} className="ir-violation-feed__item">
                <span className="ir-violation-feed__icon" aria-hidden="true">{meta.icon}</span>
                <div className="ir-violation-feed__body">
                  <div className="ir-violation-feed__row">
                    <span className="ir-violation-feed__type" style={{ color: meta.color }}>
                      {TYPE_LABELS[v.violationType] ?? v.violationType}
                    </span>
                    <span className="ir-violation-feed__time">{formatTime(v.timestamp)}</span>
                  </div>
                  <div className="ir-violation-feed__message">{v.message}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ViolationFeed;
