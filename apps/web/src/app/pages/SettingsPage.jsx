import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function SettingsPage() {
  const { role } = useParams();
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
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

  const handlePackageSubmit = async (event) => {
    event.preventDefault();
    setPackageError('');
    if (!packageForm.name || !packageForm.price_amount) {
      setPackageError('Name and price are required.');
      return;
    }
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
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
        setPackages((prev) => [data.data, ...prev]);
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
          <h2>{role === 'admin' ? 'Settings' : 'Profile & Settings'}</h2>
          <p>Configure notifications, roles, and future integrations.</p>
        </div>
      </div>

      {role === 'admin' && (
        <div className="card">
          <h3>Campaign Packages</h3>
          <form className="brand-form" onSubmit={handlePackageSubmit}>
            <div className="brand-form-row">
              <label className="brand-form-field">
                <span>Name *</span>
                <input
                  className="input"
                  value={packageForm.name}
                  onChange={(event) => updatePackageForm('name', event.target.value)}
                  placeholder="e.g. Influencer 10 Videos"
                />
              </label>
              <label className="brand-form-field">
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
              <label className="brand-form-field">
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
            </div>
            <div className="brand-form-row">
              <label className="brand-form-field">
                <span>Influencer Videos</span>
                <input
                  className="input"
                  type="number"
                  value={packageForm.influencer_video_count}
                  onChange={(event) => updatePackageForm('influencer_video_count', event.target.value)}
                />
              </label>
              <label className="brand-form-field">
                <span>UGC Videos</span>
                <input
                  className="input"
                  type="number"
                  value={packageForm.ugc_video_count}
                  onChange={(event) => updatePackageForm('ugc_video_count', event.target.value)}
                />
              </label>
              <label className="brand-form-field">
                <span>Price *</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={packageForm.price_amount}
                  onChange={(event) => updatePackageForm('price_amount', event.target.value)}
                />
              </label>
            </div>
            <div className="brand-form-row">
              <label className="brand-form-field">
                <span>Description</span>
                <input
                  className="input"
                  value={packageForm.description}
                  onChange={(event) => updatePackageForm('description', event.target.value)}
                  placeholder="Optional package description"
                />
              </label>
            </div>
            <div className="brand-form-row">
              <label className="brand-form-field">
                <input
                  type="checkbox"
                  checked={packageForm.customizable}
                  onChange={(event) => updatePackageForm('customizable', event.target.checked)}
                />
                <span>Customizable</span>
              </label>
              <label className="brand-form-field">
                <input
                  type="checkbox"
                  checked={packageForm.active}
                  onChange={(event) => updatePackageForm('active', event.target.checked)}
                />
                <span>Active</span>
              </label>
              <button type="submit" className="btn btn-primary">
                Add Package
              </button>
            </div>
            {packageError && <p className="error-text">{packageError}</p>}
          </form>

          <div className="table">
            <div className="table-row header">
              <span>Name</span>
              <span>Type</span>
              <span>Deal</span>
              <span>Videos</span>
              <span>Price</span>
              <span>Status</span>
            </div>
            {loadingPackages ? (
              <div className="table-row">
                <span>Loading packages...</span>
              </div>
            ) : (
              packages.map((pkg) => (
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
                </div>
              ))
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
