import { useEffect, useState } from 'react';
import { storage, useAppDispatch, useAppState } from '../state.jsx';

export default function NotificationCenter({ role }) {
  const { brands } = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== 'brand' || brands.length > 0) return;
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
  }, [brands.length, dispatch, role]);

  const selectedBrandName =
    role === 'brand' ? storage.getBrand() || brands[0]?.name : null;
  const organizationId =
    role === 'brand'
      ? brands.find((brand) => brand.name === selectedBrandName)?.id
      : null;

  useEffect(() => {
    if (!organizationId) return;
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/organizations/${organizationId}/notifications?limit=50`);
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
  }, [organizationId]);

  const unreadCount = notifications.filter((note) => !note.read).length;

  const markRead = (notificationId) => {
    if (!organizationId) return;
    setNotifications((prev) =>
      prev.map((note) => (note.id === notificationId ? { ...note, read: true } : note))
    );
    fetch(`/api/organizations/${organizationId}/notifications/${notificationId}/read`, {
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
                    <p>{note.message}</p>
                    <span>{note.channel}</span>
                  </div>
                  {!note.read && (
                    <button type="button" className="link-button" onClick={() => markRead(note.id)}>
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
