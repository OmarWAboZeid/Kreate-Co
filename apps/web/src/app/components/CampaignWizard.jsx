import { useState } from 'react';

const STEPS = {
  NAME: 1,
  BRAND_TYPE: 2,
  OBJECTIVES: 3,
  START_DATE: 4,
  CAMPAIGN_TYPE: 5,
  PAYMENT_TYPE: 6,
  PACKAGE_SELECTION: 7,
  CREATOR_TIERS: 8,
  UGC_PERSONA: 9,
  UGC_GENDER: 10,
  UGC_AGE: 11,
  INFLUENCER_NICHE: 12,
  INFLUENCER_PLATFORMS: 13,
  REVIEW: 14,
};

const OBJECTIVES = ['Awareness', 'Sales', 'Launch', 'Content Bank'];

const CREATOR_TIERS = [
  { value: 'nano', label: 'Nano', desc: '1K-10K followers' },
  { value: 'micro', label: 'Micro', desc: '10K-50K followers' },
  { value: 'mid-tier', label: 'Mid-tier', desc: '50K-500K followers' },
  { value: 'macro', label: 'Macro', desc: '500K+ followers' },
];

const NICHES = ['Fashion', 'F&B', 'Beauty', 'Lifestyle', 'Tech'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook'];

const UGC_PACKAGES = [
  { value: '4', label: '4 Videos' },
  { value: '8', label: '8 Videos' },
  { value: '12', label: '12 Videos' },
  { value: '20', label: '20 Videos' },
  { value: 'other', label: 'Other' },
];

const INFLUENCER_PACKAGES = [
  { value: '10', label: '10 Creators' },
  { value: '15', label: '15 Creators' },
  { value: '20', label: '20 Creators' },
  { value: '40', label: '40 Creators' },
  { value: 'other', label: 'Other' },
];

const BUNDLES = [
  { value: 'buzz', label: 'Buzz', ugc: 4, influencer: 10, desc: 'Perfect for small launches' },
  { value: 'hype', label: 'Hype', ugc: 8, influencer: 15, desc: 'Build momentum' },
  { value: 'impact', label: 'Impact', ugc: 12, influencer: 25, desc: 'Maximum reach' },
  { value: 'viral', label: 'Viral', ugc: 20, influencer: 40, desc: 'Go all out' },
];

export default function CampaignWizard({ onClose, onSubmit, brandName }) {
  const [currentStep, setCurrentStep] = useState(STEPS.NAME);
  const [form, setForm] = useState({
    name: '',
    brandType: '',
    existingBrandName: brandName || '',
    newBrandName: '',
    objectives: '',
    startDate: '',
    campaignType: '',
    paymentType: '',
    packageType: '',
    ugcPackage: '',
    ugcPackageOther: '',
    influencerPackage: '',
    influencerPackageOther: '',
    bundle: '',
    creatorTiers: [],
    ugcPersona: '',
    ugcGender: '',
    ugcAgeRange: '',
    influencerNiche: '',
    influencerPlatforms: [],
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCreatorTier = (tier) => {
    setForm((prev) => {
      const exists = prev.creatorTiers.includes(tier);
      return {
        ...prev,
        creatorTiers: exists
          ? prev.creatorTiers.filter((t) => t !== tier)
          : [...prev.creatorTiers, tier],
      };
    });
  };

  const togglePlatform = (platform) => {
    setForm((prev) => {
      const exists = prev.influencerPlatforms.includes(platform);
      return {
        ...prev,
        influencerPlatforms: exists
          ? prev.influencerPlatforms.filter((p) => p !== platform)
          : [...prev.influencerPlatforms, platform],
      };
    });
  };

  const getNextStep = () => {
    if (currentStep === STEPS.PACKAGE_SELECTION) {
      if (form.campaignType === 'UGC') return STEPS.UGC_PERSONA;
      return STEPS.CREATOR_TIERS;
    }
    if (currentStep === STEPS.CREATOR_TIERS) {
      if (form.campaignType === 'Hybrid') return STEPS.UGC_PERSONA;
      return STEPS.INFLUENCER_NICHE;
    }
    if (currentStep === STEPS.UGC_AGE) {
      if (form.campaignType === 'Hybrid') return STEPS.INFLUENCER_NICHE;
      return STEPS.REVIEW;
    }
    if (currentStep === STEPS.INFLUENCER_PLATFORMS) {
      return STEPS.REVIEW;
    }
    return currentStep + 1;
  };

  const getPrevStep = () => {
    if (currentStep === STEPS.UGC_PERSONA) {
      if (form.campaignType === 'Hybrid') return STEPS.CREATOR_TIERS;
      return STEPS.PACKAGE_SELECTION;
    }
    if (currentStep === STEPS.CREATOR_TIERS) return STEPS.PACKAGE_SELECTION;
    if (currentStep === STEPS.INFLUENCER_NICHE) {
      if (form.campaignType === 'Hybrid') return STEPS.UGC_AGE;
      return STEPS.CREATOR_TIERS;
    }
    if (currentStep === STEPS.REVIEW) {
      if (form.campaignType === 'UGC') return STEPS.UGC_AGE;
      return STEPS.INFLUENCER_PLATFORMS;
    }
    return currentStep - 1;
  };

  const canProceed = () => {
    switch (currentStep) {
      case STEPS.NAME: return form.name.trim().length > 0;
      case STEPS.BRAND_TYPE: {
        if (!form.brandType) return false;
        if (form.brandType === 'existing') return true;
        return form.newBrandName.trim().length > 0;
      }
      case STEPS.OBJECTIVES: return form.objectives.length > 0;
      case STEPS.START_DATE: return form.startDate.length > 0;
      case STEPS.CAMPAIGN_TYPE: return form.campaignType.length > 0;
      case STEPS.PAYMENT_TYPE: return form.paymentType.length > 0;
      case STEPS.PACKAGE_SELECTION: {
        if (form.packageType === 'bundle') return form.bundle.length > 0;
        if (form.campaignType === 'UGC') {
          if (form.ugcPackage === 'other') return form.ugcPackageOther.trim().length > 0;
          return form.ugcPackage.length > 0;
        }
        if (form.campaignType === 'Influencer') {
          if (form.influencerPackage === 'other') return form.influencerPackageOther.trim().length > 0;
          return form.influencerPackage.length > 0;
        }
        if (form.campaignType === 'Hybrid') {
          const ugcValid = form.ugcPackage === 'other' ? form.ugcPackageOther.trim().length > 0 : form.ugcPackage.length > 0;
          const infValid = form.influencerPackage === 'other' ? form.influencerPackageOther.trim().length > 0 : form.influencerPackage.length > 0;
          return ugcValid && infValid;
        }
        return false;
      }
      case STEPS.CREATOR_TIERS: return form.creatorTiers.length > 0;
      case STEPS.UGC_PERSONA: return form.ugcPersona.trim().length > 0;
      case STEPS.UGC_GENDER: return form.ugcGender.length > 0;
      case STEPS.UGC_AGE: return form.ugcAgeRange.length > 0;
      case STEPS.INFLUENCER_NICHE: return form.influencerNiche.length > 0;
      case STEPS.INFLUENCER_PLATFORMS: return form.influencerPlatforms.length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setCurrentStep(getNextStep());
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.NAME) {
      setCurrentStep(getPrevStep());
    }
  };

  const getBrandName = () => {
    if (form.brandType === 'existing') return form.existingBrandName;
    return form.newBrandName;
  };

  const getPackageDetails = () => {
    if (form.packageType === 'bundle') {
      const bundle = BUNDLES.find(b => b.value === form.bundle);
      return { ugcCount: bundle?.ugc || 0, influencerCount: bundle?.influencer || 0 };
    }
    return {
      ugcCount: form.ugcPackage === 'other' ? form.ugcPackageOther : form.ugcPackage,
      influencerCount: form.influencerPackage === 'other' ? form.influencerPackageOther : form.influencerPackage,
    };
  };

  const handleSubmit = () => {
    const packageDetails = getPackageDetails();
    onSubmit({
      name: form.name,
      brand: getBrandName(),
      brandType: form.brandType,
      objectives: form.objectives,
      startDate: form.startDate,
      campaignType: form.campaignType,
      paymentType: form.paymentType,
      packageType: form.packageType,
      bundle: form.bundle,
      ugcCount: packageDetails.ugcCount,
      influencerCount: packageDetails.influencerCount,
      creatorTiers: form.creatorTiers,
      ugc: form.campaignType === 'UGC' || form.campaignType === 'Hybrid' ? {
        persona: form.ugcPersona,
        gender: form.ugcGender,
        ageRange: form.ugcAgeRange,
      } : null,
      influencer: form.campaignType === 'Influencer' || form.campaignType === 'Hybrid' ? {
        niche: form.influencerNiche,
        platforms: form.influencerPlatforms,
        tiers: form.creatorTiers,
      } : null,
    });
  };

  const getTotalSteps = () => {
    if (form.campaignType === 'UGC') return 11;
    if (form.campaignType === 'Influencer') return 10;
    if (form.campaignType === 'Hybrid') return 14;
    return 7;
  };

  const getProgress = () => {
    const total = getTotalSteps();
    return Math.min((currentStep / total) * 100, 100);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.NAME:
        return (
          <div className="wizard-step">
            <h3>What's your campaign called?</h3>
            <p>Give your campaign a memorable name</p>
            <input
              className="input wizard-input"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="e.g. Summer Collection Launch"
              autoFocus
            />
          </div>
        );

      case STEPS.BRAND_TYPE:
        return (
          <div className="wizard-step">
            <h3>Is this for a new or existing brand?</h3>
            <p>Select the brand type for this campaign</p>
            <div className="wizard-options">
              <button
                type="button"
                className={`wizard-option-card ${form.brandType === 'existing' ? 'active' : ''}`}
                onClick={() => updateForm('brandType', 'existing')}
              >
                <span className="wizard-option-title">Existing Brand</span>
                <span className="wizard-option-desc">{form.existingBrandName || 'Your current brand'}</span>
              </button>
              <button
                type="button"
                className={`wizard-option-card ${form.brandType === 'new' ? 'active' : ''}`}
                onClick={() => updateForm('brandType', 'new')}
              >
                <span className="wizard-option-title">New Brand</span>
                <span className="wizard-option-desc">Add a new brand to your account</span>
              </button>
            </div>
            {form.brandType === 'new' && (
              <div className="wizard-input-group">
                <label>New Brand Name</label>
                <input
                  className="input wizard-input"
                  value={form.newBrandName}
                  onChange={(e) => updateForm('newBrandName', e.target.value)}
                  placeholder="Enter brand name"
                />
              </div>
            )}
          </div>
        );

      case STEPS.OBJECTIVES:
        return (
          <div className="wizard-step">
            <h3>What's your main objective?</h3>
            <p>Select the primary goal for this campaign</p>
            <div className="wizard-options">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj}
                  type="button"
                  className={`wizard-option ${form.objectives === obj ? 'active' : ''}`}
                  onClick={() => updateForm('objectives', obj)}
                >
                  {obj}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.START_DATE:
        return (
          <div className="wizard-step">
            <h3>When should this campaign start?</h3>
            <p>Pick a launch date</p>
            <input
              className="input wizard-input"
              type="date"
              value={form.startDate}
              onChange={(e) => updateForm('startDate', e.target.value)}
            />
          </div>
        );

      case STEPS.CAMPAIGN_TYPE:
        return (
          <div className="wizard-step">
            <h3>What type of campaign is this?</h3>
            <p>Choose the creator type for your campaign</p>
            <div className="wizard-options">
              <button
                type="button"
                className={`wizard-option-card ${form.campaignType === 'UGC' ? 'active' : ''}`}
                onClick={() => updateForm('campaignType', 'UGC')}
              >
                <span className="wizard-option-title">UGC</span>
                <span className="wizard-option-desc">User-generated content creators</span>
              </button>
              <button
                type="button"
                className={`wizard-option-card ${form.campaignType === 'Influencer' ? 'active' : ''}`}
                onClick={() => updateForm('campaignType', 'Influencer')}
              >
                <span className="wizard-option-title">Influencer</span>
                <span className="wizard-option-desc">Social media influencers</span>
              </button>
              <button
                type="button"
                className={`wizard-option-card ${form.campaignType === 'Hybrid' ? 'active' : ''}`}
                onClick={() => updateForm('campaignType', 'Hybrid')}
              >
                <span className="wizard-option-title">Hybrid</span>
                <span className="wizard-option-desc">Both UGC and Influencers</span>
              </button>
            </div>
          </div>
        );

      case STEPS.PAYMENT_TYPE:
        return (
          <div className="wizard-step">
            <h3>How will creators be compensated?</h3>
            <p>Select the payment arrangement</p>
            <div className="wizard-options">
              <button
                type="button"
                className={`wizard-option-card ${form.paymentType === 'Collab' ? 'active' : ''}`}
                onClick={() => updateForm('paymentType', 'Collab')}
              >
                <span className="wizard-option-title">Collab</span>
                <span className="wizard-option-desc">Product gifting only</span>
              </button>
              <button
                type="button"
                className={`wizard-option-card ${form.paymentType === 'Paid' ? 'active' : ''}`}
                onClick={() => updateForm('paymentType', 'Paid')}
              >
                <span className="wizard-option-title">Paid</span>
                <span className="wizard-option-desc">Monetary compensation</span>
              </button>
              <button
                type="button"
                className={`wizard-option-card ${form.paymentType === 'Mix' ? 'active' : ''}`}
                onClick={() => updateForm('paymentType', 'Mix')}
              >
                <span className="wizard-option-title">Mix</span>
                <span className="wizard-option-desc">Product + payment</span>
              </button>
            </div>
          </div>
        );

      case STEPS.PACKAGE_SELECTION:
        return (
          <div className="wizard-step">
            <h3>Choose your package</h3>
            <p>Select a bundle or customize your package</p>
            
            <div className="package-type-toggle">
              <button
                type="button"
                className={`toggle-btn ${form.packageType === 'bundle' ? 'active' : ''}`}
                onClick={() => updateForm('packageType', 'bundle')}
              >
                Bundles
              </button>
              <button
                type="button"
                className={`toggle-btn ${form.packageType === 'custom' ? 'active' : ''}`}
                onClick={() => updateForm('packageType', 'custom')}
              >
                Custom
              </button>
            </div>

            {form.packageType === 'bundle' && (
              <div className="wizard-options-grid">
                {BUNDLES.map((bundle) => (
                  <button
                    key={bundle.value}
                    type="button"
                    className={`wizard-option-card ${form.bundle === bundle.value ? 'active' : ''}`}
                    onClick={() => updateForm('bundle', bundle.value)}
                  >
                    <span className="wizard-option-title">{bundle.label}</span>
                    <span className="wizard-option-desc">{bundle.ugc} UGC + {bundle.influencer} Influencers</span>
                    <span className="wizard-option-meta">{bundle.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {form.packageType === 'custom' && (
              <div className="custom-package-section">
                {(form.campaignType === 'UGC' || form.campaignType === 'Hybrid') && (
                  <div className="package-group">
                    <h4>UGC Videos</h4>
                    <div className="wizard-options">
                      {UGC_PACKAGES.map((pkg) => (
                        <button
                          key={pkg.value}
                          type="button"
                          className={`wizard-option ${form.ugcPackage === pkg.value ? 'active' : ''}`}
                          onClick={() => updateForm('ugcPackage', pkg.value)}
                        >
                          {pkg.label}
                        </button>
                      ))}
                    </div>
                    {form.ugcPackage === 'other' && (
                      <input
                        className="input wizard-input-sm"
                        type="number"
                        value={form.ugcPackageOther}
                        onChange={(e) => updateForm('ugcPackageOther', e.target.value)}
                        placeholder="Enter number of videos"
                      />
                    )}
                  </div>
                )}

                {(form.campaignType === 'Influencer' || form.campaignType === 'Hybrid') && (
                  <div className="package-group">
                    <h4>Influencers</h4>
                    <div className="wizard-options">
                      {INFLUENCER_PACKAGES.map((pkg) => (
                        <button
                          key={pkg.value}
                          type="button"
                          className={`wizard-option ${form.influencerPackage === pkg.value ? 'active' : ''}`}
                          onClick={() => updateForm('influencerPackage', pkg.value)}
                        >
                          {pkg.label}
                        </button>
                      ))}
                    </div>
                    {form.influencerPackage === 'other' && (
                      <input
                        className="input wizard-input-sm"
                        type="number"
                        value={form.influencerPackageOther}
                        onChange={(e) => updateForm('influencerPackageOther', e.target.value)}
                        placeholder="Enter number of influencers"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case STEPS.CREATOR_TIERS:
        return (
          <div className="wizard-step">
            <h3>What influencer tiers do you prefer?</h3>
            <p>Select one or more tiers (multi-select)</p>
            <div className="wizard-options-grid">
              {CREATOR_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  className={`wizard-option-card ${form.creatorTiers.includes(tier.value) ? 'active' : ''}`}
                  onClick={() => toggleCreatorTier(tier.value)}
                >
                  <span className="wizard-option-title">{tier.label}</span>
                  <span className="wizard-option-desc">{tier.desc}</span>
                </button>
              ))}
            </div>
            {form.creatorTiers.length > 0 && (
              <p className="selected-count">Selected: {form.creatorTiers.map(t => CREATOR_TIERS.find(ct => ct.value === t)?.label).join(', ')}</p>
            )}
          </div>
        );

      case STEPS.UGC_PERSONA:
        return (
          <div className="wizard-step">
            <h3>Describe your ideal creator persona</h3>
            <p>What kind of person should represent your brand?</p>
            <textarea
              className="input wizard-textarea"
              value={form.ugcPersona}
              onChange={(e) => updateForm('ugcPersona', e.target.value)}
              placeholder="e.g. Young, trendy, lifestyle-focused individual who loves fashion..."
              rows={4}
            />
          </div>
        );

      case STEPS.UGC_GENDER:
        return (
          <div className="wizard-step">
            <h3>Preferred creator gender?</h3>
            <p>Select the gender preference for your campaign</p>
            <div className="wizard-options">
              {['Female', 'Male', 'Any'].map((gender) => (
                <button
                  key={gender}
                  type="button"
                  className={`wizard-option ${form.ugcGender === gender ? 'active' : ''}`}
                  onClick={() => updateForm('ugcGender', gender)}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.UGC_AGE:
        return (
          <div className="wizard-step">
            <h3>What age range are you targeting?</h3>
            <p>Select the preferred age range for creators</p>
            <div className="wizard-options">
              {['18-24', '25-34', '35-44', '45+', 'Any'].map((age) => (
                <button
                  key={age}
                  type="button"
                  className={`wizard-option ${form.ugcAgeRange === age ? 'active' : ''}`}
                  onClick={() => updateForm('ugcAgeRange', age)}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.INFLUENCER_NICHE:
        return (
          <div className="wizard-step">
            <h3>What niche should influencers be in?</h3>
            <p>Select the content category</p>
            <div className="wizard-options">
              {NICHES.map((niche) => (
                <button
                  key={niche}
                  type="button"
                  className={`wizard-option ${form.influencerNiche === niche ? 'active' : ''}`}
                  onClick={() => updateForm('influencerNiche', niche)}
                >
                  {niche}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.INFLUENCER_PLATFORMS:
        return (
          <div className="wizard-step">
            <h3>Which platforms should they post on?</h3>
            <p>Select one or more platforms</p>
            <div className="wizard-options">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={`wizard-option ${form.influencerPlatforms.includes(platform) ? 'active' : ''}`}
                  onClick={() => togglePlatform(platform)}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.REVIEW:
        const pkg = getPackageDetails();
        return (
          <div className="wizard-step">
            <h3>Review your campaign</h3>
            <p>Confirm the details before creating</p>
            <div className="wizard-review">
              <div className="review-item">
                <span className="review-label">Campaign Name</span>
                <span className="review-value">{form.name}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Brand</span>
                <span className="review-value">{getBrandName()} ({form.brandType})</span>
              </div>
              <div className="review-item">
                <span className="review-label">Objective</span>
                <span className="review-value">{form.objectives}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Start Date</span>
                <span className="review-value">{form.startDate}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Campaign Type</span>
                <span className="review-value">{form.campaignType}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Compensation</span>
                <span className="review-value">{form.paymentType}</span>
              </div>
              {form.packageType === 'bundle' && (
                <div className="review-item">
                  <span className="review-label">Bundle</span>
                  <span className="review-value">{BUNDLES.find(b => b.value === form.bundle)?.label}</span>
                </div>
              )}
              {(form.campaignType === 'UGC' || form.campaignType === 'Hybrid') && (
                <div className="review-item">
                  <span className="review-label">UGC Videos</span>
                  <span className="review-value">{pkg.ugcCount}</span>
                </div>
              )}
              {(form.campaignType === 'Influencer' || form.campaignType === 'Hybrid') && (
                <>
                  <div className="review-item">
                    <span className="review-label">Influencers</span>
                    <span className="review-value">{pkg.influencerCount}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Creator Tiers</span>
                    <span className="review-value">{form.creatorTiers.join(', ')}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Niche</span>
                    <span className="review-value">{form.influencerNiche}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Platforms</span>
                    <span className="review-value">{form.influencerPlatforms.join(', ')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay active">
      <div className="wizard-modal">
        <div className="wizard-header">
          <div className="wizard-progress">
            <div className="wizard-progress-bar" style={{ width: `${getProgress()}%` }} />
          </div>
          <button type="button" className="wizard-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="wizard-content">
          {renderStepContent()}
        </div>

        <div className="wizard-footer">
          {currentStep > STEPS.NAME && (
            <button type="button" className="btn btn-secondary" onClick={handleBack}>
              Back
            </button>
          )}
          {currentStep === STEPS.REVIEW ? (
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              Create Campaign
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
