import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { 
  Briefcase, 
  Users, 
  Building2, 
  Cpu, 
  MessageSquare, 
  Radio,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './ManagerLayout.css';

export default function ManagerLayout({ children }) {
  const { user } = useAuth();
  const { unreadCount: unread } = useNotifications();
  
  // Toggle state for collapsible behavior
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`manager-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>

      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        
        {/* LOGO & TOGGLE AREA */}
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon">
              {/* Dynamic Branding SVG Logo Node */}
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="brand-logo-svg"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="logo-text">Hirex_X</span>
          </div>
          <button 
            className="sidebar-toggle-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* NAVIGATION SECTIONS */}
        <nav className="sidebar-nav">
          
          {/* SECTION 1 */}
          <div className="nav-section">
            <div className="sidebar-title">Main Menu</div>
            
            <NavLink to="/manager/jobs" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <Briefcase size={18} className="nav-icon" />
              <span className="link-text">Manage Jobs</span>
            </NavLink>

            <NavLink to="/manager/applicants" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <Users size={18} className="nav-icon" />
              <span className="link-text">Applicants</span>
            </NavLink>
          </div>

          <hr className="sidebar-divider" />

          {/* SECTION 2 */}
          <div className="nav-section">
            <div className="sidebar-title">General</div>

            <NavLink to="/manager/company" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} className="nav-icon" />
              <span className="link-text">Company Profile</span>
            </NavLink>

            <NavLink to="/manager/ats" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <Cpu size={18} className="nav-icon" />
              <span className="link-text">ATS Analysis</span>
            </NavLink>

            <NavLink to="/manager/chat" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <div className="nav-icon-wrap">
                <MessageSquare size={18} className="nav-icon" />
                {unread > 0 && <span className="nav-icon-badge">{unread > 99 ? '99+' : unread}</span>}
              </div>
              <span className="link-text">Conversations</span>
            </NavLink>
          </div>

          <hr className="sidebar-divider" />

          {/* SECTION 3 */}
          <div className="nav-section">
            <div className="sidebar-title">Live Features</div>

            <NavLink to="/manager/live-broadcasts" className={({ isActive }) => `manager-link ${isActive ? 'active' : ''}`}>
              <Radio size={18} className="nav-icon" />
              <span className="link-text">Live Interviews</span>
            </NavLink>
          </div>

        </nav>

        {/* BOTTOM PROFILE CARD */}
        <div className="manager-profile-card">
          <div className="manager-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div className="profile-details">
            <h4>{user?.name || 'Eva Murphy'}</h4>
            <p>Hiring Manager</p>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <main className="manager-main">
        {children}
      </main>

    </div>
  );
}