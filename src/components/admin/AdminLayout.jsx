import { NavLink } from 'react-router-dom';
import DashboardHeader from '../common/DashboardHeader';

export default function AdminLayout({ children }) {
  return (
    <div className="app-shell">
      <DashboardHeader />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-section-label">Admin Panel</div>

          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            📊 Dashboard
          </NavLink>

        </aside>

        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
}
