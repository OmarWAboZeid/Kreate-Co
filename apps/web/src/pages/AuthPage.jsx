import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const { user, login, register, resendVerification, logout, isLoading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showVerificationActions, setShowVerificationActions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.email_verified === false) {
        navigate('/verify-email');
      } else if (user.status === 'pending') {
        navigate('/pending-review');
      } else if (user.status === 'approved') {
        const targetRole = user.role === 'admin' ? 'admin' : 'brand';
        navigate(`/app/${targetRole}/campaigns`);
      } else if (user.status === 'rejected') {
        setError('Your account was not approved. Please contact support.');
        logout();
      }
    }
  }, [user, isLoading, navigate, logout]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setNotice('');
    setVerificationPreviewUrl('');
    setShowVerificationActions(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setVerificationPreviewUrl('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (form.password !== form.confirm) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }
        if (form.password.length < 8) {
          setError('Password must be at least 8 characters');
          setSubmitting(false);
          return;
        }
        const data = await register(form.email, form.password, form.name);
        setMode('login');
        setVerificationEmail(form.email.trim());
        setShowVerificationActions(true);
        setForm((prev) => ({ ...prev, password: '', confirm: '' }));
        setNotice(
          data?.verificationDelivery === 'console'
            ? 'Account created. Use the verification link below to continue.'
            : 'Account created. Check your email for a verification link before logging in.'
        );
        setVerificationPreviewUrl(String(data?.verificationPreviewUrl || '').trim());
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      if (
        err?.code === 'EMAIL_NOT_VERIFIED' ||
        err?.code === 'EMAIL_ALREADY_REGISTERED_UNVERIFIED'
      ) {
        setVerificationEmail(form.email.trim());
        setShowVerificationActions(true);
        setNotice(
          err?.code === 'EMAIL_ALREADY_REGISTERED_UNVERIFIED'
            ? 'This account already exists but still needs email verification.'
            : 'Your account exists, but your email address is not verified yet.'
        );
        setError('');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const email = String(verificationEmail || form.email || '').trim();
    if (!email) {
      setError('Enter your email address first.');
      return;
    }

    setResending(true);
    setError('');
    try {
      const data = await resendVerification(email);
      setNotice(
        data?.message ||
          (data?.verificationDelivery === 'console'
            ? 'A new verification link is ready below.'
            : 'A new verification email has been sent.')
      );
      setVerificationPreviewUrl(String(data?.verificationPreviewUrl || '').trim());
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-decor auth-decor-1" />
      <div className="auth-decor auth-decor-2" />
      <div className="auth-decor auth-decor-3" />
      <div className="auth-decor auth-decor-4" />
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/assets/brand/logos/wordmark-clean.png" alt="kreate & co" />
          <p>Workspace access</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'active' : undefined}
            onClick={() => {
              setMode('login');
              setError('');
              setNotice('');
              setVerificationPreviewUrl('');
              setShowVerificationActions(false);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : undefined}
            onClick={() => {
              setMode('signup');
              setError('');
              setNotice('');
              setVerificationPreviewUrl('');
              setShowVerificationActions(false);
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && <p className="label">Account type: Brand</p>}

          {mode === 'signup' && (
            <label>
              Full name
              <input
                className="input"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {mode === 'signup' && (
            <label>
              Confirm password
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={(e) => updateForm('confirm', e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}
          {verificationPreviewUrl ? (
            <p className="auth-preview-link">
              Verification link: <a href={verificationPreviewUrl}>{verificationPreviewUrl}</a>
            </p>
          ) : null}
          {showVerificationActions && (
            <div className="auth-verification-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
