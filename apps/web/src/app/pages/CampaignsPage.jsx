import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { storage, useAppDispatch, useAppState, utils } from '../state.jsx';

const defaultForm = {
  name: '',
  brand: '',
  platforms: [],
  startDate: '',
  endDate: '',
};

export default function CampaignsPage() {
  const { role } = useParams();
  const { campaigns, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const brandFilter = role === 'brand' ? storage.getBrand() || brands[0] : null;
  const visibleCampaigns = useMemo(() => {
    if (!brandFilter) return campaigns;
    return campaigns.filter((campaign) => campaign.brand === brandFilter);
  }, [brandFilter, campaigns]);

  const openModal = () => {
    if (role === 'brand' && brandFilter) {
      setForm({ ...defaultForm, brand: brandFilter });
    } else {
      setForm(defaultForm);
    }
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePlatform = (platform) => {
    setForm((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists ? prev.platforms.filter((item) => item !== platform) : [...prev.platforms, platform],
      };
    });
  };

  const closeModal = () => {
    setForm(defaultForm);
    setShowModal(false);
  };

  const handleCreateCampaign = () => {
    if (!form.name || !form.brand || form.platforms.length === 0) {
      return;
    }

    const newCampaign = {
      id: utils.makeId('camp'),
      name: form.name,
      brand: form.brand,
      platforms: form.platforms,
      status: 'Draft',
      objectives: '',
      budgetRange: '',
      timeline: { start: form.startDate, end: form.endDate },
      notes: '',
      criteria: {},
      criteriaVersion: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    dispatch({ type: 'CREATE_CAMPAIGN', payload: newCampaign, actor: 'Admin' });
    closeModal();
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Campaigns</h2>
          <p>Track progress from brief to activation.</p>
        </div>
        {(role === 'admin' || role === 'brand') && (
          <button type="button" className="btn btn-primary" onClick={openModal}>
            Create Campaign
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input className="input" placeholder="Search campaigns" />
        <select className="input">
          <option>Status</option>
          <option>Draft</option>
          <option>Submitted</option>
          <option>In Review</option>
          <option>Active</option>
        </select>
        <select className="input">
          <option>Platform</option>
          <option>Instagram</option>
          <option>TikTok</option>
        </select>
      </div>

      {visibleCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start building a roster."
          action={
            (role === 'admin' || role === 'brand') ? (
              <button type="button" className="btn btn-primary" onClick={openModal}>
                Create Campaign
              </button>
            ) : null
          }
        />
      ) : (
        <div className="card-grid">
          {visibleCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={campaign.id}
              className="card campaign-card"
            >
              <div>
                <StatusPill status={campaign.status} />
                <h3>{campaign.name}</h3>
                <p>{campaign.brand}</p>
              </div>
              <div className="campaign-meta">
                <span>{campaign.platforms.join(' / ')}</span>
                <span>
                  {campaign.timeline.start || 'TBD'} → {campaign.timeline.end || 'TBD'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>New Campaign</h3>
              <button type="button" className="link-button" onClick={closeModal}>
                Cancel
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
              <label>
                Campaign name
                <input 
                  className="input" 
                  value={form.name} 
                  onChange={(e) => updateForm('name', e.target.value)} 
                  placeholder="e.g. Summer Collection Launch"
                  autoFocus
                />
              </label>

              {role === 'brand' ? (
                <div>
                  <p className="label">Brand</p>
                  <p style={{ fontWeight: 600, color: 'var(--color-crimson)' }}>{form.brand}</p>
                </div>
              ) : (
                <label>
                  Brand
                  <select className="input" value={form.brand} onChange={(e) => updateForm('brand', e.target.value)}>
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div>
                <p className="label">Platforms</p>
                <div className="pill-group">
                  {['Instagram', 'TikTok'].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className={form.platforms.includes(platform) ? 'active' : undefined}
                      onClick={() => togglePlatform(platform)}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label>
                  Start date
                  <input
                    className="input"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm('startDate', e.target.value)}
                  />
                </label>
                <label>
                  End date
                  <input
                    className="input"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateForm('endDate', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleCreateCampaign}
                disabled={!form.name || !form.brand || form.platforms.length === 0}
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
