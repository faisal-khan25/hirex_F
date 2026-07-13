/**
 * ErrorBoundary.jsx
 *
 * PRODUCTION GAP FIX: the app previously had zero error boundaries. A thrown
 * render error anywhere (for example, the broadcast hook crash described in
 * hooks/useAIInterviewBroadcast.js) unmounts the entire React tree and shows
 * a blank white page with no way to recover short of a full reload.
 *
 * Wrap any feature area — especially ones doing WebRTC/media/websocket work,
 * which are inherently more failure-prone than plain CRUD UI — with this
 * boundary so a failure is contained and recoverable.
 *
 * Usage:
 *   <ErrorBoundary fallbackTitle="Live broadcast unavailable">
 *     <LiveBroadcastViewer />
 *   </ErrorBoundary>
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Centralized place to wire in real error reporting (Sentry, etc.)
    // without touching every feature page individually.
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center', padding: '48px 24px',
            minHeight: 240, gap: 10,
          }}
        >
          <div style={{ fontSize: 34 }} aria-hidden="true">⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#131224' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: '#6b7280', maxWidth: 380 }}>
            {this.props.fallbackMessage ||
              'This part of the page hit an unexpected error. You can try again without losing your place elsewhere in the app.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 6, background: '#265DF5', color: '#fff', border: 'none',
              borderRadius: 10, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
