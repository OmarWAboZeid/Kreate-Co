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
  objectives: '',
  budgetRange: '',
  notes: '',
  followersMin: '',
  followersMax: '',
  niche: '',
  region: '',
  engagement: '',
  language: '',
  other: '',
};

export default function CampaignsPage() {
  const { role } = useParams();
  const { campaigns, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);

  const brandFilter = role === 'brand' ? storage.getBrand() || brands[0] : null;
  const visibleCampaigns = useMemo(() => {
    if (!brandFilter) return campaigns;
    return campaigns.filter((campaign) => campaign.brand === brandFilter);
  }, [brandFilter, campaigns]);

  const openWizard = () => {
    if (role === 'brand' && brandFilter) {
      setForm({ ...defaultForm, brand: brandFilter });
    } else {
      setForm(defaultForm);
    }
    setShowWizard(true);
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

  const resetWizard = () => {
    setForm(defaultForm);
    setStep(1);
    setShowWizard(false);
  };

  const handleCreateCampaign = (status) => {
    if (!form.name || !form.brand || form.platforms.length === 0) {
      return;
    }

    const newCampaign = {
      id: utils.makeId('camp'),
      name: form.name,
      brand: form.brand,
      platforms: form.platforms,
      status,
      objectives: form.objectives,
      budgetRange: form.budgetRange,
      timeline: { start: form.startDate, end: form.endDate },
      notes: form.notes,
      criteria: {
        followersMin: form.followersMin,
        followersMax: form.followersMax,
        niche: form.niche,
        region: form.region,
        engagement: form.engagement,
        language: form.language,
        other: form.other,
      },
      criteriaVersion: status === 'Submitted' ? 1 : 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    dispatch({ type: 'CREATE_CAMPAIGN', payload: newCampaign, actor: 'Admin' });
    resetWizard();
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Campaigns</h2>
          <p>Track progress from brief to activation.</p>
        </div>
        {(role === 'admin' || role === 'brand') && (
          <button type="button" className="btn btn-primary" onClick={openWizard}>
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
              <button type="button" className="btn btn-primary" onClick={openWizard}>
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

      {showWizard && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Campaign</h3>
              <button type="button" className="link-button" onClick={resetWizard}>
                Close
              </button>
            </div>

            <div className="wizard-steps">
              <button type="button" className={step === 1 ? 'active' : undefined} onClick={() => setStep(1)}>
                1. Basics
              </button>
              <button type="button" className={step === 2 ? 'active' : undefined} onClick={() => setStep(2)}>
                2. Criteria
              </button>
              <button type="button" className={step === 3 ? 'active' : undefined} onClick={() => setStep(3)}>
                3. Review
              </button>
            </div>

            {step === 1 && (
              <div className="wizard-panel">
                <label>
                  Campaign name
                  <input 
                    className="input" 
                    value={form.name} 
                    onChange={(e) => updateForm('name', e.target.value)} 
                    placeholder="e.g. Summer Collection Launch"
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
                <label>
                  Objectives
                  <textarea
                    className="input"
                    rows="3"
                    value={form.objectives}
                    onChange={(e) => updateForm('objectives', e.target.value)}
                  />
                </label>
                <label>
                  Budget range
                  <input
                    className="input"
                    value={form.budgetRange}
                    onChange={(e) => updateForm('budgetRange', e.target.value)}
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-panel">
                <div className="field-row">
                  <label>
                    Followers min
                    <input
                      className="input"
                      value={form.followersMin}
                      onChange={(e) => updateForm('followersMin', e.target.value)}
                    />
                  </label>
                  <label>
                    Followers max
                    <input
                      className="input"
                      value={form.followersMax}
                      onChange={(e) => updateForm('followersMax', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Niche / category tags
                  <input className="input" value={form.niche} onChange={(e) => updateForm('niche', e.target.value)} />
                </label>
                <label>
                  Region / language
                  <input className="input" value={form.region} onChange={(e) => updateForm('region', e.target.value)} />
                </label>
                <label>
                  Language
                  <input className="input" value={form.language} onChange={(e) => updateForm('language', e.target.value)} />
                </label>
                <label>
                  Engagement threshold
                  <input
                    className="input"
                    value={form.engagement}
                    onChange={(e) => updateForm('engagement', e.target.value)}
                  />
                </label>
                <label>
                  Other filters
                  <textarea className="input" rows="3" value={form.other} onChange={(e) => updateForm('other', e.target.value)} />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="wizard-panel">
                <div className="summary-card">
                  <h4>Summary</h4>
                  <p>
                    <strong>{form.name || 'Campaign name'}</strong> · {form.brand || 'Brand'}
                  </p>
                  <p>Platforms: {form.platforms.length ? form.platforms.join(' / ') : 'Select platforms'}</p>
                  <p>Timeline: {form.startDate || 'TBD'} → {form.endDate || 'TBD'}</p>
                  <p>Criteria: {form.followersMin || '—'} to {form.followersMax || '—'} followers · {form.niche || 'Niche'} · {form.region || 'Region'}</p>
                </div>
                <label>
                  Notes
                  <textarea className="input" rows="3" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
                </label>
              </div>
            )}

            <div className="wizard-actions">
              {step === 1 ? (
                <button type="button" className="btn btn-secondary" onClick={resetWizard}>
                  Cancel
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                  ← Previous
                </button>
              )}
              <div>
                {step < 3 ? (
                  <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
                    Next →
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => handleCreateCampaign('Draft')}>
                      Save Draft
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleCreateCampaign('Submitted')}>
                      {role === 'brand' ? 'Submit Brief' : 'Submit for Processing'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
