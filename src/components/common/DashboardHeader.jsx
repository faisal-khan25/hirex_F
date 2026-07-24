import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { DASHBOARD_PATH, PROFILE_PATH, CHAT_PATH, ROLE_LABEL } from '../../utils/roleRoutes';
import GlobalSearch from './GlobalSearch';
import './DashboardHeader.css';

/**
 * Shared authenticated header. Used two ways:
 *
 *  1. Inside JobSeekerLayout / ManagerLayout / AdminLayout, where the
 *     sidebar already renders the HireX logo — so `showLogo` is left off.
 *  2. Standalone on public marketing pages (Home, Contact, etc.) once the
 *     user is logged in, replacing the marketing Navbar entirely — see
 *     ConditionalNavbar in App.jsx. There it's rendered with `showLogo`,
 *     since there's no sidebar to provide one.
 *
 * Either way it's the exact same component/CSS, so notifications, the
 * theme toggle, the profile dropdown, spacing, and responsive behavior are
 * always identical everywhere it appears — nothing to keep in sync by hand.
 */
export default function DashboardHeader({ showLogo = false }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const hasBadge = user && unreadCount > 0 && (user.role === 'JOBSEEKER' || user.role === 'MANAGER');
  const dashboardPath = user ? (DASHBOARD_PATH[user.role] || '/') : '/';
  const chatPath = user ? (CHAT_PATH[user.role] || dashboardPath) : '/';
  const profilePath = user ? (PROFILE_PATH[user.role] || '/') : '/';

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="app-header" role="banner">
      {showLogo && (
        <button
          type="button"
          className="app-header__logo"
          onClick={() => navigate(dashboardPath)}
          aria-label="Go to your dashboard"
        >
          Hire<span>X</span>
        </button>
      )}

      <div className="app-header__search">
        <GlobalSearch />
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__icon-btn"
          aria-label={hasBadge ? `${unreadCount} unread notifications` : 'Notifications'}
          title="Notifications"
          onClick={() => navigate(chatPath)}
        >
          <Bell size={19} aria-hidden="true" />
          {hasBadge && (
            <span className="app-header__badge" aria-live="polite">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="app-header__icon-btn"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>

        <div className="app-header__profile" ref={menuRef}>
          <button
            type="button"
            className="app-header__avatar-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Account menu for ${user?.name || 'your account'}`}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="app-header__avatar">
              {user?.name?.charAt(0).toUpperCase() || <User size={16} aria-hidden="true" />}
            </span>
            <span className="app-header__avatar-name">{user?.name?.split(' ')[0]}</span>
          </button>

          {menuOpen && (
            <div className="app-header__menu" role="menu">
              <div className="app-header__menu-header">
                <span className="app-header__menu-name">{user?.name || 'Account'}</span>
                <span className="app-header__menu-role">{ROLE_LABEL[user?.role] || ''}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                className="app-header__menu-item"
                onClick={() => { setMenuOpen(false); navigate(profilePath); }}
              >
                <User size={16} aria-hidden="true" /> My Profile
              </button>
              <button
                type="button"
                role="menuitem"
                className="app-header__menu-item"
                onClick={() => { setMenuOpen(false); navigate(dashboardPath); }}
              >
                <LayoutDashboard size={16} aria-hidden="true" /> Dashboard
              </button>
              {/*
                No dedicated Settings page exists in this app yet (requirement
                7 says "Settings (if available)"). Wire it up here the moment
                one exists — same pattern as the two items above:
                <button role="menuitem" className="app-header__menu-item"
                  onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                  <Settings size={16} aria-hidden="true" /> Settings
                </button>
              */}
              <button
                type="button"
                role="menuitem"
                className="app-header__menu-item app-header__menu-item--danger"
                onClick={handleLogout}
              >
                <LogOut size={16} aria-hidden="true" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}