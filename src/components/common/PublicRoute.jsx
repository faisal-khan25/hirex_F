import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DASHBOARD_PATH } from '../../utils/roleRoutes';

/**
 * Guards routes that should only be visible to signed-out visitors
 * (Login, Register). If a user is already authenticated and manually
 * navigates to one of these routes (e.g. via browser history, a bookmark,
 * or typing the URL), they're redirected straight to their dashboard
 * instead of being shown the auth forms again.
 *
 * Mirrors ProtectedRoute's loading-state handling so we never flash
 * Login/Register before the AuthContext has finished restoring the
 * session from localStorage on startup/refresh.
 */
export default function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to={DASHBOARD_PATH[user.role] || '/'} replace />;
  }

  return children;
}