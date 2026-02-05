import { useParams } from 'react-router-dom';

export default function SettingsPage() {
  const { role } = useParams();

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>{role === 'admin' ? 'Settings' : 'Profile & Settings'}</h2>
          <p>Configure notifications, roles, and future integrations.</p>
        </div>
      </div>

      <div className="card">
        <h3>Notification Channels</h3>
        <div className="toggle-row">
          <span>Email summaries</span>
          <button type="button" className="toggle">
            On
          </button>
        </div>
        <div className="toggle-row">
          <span>WhatsApp alerts</span>
          <button type="button" className="toggle">
            Paused
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Coming Soon</h3>
        <ul className="list">
          <li>Agency workspace switcher (coming soon)</li>
          <li>Billing & invoices (coming soon)</li>
          <li>Creator self-serve portal (coming soon)</li>
        </ul>
      </div>
    </div>
  );
}
