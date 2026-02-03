import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const brandOptions = ['Rabbit', 'Hankology', 'Chez Koukou', 'Minilet'];
const creatorOptions = [
  { id: 'cr-001', name: 'Nia Rivers' },
  { id: 'cr-002', name: 'Sara ElDin' },
  { id: 'cr-003', name: 'Ari Luna' },
  { id: 'cr-004', name: 'Maya Kareem' },
];

const safeStorage = {
  set(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
};

export default function AuthPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('brand');
  const [brand, setBrand] = useState(brandOptions[0]);
  const [creator, setCreator] = useState(creatorOptions[0].id);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });

  const roleLabel = useMemo(() => (role === 'brand' ? 'Brand' : 'Creator'), [role]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (role === 'brand') {
      safeStorage.set('kreate_brand', brand);
    } else {
      safeStorage.set('kreate_creator', creator);
    }
    safeStorage.set('kreate_role', role);
    navigate(role === 'brand' ? '/app/brand/campaigns' : '/app/creator/assignments');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/assets/logo1.svg" alt="kreate & co" />
          <p>Phase 1 workspace access</p>
        </div>

        <div className="auth-toggle">
          <button type="button" className={mode === 'login' ? 'active' : undefined} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : undefined} onClick={() => setMode('signup')}>
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <p className="label">Role</p>
            <div className="pill-group">
              <button type="button" className={role === 'brand' ? 'active' : undefined} onClick={() => setRole('brand')}>
                Brand
              </button>
              <button type="button" className={role === 'creator' ? 'active' : undefined} onClick={() => setRole('creator')}>
                Creator
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <label>
              Full name
              <input
                className="input"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Name"
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
                required
              />
            </label>
          )}

          {role === 'brand' ? (
            <label>
              Brand
              <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                {brandOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Creator profile
              <select className="input" value={creator} onChange={(e) => setCreator(e.target.value)}>
                {creatorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button type="submit" className="btn btn-primary">
            {mode === 'login' ? `Continue as ${roleLabel}` : `Create ${roleLabel} account`}
          </button>
          <p className="muted auth-helper">Testing mode: no real authentication yet.</p>
        </form>
      </div>
    </div>
  );
}
