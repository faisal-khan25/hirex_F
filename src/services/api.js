import axios from 'axios';

const BACKEND_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
});

// ── Request interceptor: attach JWT ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: map errors to readable messages ────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      const networkErr = new Error(
        'Unable to reach the server. Please check your internet connection and try again.'
      );
      networkErr.isNetworkError = true;
      return Promise.reject(networkErr);
    }

    const { status, data } = err.response;
    const serverMsg = data?.error || data?.message || data?.detail || '';

    switch (status) {
      case 401:
        localStorage.clear();
        window.location.href = '/login';
        break;
      case 403:
        err.userMessage = serverMsg || 'You do not have permission to perform this action.';
        break;
      case 404:
        err.userMessage = serverMsg || 'The requested resource was not found.';
        break;
      case 429:
        err.userMessage =
          'AI service is temporarily unavailable due to high demand. ' +
          'Please try again in a moment.';
        err.isAIError   = true;
        err.isRetryable = true;
        break;
      case 503:
        err.userMessage =
          serverMsg ||
          'AI service is temporarily unavailable. ' +
          'Your interview will continue with pre-set questions.';
        err.isAIError   = true;
        err.isRetryable = true;
        break;
      case 500:
        err.userMessage = 'An unexpected server error occurred. Please try again.';
        break;
      default:
        err.userMessage = serverMsg || `Request failed (HTTP ${status}).`;
    }

    return Promise.reject(err);
  }
);

// ── Simple in-memory request deduplication ───────────────────────
const pendingRequests = new Map();

export function deduplicatedGet(url, config = {}) {
  if (pendingRequests.has(url)) return pendingRequests.get(url);
  const promise = api.get(url, config).finally(() => pendingRequests.delete(url));
  pendingRequests.set(url, promise);
  return promise;
}

// ── Blob URL cache for authenticated files ────────────────────────
const blobUrlCache = new Map();

// export async function getAuthenticatedBlobUrl(fileUrl) {
//   if (blobUrlCache.has(fileUrl)) return blobUrlCache.get(fileUrl);
//   const response = await api.get(fileUrl, { responseType: 'blob' });
//   const blobUrl  = URL.createObjectURL(new Blob([response.data]));
//   blobUrlCache.set(fileUrl, blobUrl);
//   return blobUrl;
// }
export async function getAuthenticatedBlobUrl(fileUrl) {
  if (blobUrlCache.has(fileUrl)) return blobUrlCache.get(fileUrl);
  const response = await api.get(fileUrl, { responseType: 'blob' });
  const contentType = response.headers['content-type'] || 'application/pdf';
  const blobUrl = URL.createObjectURL(new Blob([response.data], { type: contentType }));
  blobUrlCache.set(fileUrl, blobUrl);
  return blobUrl;
}

export function revokeBlobUrl(fileUrl) {
  const blobUrl = blobUrlCache.get(fileUrl);
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrlCache.delete(fileUrl); }
}

/**
 * Recruiter generates a secure interview link inside a shortlisted
 * candidate's conversation. The backend creates the live session AND
 * sends it as a chat message (type INTERVIEW_LINK) in one call — the
 * returned message also arrives over the chat WebSocket if the
 * conversation is currently open.
 */
export const generateInterviewLink = (applicationId) =>
  api.post(`/api/chat/application/${applicationId}/generate-interview-link`);

// ── Job ATS API ───────────────────────────────────────────────────

/** Run ATS scoring for all applicants of a specific job */
export const runJobAts = (jobId) =>
  api.post(`/api/jobs/${jobId}/ats/run`);

/** Get shortlisted candidates for a specific job */
export const getShortlistedForJob = (jobId) =>
  api.get(`/api/jobs/${jobId}/shortlisted`);

/** Get all applicants for a job (manager view) */
export const getApplicantsForJob = (jobId) =>
  api.get(`/api/manager/jobs/${jobId}/applicants`);

/**
 * Assign AI interview to all shortlisted candidates for a job.
 */
export const assignInterviewToAll = (jobId) =>
  api.post(`/api/interview/assign-all/${jobId}`);

/** Get interview session for a specific application (jobseeker view) */
export const getInterviewForApplication = (applicationId) =>
  api.get(`/api/interview/application/${applicationId}`);

/**
 * Get job-specific applicant stats including interview pass/fail counts.
 * Returns: { totalApplicants, shortlisted, rejected, hired, pending,
 *             interviewAssigned, interviewCompleted,
 *             interviewPassed, interviewFailed, interviewUnderReview,
 *             atsShortlisted, atsRejected }
 */
export const getJobStats = (jobId) =>
  api.get(`/api/jobs/${jobId}/stats`);

/**
 * Compute recruiter-scoped applicant stats, broken down by status.
 *
 * Strategy:
 *   1. Fetch /api/manager/jobs  ->  list of THIS recruiter's jobs only.
 *   2. For each job, fetch /api/jobs/{id}/stats  ->  returns per-status
 *      breakdown: { totalApplicants, shortlisted, hired, rejected, pending }
 *      where totalApplicants = APPLIED count for that job.
 *   3. Sum across all jobs.
 *
 * /api/manager/jobs only has a single applicationCount (all statuses combined),
 * so we must call /api/jobs/{id}/stats per job for the real status breakdown.
 *
 * Returns: { applied, shortlisted, hired, rejected, total }
 */
export async function getRecruiterApplicantStats() {
  const jobsRes = await api.get('/api/manager/jobs');
  const jobs = jobsRes.data || [];

  if (jobs.length === 0) {
    return { applied: 0, shortlisted: 0, hired: 0, rejected: 0, total: 0 };
  }

  // Fetch per-job stats in parallel; silently ignore individual failures
  const statsResults = await Promise.allSettled(
    jobs.map(job => api.get(`/api/jobs/${job.id}/stats`).then(r => r.data))
  );

  const totals = { applied: 0, shortlisted: 0, hired: 0, rejected: 0, total: 0 };

  statsResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const s = result.value;
    // /api/jobs/{id}/stats: totalApplicants = APPLIED count for that job
    const applied     = s.totalApplicants ?? s.applied     ?? 0;
    const shortlisted = s.shortlisted     ?? 0;
    const hired       = s.hired           ?? 0;
    const rejected    = s.rejected        ?? 0;
    const pending     = s.pending         ?? 0;

    totals.applied     += applied;
    totals.shortlisted += shortlisted;
    totals.hired       += hired;
    totals.rejected    += rejected;
    totals.total       += applied + shortlisted + hired + rejected + pending
      + (s.interviewAssigned  ?? 0)
      + (s.interviewCompleted ?? 0);
  });

  return totals;
}

/**
 * Get candidate interview status for a specific application.
 * Returns: { interviewStatus, interviewDisplayStatus, interviewScore,
 *             interviewPassStatus, scheduledAt, startedAt, endedAt }
 */
export const getApplicationInterviewStatus = (appId) =>
  api.get(`/api/jobseeker/applications/${appId}/interview-status`);

export default api;
