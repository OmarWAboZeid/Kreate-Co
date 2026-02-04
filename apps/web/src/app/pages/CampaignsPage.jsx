import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CampaignWizard from '../components/CampaignWizard.jsx';
import { storage, useAppDispatch, useAppState, utils } from '../state.jsx';

const defaultForm = {
  name: '',
  brand: '',
  platforms: [],
  startDate: '',
  endDate: '',
  description: '',
  objectives: '',
  budget: '',
  targetAudience: '',
  creatorType: '',
  creatorsNeeded: '',
  deliverables: '',
  contentFormat: [],
  notes: '',
};

function KebabMenu({ campaign, onEdit, onArchive }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="kebab-menu">
      <button 
        type="button" 
        className="kebab-trigger"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(!open); }}
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="kebab-backdrop" onClick={() => setOpen(false)} />
          <div className="kebab-dropdown">
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(campaign); setOpen(false); }}
            >
              Edit
            </button>
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onArchive(campaign); setOpen(false); }}
            >
              Archive
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatPackage(campaign) {
  if (campaign.bundle) {
    return `${campaign.bundle} Bundle`;
  }
  if (campaign.packageType === 'Custom') {
    const parts = [];
    if (campaign.ugcCount) parts.push(`${campaign.ugcCount} UGC`);
    if (campaign.influencerCount) parts.push(`${campaign.influencerCount} Influencers`);
    return parts.length > 0 ? parts.join(', ') : 'Custom';
  }
  return campaign.packageType || '—';
}

function formatCampaignKind(campaign) {
  const type = campaign.creatorType || campaign.campaignType;
  if (type === 'UGC Creators' || type === 'UGC') return 'UGC';
  if (type === 'Influencers' || type === 'Influencer') return 'Influencer';
  if (type === 'Both' || type === 'Hybrid') return 'Hybrid';
  return 'Hybrid';
}

function formatDealType(campaign) {
  const deal = campaign.paymentType || campaign.dealType;
  if (deal === 'Collab') return 'Collab';
  if (deal === 'Paid') return 'Paid';
  if (deal === 'Mix') return 'Mix';
  return '—';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function CampaignsPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { campaigns, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [adminBrandFilter, setAdminBrandFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const brandFilter = role === 'brand' ? storage.getBrand() || brands[0] : null;
  
  const visibleCampaigns = useMemo(() => {
    let filtered = campaigns;
    
    if (brandFilter) {
      filtered = filtered.filter((campaign) => campaign.brand === brandFilter);
    }
    if ((role === 'admin' || role === 'employee') && adminBrandFilter) {
      filtered = filtered.filter((campaign) => campaign.brand === adminBrandFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => 
        c.name?.toLowerCase().includes(q) || 
        c.brand?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }
    
    return [...filtered].sort((a, b) => {
      const dateA = a.timeline?.start || a.createdAt || '';
      const dateB = b.timeline?.start || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [brandFilter, campaigns, role, adminBrandFilter, searchQuery, statusFilter]);

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

  const toggleContentFormat = (format) => {
    setForm((prev) => {
      const exists = prev.contentFormat.includes(format);
      return {
        ...prev,
        contentFormat: exists ? prev.contentFormat.filter((item) => item !== format) : [...prev.contentFormat, format],
      };
    });
  };

  const closeModal = () => {
    setForm(defaultForm);
    setShowModal(false);
  };

  const handleWizardSubmit = (wizardData) => {
    const newCampaign = {
      id: utils.makeId('camp'),
      name: wizardData.name,
      brand: wizardData.brand,
      brandType: wizardData.brandType,
      platforms: wizardData.influencer?.platforms || ['Instagram'],
      status: 'Draft',
      description: '',
      objectives: wizardData.objectives,
      paymentType: wizardData.paymentType,
      packageType: wizardData.packageType,
      bundle: wizardData.bundle,
      ugcCount: wizardData.ugcCount,
      influencerCount: wizardData.influencerCount,
      creatorTiers: wizardData.creatorTiers,
      targetAudience: '',
      creatorType: wizardData.campaignType,
      deliverables: '',
      contentFormat: [],
      timeline: { start: wizardData.startDate, end: '' },
      notes: '',
      criteria: {
        ugc: wizardData.ugc,
        influencer: wizardData.influencer,
      },
      criteriaVersion: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    dispatch({ type: 'CREATE_CAMPAIGN', payload: newCampaign, actor: 'Brand' });
    setShowWizard(false);
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
      description: form.description,
      objectives: form.objectives,
      budgetRange: form.budget,
      targetAudience: form.targetAudience,
      creatorType: form.creatorType,
      creatorsNeeded: form.creatorsNeeded,
      deliverables: form.deliverables,
      contentFormat: form.contentFormat,
      timeline: { start: form.startDate, end: form.endDate },
      notes: form.notes,
      criteria: {},
      criteriaVersion: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    dispatch({ type: 'CREATE_CAMPAIGN', payload: newCampaign, actor: 'Admin' });
    closeModal();
  };

  const handleEdit = (campaign) => {
    navigate(`${campaign.id}`);
  };

  const handleArchive = (campaign) => {
    dispatch({ type: 'UPDATE_CAMPAIGN_STATUS', payload: { campaignId: campaign.id, status: 'Archived' } });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setAdminBrandFilter('');
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Campaigns</h2>
          <p>Track progress from brief to activation.</p>
        </div>
        {(role === 'admin' || role === 'employee' || role === 'brand') && (
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => role === 'brand' ? setShowWizard(true) : openModal()}
          >
            Create Campaign
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input 
          className="input" 
          placeholder="Search campaigns" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select 
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="In Review">In Review</option>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
        </select>
        {(role === 'admin' || role === 'employee') && (
          <select 
            className="input"
            value={adminBrandFilter}
            onChange={(e) => setAdminBrandFilter(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        )}
      </div>

      {visibleCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns found"
          description={searchQuery || statusFilter || adminBrandFilter 
            ? "Try adjusting your filters or search query." 
            : "Create your first campaign to start building a roster."}
          action={
            <div className="empty-state-actions">
              {(searchQuery || statusFilter || adminBrandFilter) && (
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
              {(role === 'admin' || role === 'employee' || role === 'brand') && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => role === 'brand' ? setShowWizard(true) : openModal()}
                >
                  Create Campaign
                </button>
              )}
            </div>
          }
        />
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="campaigns-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Brand</th>
                <th className="hide-mobile">Kind</th>
                <th className="hide-mobile">Deal Type</th>
                <th className="hide-mobile">Start Date</th>
                <th className="hide-mobile">Package</th>
                <th>Status</th>
                <th className="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign) => (
                <tr 
                  key={campaign.id} 
                  onClick={() => navigate(campaign.id)}
                  className="campaigns-table-row"
                >
                  <td className="campaign-name-cell">
                    <span className="campaign-name">{campaign.name}</span>
                    <span className="campaign-mobile-meta">
                      {formatCampaignKind(campaign)} · {formatDealType(campaign)} · {formatDate(campaign.timeline?.start)}
                    </span>
                  </td>
                  <td>{campaign.brand}</td>
                  <td className="hide-mobile">
                    <span className="kind-badge">{formatCampaignKind(campaign)}</span>
                  </td>
                  <td className="hide-mobile">{formatDealType(campaign)}</td>
                  <td className="hide-mobile">{formatDate(campaign.timeline?.start)}</td>
                  <td className="hide-mobile package-cell">{formatPackage(campaign)}</td>
                  <td>
                    <StatusPill status={campaign.status} />
                  </td>
                  <td className="actions-col">
                    <KebabMenu 
                      campaign={campaign} 
                      onEdit={handleEdit} 
                      onArchive={handleArchive} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay active">
          <div className="campaign-modal">
            <div className="campaign-modal-header">
              <div>
                <h2>Create New Campaign</h2>
                <p>Fill in the details to launch your campaign</p>
              </div>
              <button type="button" className="campaign-modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <div className="campaign-modal-body">
              <div className="campaign-form-section">
                <h4>Basic Information</h4>
                <div className="campaign-form-grid">
                  <label className="campaign-field full-width">
                    <span>Campaign Name *</span>
                    <input 
                      className="input" 
                      value={form.name} 
                      onChange={(e) => updateForm('name', e.target.value)} 
                      placeholder="e.g. Summer Collection Launch"
                      autoFocus
                    />
                  </label>

                  {role === 'brand' ? (
                    <div className="campaign-field">
                      <span>Brand</span>
                      <p className="brand-display">{form.brand}</p>
                    </div>
                  ) : (
                    <label className="campaign-field">
                      <span>Brand *</span>
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

                  <label className="campaign-field full-width">
                    <span>Campaign Description</span>
                    <textarea 
                      className="input textarea" 
                      value={form.description} 
                      onChange={(e) => updateForm('description', e.target.value)} 
                      placeholder="Describe your campaign goals and vision..."
                      rows={3}
                    />
                  </label>
                </div>
              </div>

              <div className="campaign-form-section">
                <h4>Campaign Details</h4>
                <div className="campaign-form-grid">
                  <div className="campaign-field">
                    <span>Platforms *</span>
                    <div className="pill-group">
                      {['Instagram', 'TikTok', 'Facebook'].map((platform) => (
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

                  <div className="campaign-field">
                    <span>Content Format</span>
                    <div className="pill-group">
                      {['Reels', 'Stories', 'Posts', 'Videos'].map((format) => (
                        <button
                          key={format}
                          type="button"
                          className={form.contentFormat.includes(format) ? 'active' : undefined}
                          onClick={() => toggleContentFormat(format)}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="campaign-field">
                    <span>Creator Type</span>
                    <select className="input" value={form.creatorType} onChange={(e) => updateForm('creatorType', e.target.value)}>
                      <option value="">Select type</option>
                      <option value="UGC Creators">UGC Creators</option>
                      <option value="Influencers">Influencers</option>
                      <option value="Both">Both</option>
                    </select>
                  </label>

                  <label className="campaign-field">
                    <span>Start Date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => updateForm('startDate', e.target.value)}
                    />
                  </label>

                  <label className="campaign-field">
                    <span>End Date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => updateForm('endDate', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="campaign-form-section">
                <h4>Target & Objectives</h4>
                <div className="campaign-form-grid">
                  <label className="campaign-field">
                    <span>Target Audience</span>
                    <input 
                      className="input" 
                      value={form.targetAudience} 
                      onChange={(e) => updateForm('targetAudience', e.target.value)} 
                      placeholder="e.g. Women 18-35, Fashion enthusiasts"
                    />
                  </label>

                  <label className="campaign-field">
                    <span>Campaign Objectives</span>
                    <select className="input" value={form.objectives} onChange={(e) => updateForm('objectives', e.target.value)}>
                      <option value="">Select objective</option>
                      <option value="Awareness">Awareness</option>
                      <option value="Sales">Sales</option>
                      <option value="Launch">Launch</option>
                      <option value="Content Bank">Content Bank</option>
                    </select>
                  </label>

                  <label className="campaign-field full-width">
                    <span>Deliverables</span>
                    <textarea 
                      className="input textarea" 
                      value={form.deliverables} 
                      onChange={(e) => updateForm('deliverables', e.target.value)} 
                      placeholder="e.g. 3 Reels, 5 Stories, 1 static post per creator"
                      rows={2}
                    />
                  </label>

                  <label className="campaign-field full-width">
                    <span>Additional Notes</span>
                    <textarea 
                      className="input textarea" 
                      value={form.notes} 
                      onChange={(e) => updateForm('notes', e.target.value)} 
                      placeholder="Any other requirements or special instructions..."
                      rows={2}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="campaign-modal-footer">
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

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
          brandName={brandFilter}
        />
      )}
    </div>
  );
}
