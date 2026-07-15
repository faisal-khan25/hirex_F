/**
 * ATS Service - API calls for job-specific ATS shortlisting and interview assignment
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Run job-specific ATS analysis and shortlist candidates
 * POST /api/jobs/{jobId}/ats/run
 */
export const runJobAts = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/ats/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`ATS Analysis failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error running ATS analysis:', error);
    throw error;
  }
};

/**
 * Get all shortlisted candidates for a specific job
 * GET /api/jobs/{jobId}/shortlisted
 */
export const getShortlistedCandidates = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/shortlisted`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shortlisted candidates: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching shortlisted candidates:', error);
    throw error;
  }
};

/**
 * Assign AI interviews to all shortlisted candidates for a job
 * POST /api/interview/assign-all/{jobId}
 */
export const assignAllInterviews = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/interview/assign-all/${jobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Interview assignment failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error assigning interviews:', error);
    throw error;
  }
};

/**
 * Assign AI interview to a single applicant
 * POST /api/interview/assign/{applicationId}
 */
export const assignSingleInterview = async (applicationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/interview/assign/${applicationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Interview assignment failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error assigning interview:', error);
    throw error;
  }
};

/**
 * Get ATS summary statistics
 * GET /api/ats/summary
 */
export const getAtsSummary = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ats/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ATS summary: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching ATS summary:', error);
    throw error;
  }
};

/**
 * Helper function to get auth token from localStorage
 */
const getAuthToken = () => {
  return localStorage.getItem('token') || localStorage.getItem('authToken') || '';
};

export default {
  runJobAts,
  getShortlistedCandidates,
  assignAllInterviews,
  assignSingleInterview,
  getAtsSummary,
};