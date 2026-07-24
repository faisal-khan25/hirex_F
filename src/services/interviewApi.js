import api from './api';

/**
 * Thin wrappers around all AI Interview endpoints.
 * Imported by Interviewservice.jsx — keeps the service clean.
 */
export const interviewApi = {
  assign: (applicationId, template = 'MEDIUM') =>
    api.post(`/api/interview/assign/${applicationId}`, null, {
      params: { template },
    }),

  getByApplication: (applicationId) =>
    api.get(`/api/interview/application/${applicationId}`),

  start: (sessionId) =>
    api.post(`/api/interview/${sessionId}/start`),

  getNextQuestion: (sessionId) =>
    api.get(`/api/interview/${sessionId}/next-question`),

  submitAnswer: (sessionId, questionId, answerText, transcript = '') =>
    api.post(`/api/interview/${sessionId}/answer`, {
      questionId,
      answerText,
      transcript,
    }),

  complete: (sessionId) =>
    api.post(`/api/interview/${sessionId}/complete`),

  getReport: (sessionId) =>
    api.get(`/api/interview/${sessionId}/report`),
};
