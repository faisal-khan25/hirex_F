/**
 * ConnectionStatus.jsx
 * Shows a colour-coded badge for the WebRTC / STOMP connection state.
 */

import React from 'react';

const STATE_MAP = {
  new:          { label: 'Initializing', color: '#a1a1aa' },
  connecting:   { label: 'Connecting…',  color: '#f59e0b' },
  connected:    { label: 'Connected',    color: '#10b981' },
  disconnected: { label: 'Reconnecting', color: '#f59e0b' },
  failed:       { label: 'Connection Failed', color: '#ef4444' },
  closed:       { label: 'Disconnected', color: '#ef4444' },
  idle:         { label: 'Waiting',      color: '#a1a1aa' },
};

function ConnectionStatus({ state = 'idle', className = '' }) {
  const { label, color } = STATE_MAP[state] ?? STATE_MAP.idle;
  return (
    <span
      className={`connection-status ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span
        style={{
          width: 8, height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: state === 'connected' ? `0 0 6px ${color}` : 'none',
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: '0.8rem', color, fontWeight: 500 }}>{label}</span>
    </span>
  );
}

export default ConnectionStatus;
