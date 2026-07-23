// Single source of truth for role → route mappings.
//
// Previously this map (or a near-identical copy of it) was hand-duplicated
// in Navbar.jsx, PublicRoute.jsx, and DashboardHeader.jsx. Any time a route
// changed, all three had to be edited in lockstep or they'd silently drift
// apart. Centralizing it here means every consumer redirects to the same
// place for the same role, always.

/** Where a user lands right after login/register, and what the logo / "Dashboard" menu item points to. */
export const DASHBOARD_PATH = {
  JOBSEEKER: '/jobseeker/browse',
  MANAGER: '/manager/jobs',
  ADMIN: '/admin/dashboard',
};

/** Profile / account settings page per role. */
export const PROFILE_PATH = {
  JOBSEEKER: '/jobseeker/profile',
  MANAGER: '/manager/company',
  ADMIN: '/admin/dashboard', // Admin has no dedicated profile page yet.
};

/** Messaging/chat inbox per role (Admin has no chat surface). */
export const CHAT_PATH = {
  JOBSEEKER: '/jobseeker/conversations',
  MANAGER: '/manager/chat',
};

/** Human-readable role label shown in the account menu. */
export const ROLE_LABEL = {
  JOBSEEKER: 'Job Seeker',
  MANAGER: 'Hiring Manager',
  ADMIN: 'Administrator',
};