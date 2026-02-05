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

const UGC_PACKAGES = [
  { value: '4', label: '4 Videos' },
  { value: '8', label: '8 Videos' },
  { value: '12', label: '12 Videos' },
  { value: '20', label: '20 Videos' },
  { value: 'other', label: 'Other' },
];

const INFLUENCER_PACKAGES = [
  { value: '10', label: '10 Videos' },
  { value: '15', label: '15 Videos' },
  { value: '20', label: '20 Videos' },
  { value: '40', label: '40 Videos' },
  { value: 'other', label: 'Other' },
];

const HYBRID_BUNDLES = [
  { value: 'buzz', label: 'Buzz Bundle', desc: '4 UGC, 10 influencer videos' },
  { value: 'hype', label: 'Hype Bundle', desc: '8 UGC, 15 influencer videos' },
  { value: 'impact', label: 'Impact Bundle', desc: '12 UGC, 25 influencer videos' },
  { value: 'viral', label: 'Viral Campaign', desc: '20 UGC, 40 influencer videos' },
];

export default function CampaignFormModal({
  open,
  form,
  brands,
  role,
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

  const getPackageOptions = () => {
    if (form.creatorType === 'UGC') return UGC_PACKAGES;
    if (form.creatorType === 'Influencer') return INFLUENCER_PACKAGES;
    return null;
  };

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
                {form.creatorType === 'Hybrid' ? (
                  <div className="campaign-field full-width">
                    <span>Select Bundle</span>
                    <div className="pill-group vertical">
                      {HYBRID_BUNDLES.map((bundle) => (
                        <button
                          key={bundle.value}
                          type="button"
                          className={form.campaignPackage === bundle.value ? 'active' : undefined}
                          onClick={() => onChange('campaignPackage', bundle.value)}
                        >
                          <strong>{bundle.label}</strong> - {bundle.desc}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="campaign-field">
                      <span>Package</span>
                      <div className="pill-group">
                        {getPackageOptions()?.map((pkg) => (
                          <button
                            key={pkg.value}
                            type="button"
                            className={form.campaignPackage === pkg.value ? 'active' : undefined}
                            onClick={() => onChange('campaignPackage', pkg.value)}
                          >
                            {pkg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.campaignPackage === 'other' && (
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
                  </>
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
              (form.campaignPackage === 'other' && !form.customPackage) ||
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
