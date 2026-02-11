import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import BrandsPage from './BrandsPage.jsx';
import UsersPage from './UsersPage.jsx';

export default function SettingsPage() {
  const { role } = useParams();
  const settingsTabs =
    role === 'admin'
      ? [
          { id: 'packages', label: 'Packages' },
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
  const [packageForm, setPackageForm] = useState({
    name: '',
    package_type: 'influencer',
    deal_type: 'paid',
    influencer_video_count: '',
    ugc_video_count: '',
    description: '',
    price_amount: '',
    currency: 'USD',
    customizable: false,
    active: true,
  });
  const [packageError, setPackageError] = useState('');

  useEffect(() => {
    if (!settingsTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(settingsTabs[0].id);
    }
  }, [activeTab, settingsTabs]);

  const filteredPackages = packages.filter((pkg) => {
    if (!packageSearch.trim()) return true;
    const query = packageSearch.trim().toLowerCase();
    return (
      (pkg.name || '').toLowerCase().includes(query) ||
      (pkg.package_type || '').toLowerCase().includes(query) ||
      (pkg.deal_type || '').toLowerCase().includes(query)
    );
  });

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

  const updatePackageForm = (field, value) => {
    setPackageForm((prev) => ({ ...prev, [field]: value }));
  };

  const openNewPackageModal = () => {
    setEditingPackage(null);
    setPackageError('');
    setPackageForm({
      name: '',
      package_type: 'influencer',
      deal_type: 'paid',
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
      deal_type: pkg.deal_type || 'paid',
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

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Configure packages, preferences, brands, and users.</p>
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
              <p>Manage and edit the packages that power campaign pricing.</p>
            </div>
            <div className="table-actions">
              <input
                className="input"
                style={{ minWidth: 220 }}
                placeholder="Search packages..."
                value={packageSearch}
                onChange={(event) => setPackageSearch(event.target.value)}
              />
              <button type="button" className="btn btn-primary" onClick={openNewPackageModal}>
                Add Package
              </button>
            </div>
          </div>

          <div className="table">
            <div className="table-row header">
              <span>Name</span>
              <span>Type</span>
              <span>Deal</span>
              <span>Videos</span>
              <span>Price</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {loadingPackages ? (
              <div className="table-row">
                <span>Loading packages...</span>
              </div>
            ) : (
              filteredPackages.map((pkg) => (
                <div key={pkg.id} className="table-row">
                  <span>{pkg.name}</span>
                  <span>{pkg.package_type}</span>
                  <span>{pkg.deal_type}</span>
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
      )}

      {activeTab === 'preferences' && (
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
      )}

      {role === 'admin' && activeTab === 'brands' && <BrandsPage embedded />}
      {role === 'admin' && activeTab === 'users' && <UsersPage embedded />}

      <Modal
        open={showPackageModal}
        onClose={closePackageModal}
        title={editingPackage ? 'Edit Package' : 'Add Package'}
        description="Define package structure, pricing, and availability."
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
              <span>Deal Type</span>
              <select
                className="input"
                value={packageForm.deal_type}
                onChange={(event) => updatePackageForm('deal_type', event.target.value)}
              >
                <option value="collab">Collab</option>
                <option value="paid">Paid</option>
                <option value="mix">Mix</option>
              </select>
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
          <div className="package-form-toggle">
            <label>
              <input
                type="checkbox"
                checked={packageForm.customizable}
                onChange={(event) => updatePackageForm('customizable', event.target.checked)}
              />
              <span>Customizable</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={packageForm.active}
                onChange={(event) => updatePackageForm('active', event.target.checked)}
              />
              <span>Active</span>
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
