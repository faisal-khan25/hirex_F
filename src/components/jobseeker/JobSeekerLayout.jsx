import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import DashboardHeader from '../common/DashboardHeader';
import { 
  Search, 
  ClipboardList, 
  MessageSquare, 
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './JobSeekerLayout.css';

// PERF FIX: Consolidated polling into unified NotificationContext.
export default function JobSeekerLayout({ children }) {
  const { user } = useAuth();
  const { unreadCount: unread } = useNotifications();
  
  // Toggle state for collapsible behavior
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <DashboardHeader />
      <div className={`seeker-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>

      {/* SIDEBAR */}
      <aside className="seeker-sidebar">
        
        {/* LOGO & TOGGLE AREA */}
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon">H</div>
            <span className="logo-text">HireX</span>
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
          
          <div className="nav-section">
            <div className="sidebar-title">Job Seeker</div>
            
            <NavLink to="/jobseeker/browse" className={({ isActive }) => `seeker-link ${isActive ? 'active' : ''}`}>
              <Search size={18} className="nav-icon" />
              <span className="link-text">Browse Jobs</span>
            </NavLink>

            <NavLink to="/jobseeker/applications" className={({ isActive }) => `seeker-link ${isActive ? 'active' : ''}`}>
              <ClipboardList size={18} className="nav-icon" />
              <span className="link-text">Applications</span>
            </NavLink>

            <NavLink to="/jobseeker/conversations" className={({ isActive }) => `seeker-link ${isActive ? 'active' : ''}`}>
              <div className="nav-icon-wrap">
                <MessageSquare size={18} className="nav-icon" />
                {unread > 0 && <span className="nav-icon-badge">{unread > 99 ? '99+' : unread}</span>}
              </div>
              <span className="link-text">Conversations</span>
            </NavLink>

            <NavLink to="/jobseeker/profile" className={({ isActive }) => `seeker-link ${isActive ? 'active' : ''}`}>
              <User size={18} className="nav-icon" />
              <span className="link-text">Profile</span>
            </NavLink>
          </div>

        </nav>

        {/* BOTTOM PROFILE CARD */}
        <div className="seeker-profile-card">
          <div className="seeker-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'J'}
          </div>
          <div className="profile-details">
            <h4>{user?.name || 'Jane Doe'}</h4>
            <p>Candidate</p>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <main className="seeker-main">
        {children}
      </main>

      </div>
    </div>
  );
}