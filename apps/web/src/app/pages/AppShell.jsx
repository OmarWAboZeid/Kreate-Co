import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppStateProvider } from '../state.jsx';
import ContextChatWidget from '../components/ContextChatWidget.jsx';
import NotificationCenter from '../components/NotificationCenter.jsx';
import { roleConfig } from '../config/roles.js';
import { useAuth } from '../../hooks/useAuth.jsx';

const ALPHA_THRESHOLD = 8;
const STATIC_TOPBAR_LOGOS = new Set([
  '/assets/brand/logos/artboard-1-3-cropped.png',
  '/assets/brand/logos/kreateco-wordmark.png',
]);

const trimTransparentPadding = (src) =>
  new Promise((resolve) => {
    if (!src || STATIC_TOPBAR_LOGOS.has(src)) {
      resolve(src);
      return;
    }

    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve(src);
          return;
        }

        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;
        const out = document.createElement('canvas');
        out.width = cropWidth;
        out.height = cropHeight;
        const outCtx = out.getContext('2d');
        if (!outCtx) {
          resolve(src);
          return;
        }

        outCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        resolve(out.toDataURL('image/png'));
      } catch (error) {
        resolve(src);
      }
    };

    img.onerror = () => resolve(src);
    img.src = src;
  });

function ShellInner() {
  const { role } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [brandProfile, setBrandProfile] = useState(null);
  const [displayLogoSrc, setDisplayLogoSrc] = useState(null);

  const currentRole = roleConfig[role];
  const isAdminRole = role === 'admin';
  const isBrandRole = role === 'brand';
  const adminWorkspaceName = (user?.name && user.name.trim()) || 'admin';
  const brandWorkspaceName = (brandProfile?.name && brandProfile.name.trim()) || 'Brand';
  const topbarLogoSrc = isAdminRole
    ? user?.logo_url || '/assets/brand/logos/artboard-1-3-cropped.png'
    : isBrandRole
      ? brandProfile?.logo_url || '/assets/brand/logos/kreateco-wordmark.png'
      : null;
  const topbarLogoVariant = isAdminRole ? 'admin' : isBrandRole ? 'brand' : '';
  const topbarTitle = isAdminRole
    ? `${adminWorkspaceName} workspace`
    : isBrandRole
      ? `${brandWorkspaceName} workspace`
      : `${currentRole.label} Workspace`;

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

  useEffect(() => {
    let ignore = false;

    const fetchBrandProfile = async () => {
      if (!isBrandRole) {
        setBrandProfile(null);
        return;
      }
      try {
        const res = await fetch('/api/brands', { credentials: 'include' });
        const data = await res.json();
        if (!ignore && data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setBrandProfile(data.data[0]);
          return;
        }
        if (!ignore) {
          setBrandProfile(null);
        }
      } catch (error) {
        if (!ignore) {
          setBrandProfile(null);
        }
      }
    };

    fetchBrandProfile();
    return () => {
      ignore = true;
    };
  }, [isBrandRole]);

  useEffect(() => {
    let active = true;

    const resolveLogo = async () => {
      if (!topbarLogoSrc) {
        if (active) setDisplayLogoSrc(null);
        return;
      }
      const trimmed = await trimTransparentPadding(topbarLogoSrc);
      if (active) {
        setDisplayLogoSrc(trimmed || topbarLogoSrc);
      }
    };

    resolveLogo();
    return () => {
      active = false;
    };
  }, [topbarLogoSrc]);

  if (!currentRole) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="app-brand-logo">
            <img src="/assets/brand/logos/kreateco-wordmark.png" alt="Kreate&Co" />
          </div>
          <span className="app-brand-subtitle">Workspace</span>
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
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className={`app-topbar-title ${topbarLogoVariant}`}>
            {topbarLogoSrc && (
              <span className="app-topbar-logo-wrap">
                <img
                  className={`app-topbar-logo app-topbar-logo-wordmark ${topbarLogoVariant}`}
                  src={displayLogoSrc || topbarLogoSrc}
                  alt="Kreate&Co logo"
                />
              </span>
            )}
            <h1>{topbarTitle}</h1>
          </div>
          <div className="app-topbar-actions">
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
            <NotificationCenter role={role} />
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
        <ContextChatWidget />
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
