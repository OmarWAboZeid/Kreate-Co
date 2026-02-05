import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppState, useAppDispatch } from '../state.jsx';

const API_BASE = '/api';

export default function SettingsPage() {
  const { role } = useParams();
  const { brands } = useAppState();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role === 'admin' && brands.length === 0) {
      fetchBrands();
    }
  }, [role, brands.length]);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/brands`);
      const data = await res.json();
      if (data.ok) {
        dispatch({ type: 'SET_BRANDS', payload: data.data });
      }
    } catch (err) {
      console.error('Error fetching brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (file) => {
    const urlRes = await fetch(`${API_BASE}/uploads/request-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    const urlData = await urlRes.json();
    if (!urlData.ok) {
      throw new Error('Failed to get upload URL');
    }

    await fetch(urlData.uploadURL, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    return urlData.objectPath;
  };

  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      setError('Please enter a brand name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile);
      }

      const res = await fetch(`${API_BASE}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrandName.trim(),
          logo_url: logoUrl,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        dispatch({ type: 'ADD_BRAND', payload: data.data });
        setNewBrandName('');
        setLogoFile(null);
        setLogoPreview(null);
      } else {
        setError(data.error || 'Failed to add brand');
      }
    } catch (err) {
      setError('Failed to add brand');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!confirm('Are you sure you want to delete this brand?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/brands/${brandId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.ok) {
        dispatch({ type: 'DELETE_BRAND', payload: brandId });
      } else {
        alert(data.error || 'Failed to delete brand');
      }
    } catch (err) {
      alert('Failed to delete brand');
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>{role === 'admin' ? 'Settings' : 'Profile & Settings'}</h2>
          <p>Configure notifications, roles, and future integrations.</p>
        </div>
      </div>

      {role === 'admin' && (
        <div className="card">
          <h3>Manage Brands</h3>
          <p className="text-muted" style={{ marginBottom: '20px' }}>
            Add and manage brands that can be assigned to campaigns.
          </p>

          <form onSubmit={handleAddBrand} className="brand-form">
            <div className="brand-form-row">
              <div className="brand-form-field">
                <label>Brand Name</label>
                <input
                  type="text"
                  className="input"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Enter brand name"
                />
              </div>
              <div className="brand-form-field">
                <label>Logo (optional)</label>
                <div className="logo-upload-container">
                  {logoPreview ? (
                    <div className="logo-preview">
                      <img src={logoPreview} alt="Logo preview" />
                      <button
                        type="button"
                        className="logo-remove"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <label className="logo-upload-btn">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        style={{ display: 'none' }}
                      />
                      <span>Choose File</span>
                    </label>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !newBrandName.trim()}
              >
                {submitting ? 'Adding...' : 'Add Brand'}
              </button>
            </div>
            {error && <p className="error-text">{error}</p>}
          </form>

          <div className="brands-list">
            {loading ? (
              <p>Loading brands...</p>
            ) : brands.length === 0 ? (
              <p className="text-muted">No brands added yet.</p>
            ) : (
              <div className="brands-grid">
                {brands.map((brand) => (
                  <div key={brand.id} className="brand-card">
                    <div className="brand-card-logo">
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt={brand.name} />
                      ) : (
                        <div className="brand-card-placeholder">
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="brand-card-info">
                      <span className="brand-card-name">{brand.name}</span>
                    </div>
                    <button
                      type="button"
                      className="brand-card-delete"
                      onClick={() => handleDeleteBrand(brand.id)}
                      title="Delete brand"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        <h3>Phase 2 Extensions</h3>
        <ul className="list">
          <li>Agency workspace switcher (coming soon)</li>
          <li>Billing & invoices (coming soon)</li>
          <li>Creator self-serve portal (coming soon)</li>
        </ul>
      </div>
    </div>
  );
}
