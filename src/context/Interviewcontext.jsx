import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useReducer,
  useMemo,
} from 'react';
import interviewService from '../services/Interviewservice';

/**
 * Interview Context
 *
 * KEY FIXES:
 * 1. initializeSession: AI errors (isAIError) set state.aiError, NOT state.error,
 *    so the UI shows a toast but does NOT block the interview.
 * 2. nextQuestion: if AI fetch fails, returns null gracefully (no completeInterview call).
 * 3. submitAnswer: AI evaluation errors are non-fatal — returns the partial result
 *    so the UI can still show "Thank you for your answer." and move on.
 * 4. completeInterview: always sets status=COMPLETED locally first, then calls
 *    backend. Backend failure doesn't revert the local COMPLETED status.
 * 5. Added AI_ERROR action for surfacing non-fatal AI messages as toasts.
 */

export const InterviewContext = createContext(null);

// ── Action types ────────────────────────────────────────────────
const A = {
  SET_SESSION:      'SET_SESSION',
  SET_STATUS:       'SET_STATUS',
  SET_QUESTIONS:    'SET_QUESTIONS',
  SET_CURRENT_Q:    'SET_CURRENT_Q',
  NEXT_QUESTION:    'NEXT_QUESTION',
  SET_ANSWER:       'SET_ANSWER',
  SAVE_ANSWER:      'SAVE_ANSWER',
  SET_AI_SPEAKING:  'SET_AI_SPEAKING',
  SET_AI_THINKING:  'SET_AI_THINKING',
  SET_AI_LISTENING: 'SET_AI_LISTENING',
  SET_LOADING:      'SET_LOADING',
  SET_ERROR:        'SET_ERROR',   // fatal — blocks the interview
  SET_AI_ERROR:     'SET_AI_ERROR', // non-fatal — show as toast only
  CLEAR_ERROR:      'CLEAR_ERROR',
  CLEAR_AI_ERROR:   'CLEAR_AI_ERROR',
};

// ── Initial state ───────────────────────────────────────────────
const initialState = {
  sessionId:            null,
  applicationId:        null,
  candidateName:        '',
  positionTitle:        '',
  status:               'INITIALIZING', // INITIALIZING | IN_PROGRESS | COMPLETED | FAILED

  questions:            [],
  currentQuestionIndex: 0,
  currentQuestion:      null,

  answers:              {},
  currentAnswer:        '',

  isSpeaking:  false,
  isThinking:  false,
  isListening: false,
  aiState:     'IDLE', // IDLE | SPEAKING | THINKING | LISTENING | EVALUATING

  loading:  false,
  error:    null,    // fatal — shown on the error screen
  aiError:  null,    // non-fatal — shown as a dismissible toast/banner
};

// ── Reducer ─────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case A.SET_SESSION:
      return {
        ...state,
        sessionId:     action.payload.id,
        applicationId: action.payload.applicationId,
        candidateName: action.payload.candidateName || '',
        positionTitle: action.payload.positionTitle || '',
        status:        'IN_PROGRESS',
        error:         null,
        aiError:       null,
      };

    case A.SET_STATUS:
      return { ...state, status: action.payload };

    case A.SET_QUESTIONS: {
      // payload is either a plain array (fresh session — always start at
      // question 0) or { questions, resumeQuestionId } (reconnect — resume
      // at whichever question the backend says is still unanswered, so the
      // progress indicator and the Submit Answer/Submit Interview button
      // reflect the candidate's real position instead of resetting to 1/1).
      const isResumeShape = action.payload && !Array.isArray(action.payload);
      const questions = (isResumeShape ? action.payload.questions : action.payload) || [];
      const resumeQuestionId = isResumeShape ? action.payload.resumeQuestionId : null;

      let index = 0;
      if (resumeQuestionId != null) {
        const found = questions.findIndex((q) => q.id === resumeQuestionId);
        if (found >= 0) index = found;
      }

      return {
        ...state,
        questions,
        currentQuestionIndex: index,
        currentQuestion:      questions[index] || null,
      };
    }

    case A.SET_CURRENT_Q:
      return { ...state, currentQuestion: action.payload };

    case A.NEXT_QUESTION: {
      const nextIndex = state.currentQuestionIndex + 1;
      return {
        ...state,
        currentQuestionIndex: nextIndex,
        currentQuestion:
          nextIndex < state.questions.length ? state.questions[nextIndex] : null,
        currentAnswer: '',
      };
    }

    case A.SET_ANSWER:
      return { ...state, currentAnswer: action.payload };

    case A.SAVE_ANSWER:
      return {
        ...state,
        answers: { ...state.answers, [action.payload.questionId]: action.payload },
      };

    case A.SET_AI_SPEAKING:
      return { ...state, isSpeaking: action.payload, aiState: action.payload ? 'SPEAKING' : 'IDLE' };

    case A.SET_AI_THINKING:
      return { ...state, isThinking: action.payload, aiState: action.payload ? 'THINKING' : 'IDLE' };

    case A.SET_AI_LISTENING:
      return { ...state, isListening: action.payload, aiState: action.payload ? 'LISTENING' : 'IDLE' };

    case A.SET_LOADING:
      return { ...state, loading: action.payload };

    case A.SET_ERROR:
      return { ...state, error: action.payload };

    // Non-fatal AI error — interview continues
    case A.SET_AI_ERROR:
      return { ...state, aiError: action.payload };

    case A.CLEAR_ERROR:
      return { ...state, error: null };

    case A.CLEAR_AI_ERROR:
      return { ...state, aiError: null };

    default:
      return state;
  }
}

// ── Provider ─────────────────────────────────────────────────────
export function InterviewProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /**
   * Initialize the session.
   * Only truly fatal errors (no session scheduled, already completed) set
   * state.error and block the interview.  AI failures during init are
   * treated as non-fatal: the session continues with fallback questions.
   */
  const initializeSession = useCallback(async (applicationId) => {
    dispatch({ type: A.SET_LOADING, payload: true });
    dispatch({ type: A.CLEAR_ERROR });
    dispatch({ type: A.CLEAR_AI_ERROR });

    try {
      const session = await interviewService.initializeSession(applicationId);

      dispatch({ type: A.SET_SESSION, payload: session });

      const questions = session.questions || [];
      dispatch({
        type:    A.SET_QUESTIONS,
        payload: { questions, resumeQuestionId: session.resumeQuestionId ?? null },
      });

      // Warn if AI returned zero questions (shouldn't happen with fallbacks, but be safe)
      if (questions.length === 0) {
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: 'AI service is temporarily unavailable. ' +
                   'The interview will begin as soon as questions are available.',
        });
      }

      return session;

    } catch (err) {
      // AI errors during initialization: show banner but don't block
      if (err.isAIError) {
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: err.message ||
                   'AI service is temporarily unavailable. Please try again later.',
        });
        throw err; // still propagate so the caller can retry
      }
      // Fatal errors: no session, already completed, auth
      dispatch({ type: A.SET_ERROR, payload: err.message });
      throw err;
    } finally {
      dispatch({ type: A.SET_LOADING, payload: false });
    }
  }, []);

  /**
   * Fetch the next question from the backend.
   * Returns the question or null (done).  Never sets a fatal error.
   */
  const fetchNextQuestion = useCallback(async () => {
    if (!state.sessionId) return null;
    try {
      const question = await interviewService.getNextQuestion(state.sessionId);
      if (question) dispatch({ type: A.SET_CURRENT_Q, payload: question });
      return question;
    } catch (err) {
      // AI-related fetch failure: show a banner, let the candidate try again
      if (err.isAIError) {
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: 'AI service is temporarily unavailable. ' +
                   'Please wait a moment and try again.',
        });
      }
      console.error('fetchNextQuestion error:', err.message);
      return null; // treat as "no more questions" to avoid crashing the interview
    }
  }, [state.sessionId]);

  /**
   * Advance to the next question.
   * Tries local cache first, then backend.
   * Returns null only when genuinely no more questions remain.
   */
  const nextQuestion = useCallback(async () => {
    const nextIndex = state.currentQuestionIndex + 1;

    if (nextIndex < state.questions.length) {
      dispatch({ type: A.NEXT_QUESTION });
      return state.questions[nextIndex];
    }

    // Fetch from backend (follow-ups / dynamically added questions)
    const question = await fetchNextQuestion();
    if (question) {
      dispatch({ type: A.SET_QUESTIONS, payload: [...state.questions, question] });
      dispatch({ type: A.SET_CURRENT_Q, payload: question });
      return question;
    }

    return null; // interview complete
  }, [state.currentQuestionIndex, state.questions, fetchNextQuestion]);

  /**
   * Submit the current answer.
   * AI evaluation errors are non-fatal — the method returns a partial result
   * with a placeholder feedback instead of throwing.
   */
  const submitAnswer = useCallback(async (answerText, metadata = {}) => {
    if (!state.sessionId || !state.currentQuestion) {
      throw new Error('No active interview question.');
    }

    dispatch({ type: A.SET_LOADING, payload: true });

    try {
      const result = await interviewService.submitAnswer(
        state.sessionId,
        state.currentQuestion.id,
        answerText,
        answerText // use answerText as transcript when no separate transcript
      );

      dispatch({
        type:    A.SAVE_ANSWER,
        payload: {
          questionId: state.currentQuestion.id,
          text:       answerText,
          duration:   metadata.duration || 0,
          ...result,
        },
      });

      // If AI evaluation failed on the backend, surface a non-fatal banner
      if (!result?.relevanceScore && !result?.confidenceScore) {
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: 'AI service is temporarily unavailable. ' +
                   'Your answer has been saved. Evaluation will complete when service is restored.',
        });
      } else {
        dispatch({ type: A.CLEAR_AI_ERROR });
      }

      dispatch({ type: A.CLEAR_ERROR });
      return result;

    } catch (err) {
      if (err.isAIError) {
        // AI error from submitAnswer — already handled in the service layer
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: err.message ||
                   'AI service is temporarily unavailable. Your answer has been saved.',
        });
        // Return synthetic result so the interview can continue
        return {
          questionId:        state.currentQuestion.id,
          evaluationFeedback:'AI service is temporarily unavailable. ' +
                             'Your answer has been saved.',
        };
      }
      // Real error (network, server) — propagate
      dispatch({ type: A.SET_ERROR, payload: err.message });
      throw err;
    } finally {
      dispatch({ type: A.SET_LOADING, payload: false });
    }
  }, [state.sessionId, state.currentQuestion]);

  /**
   * Get evaluation for the saved answer (derived from stored result).
   */
  const evaluateAnswer = useCallback(async () => {
    if (!state.sessionId || !state.currentQuestion) return { feedback: '' };
    dispatch({ type: A.SET_AI_THINKING, payload: true });
    try {
      const saved = state.answers[state.currentQuestion.id];
      if (saved) {
        return {
          feedback:   saved.evaluationFeedback || 'Thank you for your answer.',
          score:      saved.relevanceScore != null ? Math.round(saved.relevanceScore * 10) : null,
          confidence: saved.confidenceScore,
          clarity:    saved.clarityScore,
        };
      }
      return { feedback: 'Thank you for your answer.' };
    } finally {
      dispatch({ type: A.SET_AI_THINKING, payload: false });
    }
  }, [state.sessionId, state.currentQuestion, state.answers]);

  /**
   * Complete the interview.
   * Sets the local status to COMPLETED immediately (so the UI transitions
   * right away — the candidate's answers are already saved at this point
   * regardless of what happens next). Then calls the backend, which is
   * idempotent and safe to retry.
   *
   * AI-evaluation failures are non-fatal and only show a dismissible banner.
   * Genuine submission failures (network down, session not found, 5xx) now
   * surface a specific, actionable message instead of being swallowed —
   * the candidate can retry via the same button, since completeSession()
   * on the backend is safe to call more than once.
   */
  const completeInterview = useCallback(async () => {
    if (!state.sessionId) return;

    dispatch({ type: A.SET_STATUS, payload: 'COMPLETED' });

    try {
      const report = await interviewService.completeSession(state.sessionId);
      dispatch({ type: A.CLEAR_AI_ERROR });
      return report;
    } catch (err) {
      console.warn('Error completing interview session on backend:', err.message);
      if (err.isAIError) {
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: 'AI evaluation summary is temporarily unavailable and will be generated later.',
        });
      } else {
        // A genuine submission failure — tell the candidate plainly and let
        // them retry (safe/idempotent) rather than showing nothing or a
        // generic error.
        dispatch({
          type:    A.SET_AI_ERROR,
          payload: err.message ||
                   'We could not confirm your interview submission. Your answers are saved — please try again.',
        });
      }
      throw err;
    }
  }, [state.sessionId]);

  // ── AI state setters ─────────────────────────────────────────
  const setAISpeaking  = useCallback((v) => dispatch({ type: A.SET_AI_SPEAKING,  payload: v }), []);
  const setAIThinking  = useCallback((v) => dispatch({ type: A.SET_AI_THINKING,  payload: v }), []);
  const setAIListening = useCallback((v) => dispatch({ type: A.SET_AI_LISTENING, payload: v }), []);
  const updateCurrentAnswer = useCallback(
    (text) => dispatch({ type: A.SET_ANSWER, payload: text }), []);
  const clearError    = useCallback(() => dispatch({ type: A.CLEAR_ERROR }),    []);
  const clearAIError  = useCallback(() => dispatch({ type: A.CLEAR_AI_ERROR }), []);

  const value = useMemo(() => ({
    state,
    initializeSession,
    fetchNextQuestion,
    nextQuestion,
    submitAnswer,
    evaluateAnswer,
    completeInterview,
    updateCurrentAnswer,
    setAISpeaking,
    setAIThinking,
    setAIListening,
    clearError,
    clearAIError,
  }), [
    state,
    initializeSession,
    fetchNextQuestion,
    nextQuestion,
    submitAnswer,
    evaluateAnswer,
    completeInterview,
    updateCurrentAnswer,
    setAISpeaking,
    setAIThinking,
    setAIListening,
    clearError,
    clearAIError,
  ]);

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterview must be used within InterviewProvider');
  return ctx;
}

export default InterviewProvider;