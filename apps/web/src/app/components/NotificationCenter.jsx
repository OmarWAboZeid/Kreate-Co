import { useEffect, useState } from 'react';
import { useAppDispatch, useAppState } from '../state.jsx';

export default function NotificationCenter({ role }) {
  const { brands } = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionRole, setSessionRole] = useState(null);
  const [sessionBrandId, setSessionBrandId] = useState(null);
  const isBrand = role === 'brand';
  const isAdminView = role === 'admin' || role === 'employee';

  useEffect(() => {
    let active = true;
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (active && data.ok) {
          setSessionRole(data.data?.role || null);
          setSessionBrandId(data.data?.brand_id || null);
        }
      } catch (err) {
        console.error('Failed to fetch session user:', err);
      }
    };
    fetchMe();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrand || brands.length > 0) return;
    const fetchBrands = async () => {
      try {
        const res = await fetch('/api/brands');
        const data = await res.json();
        if (data.ok) {
          dispatch({ type: 'SET_BRANDS', payload: data.data });
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    };
    fetchBrands();
  }, [brands.length, dispatch, isBrand]);

  const canAdminNotifications = sessionRole
    ? sessionRole === 'admin' || sessionRole === 'employee'
    : isAdminView;
  const isImpersonatingBrand = isBrand && canAdminNotifications;
  const organizationId = isBrand
    ? sessionRole === 'brand'
      ? sessionBrandId
      : isImpersonatingBrand
        ? brands[0]?.id || null
        : null
    : null;
  const notificationsUrl =
    isBrand
      ? organizationId
        ? isImpersonatingBrand
          ? `/api/notifications?organizationId=${organizationId}&limit=50`
          : `/api/organizations/${organizationId}/notifications?limit=50`
        : null
      : canAdminNotifications && isAdminView
        ? '/api/notifications?limit=50'
        : null;

  useEffect(() => {
    if (!notificationsUrl) return;
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await fetch(notificationsUrl);
        const data = await res.json();
        if (data.ok) {
          setNotifications(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [notificationsUrl]);

  useEffect(() => {
    setNotifications([]);
  }, [notificationsUrl]);

  const unreadCount = notifications.filter((note) => !note.read).length;

  const markRead = (note) => {
    const orgId = note.organization_id || organizationId;
    if (!orgId) return;
    setNotifications((prev) =>
      prev.map((item) => (item.id === note.id ? { ...item, read: true } : item))
    );
    fetch(`/api/organizations/${orgId}/notifications/${note.id}/read`, {
      method: 'POST',
    }).catch((err) => {
      console.error('Failed to mark notification read:', err);
    });
  };

  return (
    <div className="notif">
      <button className="notif-trigger" type="button" onClick={() => setOpen((prev) => !prev)}>
        <span>Notifications</span>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <strong>Inbox</strong>
            <button type="button" className="link-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {loading ? (
            <p className="notif-empty">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((note) => (
                <li key={note.id} className={note.read ? 'read' : 'unread'}>
                  <div>
                    <p>
                      {note.organization_name ? `${note.organization_name} · ` : ''}
                      {note.message}
                    </p>
                    <span>{note.channel}</span>
                  </div>
                  {!note.read && (
                    <button type="button" className="link-button" onClick={() => markRead(note)}>
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
