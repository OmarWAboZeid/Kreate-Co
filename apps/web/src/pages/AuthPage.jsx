import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const { user, login, register, isLoading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('brand');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.status === 'pending') {
        navigate('/pending-review');
      } else if (user.status === 'approved') {
        const targetRole = user.role === 'admin' ? 'admin' : 'brand';
        navigate(`/app/${targetRole}/campaigns`);
      }
    }
  }, [user, isLoading, navigate]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (form.password !== form.confirm) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        await register(form.email, form.password, form.name, role);
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
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
          <img src="/assets/logo1.svg" alt="kreate & co" />
          <p>Workspace access</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'active' : undefined}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : undefined}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div>
              <p className="label">I am a</p>
              <div className="pill-group">
                <button
                  type="button"
                  className={role === 'brand' ? 'active' : undefined}
                  onClick={() => setRole('brand')}
                >
                  Brand
                </button>
                <button
                  type="button"
                  className={role === 'creator' ? 'active' : undefined}
                  onClick={() => setRole('creator')}
                >
                  Creator
                </button>
              </div>
            </div>
          )}

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

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
