/**
 * Static, role-scoped search index for the global search bar.
 *
 * Every entry describes something a user can navigate to. Categories map
 * to an icon (rendered by GlobalSearch via lucide-react) so results can be
 * grouped visually. `keywords` widen what a query can match beyond the
 * visible label (e.g. "cv" -> Resume, "signout" -> Logout).
 *
 * `quickAction: true` entries are surfaced first, before the user types
 * anything, as one-tap shortcuts to the most common destinations for that
 * role.
 */

export const CATEGORY_ICON = {
  Jobs: 'Briefcase',
  Companies: 'Building2',
  Recruiters: 'UserSquare2',
  Candidates: 'Users',
  Applications: 'ClipboardList',
  Messages: 'MessageSquare',
  Notifications: 'Bell',
  Settings: 'Settings',
  'AI Interview': 'Sparkles',
  Resumes: 'FileText',
  Skills: 'Award',
  Interviews: 'Radio',
  'ATS Results': 'Cpu',
  Reports: 'BarChart3',
  Analytics: 'BarChart3',
  Users: 'UserCog',
  Account: 'CircleUserRound',
};

const JOBSEEKER_INDEX = [
  { id: 'js-browse', label: 'Browse Jobs', category: 'Jobs', path: '/jobseeker/browse', description: 'Search and filter open roles', keywords: ['jobs', 'openings', 'positions', 'vacancies', 'search jobs'], quickAction: true },
  { id: 'js-companies', label: 'Companies Hiring', category: 'Companies', path: '/jobseeker/browse', description: 'Discover companies with open roles', keywords: ['company', 'employer', 'organizations'] },
  { id: 'js-recruiters', label: 'Recruiters & Hiring Managers', category: 'Recruiters', path: '/jobseeker/conversations', description: 'Message recruiters you have applied to', keywords: ['recruiter', 'hiring manager', 'contact'] },
  { id: 'js-applications', label: 'My Applications', category: 'Applications', path: '/jobseeker/applications', description: 'Track the status of jobs you applied to', keywords: ['applications', 'applied', 'status', 'tracker'], quickAction: true },
  { id: 'js-messages', label: 'Messages', category: 'Messages', path: '/jobseeker/conversations', description: 'Chat with recruiters', keywords: ['chat', 'conversations', 'inbox', 'messages'], quickAction: true },
  { id: 'js-notifications', label: 'Notifications', category: 'Notifications', path: '/jobseeker/conversations', description: 'Unread messages and alerts', keywords: ['alerts', 'updates', 'notifications', 'bell'] },
  { id: 'js-profile', label: 'Profile Settings', category: 'Settings', path: '/jobseeker/profile', description: 'Update your personal details and preferences', keywords: ['settings', 'account', 'preferences', 'edit profile'], quickAction: true },
  { id: 'js-ai-interview', label: 'AI Interview', category: 'AI Interview', path: '/jobseeker/applications', description: 'Launch an assigned AI interview from your applications', keywords: ['ai interview', 'mock interview', 'assessment', 'interview practice'] },
  { id: 'js-resume', label: 'Resume', category: 'Resumes', path: '/jobseeker/profile', description: 'Upload or update your resume', keywords: ['resume', 'cv', 'upload resume'] },
  { id: 'js-skills', label: 'Skills', category: 'Skills', path: '/jobseeker/profile', description: 'Manage the skills on your profile', keywords: ['skills', 'expertise', 'tech stack'] },
  { id: 'js-logout', label: 'Logout', category: 'Account', path: '__logout__', description: 'Sign out of HireX', keywords: ['logout', 'sign out', 'signout'] },
];

const MANAGER_INDEX = [
  { id: 'mg-jobs', label: 'Manage Jobs', category: 'Jobs', path: '/manager/jobs', description: 'Create, edit and publish job postings', keywords: ['jobs', 'postings', 'openings', 'create job', 'post a job'], quickAction: true },
  { id: 'mg-candidates', label: 'Candidates', category: 'Candidates', path: '/manager/applicants', description: 'Review applicants across your jobs', keywords: ['candidates', 'applicants', 'resumes', 'talent'], quickAction: true },
  { id: 'mg-applications', label: 'Applications', category: 'Applications', path: '/manager/applicants', description: 'Applications received for your postings', keywords: ['applications', 'applied', 'pipeline'] },
  { id: 'mg-interviews', label: 'Live Interviews', category: 'Interviews', path: '/manager/live-broadcasts', description: 'Monitor and join live interview broadcasts', keywords: ['interviews', 'live', 'broadcast', 'video interview'], quickAction: true },
  { id: 'mg-ats', label: 'ATS Results', category: 'ATS Results', path: '/manager/ats', description: 'AI-scored resume matches for your jobs', keywords: ['ats', 'resume screening', 'match score', 'ai screening'], quickAction: true },
  { id: 'mg-messages', label: 'Messages', category: 'Messages', path: '/manager/chat', description: 'Chat with candidates', keywords: ['chat', 'conversations', 'inbox', 'messages'] },
  { id: 'mg-notifications', label: 'Notifications', category: 'Notifications', path: '/manager/chat', description: 'Unread messages and alerts', keywords: ['alerts', 'updates', 'notifications', 'bell'] },
  { id: 'mg-company', label: 'Company Profile', category: 'Companies', path: '/manager/company', description: 'Manage your company data and branding', keywords: ['company', 'organization', 'employer profile', 'branding'] },
  { id: 'mg-reports', label: 'Interview Reports', category: 'Reports', path: '/manager/applicants', description: 'View AI interview reports for candidates', keywords: ['reports', 'interview report', 'summary', 'scorecard'] },
  { id: 'mg-logout', label: 'Logout', category: 'Account', path: '__logout__', description: 'Sign out of HireX', keywords: ['logout', 'sign out', 'signout'] },
];

const ADMIN_INDEX = [
  { id: 'ad-users', label: 'Users', category: 'Users', path: '/admin/dashboard', description: 'Manage job seekers, managers and admins', keywords: ['users', 'accounts', 'people', 'user management'], quickAction: true },
  { id: 'ad-companies', label: 'Companies', category: 'Companies', path: '/admin/dashboard', description: 'Companies registered on the platform', keywords: ['companies', 'employers', 'organizations'], quickAction: true },
  { id: 'ad-jobs', label: 'Jobs', category: 'Jobs', path: '/admin/dashboard', description: 'All job postings across the platform', keywords: ['jobs', 'postings', 'listings'], quickAction: true },
  { id: 'ad-analytics', label: 'Analytics', category: 'Analytics', path: '/admin/dashboard', description: 'Platform-wide usage and hiring analytics', keywords: ['analytics', 'metrics', 'stats', 'insights'], quickAction: true },
  { id: 'ad-reports', label: 'Reports', category: 'Reports', path: '/admin/dashboard', description: 'Generated platform reports', keywords: ['reports', 'export', 'summary'] },
  { id: 'ad-settings', label: 'Settings', category: 'Settings', path: '/admin/dashboard', description: 'Platform configuration and admin settings', keywords: ['settings', 'configuration', 'preferences'] },
  { id: 'ad-logout', label: 'Logout', category: 'Account', path: '__logout__', description: 'Sign out of HireX', keywords: ['logout', 'sign out', 'signout'] },
];

const INDEX_BY_ROLE = {
  JOBSEEKER: JOBSEEKER_INDEX,
  MANAGER: MANAGER_INDEX,
  ADMIN: ADMIN_INDEX,
};

export function getSearchIndex(role) {
  return INDEX_BY_ROLE[role] || [];
}

export function getQuickActions(role) {
  return getSearchIndex(role).filter((item) => item.quickAction);
}
