import { memo, useCallback, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import './Navbar.css';

const NAV_LINKS = [
  { label: 'Home',       type: 'scroll', id: 'home'     },
  { label: 'Features',   type: 'scroll', id: 'features' },
  { label: 'About',      type: 'scroll', id: 'about'    },
  { label: 'Help',       type: 'scroll', id: 'help'     },
  { label: 'Contact Us', type: 'route',  to: '/contact' },
];

const DASH_PATH = {
  JOBSEEKER: '/jobseeker/browse',
  MANAGER:   '/manager/jobs',
  ADMIN:     '/admin/dashboard',
};

// Chat path per role (where the chat/conversations page lives)
const CHAT_PATH = {
  JOBSEEKER: '/jobseeker/conversations',
  MANAGER:   '/manager/chat',
};

function Navbar() {
  const { user, logout }        = useAuth();
  const { unreadCount }         = useNotifications();
  const navigate                = useNavigate();
  const location                = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Tracks which nav item is "active" for styling purposes.
  // Route-based links (Contact Us) are derived from location.pathname instead.
  const [activeSection, setActiveSection] = useState(
    location.pathname === '/' ? (location.hash ? location.hash.slice(1) : 'home') : null
  );

  /* shrink / glass effect on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* close mobile menu on route change */
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  /* if we leave "/" entirely (e.g. go to /contact), clear scroll-based active state */
  useEffect(() => {
    if (location.pathname !== '/') setActiveSection(null);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleScroll = useCallback((id) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    setActiveSection(id);
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  }, [location.pathname, navigate]);

  // Unified active check used for both desktop + drawer nav
  const isLinkActive = useCallback((link) => {
    if (link.type === 'route') return location.pathname === link.to;
    return activeSection === link.id;
  }, [location.pathname, activeSection]);

  // Badge: only show for roles that have chat
  const showBadge = user && unreadCount > 0 && (user.role === 'JOBSEEKER' || user.role === 'MANAGER');
  const chatPath  = user ? (CHAT_PATH[user.role] || DASH_PATH[user.role]) : '/';

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} aria-label="Primary">
        <div className="navbar__inner">

          {/* ── Logo ── */}
          <NavLink to="/" end className="navbar__logo" aria-label="HireX Home">
            Hire<span>X</span>
          </NavLink>

          {/* ── Center links (desktop) ── */}
          <ul className="navbar__links">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link);
              return link.type === 'scroll' ? (
                <li key={link.id}>
                  <NavLink
                    to={`/#${link.id}`}
                    onClick={handleScroll(link.id)}
                    className={`navbar__link${active ? ' navbar__link--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ) : (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    onClick={() => setActiveSection(null)}
                    className={({ isActive }) =>
                      `navbar__link${isActive ? ' navbar__link--active' : ''}`
                    }
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* ── Right auth section (desktop) ── */}
          <div className="navbar__auth">
            {!user ? (
              <>
                <NavLink to="/login" className="navbar__login">Login</NavLink>
                <NavLink to="/register" className="navbar__register">Get Started</NavLink>
              </>
            ) : (
              <>
                {/* ── Notification bell ── */}
                <NavLink
                  to={chatPath}
                  className="navbar__notif-btn"
                  aria-label={unreadCount > 0 ? `${unreadCount} unread messages` : 'Messages'}
                  title={unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'Messages'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {showBadge && (
                    <span className="navbar__notif-badge" aria-live="polite">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>

                <div className="navbar__user">
                  <div className="navbar__avatar">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="navbar__username">Hi, {user.name?.split(' ')[0]}</span>
                </div>
                <NavLink to={DASH_PATH[user.role]} className="navbar__login">Dashboard</NavLink>
                <button className="navbar__register" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>

          {/* ── Hamburger (mobile) ── */}
          <button
            className={`navbar__hamburger${menuOpen ? ' navbar__hamburger--open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-drawer"
          >
            {/* Notification dot on hamburger for mobile */}
            {showBadge && <span className="navbar__hamburger-dot" aria-hidden="true" />}
            <span /><span /><span />
          </button>

        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <nav
        id="navbar-mobile-drawer"
        aria-label="Mobile"
        className={`navbar__drawer${menuOpen ? ' navbar__drawer--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <ul className="navbar__drawer-links">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(link);
            return link.type === 'scroll' ? (
              <li key={link.id}>
                <NavLink
                  to={`/#${link.id}`}
                  onClick={handleScroll(link.id)}
                  className={`navbar__drawer-link${active ? ' navbar__link--active' : ''}`}
                >
                  {link.label}
                </NavLink>
              </li>
            ) : (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `navbar__drawer-link${isActive ? ' navbar__link--active' : ''}`
                  }
                  onClick={() => { setMenuOpen(false); setActiveSection(null); }}
                >
                  {link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="navbar__drawer-auth">
          {!user ? (
            <>
              <NavLink to="/login"    className="navbar__drawer-login"    onClick={() => setMenuOpen(false)}>Login</NavLink>
              <NavLink to="/register" className="navbar__drawer-register" onClick={() => setMenuOpen(false)}>Get Started</NavLink>
            </>
          ) : (
            <>
              {/* Messages link with badge in drawer */}
              <NavLink
                to={chatPath}
                className="navbar__drawer-messages"
                onClick={() => setMenuOpen(false)}
              >
                💬 Messages
                {showBadge && (
                  <span className="navbar__drawer-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
              <NavLink to={DASH_PATH[user.role]} className="navbar__drawer-login" onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
              <button className="navbar__drawer-register" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      {/* overlay */}
      {menuOpen && <div className="navbar__overlay" onClick={() => setMenuOpen(false)} />}
    </>
  );
}

export default memo(Navbar);
