import { useAuth } from '../hooks/useAuth.jsx';

export default function PendingReviewPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="auth-page">
      <div className="auth-decor auth-decor-1" />
      <div className="auth-decor auth-decor-2" />
      <div className="auth-decor auth-decor-3" />
      <div className="auth-decor auth-decor-4" />
      <div className="auth-card pending-review-card">
        <div className="auth-brand">
          <img src="/assets/logo1.svg" alt="kreate & co" />
        </div>
        
        <div className="pending-review-content">
          <div className="pending-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          
          <h2>Account Under Review</h2>
          
          <p className="pending-message">
            Thank you for signing up, <strong>{user?.name || 'there'}</strong>!
          </p>
          
          <p className="pending-description">
            Your account is currently being reviewed by our team. 
            We'll notify you once your account has been approved and you can access the platform.
          </p>
          
          <div className="pending-status">
            <span className="status-dot pending" />
            <span>Review in progress</span>
          </div>
          
          <div className="pending-info">
            <p>This usually takes 1-2 business days. If you have any questions, please contact us at:</p>
            <a href="mailto:support@kreate.co">support@kreate.co</a>
          </div>
          
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
