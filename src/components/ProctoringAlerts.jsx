/**
 * ProctoringAlerts.jsx
 *
 * Reusable, responsive "AI Interview Monitoring" alert stack
 * (Phone Detection / Face Detection / Multiple Face Detection /
 * Sound Detection / Tab Switch / Camera & Mic warnings, etc.)
 *
 * WHY THIS COMPONENT EXISTS
 * ─────────────────────────
 * Proctoring warnings used to be pinned with a hard-coded `top`/`right`
 * pixel value. That silently broke as soon as the header above it grew
 * (a second banner appeared, fonts got bigger, the viewport got narrow
 * and controls wrapped, etc.) — the toast stack would then render on
 * top of the Close/Exit button, the camera preview, or the interview
 * controls, making them unclickable.
 *
 * This component fixes that at the root:
 *   1. It never guesses the header height — the parent passes a
 *      measured `topOffset` (see the `useHeaderHeight` hook below),
 *      so the stack always starts *below* every header element.
 *   2. It never grows into the footer/controls — it is capped with
 *      `bottomOffset` and switches to an internal scrollbar
 *      (`overflow-y: auto`) once it would exceed that height.
 *   3. It only ever docks to the LEFT or RIGHT edge of the screen,
 *      never centered over the video / question panel.
 *   4. `pointer-events` are disabled on empty space around each card,
 *      so the invisible bounding box of the stack can never eat a
 *      click meant for something behind it.
 *   5. Fully responsive: on narrow (tablet/mobile) viewports the
 *      stack becomes a bottom-anchored, full-width tray that still
 *      never covers the header controls or the primary action button.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ProctoringAlerts.css';

/**
 * Measures the rendered height of a header/toolbar element and keeps it
 * updated across resizes, orientation changes, and content changes
 * (e.g. an error banner appearing/disappearing inside the header).
 * Returns a ref to attach to the header wrapper + the live height in px.
 */
export function useHeaderHeight(fallback = 64) {
  const ref = useRef(null);
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => setHeight(el.getBoundingClientRect().height);
    measure();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return [ref, height];
}

/** Normalizes the many severity/type vocabularies used across the app
 *  (CRITICAL/HIGH/MEDIUM/LOW, warning/error/info) into one visual tier. */
function normalizeLevel(alert) {
  const raw = String(alert.level ?? alert.severity ?? alert.type ?? 'info').toUpperCase();
  if (raw === 'CRITICAL' || raw === 'ERROR' || raw === 'HIGH') return 'critical';
  if (raw === 'MEDIUM' || raw === 'WARNING' || raw === 'WARN') return 'warning';
  return 'info';
}

const LEVEL_META = {
  critical: { icon: '🚨' },
  warning: { icon: '⚠️' },
  info: { icon: 'ℹ️' },
};

/**
 * @param {Object[]} alerts        - [{ id, message, level|severity|type, timestamp? }]
 * @param {Function} [onDismiss]   - (id) => void. Omit to render non-dismissible alerts.
 * @param {'left'|'right'} [side]  - which edge of the screen to dock to. Default 'right'.
 * @param {number} [topOffset]     - px to keep clear at the top (measured header height).
 * @param {number} [bottomOffset]  - px to keep clear at the bottom (footer/controls height).
 * @param {{icon?:string, label:string}} [summary] - optional pill shown above the list,
 *        e.g. a running "N violations flagged" counter.
 * @param {string} [ariaLabel]
 * @param {number} [maxVisible]    - hard cap on rendered cards (defensive; list still scrolls
 *        within that cap). Omit for "show everything, just scroll".
 */
function ProctoringAlerts({
  alerts = [],
  onDismiss,
  side = 'right',
  topOffset = 76,
  bottomOffset = 96,
  summary,
  ariaLabel = 'Proctoring alerts',
  maxVisible,
}) {
  const visible = maxVisible ? alerts.slice(0, maxVisible) : alerts;
  if (visible.length === 0 && !summary) return null;

  return (
    <div
      className={`proctoring-alerts proctoring-alerts--${side}`}
      role="region"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-atomic="false"
      style={{
        '--pa-top': `${topOffset}px`,
        '--pa-bottom': `${bottomOffset}px`,
      }}
    >
      {summary && (
        <div className="proctoring-alerts__summary">
          {summary.icon && <span aria-hidden="true">{summary.icon}</span>}
          <span>{summary.label}</span>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="proctoring-alerts__list">
          {visible.map((a) => {
            const level = normalizeLevel(a);
            const meta = LEVEL_META[level];
            return (
              <li
                key={a.id}
                role="alert"
                className={`proctoring-alerts__item proctoring-alerts__item--${level}`}
              >
                <span className="proctoring-alerts__icon" aria-hidden="true">{meta.icon}</span>
                <span className="proctoring-alerts__message">{a.message}</span>
                {onDismiss && (
                  <button
                    type="button"
                    className="proctoring-alerts__dismiss"
                    onClick={() => onDismiss(a.id)}
                    aria-label="Dismiss warning"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ProctoringAlerts;