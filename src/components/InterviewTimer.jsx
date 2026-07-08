/**
 * InterviewTimer.jsx
 * Counts up from 00:00 while `running` is true.
 * `startOffset` (seconds) lets you resume from a server-provided elapsed time.
 */

import React, { useState, useEffect, useRef } from 'react';

function InterviewTimer({ running = false, startOffset = 0, className = '' }) {
  const [elapsed, setElapsed] = useState(startOffset);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now() - startOffset * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  const formatted =
    h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <span className={`interview-timer ${className}`} aria-live="off">
      {formatted}
    </span>
  );
}

export default InterviewTimer;
