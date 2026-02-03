import { useState } from 'react';
import { useAppDispatch, useAppState } from '../state.jsx';

export default function NotificationCenter({ role }) {
  const { notifications } = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);

  const roleNotifications = notifications.filter((note) => note.role === role);
  const unreadCount = roleNotifications.filter((note) => !note.read).length;

  const markRead = (notificationId) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { notificationId } });
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
          {roleNotifications.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-list">
              {roleNotifications.map((note) => (
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
