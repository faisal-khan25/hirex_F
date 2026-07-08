/**
 * liveInterviewApi.js
 *
 * Axios wrappers for /api/live-interview REST endpoints.
 * Imported from the existing api.js which already attaches the JWT.
 *
 * UPDATED (Multi-Applicant Assignment):
 *   - createSession now accepts assignedApplicantIds array
 *   - Added getAssignableApplicants for the recruiter applicant picker
 */

import api from './api';

export const liveInterviewApi = {
  /**
   * POST /api/live-interview/create — recruiter creates a session
   *
   * @param {number|null} interviewSessionId  - AI interview session ID (optional if jobId provided)
   * @param {number[]} assignedApplicantIds   - list of applicant User IDs to assign
   * @param {number|null} jobId               - job ID (used when no interviewSessionId exists)
   */
  createSession: (interviewSessionId, assignedApplicantIds = [], jobId = null) =>
    api.post('/api/live-interview/create', { interviewSessionId, assignedApplicantIds, jobId }),

  /**
   * GET /api/live-interview/assignable-applicants/{interviewSessionId}
   * Returns [{ applicantId, name, email, applicationId }] — recruiter picks from this list.
   */
  getAssignableApplicants: (interviewSessionId) =>
    api.get(`/api/live-interview/assignable-applicants/${interviewSessionId}`),

  /**
   * GET /api/live-interview/assignable-applicants/by-job/{jobId}
   * Returns shortlisted applicants for a job WITHOUT requiring a prior AI interview session.
   * This is the primary entry point from the recruiter chat panel.
   */
  getAssignableApplicantsByJob: (jobId) =>
    api.get(`/api/live-interview/assignable-applicants/by-job/${jobId}`),

  /** GET /api/live-interview/join/{token} — validate token and fetch metadata */
  joinByToken: (token) =>
    api.get(`/api/live-interview/join/${token}`),

  /** GET /api/live-interview/{id} — get session by DB id */
  getById: (id) =>
    api.get(`/api/live-interview/${id}`),

  /** POST /api/live-interview/{id}/end — recruiter ends the session */
  endSession: (id, sessionToken, notes = '') =>
    api.post(`/api/live-interview/${id}/end`, { sessionToken, notes }),

  /** GET /api/live-interview/ice-servers — get STUN/TURN configuration */
  getIceServers: () =>
    api.get(`/api/live-interview/ice-servers`),

  // ── NEW: Live Broadcasting for AI Interview ────────────────────────────

  /**
   * GET /api/live-interview/candidate/{applicationId}
   * Candidate polls this right after starting the AI interview to obtain
   * the auto-created broadcast session token. Returns 204 (no body) if the
   * broadcast isn't ready yet / the candidate isn't assigned — axios
   * resolves this normally with `data` undefined, it does NOT throw.
   */
  getForCandidate: (applicationId) =>
    api.get(`/api/live-interview/candidate/${applicationId}`),

  /**
   * GET /api/live-interview/by-interview-session/{interviewSessionId}
   * Recruiter dashboard uses this to open a specific AI-interview broadcast.
   * Includes the session token (needed for STOMP/WebRTC) when the caller is
   * the owning recruiter, plus the mirrored AI interview status/question.
   */
  getBroadcastByInterviewSession: (interviewSessionId) =>
    api.get(`/api/live-interview/by-interview-session/${interviewSessionId}`),

  /**
   * GET /api/live-interview/active-broadcasts
   * Recruiter dashboard — lists every WAITING/ACTIVE broadcast (manual or
   * AI-interview-origin) belonging to the calling recruiter, token included.
   */
  getActiveBroadcasts: () =>
    api.get(`/api/live-interview/active-broadcasts`),
};

export default liveInterviewApi;