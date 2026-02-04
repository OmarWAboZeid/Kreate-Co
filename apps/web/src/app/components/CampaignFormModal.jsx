const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'Facebook'];
const CONTENT_FORMAT_OPTIONS = ['Reels', 'Stories', 'Posts', 'Videos'];

export default function CampaignFormModal({
  open,
  form,
  brands,
  role,
  onClose,
  onChange,
  onTogglePlatform,
  onToggleContentFormat,
  onSubmit,
}) {
  if (!open) return null;

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

              <label className="campaign-field">
                <span>Creator Type</span>
                <select
                  className="input"
                  value={form.creatorType}
                  onChange={(event) => onChange('creatorType', event.target.value)}
                >
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

          <div className="campaign-form-section">
            <h4>Target & Objectives</h4>
            <div className="campaign-form-grid">
              <label className="campaign-field">
                <span>Target Audience</span>
                <input
                  className="input"
                  value={form.targetAudience}
                  onChange={(event) => onChange('targetAudience', event.target.value)}
                  placeholder="e.g. Women 18-35, Fashion enthusiasts"
                />
              </label>

              <label className="campaign-field">
                <span>Campaign Objectives</span>
                <select
                  className="input"
                  value={form.objectives}
                  onChange={(event) => onChange('objectives', event.target.value)}
                >
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
            disabled={!form.name || !form.brand || form.platforms.length === 0}
          >
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
