import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useInterview } from '../context/Interviewcontext';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis ';
import { useFullscreen } from './UseFullscreen';
import { useAIInterviewBroadcast } from '../hooks/useAIInterviewBroadcast';
import useProctoring from '../hooks/useProctoring';
import stompService from '../services/stompService';
import AIAvatar from './Aiavatar';
import TimerBar from './TimerBar';
import ProgressTracker from './Progresstracker';
import { AIMessage, CandidateMessage, TypingIndicator } from './MessageBubbles';
import AnswerInputArea from './AnswerInputArea ';
import LiveBroadcastBadge from '../components/LiveBroadcastBadge';
import "./Interview.css";

/**
 * AIInterview Page Component
 *
 * KEY FIXES:
 * 1. state.aiError (non-fatal) → shown as a dismissible banner, not an error screen.
 * 2. Answer submission failures (AI) → toast banner, interview continues.
 * 3. nextQuestion() returning null → completeInterview() called (not an error).
 * 4. Empty/null AI response → fallback text, never crashes.
 * 5. handleSubmitAnswer error handling distinguishes AI errors from real failures.
 */
const AIInterview = ({ applicationId }) => {
  const {
    state,
    initializeSession,
    submitAnswer,
    evaluateAnswer,
    nextQuestion,
    completeInterview,
    setAISpeaking,
    setAIThinking,
    setAIListening,
    clearAIError,
  } = useInterview();

  const { speak, stop, isSupported: speechSupported } = useSpeechSynthesis();
  const { elementRef: fullscreenRef, toggleFullscreen } = useFullscreen();

  // ── Live Broadcasting for AI Interview ───────────────────────────────────
  // Automatically streams the candidate's webcam to the recruiter for the
  // duration of the interview. The backend already creates/ends the
  // broadcast session around /start and /complete — this hook just handles
  // the WebRTC/STOMP side on the candidate's browser. Purely background:
  // no UI besides the small status badge rendered below.
  const {
    status: broadcastStatus,
    stop: stopBroadcast,
    stream: broadcastStream,
    sessionToken: broadcastSessionToken,
  } = useAIInterviewBroadcast({
    applicationId,
    active: state.status === 'IN_PROGRESS',
  });

  useEffect(() => {
    if (state.status === 'COMPLETED') {
      stopBroadcast();
    }
  }, [state.status, stopBroadcast]);

  // ── NEW: AI Interview Monitoring (phone / face / noise / tab-switch) ────
  // Runs against the SAME local stream already captured for the broadcast
  // above — no extra camera/mic prompt. Only active once the broadcast is
  // actually live, matching the manual live-interview room's behavior.
  const [proctorAlerts, setProctorAlerts] = useState([]);

  const handleProctorViolation = useCallback((type, severity, message, metadata) => {
    setProctorAlerts(prev => [{ message, severity, ts: Date.now() }, ...prev].slice(0, 3));

    if (stompService.isConnected && broadcastSessionToken) {
      stompService.sendViolation(broadcastSessionToken, type, severity, message, JSON.stringify(metadata ?? {}));
    }
  }, [broadcastSessionToken]);

  useProctoring({
    stream: broadcastStream,
    enabled: broadcastStatus === 'live',
    cameraOn: true,
    micOn: true,
    onViolation: handleProctorViolation,
  });

  const [messages,     setMessages]     = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef(null);

  // Helper: extract question text regardless of which field the backend uses
  const getQuestionText = (q) =>
    q?.questionText || q?.text || q?.question || '';

  // ── speakQuestion ─────────────────────────────────────────────────────────
  const speakQuestion = useCallback(
    async (question) => {
      const questionText = getQuestionText(question);
      if (!questionText) return;

      if (!voiceEnabled || !speechSupported) {
        setMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: 'ai', text: questionText, timestamp: Date.now(), isNew: true },
        ]);
        return;
      }

      try {
        setAISpeaking(true);
        await speak(questionText, {
          rate:    0.95,
          pitch:   1,
          volume:  1,
          onStart: () => {
            setMessages((prev) => [
              ...prev,
              { id: `ai-${Date.now()}`, role: 'ai', text: questionText, timestamp: Date.now(), isNew: true },
            ]);
          },
          onEnd:   () => setAISpeaking(false),
        });
      } catch (err) {
        console.error('Speech error:', err);
        setAISpeaking(false);
        setMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: 'ai', text: questionText, timestamp: Date.now(), isNew: false },
        ]);
      }
    },
    [voiceEnabled, speechSupported, speak, setAISpeaking]
  );

  // ── Initialize once on mount ────────────────────────────────────────────
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!applicationId) {
      console.error('AIInterview: applicationId prop is missing');
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        await initializeSession(applicationId);
      } catch (err) {
        console.error('Failed to initialize interview:', err);
        // Don't alert here — the context sets state.error for fatal errors,
        // and state.aiError for non-fatal ones. Both are shown in the render below.
        initializedRef.current = false; // allow retry
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // ── Speak first question once session is ready ──────────────────────────
  const lastSpokenIdRef = useRef(null);
  useEffect(() => {
    if (
      state.currentQuestion &&
      state.currentQuestion.id !== lastSpokenIdRef.current
    ) {
      lastSpokenIdRef.current = state.currentQuestion.id;
      speakQuestion(state.currentQuestion);
    }
  }, [state.currentQuestion, speakQuestion]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Submit answer ────────────────────────────────────────────────────────
  //
  // FIX (perceived speed): this used to (a) await the full text-to-speech
  // playback of the feedback message, THEN (b) wait a hard-coded 2000ms,
  // before even asking the backend for the next question — on top of the
  // AI evaluation that used to block the backend response too. TTS now
  // fires without being awaited, and the next question is fetched right
  // after the feedback message is queued, not after a fixed delay.
  //
  // FIX (button flow): previously, reaching the last question just made the
  // single Submit button relabel itself "Submit Interview" and, once
  // clicked, the interview auto-completed in the same action as saving the
  // answer — there wasn't really a second, distinct step. Now: clicking
  // Submit Answer on question 10 only saves that answer (same as every
  // other question). When nextQuestion() comes back empty (no more
  // questions left), we stop and flip awaitingFinalSubmit to true, which
  // swaps the input area out for a dedicated "Submit Interview" button
  // (handleSubmitInterview below) — a real, separate second action.
  const [awaitingFinalSubmit, setAwaitingFinalSubmit] = useState(false);

  const handleSubmitAnswer = useCallback(
    async (answerText) => {
      if (!state.currentQuestion || isSubmitting) return;

      // Guard against blank submissions
      if (!answerText?.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id:        `warn-${Date.now()}`,
            role:      'ai',
            text:      "Please provide an answer before continuing.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setIsSubmitting(true);
      const duration = Math.floor(
        (Date.now() - (state.currentQuestion.askedAt
          ? new Date(state.currentQuestion.askedAt).getTime()
          : Date.now())) / 1000
      );

      try {
        // 1. Show candidate message
        setMessages((prev) => [
          ...prev,
          { id: `candidate-${Date.now()}`, role: 'candidate', text: answerText, timestamp: Date.now(), duration },
        ]);

        // 2. Show thinking indicator
        setAIThinking(true);
        const thinkingId = `thinking-${Date.now()}`;
        setMessages((prev) => [...prev, { id: thinkingId, role: 'ai', variant: 'loading' }]);

        // 3. Submit to backend. AI scoring now runs in the background on the
        // server, so this resolves as soon as the answer is saved — it no
        // longer waits on a live AI call.
        const result = await submitAnswer(answerText, { duration });

        // 4. Get feedback — use AI result or a friendly default. (Scores are
        // computed asynchronously now, so this will usually be the default
        // on the first render and that's expected/fine.)
        const feedbackText =
          result?.evaluationFeedback ||
          'Thank you for your answer. Moving on to the next question.';

        // 5. Remove thinking indicator, show feedback immediately
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          { id: `feedback-${Date.now()}`, role: 'ai', text: feedbackText, timestamp: Date.now() },
        ]);
        setAIThinking(false);
        setIsSubmitting(false);

        // 6. Speak the feedback WITHOUT blocking progress — fire and forget.
        if (voiceEnabled && speechSupported) {
          setAISpeaking(true);
          speak(feedbackText, {
            rate:  0.95,
            onEnd: () => setAISpeaking(false),
          }).catch((err) => {
            console.error('Speech error:', err);
            setAISpeaking(false);
          });
        }

        // 7. Advance right away — no artificial delay. Questions 2-10 are
        // already cached locally from session start, so this is instant;
        // it only hits the network on genuine reconnect/follow-up cases.
        try {
          const nextQ = await nextQuestion();
          if (nextQ) {
            setMessages((prev) => [
              ...prev,
              {
                id:        `transition-${Date.now()}`,
                role:      'ai',
                text:      "Let's move on to the next question.",
                timestamp: Date.now(),
              },
            ]);
          } else {
            // No more questions left — this was the 10th answer. Don't
            // auto-complete; wait for the candidate to explicitly click
            // "Submit Interview" (handleSubmitInterview).
            setAwaitingFinalSubmit(true);
            setMessages((prev) => [
              ...prev,
              {
                id:        `allanswered-${Date.now()}`,
                role:      'ai',
                text:      "That's the last question — thank you! Click \"Submit Interview\" below when you're ready to finish.",
                timestamp: Date.now(),
              },
            ]);
          }
        } catch (nextErr) {
          console.error('Error advancing to next question:', nextErr);
          setMessages((prev) => [
            ...prev,
            {
              id:        `nexterr-${Date.now()}`,
              role:      'ai',
              text:      'There was a temporary issue loading the next question. Please try submitting again or refresh the page.',
              timestamp: Date.now(),
            },
          ]);
        }

      } catch (err) {
        console.error('Error submitting answer:', err);
        // Remove thinking indicator
        setMessages((prev) => prev.filter((m) => !m.id?.startsWith('thinking-')));
        // Show a user-friendly error message in the chat instead of an alert
        const userMsg = err.isAIError
          ? 'AI service is temporarily unavailable. Please wait a moment and try again.'
          : (err.message || 'There was an error submitting your answer. Please try again.');
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'ai', text: `⚠️ ${userMsg}`, timestamp: Date.now() },
        ]);
        setAIThinking(false);
        setIsSubmitting(false);
      }
    },
    [
      state.currentQuestion,
      isSubmitting,
      submitAnswer,
      nextQuestion,
      speakQuestion,
      voiceEnabled,
      speechSupported,
      speak,
      setAISpeaking,
      setAIThinking,
    ]
  );

  // ── Submit interview (separate, explicit second action) ─────────────────
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const handleSubmitInterview = useCallback(async () => {
    if (isCompletingInterview) return;
    setIsCompletingInterview(true);
    try {
      setMessages((prev) => [
        ...prev,
        {
          id:        `complete-${Date.now()}`,
          role:      'ai',
          text:      'Thank you for completing this interview! Your responses have been recorded and will be reviewed.',
          timestamp: Date.now(),
        },
      ]);
      // Idempotent on the backend — safe even though the last answer may
      // have already auto-completed the session server-side.
      await completeInterview();
    } catch (completeErr) {
      // completeInterview() already surfaces a meaningful message via
      // state.aiError (shown on the "Interview Complete" screen), so
      // just log here — no need to duplicate the message in chat.
      console.error('Error finalizing interview submission:', completeErr);
    } finally {
      setIsCompletingInterview(false);
    }
  }, [isCompletingInterview, completeInterview]);

  // ── Exit handler ─────────────────────────────────────────────────────────
  const handleExit = useCallback(() => {
    if (window.confirm('Are you sure you want to exit? Your progress will be saved.')) {
      stop();
      stopBroadcast();
      completeInterview().catch((err) => {
        // Non-blocking: the candidate is leaving either way; just log it.
        console.warn('Error completing interview on exit:', err?.message);
      });
      window.location.href = '/jobseeker/applications';
    }
  }, [stop, stopBroadcast, completeInterview]);

  // ── Loading / waiting screen ─────────────────────────────────────────────
  if (state.status === 'INITIALIZING' || (!state.currentQuestion && state.status !== 'COMPLETED')) {
    const isError = !!state.error;
    return (
      <div className="interview-container" style={{ height: '100vh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', flexDirection: 'column', gap: '24px',
        }}>
          <div style={{ fontSize: '48px', animation: isError ? 'none' : 'pulse 1.5s ease-in-out infinite' }}>
            {isError ? '⚠️' : '🤖'}
          </div>
          <div style={{ textAlign: 'center', maxWidth: '480px', padding: '0 20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              {isError ? 'Interview Unavailable' : 'Initializing Interview'}
            </h2>
            <p style={{ margin: '0 0 16px', opacity: 0.7, fontSize: '14px', lineHeight: '1.6' }}>
              {isError
                ? state.error
                : 'Preparing your personalized interview experience…'}
            </p>
            {/* Non-fatal AI error during init */}
            {!isError && state.aiError && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: '8px', padding: '12px 16px',
                color: '#fbbf24', fontSize: '13px', marginBottom: '12px',
              }}>
                ⚠️ {state.aiError}
              </div>
            )}
            {isError && (
              <button
                onClick={() => window.location.href = '/jobseeker/applications'}
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  color: '#818cf8', borderRadius: '8px',
                  padding: '8px 20px', cursor: 'pointer', fontSize: '14px',
                }}
              >
                ← Back to Applications
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Completed screen ─────────────────────────────────────────────────────
  if (state.status === 'COMPLETED') {
    return (
      <div className="interview-container" style={{ height: '100vh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', flexDirection: 'column', gap: '24px',
        }}>
          <div style={{ fontSize: '64px' }}>🎉</div>
          <div style={{ textAlign: 'center', maxWidth: '480px', padding: '0 20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Interview Complete!</h2>
            <p style={{ margin: '0 0 16px', opacity: 0.7, fontSize: '15px', lineHeight: '1.6' }}>
              Thank you for completing the interview. Your responses have been recorded and
              will be reviewed by the hiring team.
            </p>
            {state.aiError && (
              <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '16px' }}>
                ⚠️ {state.aiError}
              </p>
            )}
            <button
              onClick={() => window.location.href = '/jobseeker/applications'}
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.4)',
                color: '#818cf8', borderRadius: '8px',
                padding: '10px 24px', cursor: 'pointer', fontSize: '14px',
              }}
            >
              ← Back to Applications
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main interview UI ────────────────────────────────────────────────────
  return (
    <div
      className="interview-container"
      ref={fullscreenRef}
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <LiveBroadcastBadge status={broadcastStatus} />

      {proctorAlerts.length > 0 && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proctorAlerts.map(a => (
            <div key={a.ts} style={{
              background: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${a.severity === 'CRITICAL' || a.severity === 'HIGH' ? '#fecaca' : '#fde68a'}`,
              color: '#1a1a1a',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              maxWidth: 300,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              {a.message}
            </div>
          ))}
        </div>
      )}
      <TimerBar
        onFullscreenToggle={toggleFullscreen}
        onVoiceToggle={setVoiceEnabled}
        onExit={handleExit}
        maxDuration={1800}
      />

      {/* Non-fatal AI error banner */}
      {state.aiError && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border:     '1px solid rgba(245,158,11,0.3)',
          borderRadius: 0, padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '13px', color: '#fbbf24',
        }}>
          <span>⚠️ {state.aiError}</span>
          <button
            onClick={clearAIError}
            style={{
              background: 'transparent', border: 'none', color: '#fbbf24',
              cursor: 'pointer', fontSize: '16px', padding: '0 4px',
            }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '20px', padding: '20px',
        overflow: 'hidden', minWidth: 0,
      }}>
        {/* Left — Avatar + Progress */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '24px',
          overflow: 'hidden', padding: '20px',
          background: 'rgba(13, 14, 26, 0.3)',
          borderRadius: '16px',
          border: '1px solid rgba(99, 102, 241, 0.1)',
          minWidth: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AIAvatar size="md" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <ProgressTracker />
          </div>
        </div>

        {/* Right — Chat + Input */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '16px',
          overflow: 'hidden', padding: '20px',
          background: 'rgba(13, 14, 26, 0.3)',
          borderRadius: '16px',
          border: '1px solid rgba(99, 102, 241, 0.1)',
          minWidth: 0,
        }}>
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messages.map((msg) => {
              if (msg.role === 'ai') {
                if (msg.variant === 'loading') return <TypingIndicator key={msg.id} />;
                return (
                  <AIMessage
                    key={msg.id}
                    text={msg.text}
                    isNew={msg.isNew}
                    hasTypingAnimation={msg.isNew}
                  />
                );
              }
              if (msg.role === 'candidate') {
                return (
                  <CandidateMessage
                    key={msg.id}
                    text={msg.text}
                    timestamp={msg.timestamp}
                    duration={msg.duration}
                  />
                );
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </div>

          {awaitingFinalSubmit ? (
            /* ── Dedicated, separate "Submit Interview" step ──────────────
               A real second button, distinct from "Submit Answer" above —
               not the same button relabeled. Shown only after the 10th
               answer has been saved. */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '12px', padding: '20px',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px',
            }}>
              <span style={{ fontSize: '13px', color: 'rgba(240,240,248,0.75)', textAlign: 'center' }}>
                You've answered all {state.questions.length || 10} questions.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleSubmitInterview}
                disabled={isCompletingInterview}
                style={{
                  background: '#10b981', borderColor: '#10b981',
                  padding: '10px 28px', fontSize: '14px',
                  opacity: isCompletingInterview ? 0.6 : 1,
                }}
              >
                {isCompletingInterview ? 'Submitting Interview...' : 'Submit Interview'}
              </button>
            </div>
          ) : (
            <AnswerInputArea
              onSubmit={handleSubmitAnswer}
              enableVoiceInput={voiceEnabled}
              maxLength={2000}
              disabled={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInterview;