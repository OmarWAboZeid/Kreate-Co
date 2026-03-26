import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, verifyEmail, resendVerification, logout } = useAuth();
  const token = String(searchParams.get('token') || '').trim();
  const emailFromQuery = String(searchParams.get('email') || '').trim();
  const [verifying, setVerifying] = useState(Boolean(token));
  const [status, setStatus] = useState(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState(
    token ? 'We are confirming your email address.' : 'Check your inbox to continue.'
  );
  const [resending, setResending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const targetEmail = useMemo(
    () => String(user?.email || emailFromQuery || '').trim(),
    [emailFromQuery, user?.email]
  );

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    const run = async () => {
      setVerifying(true);
      setStatus('verifying');
      setPreviewUrl('');
      try {
        const data = await verifyEmail(token);
        if (!active) return;
        setStatus('verified');
        setMessage(
          data?.alreadyVerified
            ? 'This email address is already verified. You can sign in now.'
            : 'Your email is verified. You can sign in now.'
        );
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setMessage(error?.message || 'We could not verify that link.');
      } finally {
        if (active) {
          setVerifying(false);
        }
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [token, verifyEmail]);

  const handleResend = async () => {
    if (!targetEmail) return;
    setResending(true);
    try {
      const data = await resendVerification(targetEmail);
      setStatus(data?.alreadyVerified ? 'verified' : 'resent');
      setMessage(
        data?.message ||
          (data?.alreadyVerified
            ? 'This email is already verified. You can sign in now.'
            : 'A new verification email has been sent.')
      );
      setPreviewUrl(String(data?.verificationPreviewUrl || '').trim());
    } catch (error) {
      setStatus('error');
      setMessage(error?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-decor auth-decor-1" />
      <div className="auth-decor auth-decor-2" />
      <div className="auth-decor auth-decor-3" />
      <div className="auth-decor auth-decor-4" />
      <div className="auth-card email-verification-card">
        <div className="auth-brand">
          <img src="/assets/brand/logos/wordmark-clean.png" alt="kreate & co" />
          <p>Email verification</p>
        </div>

        <div className="email-verification-content">
          <div className={`email-verification-icon ${status}`}>
            {status === 'verified' ? '✓' : status === 'error' ? '!' : '@'}
          </div>

          <h2>
            {status === 'verified'
              ? 'Email verified'
              : verifying
                ? 'Verifying your email'
                : 'Verify your email'}
          </h2>

          <p className="email-verification-message">{message}</p>

          {targetEmail ? (
            <p className="email-verification-target">
              Verification email for <strong>{targetEmail}</strong>
            </p>
          ) : null}

          {previewUrl ? (
            <p className="email-verification-preview">
              Dev link: <a href={previewUrl}>{previewUrl}</a>
            </p>
          ) : null}

          <div className="email-verification-actions">
            {status === 'verified' ? (
              <Link to="/" className="btn btn-primary">
                Go to Login
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleResend}
                  disabled={resending || !targetEmail}
                >
                  {resending ? 'Sending...' : 'Resend Verification'}
                </button>
                <Link to="/" className="btn btn-secondary">
                  Back to Login
                </Link>
              </>
            )}
          </div>

          {user ? (
            <button type="button" className="link-button email-verification-signout" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
