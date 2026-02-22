import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import BrandsPage from './BrandsPage.jsx';
import UsersPage from './UsersPage.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';

const API_BASE = '/api';
const formatPackageFilterLabel = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function SettingsPage() {
  const { role } = useParams();
  const { user, refetch: refetchAuthUser } = useAuth();
  const settingsTabs =
    role === 'admin'
      ? [
          { id: 'packages', label: 'Packages' },
          { id: 'creatorStages', label: 'Creator Stages' },
          { id: 'preferences', label: 'Preferences' },
          { id: 'brands', label: 'Brands' },
          { id: 'users', label: 'Users' },
        ]
      : [{ id: 'preferences', label: 'Preferences' }];
  const [activeTab, setActiveTab] = useState(settingsTabs[0].id);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageTypeFilter, setPackageTypeFilter] = useState('all');
  const [packageStatusFilter, setPackageStatusFilter] = useState('all');
  const [packageForm, setPackageForm] = useState({
    name: '',
    package_type: 'influencer',
    influencer_video_count: '',
    ugc_video_count: '',
    description: '',
    price_amount: '',
    currency: 'USD',
    customizable: false,
    active: true,
  });
  const [packageError, setPackageError] = useState('');
  const [preferencesForm, setPreferencesForm] = useState({
    name: '',
    email: '',
    logo_url: '',
  });
  const [preferencesLogoFile, setPreferencesLogoFile] = useState(null);
  const [preferencesLogoPreview, setPreferencesLogoPreview] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [preferencesSuccess, setPreferencesSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [creatorStages, setCreatorStages] = useState([]);
  const [creatorStagesLoading, setCreatorStagesLoading] = useState(false);
  const [creatorStagesSaving, setCreatorStagesSaving] = useState(false);
  const [creatorStagesError, setCreatorStagesError] = useState('');
  const [creatorStageForm, setCreatorStageForm] = useState({
    campaignType: 'UGC',
    label: '',
  });

  useEffect(() => {
    if (!settingsTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(settingsTabs[0].id);
    }
  }, [activeTab, settingsTabs]);

  const packageTypeOptions = Array.from(
    new Set(
      packages
        .map((pkg) => String(pkg.package_type || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const filteredPackages = packages.filter((pkg) => {
    const query = packageSearch.trim().toLowerCase();
    const packageType = String(pkg.package_type || '').trim().toLowerCase();
    const status = pkg.active === false ? 'inactive' : 'active';

    if (query) {
      const searchBlob = [pkg.name, pkg.package_type, pkg.description, pkg.currency]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      if (!searchBlob.includes(query)) return false;
    }

    if (packageTypeFilter !== 'all' && packageType !== packageTypeFilter) return false;
    if (packageStatusFilter !== 'all' && status !== packageStatusFilter) return false;
    return true;
  });
  const hasPackageFilters = Boolean(
    packageSearch.trim() || packageTypeFilter !== 'all' || packageStatusFilter !== 'all'
  );

  useEffect(() => {
    if (role !== 'admin') return;
    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch('/api/packages?includeInactive=true');
        const data = await res.json();
        if (data.ok) {
          setPackages(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load packages:', err);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, [role]);

  const fetchCreatorStages = async () => {
    if (role !== 'admin') return;
    setCreatorStagesLoading(true);
    setCreatorStagesError('');
    try {
      const res = await fetch('/api/creator-stages?includeInactive=true', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to load creator stages.');
      }
      setCreatorStages(data.data || []);
    } catch (error) {
      setCreatorStagesError(error?.message || 'Failed to load creator stages.');
    } finally {
      setCreatorStagesLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'admin' || activeTab !== 'creatorStages') return;
    fetchCreatorStages();
  }, [role, activeTab]);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to encode image'));
      };
      reader.onerror = () => reject(new Error('Failed to encode image'));
      reader.readAsDataURL(file);
    });

  const uploadPreferencesLogo = async (file) => {
    try {
      const urlRes = await fetch(`${API_BASE}/uploads/request-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok || !urlData.uploadURL || !urlData.objectPath) {
        throw new Error(urlData.error || 'Failed to get upload URL');
      }
      const uploadRes = await fetch(urlData.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload logo file');
      }
      return urlData.objectPath;
    } catch (error) {
      console.warn('Signed logo upload failed, using inline fallback.', error);
      return fileToDataUrl(file);
    }
  };

  const fetchPreferencesProfile = async () => {
    setPreferencesLoading(true);
    setPreferencesError('');
    setPreferencesSuccess('');
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data?.error || 'Failed to load profile.');
      }
      setPreferencesForm({
        name: data.data.name || '',
        email: data.data.email || '',
        logo_url: data.data.logo_url || '',
      });
      setPreferencesLogoFile(null);
      setPreferencesLogoPreview(data.data.logo_url || null);
    } catch (error) {
      setPreferencesError(error?.message || 'Failed to load profile.');
    } finally {
      setPreferencesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'preferences' || !user) return;
    fetchPreferencesProfile();
  }, [activeTab, user?.id]);

  const updatePreferencesForm = (field, value) => {
    setPreferencesError('');
    setPreferencesSuccess('');
    setPreferencesForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePasswordForm = (field, value) => {
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferencesLogoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreferencesError('');
    setPreferencesSuccess('');
    setPreferencesLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreferencesLogoPreview(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePreferencesLogo = () => {
    setPreferencesLogoFile(null);
    setPreferencesLogoPreview(null);
    setPreferencesError('');
    setPreferencesSuccess('');
    setPreferencesForm((prev) => ({ ...prev, logo_url: '' }));
  };

  const handlePreferencesSubmit = async (event) => {
    event.preventDefault();
    const name = String(preferencesForm.name || '').trim();
    const email = String(preferencesForm.email || '')
      .trim()
      .toLowerCase();
    if (!name) {
      setPreferencesError('Name is required.');
      return;
    }
    if (!email) {
      setPreferencesError('Email is required.');
      return;
    }

    setPreferencesSaving(true);
    setPreferencesError('');
    setPreferencesSuccess('');
    try {
      let logoUrl = preferencesForm.logo_url || null;
      if (preferencesLogoFile) {
        logoUrl = await uploadPreferencesLogo(preferencesLogoFile);
      } else if (!preferencesLogoPreview) {
        logoUrl = null;
      }

      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          logo_url: logoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data?.error || 'Failed to update profile.');
      }

      setPreferencesForm({
        name: data.data.name || '',
        email: data.data.email || '',
        logo_url: data.data.logo_url || '',
      });
      setPreferencesLogoPreview(data.data.logo_url || null);
      setPreferencesLogoFile(null);
      setPreferencesSuccess('Profile updated successfully.');
      if (typeof refetchAuthUser === 'function') {
        await refetchAuthUser();
      }
    } catch (error) {
      setPreferencesError(error?.message || 'Failed to update profile.');
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const currentPassword = String(passwordForm.currentPassword || '');
    const newPassword = String(passwordForm.newPassword || '');
    const confirmPassword = String(passwordForm.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      const res = await fetch(`${API_BASE}/me/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to update password.');
      }
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordSuccess('Password updated successfully.');
    } catch (error) {
      setPasswordError(error?.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const updatePackageForm = (field, value) => {
    setPackageForm((prev) => ({ ...prev, [field]: value }));
  };

  const openNewPackageModal = () => {
    setEditingPackage(null);
    setPackageError('');
    setPackageForm({
      name: '',
      package_type: 'influencer',
      influencer_video_count: '',
      ugc_video_count: '',
      description: '',
      price_amount: '',
      currency: 'USD',
      customizable: false,
      active: true,
    });
    setShowPackageModal(true);
  };

  const openEditPackageModal = (pkg) => {
    setEditingPackage(pkg);
    setPackageError('');
    setPackageForm({
      name: pkg.name || '',
      package_type: pkg.package_type || 'influencer',
      influencer_video_count: pkg.influencer_video_count ?? '',
      ugc_video_count: pkg.ugc_video_count ?? '',
      description: pkg.description || '',
      price_amount: pkg.price_amount ?? '',
      currency: pkg.currency || 'USD',
      customizable: Boolean(pkg.customizable),
      active: pkg.active !== false,
    });
    setShowPackageModal(true);
  };

  const closePackageModal = () => {
    setShowPackageModal(false);
    setEditingPackage(null);
    setPackageError('');
  };

  const handleDeletePackage = async (pkg) => {
    const confirmed = window.confirm(`Delete package "${pkg.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to delete package.');
      }
      setPackages((prev) => prev.filter((item) => item.id !== pkg.id));
    } catch (err) {
      window.alert(err?.message || 'Failed to delete package.');
    }
  };

  const clearPackageFilters = () => {
    setPackageSearch('');
    setPackageTypeFilter('all');
    setPackageStatusFilter('all');
  };

  const handlePackageSubmit = async (event) => {
    event.preventDefault();
    setPackageError('');
    if (!packageForm.name || !packageForm.price_amount) {
      setPackageError('Name and price are required.');
      return;
    }
    try {
      const res = await fetch(editingPackage ? `/api/packages/${editingPackage.id}` : '/api/packages', {
        method: editingPackage ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...packageForm,
          influencer_video_count:
            packageForm.influencer_video_count === ''
              ? null
              : Number(packageForm.influencer_video_count),
          ugc_video_count:
            packageForm.ugc_video_count === '' ? null : Number(packageForm.ugc_video_count),
          price_amount: Number(packageForm.price_amount),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPackages((prev) => {
          if (editingPackage) {
            return prev.map((item) => (item.id === data.data.id ? data.data : item));
          }
          return [data.data, ...prev];
        });
        closePackageModal();
      } else {
        setPackageError(data.error || 'Failed to create package.');
      }
    } catch (err) {
      setPackageError('Failed to create package.');
    }
  };

  const sortedCreatorStages = [...creatorStages].sort((left, right) => {
    if (left.campaign_type !== right.campaign_type) {
      return String(left.campaign_type || '').localeCompare(String(right.campaign_type || ''));
    }
    if ((left.sort_order ?? 0) !== (right.sort_order ?? 0)) {
      return (left.sort_order ?? 0) - (right.sort_order ?? 0);
    }
    return String(left.label || '').localeCompare(String(right.label || ''));
  });

  const updateCreatorStageForm = (field, value) => {
    setCreatorStagesError('');
    setCreatorStageForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatorStageSubmit = async (event) => {
    event.preventDefault();
    const label = String(creatorStageForm.label || '').trim();
    const campaignType = String(creatorStageForm.campaignType || '').trim();
    if (!label) {
      setCreatorStagesError('Status label is required.');
      return;
    }
    if (!campaignType) {
      setCreatorStagesError('Campaign type is required.');
      return;
    }

    setCreatorStagesSaving(true);
    setCreatorStagesError('');
    try {
      const res = await fetch('/api/creator-stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignType,
          label,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data?.error || 'Failed to add creator status.');
      }
      setCreatorStages((prev) => [...prev, data.data]);
      setCreatorStageForm((prev) => ({ ...prev, label: '' }));
    } catch (error) {
      setCreatorStagesError(error?.message || 'Failed to add creator status.');
    } finally {
      setCreatorStagesSaving(false);
    }
  };

  const handleDeleteCreatorStage = async (stage) => {
    if (!stage?.id) return;
    setCreatorStagesError('');
    try {
      const res = await fetch(`/api/creator-stages/${stage.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to delete status.');
      }
      setCreatorStages((prev) => prev.filter((item) => item.id !== stage.id));
    } catch (error) {
      setCreatorStagesError(error?.message || 'Failed to delete status.');
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Configure creator stages, packages, preferences, brands, and users.</p>
        </div>
      </div>

      <div className="tabs-container">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {role === 'admin' && activeTab === 'packages' && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3>Campaign Packages</h3>
            </div>
            <div className="table-actions packages-toolbar">
              <div className="packages-toolbar-filters">
                <input
                  className="input packages-filter-input"
                  placeholder="Search packages..."
                  value={packageSearch}
                  onChange={(event) => setPackageSearch(event.target.value)}
                />
                <select
                  className="input packages-filter-select"
                  value={packageTypeFilter}
                  onChange={(event) => setPackageTypeFilter(event.target.value)}
                >
                  <option value="all">All Types</option>
                  {packageTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatPackageFilterLabel(option)}
                    </option>
                  ))}
                </select>
                <select
                  className="input packages-filter-select"
                  value={packageStatusFilter}
                  onChange={(event) => setPackageStatusFilter(event.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {hasPackageFilters ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={clearPackageFilters}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-primary packages-toolbar-add"
                onClick={openNewPackageModal}
              >
                Add Package
              </button>
            </div>
          </div>

          <div className="settings-packages-table-wrap">
            <div className="table settings-packages-table">
              <div className="table-row header">
                <span>Name</span>
                <span>Type</span>
                <span>Videos</span>
                <span>Price</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {loadingPackages ? (
                <div className="table-row">
                  <span>Loading packages...</span>
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="table-row">
                  <span>No packages match the current filters.</span>
                </div>
              ) : (
                filteredPackages.map((pkg) => (
                  <div key={pkg.id} className="table-row">
                    <span>{pkg.name}</span>
                    <span>{pkg.package_type}</span>
                    <span>
                      {pkg.package_type === 'bundle'
                        ? `${pkg.ugc_video_count || 0} UGC / ${pkg.influencer_video_count || 0} INF`
                        : pkg.package_type === 'ugc'
                          ? `${pkg.ugc_video_count || 0} UGC`
                          : pkg.package_type === 'influencer'
                            ? `${pkg.influencer_video_count || 0} INF`
                            : 'Custom'}
                    </span>
                    <span>${pkg.price_amount}</span>
                    <span>{pkg.active ? 'Active' : 'Inactive'}</span>
                    <span>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => openEditPackageModal(pkg)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeletePackage(pkg)}
                        >
                          Delete
                        </button>
                      </div>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {role === 'admin' && activeTab === 'creatorStages' && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h3>Creator Stages</h3>
              <p>Define status stages by campaign type for campaign creator workflows.</p>
            </div>
          </div>

          <form className="creator-stage-form" onSubmit={handleCreatorStageSubmit}>
            <label>
              <span>Campaign Type</span>
              <select
                className="input"
                value={creatorStageForm.campaignType}
                onChange={(event) => updateCreatorStageForm('campaignType', event.target.value)}
              >
                <option value="UGC">UGC</option>
                <option value="Influencer">Influencer</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </label>
            <label>
              <span>Status Label</span>
              <input
                className="input"
                value={creatorStageForm.label}
                onChange={(event) => updateCreatorStageForm('label', event.target.value)}
                placeholder="e.g. Contracted"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={creatorStagesSaving}>
              {creatorStagesSaving ? 'Adding...' : 'Add Status'}
            </button>
          </form>

          {creatorStagesError ? <p className="error-text">{creatorStagesError}</p> : null}

          <div className="creator-stage-table-wrap">
            <div className="creator-stage-table">
              <div className="creator-stage-row creator-stage-row-head">
                <span>Campaign Type</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {creatorStagesLoading ? (
                <div className="creator-stage-row">
                  <span>Loading statuses...</span>
                  <span>—</span>
                  <span>—</span>
                </div>
              ) : sortedCreatorStages.length === 0 ? (
                <div className="creator-stage-row">
                  <span>No statuses yet.</span>
                  <span>—</span>
                  <span>—</span>
                </div>
              ) : (
                sortedCreatorStages.map((stage) => (
                  <div key={stage.id} className="creator-stage-row">
                    <span>{stage.campaign_type}</span>
                    <span>{stage.label}</span>
                    <span>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => handleDeleteCreatorStage(stage)}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="card settings-preferences-card">
          <h3>Profile Preferences</h3>
          <p className="text-muted">
            {role === 'admin'
              ? 'Update your current account profile and workspace logo.'
              : 'Update your current account profile.'}
          </p>

          {preferencesLoading ? (
            <p className="text-muted">Loading profile...</p>
          ) : (
            <form className="package-form-grid" onSubmit={handlePreferencesSubmit}>
              <label>
                <span>Full Name *</span>
                <input
                  className="input"
                  value={preferencesForm.name}
                  onChange={(event) => updatePreferencesForm('name', event.target.value)}
                  placeholder="Your full name"
                  required
                />
              </label>
              <label>
                <span>Email *</span>
                <input
                  className="input"
                  type="email"
                  value={preferencesForm.email}
                  onChange={(event) => updatePreferencesForm('email', event.target.value)}
                  placeholder="you@kreate.co"
                  required
                />
              </label>

              {role === 'admin' && (
                <div className="full-width settings-preferences-logo-field">
                  <span>Workspace Logo</span>
                  <div className="logo-upload-container">
                    {preferencesLogoPreview ? (
                      <div className="logo-preview">
                        <img src={preferencesLogoPreview} alt="Logo preview" />
                        <button
                          type="button"
                          className="logo-remove"
                          onClick={handleRemovePreferencesLogo}
                          aria-label="Remove logo"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                    {!preferencesLogoPreview && (
                      <label className="logo-upload-btn">
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePreferencesLogoSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                    {preferencesLogoPreview && (
                      <label className="logo-upload-btn">
                        Change Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePreferencesLogoSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-muted">Used in the admin workspace header.</p>
                </div>
              )}

              {(preferencesError || preferencesSuccess) && (
                <p className={`full-width ${preferencesError ? 'error-text' : 'text-muted'}`}>
                  {preferencesError || preferencesSuccess}
                </p>
              )}

              <div className="modal-actions full-width settings-preferences-actions">
                <button type="submit" className="btn btn-primary" disabled={preferencesSaving}>
                  {preferencesSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          <div className="settings-preferences-divider" />

          <h3>Security</h3>
          <p className="text-muted">Change your account password.</p>
          <form className="package-form-grid settings-password-form" onSubmit={handlePasswordSubmit}>
            <label>
              <span>Current Password *</span>
              <input
                className="input"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => updatePasswordForm('currentPassword', event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              <span>New Password *</span>
              <input
                className="input"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => updatePasswordForm('newPassword', event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="full-width">
              <span>Confirm New Password *</span>
              <input
                className="input"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => updatePasswordForm('confirmPassword', event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {(passwordError || passwordSuccess) && (
              <p className={`full-width ${passwordError ? 'error-text' : 'text-muted'}`}>
                {passwordError || passwordSuccess}
              </p>
            )}
            <div className="modal-actions full-width settings-preferences-actions">
              <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>

          <div className="settings-preferences-divider" />

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
      )}

      {role === 'admin' && activeTab === 'brands' && <BrandsPage embedded />}
      {role === 'admin' && activeTab === 'users' && <UsersPage embedded />}

      <Modal
        open={showPackageModal}
        onClose={closePackageModal}
        title={editingPackage ? 'Edit Package' : 'Add Package'}
        description="Define package structure and pricing."
        size="large"
      >
        <form className="modal-form" onSubmit={handlePackageSubmit}>
          <div className="package-form-grid">
            <label>
              <span>Name *</span>
              <input
                className="input"
                value={packageForm.name}
                onChange={(event) => updatePackageForm('name', event.target.value)}
                placeholder="e.g. Influencer 10 Videos"
                required
              />
            </label>
            <label>
              <span>Package Type</span>
              <select
                className="input"
                value={packageForm.package_type}
                onChange={(event) => updatePackageForm('package_type', event.target.value)}
              >
                <option value="influencer">Influencer</option>
                <option value="ugc">UGC</option>
                <option value="bundle">Bundle</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span>Price *</span>
              <input
                className="input"
                type="number"
                step="0.01"
                value={packageForm.price_amount}
                onChange={(event) => updatePackageForm('price_amount', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Influencer Videos</span>
              <input
                className="input"
                type="number"
                value={packageForm.influencer_video_count}
                onChange={(event) => updatePackageForm('influencer_video_count', event.target.value)}
              />
            </label>
            <label>
              <span>UGC Videos</span>
              <input
                className="input"
                type="number"
                value={packageForm.ugc_video_count}
                onChange={(event) => updatePackageForm('ugc_video_count', event.target.value)}
              />
            </label>
            <label className="full-width">
              <span>Description</span>
              <input
                className="input"
                value={packageForm.description}
                onChange={(event) => updatePackageForm('description', event.target.value)}
                placeholder="Optional package description"
              />
            </label>
          </div>
          {packageError && <p className="error-text">{packageError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closePackageModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingPackage ? 'Save Changes' : 'Add Package'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
