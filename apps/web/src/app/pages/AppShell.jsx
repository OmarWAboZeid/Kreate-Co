import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppStateProvider } from '../state.jsx';
import NotificationCenter from '../components/NotificationCenter.jsx';
import { roleConfig } from '../config/roles.js';

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
      navigate(`${basePath}/campaigns`, { replace: true });
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
          <div className="role-switch">
            <button
              type="button"
              className={role === 'admin' ? 'active' : undefined}
              onClick={() => handleRoleChange('admin')}
            >
              Admin
            </button>
            <button
              type="button"
              className={role === 'brand' ? 'active' : undefined}
              onClick={() => handleRoleChange('brand')}
            >
              Brand
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
