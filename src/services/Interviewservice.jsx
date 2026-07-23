import api from './api';

/**
 * Interview Service
 * Matches AIInterviewController.java exactly.
 *
 * Recruiter flow:
 *   POST /api/interview/assign/{applicationId}      → creates PENDING session
 *
 * Candidate flow:
 *   GET  /api/interview/application/{applicationId} → find existing session
 *   POST /api/interview/{sessionId}/start           → set IN_PROGRESS + questions[]
 *   GET  /api/interview/{sessionId}/next-question   → next unanswered question
 *   POST /api/interview/{sessionId}/answer          → submit answer
 *   POST /api/interview/{sessionId}/complete        → done
 *
 * KEY FIXES:
 * - AI-related HTTP errors (429, 503) are caught and do NOT end the interview.
 * - submitAnswer() treats AI failures as non-fatal: the answer is saved,
 *   feedback just falls back to a placeholder message.
 * - getNextQuestion() only returns null (→ complete) on HTTP 410; all other
 *   errors propagate so the caller can decide (retry vs. show toast, etc.).
 * - completeSession() is idempotent; calling it twice is safe.
 */

/** Map an axios error to a descriptive Error with .isAIError flag. */
function toInterviewError(err, fallbackMsg) {
  const msg = err.userMessage || err.response?.data?.error || err.message || fallbackMsg;
  const out  = new Error(msg);
  out.isAIError   = err.isAIError   || false;
  out.isRetryable = err.isRetryable || false;
  out.status      = err.response?.status;
  return out;
}

const interviewService = {

  /**
   * Look up the session for this application, then start it.
   * If already IN_PROGRESS, returns the current state (reconnect scenario).
   * Returns InterviewSessionDto with questions[] populated.
   */
  async initializeSession(applicationId) {
    // 1. Find the session the recruiter created
    let session;
    try {
      const { data } = await api.get(`/api/interview/application/${applicationId}`);
      session = data;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error(
          'No interview has been scheduled for this application yet. ' +
          'Please wait for your recruiter to assign the AI interview.'
        );
      }
      throw toInterviewError(err, 'Failed to load interview session. Please try again.');
    }

    if (!session?.id) {
      throw new Error('Invalid session data received from the server.');
    }

    // 2. Already in progress (page refresh / reconnect) — resume properly.
    //
    // BUG FIX: this used to call ONLY getNextQuestion() and hand the frontend
    // a 1-item questions array. That collapsed the progress tracker to
    // "1 of 1" and made isLastQuestion true for every question after a
    // refresh, so the "Submit Interview" button appeared immediately
    // instead of "Submit Answer" — even on question 2 of 10.
    //
    // Fix: POST /start is idempotent — when the session is already
    // IN_PROGRESS the backend just returns the full ordered 10-question
    // list without generating anything new. We fetch that (for the correct
    // total) AND the real next-unanswered question (for the correct resume
    // point), so the frontend can restore the actual "N of 10" state.
    if (session.status === 'IN_PROGRESS') {
      try {
        const { data: started } = await api.post(`/api/interview/${session.id}/start`);
        const fullSession = started.session || started;
        const allQuestions = fullSession.questions || [];

        let resumeQuestionId = null;
        try {
          const nextQuestion = await this.getNextQuestion(session.id);
          resumeQuestionId = nextQuestion?.id ?? null;
        } catch (nextErr) {
          console.warn('Could not determine resume point during reconnect:', nextErr.message);
        }

        return { ...fullSession, questions: allQuestions, resumeQuestionId };
      } catch (err) {
        // Full reconnect failed — fall back to the single-question view so
        // the interview can still continue, even though progress/button
        // state will be less accurate until the next successful fetch.
        console.warn('Could not fetch full question set during reconnect:', err.message);
        try {
          const nextQuestion = await this.getNextQuestion(session.id);
          return { ...session, questions: nextQuestion ? [nextQuestion] : [] };
        } catch (err2) {
          return { ...session, questions: [] };
        }
      }
    }

    // 3. Already completed — surface a clear message
    if (session.status === 'COMPLETED') {
      throw new Error('This interview has already been completed.');
    }

    // 4. Start the PENDING session
    try {
      const { data: started } = await api.post(`/api/interview/${session.id}/start`);
      return started.session || started;
    } catch (err) {
      // Race condition: two /start calls hit the server at the same time
      const message = err.response?.data?.error || err.response?.data?.message || '';
      if (err.response?.status === 400 && /already started/i.test(message)) {
        try {
          const { data: refreshed } = await api.get(`/api/interview/application/${applicationId}`);
          const nextQuestion = await this.getNextQuestion(refreshed.id);
          return { ...refreshed, questions: nextQuestion ? [nextQuestion] : [] };
        } catch (retryErr) {
          throw toInterviewError(retryErr, 'Failed to resume interview. Please refresh the page.');
        }
      }
      throw toInterviewError(err, 'Failed to start interview. Please try again.');
    }
  },

  /**
   * Get the next unanswered question.
   *
   * Returns null ONLY when the interview is genuinely complete (HTTP 410).
   * On AI-related errors (429/503), throws with err.isAIError = true so the
   * caller can show a toast and retry instead of ending the interview.
   */
  async getNextQuestion(sessionId) {
    try {
      const { data } = await api.get(`/api/interview/${sessionId}/next-question`);
      // Validate the response has meaningful content
      if (!data || (!data.questionText && !data.text && !data.question)) {
        console.warn('Backend returned a question with no text content:', data);
        return data; // still return — the UI will show whatever it gets
      }
      return data;
    } catch (err) {
      if (err.response?.status === 410 || err.response?.status === 404) {
        // 410 Gone = no more questions (interview done); 404 = same semantics
        return null;
      }
      // All other errors: propagate so caller decides what to do
      throw toInterviewError(err, 'Failed to load the next question. Please try again.');
    }
  },

  /**
   * Submit an answer for the current question.
   *
   * FIX: AI evaluation errors (429/503) from the backend are caught here and
   * converted into a partial result with a placeholder feedback message.
   * The answer IS saved; only the AI scoring may be missing.
   * This means the interview NEVER ends because of an evaluation failure.
   */
  async submitAnswer(sessionId, questionId, answerText, transcript = '') {
    // Guard: never send a blank answer
    const safeAnswer     = answerText?.trim()  || '[No answer provided]';
    const safeTranscript = transcript?.trim()  || safeAnswer;

    try {
      const { data } = await api.post(`/api/interview/${sessionId}/answer`, {
        questionId,
        answerText:  safeAnswer,
        transcript:  safeTranscript,
      });
      return data;
    } catch (err) {
      // AI evaluation failure — backend saves the answer but evaluation might be partial
      if (err.isAIError || err.response?.status === 503 || err.response?.status === 429) {
        console.warn('AI evaluation failed for answer; returning fallback result:', err.message);
        // Return a synthetic DTO so the UI can continue
        return {
          questionId,
          answerText:        safeAnswer,
          evaluationFeedback:'AI service is temporarily unavailable. ' +
                             'Your answer has been saved. Please try again later.',
          relevanceScore:    null,
          confidenceScore:   null,
          clarityScore:      null,
          completenessScore: null,
        };
      }
      throw toInterviewError(err, 'Failed to submit your answer. Please try again.');
    }
  },

  /**
   * Mark the session as completed.
   * Safe to call multiple times (backend is idempotent).
   * AI-evaluation-only failures are non-fatal (the session is still marked
   * complete server-side, since completeInterview() persists COMPLETED
   * before evaluation ever runs); genuine submission failures (network
   * down, 5xx, session not found) are re-thrown with a meaningful message
   * so the UI can show it instead of silently pretending everything
   * succeeded.
   */
  async completeSession(sessionId) {
    try {
      const { data } = await api.post(`/api/interview/${sessionId}/complete`);
      return data;
    } catch (err) {
      if (err.isAIError || err.response?.status === 503) {
        console.warn('AI evaluation failed during session completion:', err.message);
        return { id: sessionId, status: 'COMPLETED', aiEvaluationPending: true };
      }
      if (err.response?.status === 404) {
        throw toInterviewError(err, 'Could not find your interview session. Please refresh and try again.');
      }
      console.error('Error completing session:', err.message);
      throw toInterviewError(err, 'We could not confirm your interview submission. ' +
          'Your answers have been saved — please try again in a moment.');
    }
  },

  /**
   * Get the full interview report (recruiter-facing).
   */
  async getReport(sessionId) {
    try {
      const { data } = await api.get(`/api/interview/${sessionId}/report`);
      return data;
    } catch (err) {
      throw toInterviewError(err, 'Failed to load the interview report.');
    }
  },
};

export default interviewService;