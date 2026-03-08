import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppState } from '../state.jsx';

export default function NotificationCenter({ role }) {
  const { brands } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
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
    let active = true;
    const fetchNotifications = async ({ quiet = false } = {}) => {
      if (!quiet) {
        setLoading(true);
      }
      try {
        const res = await fetch(notificationsUrl);
        const data = await res.json();
        if (active && data.ok) {
          setNotifications(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        if (active && !quiet) {
          setLoading(false);
        }
      }
    };
    fetchNotifications();
    const pollId = window.setInterval(() => fetchNotifications({ quiet: true }), 15000);
    return () => {
      active = false;
      window.clearInterval(pollId);
    };
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

  const clearAllNotifications = async () => {
    if (clearing || notifications.length === 0) return;
    const confirmed = window.confirm('Clear all notifications?');
    if (!confirmed) return;

    let clearUrl = null;
    if (isBrand && organizationId) {
      clearUrl = isImpersonatingBrand
        ? `/api/notifications/clear?organizationId=${organizationId}`
        : `/api/organizations/${organizationId}/notifications/clear`;
    } else if (canAdminNotifications && isAdminView) {
      clearUrl = '/api/notifications/clear';
    }
    if (!clearUrl) return;

    setClearing(true);
    try {
      const res = await fetch(clearUrl, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to clear notifications');
      }
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    } finally {
      setClearing(false);
    }
  };

  const openCampaignThread = (note) => {
    if (!note?.campaign_id) return;
    markRead(note);
    setOpen(false);
    navigate(`/app/${role}/campaigns/${note.campaign_id}?tab=messages`);
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
            <div className="notif-header-actions">
              <button
                type="button"
                className="link-button"
                onClick={clearAllNotifications}
                disabled={clearing || notifications.length === 0}
              >
                {clearing ? 'Clearing...' : 'Clear all'}
              </button>
              <button type="button" className="link-button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
          {loading ? (
            <p className="notif-empty">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((note) => (
                <li key={note.id} className={note.read ? 'read' : 'unread'}>
                  <div className="notif-item-copy">
                    <p>
                      {note.organization_name ? `${note.organization_name} · ` : ''}
                      {note.message}
                    </p>
                    <span>
                      {note.campaign_name ? `${note.campaign_name} · ` : ''}
                      {note.channel}
                    </span>
                  </div>
                  <div className="notif-item-actions">
                    {note.campaign_id ? (
                      <button type="button" className="link-button" onClick={() => openCampaignThread(note)}>
                        Open chat
                      </button>
                    ) : null}
                    {!note.read && (
                      <button type="button" className="link-button" onClick={() => markRead(note)}>
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
