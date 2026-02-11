import { useEffect, useMemo, useState } from 'react';

const PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'Facebook'];
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
  title,
  subtitle,
  submitLabel,
  onClose,
  onChange,
  onTogglePlatform,
  onToggleContentFormat,
  onToggleObjective,
  onToggleCreatorTier,
  onSubmit,
}) {
  const showCreatorTiers = form.creatorType === 'Influencer' || form.creatorType === 'Hybrid';
  const modalTitle = title || 'Create New Campaign';
  const modalSubtitle = subtitle || 'Fill in the details to launch your campaign';
  const actionLabel = submitLabel || 'Create Campaign';
  const selectedPackage = packages.find((pkg) => pkg.id === form.campaignPackage);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched({});
    setSubmitAttempted(false);
    setSubmitError('');
    setIsSubmitting(false);
  }, [open]);

  const errors = useMemo(() => {
    const nextErrors = {};
    if (!form.name?.trim()) nextErrors.name = 'Campaign name is required.';
    if (!form.brand?.trim()) nextErrors.brand = 'Brand is required.';
    if (!form.creatorType) nextErrors.creatorType = 'Select a campaign type.';
    if (!form.dealType) nextErrors.dealType = 'Select a deal type.';
    if (!form.campaignPackage) nextErrors.campaignPackage = 'Select a package.';
    if (selectedPackage?.customizable && !form.customPackage?.trim()) {
      nextErrors.customPackage = 'Add custom package details.';
    }
    if (showCreatorTiers && (!form.creatorTiers || form.creatorTiers.length === 0)) {
      nextErrors.creatorTiers = 'Select at least one creator tier.';
    }
    if (form.creatorType !== 'UGC' && (!form.platforms || form.platforms.length === 0)) {
      nextErrors.platforms = 'Select at least one platform.';
    }
    if (!form.objectives || form.objectives.length === 0) {
      nextErrors.objectives = 'Select at least one objective.';
    }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      nextErrors.endDate = 'End date must be after the start date.';
    }
    return nextErrors;
  }, [form, selectedPackage, showCreatorTiers]);

  const showError = (field) => submitAttempted || touched[field];
  const fieldError = (field) => (showError(field) ? errors[field] : '');

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSubmitError('');
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      setSubmitError('Please fix the highlighted fields.');
      const firstError = errorKeys[0];
      const target = document.querySelector(`[data-field="${firstError}"]`);
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof target.focus === 'function') {
          target.focus();
        }
      }
      return;
    }
    try {
      setIsSubmitting(true);
      const result = onSubmit?.();
      let resolved = result;
      if (result && typeof result.then === 'function') {
        resolved = await result;
      }
      if (resolved !== false && onClose) {
        onClose();
      }
    } catch (error) {
      setSubmitError(error?.message || 'Something went wrong while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    if (form.dealType && pkg.deal_type !== form.dealType) return false;
    if (!form.creatorType) return false;
    if (form.creatorType === 'Hybrid') {
      return (
        pkg.package_type === 'bundle' ||
        (pkg.package_type === 'custom' && /hybrid\\s*other/i.test(pkg.name || ''))
      );
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

  if (!open) return null;

  return (
    <div className="modal-overlay active campaign-modal-overlay">
      <div className="campaign-modal">
        <div className="campaign-modal-header">
          <div>
            <h2>{modalTitle}</h2>
            <p>{modalSubtitle}</p>
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
                  className={`input ${fieldError('name') ? 'input-error' : ''}`}
                  value={form.name}
                  onChange={(event) => {
                    onChange('name', event.target.value);
                    markTouched('name');
                  }}
                  placeholder="e.g. Summer Collection Launch"
                  autoFocus
                  data-field="name"
                />
                {fieldError('name') && <p className="field-error">{fieldError('name')}</p>}
              </label>

              {role === 'brand' ? (
                <div className="campaign-field">
                  <span>Brand</span>
                  <p className="brand-display" data-field="brand">
                    {form.brand}
                  </p>
                  {fieldError('brand') && <p className="field-error">{fieldError('brand')}</p>}
                </div>
              ) : (
                <label className="campaign-field">
                  <span>Brand *</span>
                  <select
                    className={`input ${fieldError('brand') ? 'input-error' : ''}`}
                    value={form.brand}
                    onChange={(event) => {
                      onChange('brand', event.target.value);
                      markTouched('brand');
                    }}
                    data-field="brand"
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  {fieldError('brand') && <p className="field-error">{fieldError('brand')}</p>}
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
                  className={`input ${fieldError('creatorType') ? 'input-error' : ''}`}
                  value={form.creatorType}
                  onChange={(event) => {
                    onChange('creatorType', event.target.value);
                    markTouched('creatorType');
                  }}
                  data-field="creatorType"
                >
                  <option value="">Select type</option>
                  <option value="UGC">UGC</option>
                  <option value="Influencer">Influencer</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
                {fieldError('creatorType') && (
                  <p className="field-error">{fieldError('creatorType')}</p>
                )}
              </label>

              {role !== 'brand' && form.creatorType === 'Hybrid' && (
                <label className="campaign-field">
                  <span>Hybrid Details (Other)</span>
                  <input
                    className="input"
                    value={form.campaignTypeDetail || ''}
                    onChange={(event) => {
                      onChange('campaignTypeDetail', event.target.value);
                      markTouched('campaignTypeDetail');
                    }}
                    placeholder="Describe the hybrid setup..."
                    data-field="campaignTypeDetail"
                  />
                </label>
              )}

              <label className="campaign-field">
                <span>Type of Campaign (Deal) *</span>
                <select
                  className={`input ${fieldError('dealType') ? 'input-error' : ''}`}
                  value={form.dealType}
                  onChange={(event) => {
                    onChange('dealType', event.target.value);
                    markTouched('dealType');
                  }}
                  data-field="dealType"
                >
                  <option value="">Select deal type</option>
                  {DEAL_TYPES.map((type) => (
                    <option key={type} value={type.toLowerCase()}>
                      {type}
                    </option>
                  ))}
                </select>
                {fieldError('dealType') && <p className="field-error">{fieldError('dealType')}</p>}
              </label>

              <label className="campaign-field">
                <span>Start Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => {
                    onChange('startDate', event.target.value);
                    markTouched('startDate');
                  }}
                  data-field="startDate"
                />
              </label>

              <label className="campaign-field">
                <span>End Date</span>
                <input
                  className={`input ${fieldError('endDate') ? 'input-error' : ''}`}
                  type="date"
                  value={form.endDate}
                  onChange={(event) => {
                    onChange('endDate', event.target.value);
                    markTouched('endDate');
                  }}
                  data-field="endDate"
                />
                {fieldError('endDate') && <p className="field-error">{fieldError('endDate')}</p>}
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
                    <div
                      className={`pill-group ${form.creatorType === 'Hybrid' ? 'vertical' : ''}`}
                      data-field="campaignPackage"
                    >
                      {filteredPackages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className={form.campaignPackage === pkg.id ? 'active' : undefined}
                          onClick={() => {
                            onChange('campaignPackage', pkg.id);
                            markTouched('campaignPackage');
                          }}
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
                  {fieldError('campaignPackage') && (
                    <p className="field-error">{fieldError('campaignPackage')}</p>
                  )}
                </div>
                {selectedPackage?.customizable && (
                  <label className="campaign-field">
                    <span>Custom Package *</span>
                    <input
                      className={`input ${fieldError('customPackage') ? 'input-error' : ''}`}
                      value={form.customPackage}
                      onChange={(event) => {
                        onChange('customPackage', event.target.value);
                        markTouched('customPackage');
                      }}
                      placeholder="Enter custom package details"
                      data-field="customPackage"
                    />
                    {fieldError('customPackage') && (
                      <p className="field-error">{fieldError('customPackage')}</p>
                    )}
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
                  <div className="pill-group" data-field="creatorTiers">
                    {CREATOR_TIERS.map((tier) => (
                      <button
                        key={tier.value}
                        type="button"
                        className={form.creatorTiers?.includes(tier.value) ? 'active' : undefined}
                        onClick={() => {
                          onToggleCreatorTier(tier.value);
                          markTouched('creatorTiers');
                        }}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                  {fieldError('creatorTiers') && (
                    <p className="field-error">{fieldError('creatorTiers')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {form.creatorType !== 'UGC' && (
            <div className="campaign-form-section">
              <h4>Campaign Details</h4>
              <div className="campaign-form-grid">
                <div className="campaign-field">
                  <span>Platforms *</span>
                  <div className="pill-group" data-field="platforms">
                    {PLATFORM_OPTIONS.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        className={form.platforms.includes(platform) ? 'active' : undefined}
                        onClick={() => {
                          onTogglePlatform(platform);
                          markTouched('platforms');
                        }}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                  {fieldError('platforms') && (
                    <p className="field-error">{fieldError('platforms')}</p>
                  )}
                </div>

                <div className="campaign-field">
                  <span>Content Format</span>
                  <div className="pill-group" data-field="contentFormat">
                    {CONTENT_FORMAT_OPTIONS.map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={form.contentFormat.includes(format) ? 'active' : undefined}
                        onClick={() => {
                          onToggleContentFormat(format);
                          markTouched('contentFormat');
                        }}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="campaign-form-section">
            <h4>Objectives & Target</h4>
            <div className="campaign-form-grid">
              <div className="campaign-field full-width">
                <span>Campaign Objectives (Multi-select) *</span>
                <div className="pill-group" data-field="objectives">
                  {OBJECTIVES.map((obj) => (
                    <button
                      key={obj}
                      type="button"
                      className={form.objectives?.includes(obj.toLowerCase()) ? 'active' : undefined}
                      onClick={() => {
                        onToggleObjective(obj.toLowerCase());
                        markTouched('objectives');
                      }}
                    >
                      {obj}
                    </button>
                  ))}
                </div>
                {fieldError('objectives') && (
                  <p className="field-error">{fieldError('objectives')}</p>
                )}
              </div>

              <label className="campaign-field">
                <span>Target Audience</span>
                <input
                  className="input"
                  value={form.targetAudience}
                  onChange={(event) => {
                    onChange('targetAudience', event.target.value);
                    markTouched('targetAudience');
                  }}
                  placeholder="e.g. Women 18-35, Fashion enthusiasts"
                  data-field="targetAudience"
                />
              </label>

              <label className="campaign-field full-width">
                <span>Deliverables</span>
                <textarea
                  className="input textarea"
                  value={form.deliverables}
                  onChange={(event) => {
                    onChange('deliverables', event.target.value);
                    markTouched('deliverables');
                  }}
                  placeholder="e.g. 3 Reels, 5 Stories, 1 static post per creator"
                  rows={2}
                  data-field="deliverables"
                />
              </label>

              <label className="campaign-field full-width">
                <span>Additional Notes</span>
                <textarea
                  className="input textarea"
                  value={form.notes}
                  onChange={(event) => {
                    onChange('notes', event.target.value);
                    markTouched('notes');
                  }}
                  placeholder="Any other requirements or special instructions..."
                  rows={2}
                  data-field="notes"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="campaign-modal-footer">
          {submitError && <p className="field-error">{submitError}</p>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
