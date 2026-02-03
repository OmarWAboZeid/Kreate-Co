import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppStateProvider } from '../state.jsx';
import NotificationCenter from '../components/NotificationCenter.jsx';

const roleConfig = {
  admin: {
    label: 'Super Admin',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
      { to: 'analytics', label: 'Analytics' },
      { to: 'settings', label: 'Settings' },
    ],
  },
  employee: {
    label: 'Employee',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
    ],
  },
  brand: {
    label: 'Brand',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
      { to: 'analytics', label: 'Analytics' },
      { to: 'settings', label: 'Profile' },
    ],
  },
  creator: {
    label: 'Creator',
    nav: [
      { to: 'assignments', label: 'Assignments' },
      { to: 'content', label: 'Content Delivery' },
      { to: 'settings', label: 'Profile' },
    ],
  },
};

function ShellInner() {
  const { role } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentRole = roleConfig[role];

  useEffect(() => {
    if (!currentRole) {
      navigate('/app/admin/campaigns', { replace: true });
      return;
    }

    const basePath = `/app/${role}`;
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      const fallback = role === 'creator' ? 'assignments' : 'campaigns';
      navigate(`${basePath}/${fallback}`, { replace: true });
    }
  }, [currentRole, location.pathname, navigate, role]);

  if (!currentRole) {
    return null;
  }

  const handleRoleChange = (nextRole) => {
    if (nextRole === role) return;
    const nextPath = location.pathname.replace(`/app/${role}`, `/app/${nextRole}`);
    navigate(nextPath);
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <img src="/assets/logo1.svg" alt="kreate & co" />
          <span>Phase 1</span>
        </div>
        <nav className="app-nav">
          {currentRole.nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <p>Role</p>
          <div className="role-switch role-switch-grid">
            <button
              type="button"
              className={role === 'admin' ? 'active' : undefined}
              onClick={() => handleRoleChange('admin')}
            >
              Super Admin
            </button>
            <button
              type="button"
              className={role === 'employee' ? 'active' : undefined}
              onClick={() => handleRoleChange('employee')}
            >
              Employee
            </button>
            <button
              type="button"
              className={role === 'brand' ? 'active' : undefined}
              onClick={() => handleRoleChange('brand')}
            >
              Brand
            </button>
            <button
              type="button"
              className={role === 'creator' ? 'active' : undefined}
              onClick={() => handleRoleChange('creator')}
            >
              Creator
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <h1>{currentRole.label} Workspace</h1>
            <p>Phase 1 core workflows and approvals.</p>
          </div>
          <div className="app-topbar-actions">
            <input className="app-search" placeholder="Search campaigns, creators, content" />
            <NotificationCenter role={role} />
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <AppStateProvider>
      <ShellInner />
    </AppStateProvider>
  );
}
