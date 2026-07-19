import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInterview } from '../context/Interviewcontext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition ';
import useCamera from '../hooks/useCamera';

/**
 * AnswerInputArea Component
 * Handles candidate response input via text or voice
 * Features: Auto-save, voice transcription, real-time word count,
 *           camera preview toggle, submit functionality
 */
const AnswerInputArea = ({
  onSubmit,
  maxLength = 2000,
  enableVoiceInput = true,
  autoSaveInterval = 3000,
  disabled = false,
}) => {
  const { state, updateCurrentAnswer, setAIListening } = useInterview();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [lastSaveTime,  setLastSaveTime]  = useState(null);
  const [cameraOpen,    setCameraOpen]    = useState(false);

  const videoRef = useRef(null);

  const { transcript, interimTranscript, isListening, startListening, stopListening } =
    useSpeechRecognition();

  const {
    stream,
    cameraOn,
    permissionError,
    isStarting,
    startCamera,
    stopCamera,
    toggleCamera,
  } = useCamera();

  // ── Attach stream to video element ──────────────────────────────
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ── Clean up camera on unmount ───────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  // ── Sync voice transcript to answer ─────────────────────────────
  useEffect(() => {
    if (transcript) {
      const combined = (state.currentAnswer + ' ' + transcript).trim();
      if (combined.length <= maxLength) updateCurrentAnswer(combined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // ── Auto-save ────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.currentAnswer || !state.currentQuestion) return;
    const timeout = setTimeout(() => {
      setIsSaving(true);
      setTimeout(() => { setIsSaving(false); setLastSaveTime(new Date()); }, 300);
    }, autoSaveInterval);
    return () => clearTimeout(timeout);
  }, [state.currentAnswer, state.currentQuestion, autoSaveInterval]);

  // ── Camera toggle ─────────────────────────────────────────────────
  const handleToggleCamera = useCallback(async () => {
    if (cameraOpen) {
      // Close: stop stream and hide preview
      stopCamera();
      setCameraOpen(false);
    } else {
      // Open: request camera access and show preview
      setCameraOpen(true);
      await startCamera({ video: true, audio: false });
    }
  }, [cameraOpen, startCamera, stopCamera]);

  // ── Voice toggle ──────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(async () => {
    if (isVoiceActive) {
      stopListening();
      setAIListening(false);
      setIsVoiceActive(false);
    } else {
      try {
        startListening();
        setAIListening(true);
        setIsVoiceActive(true);
      } catch (error) {
        console.error('Error starting voice input:', error);
        setIsVoiceActive(false);
      }
    }
  }, [isVoiceActive, startListening, stopListening, setAIListening]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxLength) updateCurrentAnswer(text);
  };

  const handleSubmit = useCallback(() => {
    if (!state.currentAnswer.trim()) {
      alert('Please provide an answer before submitting.');
      return;
    }
    onSubmit?.(state.currentAnswer);
  }, [state.currentAnswer, onSubmit]);

  const handleClear = useCallback(() => {
    if (state.currentAnswer && window.confirm('Clear your answer?')) {
      updateCurrentAnswer('');
    }
  }, [state.currentAnswer, updateCurrentAnswer]);

  const wordCount = state.currentAnswer.trim().split(/\s+/).filter(Boolean).length;
  const charCount = state.currentAnswer.length;
  const hasContent = state.currentAnswer.trim().length > 0;

  return (
    <div className="answer-input-area">

      {/* ── Camera preview (shown when cameraOpen) ──────────────── */}
      {cameraOpen && (
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: '180px',
          background: '#07080f',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1.5px solid rgba(99,102,241,0.35)',
        }}>
          {/* Video feed */}
          {stream && cameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // mirror
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 8, color: 'rgba(240,240,248,0.35)', fontSize: 13,
            }}>
              {isStarting ? (
                <>
                  <span style={{ fontSize: 24 }}>📹</span>
                  <span>Starting camera…</span>
                </>
              ) : permissionError ? (
                <>
                  <span style={{ fontSize: 24 }}>🚫</span>
                  <span style={{ color: '#fca5a5', textAlign: 'center', padding: '0 12px' }}>
                    {permissionError}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 24 }}>📷</span>
                  <span>Camera off</span>
                </>
              )}
            </div>
          )}

          {/* Camera-on/off toggle inside preview */}
          {stream && (
            <button
              onClick={toggleCamera}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              style={{
                position: 'absolute',
                bottom: 8, right: 8,
                background: cameraOn
                  ? 'rgba(99,102,241,0.75)'
                  : 'rgba(239,68,68,0.75)',
                border: 'none',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              {cameraOn ? '📹 On' : '🚫 Off'}
            </button>
          )}

          {/* "You" label */}
          {stream && cameraOn && (
            <div style={{
              position: 'absolute',
              bottom: 8, left: 10,
              background: 'rgba(13,14,26,0.7)',
              borderRadius: 6, padding: '2px 8px',
              fontSize: 11, color: 'rgba(240,240,248,0.8)',
            }}>
              You
            </div>
          )}
        </div>
      )}

      {/* ── Text input ───────────────────────────────────────────── */}
      <div className="input-field-wrapper">
        <textarea
          className="answer-input"
          value={state.currentAnswer + (interimTranscript ? ` ${interimTranscript}` : '')}
          onChange={handleInputChange}
          placeholder={
            enableVoiceInput
              ? 'Type your answer or use the microphone to speak...'
              : 'Type your answer here...'
          }
          maxLength={maxLength}
          rows={3}
          disabled={state.loading || disabled}
          aria-label="Answer input"
        />

        <div className="input-meta">
          <div className="input-count">
            <span>{charCount}</span>
            <span style={{ opacity: 0.5, marginLeft: '4px' }}>/ {maxLength}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: '#8b92b3' }}>
            {wordCount > 0 && <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>}
            {isSaving && <span style={{ color: '#a5b4fc' }}>Saving...</span>}
            {lastSaveTime && !isSaving && (
              <span>Saved {Math.floor((Date.now() - lastSaveTime) / 1000)}s ago</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Control buttons ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Microphone button */}
        {enableVoiceInput && (
          <button
            className={`btn-icon ${isVoiceActive ? 'listening' : ''}`}
            onClick={toggleVoiceInput}
            disabled={state.loading || disabled}
            title={isVoiceActive ? 'Stop recording' : 'Start voice input'}
            aria-pressed={isVoiceActive}
            aria-label="Toggle voice input"
          >
            {isVoiceActive ? '⏹' : '🎤'}
          </button>
        )}

        {/* ✅ Camera button — right next to microphone */}
        <button
          className={`btn-icon ${cameraOpen ? 'camera-active' : ''}`}
          onClick={handleToggleCamera}
          disabled={state.loading || disabled}
          title={cameraOpen ? 'Close camera' : 'Open camera'}
          aria-pressed={cameraOpen}
          aria-label="Toggle camera"
          style={cameraOpen ? {
            background: 'rgba(99,102,241,0.15)',
            borderColor: 'rgba(99,102,241,0.5)',
            color: '#a5b4fc',
          } : {}}
        >
          {cameraOpen ? '📹' : '📷'}
        </button>

        {/* Clear button */}
        {hasContent && (
          <button
            className="btn-icon"
            onClick={handleClear}
            disabled={state.loading || disabled}
            title="Clear answer"
            aria-label="Clear answer"
            style={{
              background: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.3)',
              color: '#f87171',
            }}
          >
            🗑
          </button>
        )}

        {/* Submit button — always saves the current answer and advances.
            The final "Submit Interview" action is a separate, dedicated
            button shown by the parent once all questions are answered. */}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!hasContent || state.loading || disabled}
          style={{ marginLeft: 'auto', opacity: !hasContent || state.loading || disabled ? 0.5 : 1 }}
        >
          {(state.loading || disabled) ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>

      {/* Voice feedback bar */}
      {isVoiceActive && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(34,211,238,0.05)',
          border: '1px solid rgba(34,211,238,0.2)',
          borderRadius: 6, fontSize: 12, color: '#22d3ee',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>🎙</span>
          <span>{isListening ? 'Listening...' : 'Recording paused'}</span>
        </div>
      )}
    </div>
  );
};

export default AnswerInputArea;