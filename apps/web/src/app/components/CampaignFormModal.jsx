const PLATFORM_OPTIONS = ['TikTok', 'Instagram'];
const CONTENT_FORMAT_OPTIONS = ['Reel', 'Post', 'Story'];
const DEAL_TYPES = ['Collab', 'Paid', 'Mix'];
const OBJECTIVES = ['Awareness', 'Sales', 'Launch', 'Content Bank'];
const CREATOR_TIERS = [
  { value: 'nano', label: 'Nano Influencers' },
  { value: 'micro', label: 'Micro Influencers' },
  { value: 'mid-tier', label: 'Mid-tier' },
  { value: 'macro', label: 'Macro' },
];

const dealTypeLabel = {
  collab: 'Collab',
  paid: 'Paid',
  mix: 'Mix',
};

export default function CampaignFormModal({
  open,
  form,
  brands,
  role,
  packages = [],
  loadingPackages = false,
  onClose,
  onChange,
  onTogglePlatform,
  onToggleContentFormat,
  onToggleObjective,
  onToggleCreatorTier,
  onSubmit,
}) {
  if (!open) return null;

  const showCreatorTiers = form.creatorType === 'Influencer' || form.creatorType === 'Hybrid';

  const selectedPackage = packages.find((pkg) => pkg.id === form.campaignPackage);

  const filteredPackages = packages.filter((pkg) => {
    if (form.dealType && pkg.deal_type !== form.dealType) return false;
    if (!form.creatorType) return false;
    if (form.creatorType === 'Hybrid') {
      return pkg.package_type === 'bundle';
    }
    if (form.creatorType === 'UGC') {
      return pkg.package_type === 'ugc' || (pkg.package_type === 'custom' && /ugc/i.test(pkg.name));
    }
    if (form.creatorType === 'Influencer') {
      return (
        pkg.package_type === 'influencer' ||
        (pkg.package_type === 'custom' && /influencer/i.test(pkg.name))
      );
    }
    return false;
  });

  return (
    <div className="modal-overlay active">
      <div className="campaign-modal">
        <div className="campaign-modal-header">
          <div>
            <h2>Create New Campaign</h2>
            <p>Fill in the details to launch your campaign</p>
          </div>
          <button type="button" className="campaign-modal-close" onClick={onClose}>
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
                  onChange={(event) => onChange('name', event.target.value)}
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
                  <select
                    className="input"
                    value={form.brand}
                    onChange={(event) => onChange('brand', event.target.value)}
                  >
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
                  onChange={(event) => onChange('description', event.target.value)}
                  placeholder="Describe your campaign goals and vision..."
                  rows={3}
                />
              </label>
            </div>
          </div>

          <div className="campaign-form-section">
            <h4>Campaign Type & Payment</h4>
            <div className="campaign-form-grid">
              <label className="campaign-field">
                <span>Campaign Type *</span>
                <select
                  className="input"
                  value={form.creatorType}
                  onChange={(event) => onChange('creatorType', event.target.value)}
                >
                  <option value="">Select type</option>
                  <option value="UGC">UGC</option>
                  <option value="Influencer">Influencer</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>

              <label className="campaign-field">
                <span>Type of Campaign (Deal) *</span>
                <select
                  className="input"
                  value={form.dealType}
                  onChange={(event) => onChange('dealType', event.target.value)}
                >
                  <option value="">Select deal type</option>
                  {DEAL_TYPES.map((type) => (
                    <option key={type} value={type.toLowerCase()}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="campaign-field">
                <span>Start Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => onChange('startDate', event.target.value)}
                />
              </label>

              <label className="campaign-field">
                <span>End Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => onChange('endDate', event.target.value)}
                />
              </label>
            </div>
          </div>

          {form.creatorType && (
            <div className="campaign-form-section">
              <h4>Campaign Package *</h4>
              <div className="campaign-form-grid">
                <div className="campaign-field full-width">
                  <span>
                    Package{form.dealType ? ` · ${dealTypeLabel[form.dealType]}` : ''}
                  </span>
                  {loadingPackages ? (
                    <p className="muted">Loading packages...</p>
                  ) : (
                    <div className={`pill-group ${form.creatorType === 'Hybrid' ? 'vertical' : ''}`}>
                      {filteredPackages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className={form.campaignPackage === pkg.id ? 'active' : undefined}
                          onClick={() => onChange('campaignPackage', pkg.id)}
                        >
                          <strong>{pkg.name}</strong>
                          {pkg.description ? ` - ${pkg.description}` : ''}
                          {pkg.price_amount != null ? ` · $${pkg.price_amount}` : ''}
                        </button>
                      ))}
                      {filteredPackages.length === 0 && (
                        <span className="muted">Select a deal type to see packages.</span>
                      )}
                    </div>
                  )}
                </div>
                {selectedPackage?.customizable && (
                  <label className="campaign-field">
                    <span>Custom Package *</span>
                    <input
                      className="input"
                      value={form.customPackage}
                      onChange={(event) => onChange('customPackage', event.target.value)}
                      placeholder="Enter custom package details"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {showCreatorTiers && (
            <div className="campaign-form-section">
              <h4>Creator Tiers (Multi-select) *</h4>
              <div className="campaign-form-grid">
                <div className="campaign-field full-width">
                  <div className="pill-group">
                    {CREATOR_TIERS.map((tier) => (
                      <button
                        key={tier.value}
                        type="button"
                        className={form.creatorTiers?.includes(tier.value) ? 'active' : undefined}
                        onClick={() => onToggleCreatorTier(tier.value)}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="campaign-form-section">
            <h4>Campaign Details</h4>
            <div className="campaign-form-grid">
              <div className="campaign-field">
                <span>Platforms *</span>
                <div className="pill-group">
                  {PLATFORM_OPTIONS.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className={form.platforms.includes(platform) ? 'active' : undefined}
                      onClick={() => onTogglePlatform(platform)}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <div className="campaign-field">
                <span>Content Format</span>
                <div className="pill-group">
                  {CONTENT_FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format}
                      type="button"
                      className={form.contentFormat.includes(format) ? 'active' : undefined}
                      onClick={() => onToggleContentFormat(format)}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="campaign-form-section">
            <h4>Objectives & Target</h4>
            <div className="campaign-form-grid">
              <div className="campaign-field full-width">
                <span>Campaign Objectives (Multi-select) *</span>
                <div className="pill-group">
                  {OBJECTIVES.map((obj) => (
                    <button
                      key={obj}
                      type="button"
                      className={form.objectives?.includes(obj.toLowerCase()) ? 'active' : undefined}
                      onClick={() => onToggleObjective(obj.toLowerCase())}
                    >
                      {obj}
                    </button>
                  ))}
                </div>
              </div>

              <label className="campaign-field">
                <span>Target Audience</span>
                <input
                  className="input"
                  value={form.targetAudience}
                  onChange={(event) => onChange('targetAudience', event.target.value)}
                  placeholder="e.g. Women 18-35, Fashion enthusiasts"
                />
              </label>

              <label className="campaign-field full-width">
                <span>Deliverables</span>
                <textarea
                  className="input textarea"
                  value={form.deliverables}
                  onChange={(event) => onChange('deliverables', event.target.value)}
                  placeholder="e.g. 3 Reels, 5 Stories, 1 static post per creator"
                  rows={2}
                />
              </label>

              <label className="campaign-field full-width">
                <span>Additional Notes</span>
                <textarea
                  className="input textarea"
                  value={form.notes}
                  onChange={(event) => onChange('notes', event.target.value)}
                  placeholder="Any other requirements or special instructions..."
                  rows={2}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="campaign-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={
              !form.name ||
              !form.brand ||
              !form.creatorType ||
              !form.dealType ||
              !form.campaignPackage ||
              (selectedPackage?.customizable && !form.customPackage) ||
              (showCreatorTiers && (!form.creatorTiers || form.creatorTiers.length === 0)) ||
              form.platforms.length === 0 ||
              !form.objectives ||
              form.objectives.length === 0
            }
          >
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
