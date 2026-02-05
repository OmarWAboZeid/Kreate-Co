import { useState } from 'react';

const STEPS = {
  NAME: 1,
  OBJECTIVES: 2,
  START_DATE: 3,
  CAMPAIGN_TYPE: 4,
  PAYMENT_TYPE: 5,
  CREATOR_TIERS: 6,
  UGC_PERSONA: 7,
  UGC_GENDER: 8,
  UGC_AGE: 9,
  UGC_VIDEOS: 10,
  INFLUENCER_NICHE: 11,
  INFLUENCER_PLATFORMS: 12,
  INFLUENCER_BUDGET: 13,
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
const PLATFORMS = ['Instagram', 'TikTok'];

const UGC_VIDEO_OPTIONS = [
  { value: '4', label: '4 Videos' },
  { value: '8', label: '8 Videos' },
  { value: '12', label: '12 Videos' },
  { value: '20', label: '20 Videos' },
  { value: 'other', label: 'Other' },
];

const BUDGET_OPTIONS = [
  { value: 'under-5k', label: 'Under $5,000' },
  { value: '5k-10k', label: '$5,000 - $10,000' },
  { value: '10k-25k', label: '$10,000 - $25,000' },
  { value: '25k-50k', label: '$25,000 - $50,000' },
  { value: 'over-50k', label: 'Over $50,000' },
  { value: 'tbd', label: 'To be discussed' },
];

export default function CampaignWizard({ onClose, onSubmit, brandName }) {
  const [currentStep, setCurrentStep] = useState(STEPS.NAME);
  const [form, setForm] = useState({
    name: '',
    brandName: brandName || '',
    objectives: '',
    startDate: '',
    campaignType: '',
    paymentType: '',
    creatorTiers: [],
    ugcPersona: '',
    ugcGender: '',
    ugcAgeRange: '',
    ugcVideos: '',
    ugcVideosOther: '',
    influencerNiche: '',
    influencerPlatforms: [],
    influencerBudget: '',
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
    switch (currentStep) {
      case STEPS.NAME:
        return STEPS.OBJECTIVES;
      case STEPS.OBJECTIVES:
        return STEPS.START_DATE;
      case STEPS.START_DATE:
        return STEPS.CAMPAIGN_TYPE;
      case STEPS.CAMPAIGN_TYPE:
        return STEPS.PAYMENT_TYPE;
      case STEPS.PAYMENT_TYPE:
        if (form.campaignType === 'UGC') return STEPS.UGC_PERSONA;
        return STEPS.CREATOR_TIERS;
      case STEPS.CREATOR_TIERS:
        if (form.campaignType === 'Hybrid') return STEPS.UGC_PERSONA;
        return STEPS.INFLUENCER_NICHE;
      case STEPS.UGC_PERSONA:
        return STEPS.UGC_GENDER;
      case STEPS.UGC_GENDER:
        return STEPS.UGC_AGE;
      case STEPS.UGC_AGE:
        return STEPS.UGC_VIDEOS;
      case STEPS.UGC_VIDEOS:
        if (form.campaignType === 'Hybrid') return STEPS.INFLUENCER_NICHE;
        return STEPS.REVIEW;
      case STEPS.INFLUENCER_NICHE:
        return STEPS.INFLUENCER_PLATFORMS;
      case STEPS.INFLUENCER_PLATFORMS:
        return STEPS.INFLUENCER_BUDGET;
      case STEPS.INFLUENCER_BUDGET:
        return STEPS.REVIEW;
      default:
        return currentStep + 1;
    }
  };

  const getPrevStep = () => {
    switch (currentStep) {
      case STEPS.OBJECTIVES:
        return STEPS.NAME;
      case STEPS.START_DATE:
        return STEPS.OBJECTIVES;
      case STEPS.CAMPAIGN_TYPE:
        return STEPS.START_DATE;
      case STEPS.PAYMENT_TYPE:
        return STEPS.CAMPAIGN_TYPE;
      case STEPS.CREATOR_TIERS:
        return STEPS.PAYMENT_TYPE;
      case STEPS.UGC_PERSONA:
        if (form.campaignType === 'Hybrid') return STEPS.CREATOR_TIERS;
        return STEPS.PAYMENT_TYPE;
      case STEPS.UGC_GENDER:
        return STEPS.UGC_PERSONA;
      case STEPS.UGC_AGE:
        return STEPS.UGC_GENDER;
      case STEPS.UGC_VIDEOS:
        return STEPS.UGC_AGE;
      case STEPS.INFLUENCER_NICHE:
        if (form.campaignType === 'Hybrid') return STEPS.UGC_VIDEOS;
        return STEPS.CREATOR_TIERS;
      case STEPS.INFLUENCER_PLATFORMS:
        return STEPS.INFLUENCER_NICHE;
      case STEPS.INFLUENCER_BUDGET:
        return STEPS.INFLUENCER_PLATFORMS;
      case STEPS.REVIEW:
        if (form.campaignType === 'UGC') return STEPS.UGC_VIDEOS;
        return STEPS.INFLUENCER_BUDGET;
      default:
        return currentStep - 1;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case STEPS.NAME:
        return form.name.trim().length > 0;
      case STEPS.OBJECTIVES:
        return form.objectives.length > 0;
      case STEPS.START_DATE:
        return form.startDate.length > 0;
      case STEPS.CAMPAIGN_TYPE:
        return form.campaignType.length > 0;
      case STEPS.PAYMENT_TYPE:
        return form.paymentType.length > 0;
      case STEPS.CREATOR_TIERS:
        return form.creatorTiers.length > 0;
      case STEPS.UGC_PERSONA:
        return form.ugcPersona.trim().length > 0;
      case STEPS.UGC_GENDER:
        return form.ugcGender.length > 0;
      case STEPS.UGC_AGE:
        return form.ugcAgeRange.length > 0;
      case STEPS.UGC_VIDEOS:
        if (form.ugcVideos === 'other') return form.ugcVideosOther.trim().length > 0;
        return form.ugcVideos.length > 0;
      case STEPS.INFLUENCER_NICHE:
        return form.influencerNiche.length > 0;
      case STEPS.INFLUENCER_PLATFORMS:
        return form.influencerPlatforms.length > 0;
      case STEPS.INFLUENCER_BUDGET:
        return form.influencerBudget.length > 0;
      default:
        return true;
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

  const handleSubmit = () => {
    const ugcCount = form.ugcVideos === 'other' ? form.ugcVideosOther : form.ugcVideos;
    
    onSubmit({
      name: form.name,
      brand: form.brandName,
      objectives: form.objectives,
      startDate: form.startDate,
      campaignType: form.campaignType,
      paymentType: form.paymentType,
      creatorTiers: form.creatorTiers,
      ugcCount: ugcCount || null,
      ugc:
        form.campaignType === 'UGC' || form.campaignType === 'Hybrid'
          ? {
              persona: form.ugcPersona,
              gender: form.ugcGender,
              ageRange: form.ugcAgeRange,
            }
          : null,
      influencer:
        form.campaignType === 'Influencer' || form.campaignType === 'Hybrid'
          ? {
              niche: form.influencerNiche,
              platforms: form.influencerPlatforms,
              tiers: form.creatorTiers,
              budget: form.influencerBudget,
            }
          : null,
    });
  };

  const getTotalSteps = () => {
    if (form.campaignType === 'UGC') return 10;
    if (form.campaignType === 'Influencer') return 10;
    if (form.campaignType === 'Hybrid') return 14;
    return 5;
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
              <p className="selected-count">
                Selected:{' '}
                {form.creatorTiers
                  .map((t) => CREATOR_TIERS.find((ct) => ct.value === t)?.label)
                  .join(', ')}
              </p>
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

      case STEPS.UGC_VIDEOS:
        return (
          <div className="wizard-step">
            <h3>How many videos do you need?</h3>
            <p>Select the number of UGC videos for this campaign</p>
            <div className="wizard-options">
              {UGC_VIDEO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`wizard-option ${form.ugcVideos === opt.value ? 'active' : ''}`}
                  onClick={() => updateForm('ugcVideos', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.ugcVideos === 'other' && (
              <input
                className="input wizard-input"
                type="number"
                value={form.ugcVideosOther}
                onChange={(e) => updateForm('ugcVideosOther', e.target.value)}
                placeholder="Enter number of videos"
              />
            )}
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
            <p>Select one or more platforms (multi-select)</p>
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
            {form.influencerPlatforms.length > 0 && (
              <p className="selected-count">Selected: {form.influencerPlatforms.join(', ')}</p>
            )}
          </div>
        );

      case STEPS.INFLUENCER_BUDGET:
        return (
          <div className="wizard-step">
            <h3>What's your budget for creators?</h3>
            <p>Select your approximate budget range</p>
            <div className="wizard-options">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`wizard-option ${form.influencerBudget === opt.value ? 'active' : ''}`}
                  onClick={() => updateForm('influencerBudget', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.REVIEW:
        return (
          <div className="wizard-step">
            <h3>Review your campaign</h3>
            <p>Make sure everything looks good before submitting</p>
            <div className="wizard-review">
              <div className="review-section">
                <h4>Campaign Details</h4>
                <div className="review-item">
                  <span>Campaign Name</span>
                  <strong>{form.name}</strong>
                </div>
                <div className="review-item">
                  <span>Objective</span>
                  <strong>{form.objectives}</strong>
                </div>
                <div className="review-item">
                  <span>Start Date</span>
                  <strong>{form.startDate}</strong>
                </div>
                <div className="review-item">
                  <span>Campaign Type</span>
                  <strong>{form.campaignType}</strong>
                </div>
                <div className="review-item">
                  <span>Payment Type</span>
                  <strong>{form.paymentType}</strong>
                </div>
              </div>

              {(form.campaignType === 'UGC' || form.campaignType === 'Hybrid') && (
                <div className="review-section">
                  <h4>UGC Requirements</h4>
                  <div className="review-item">
                    <span>Persona</span>
                    <strong>{form.ugcPersona}</strong>
                  </div>
                  <div className="review-item">
                    <span>Gender</span>
                    <strong>{form.ugcGender}</strong>
                  </div>
                  <div className="review-item">
                    <span>Age Range</span>
                    <strong>{form.ugcAgeRange}</strong>
                  </div>
                  <div className="review-item">
                    <span>Number of Videos</span>
                    <strong>
                      {form.ugcVideos === 'other' ? form.ugcVideosOther : form.ugcVideos}
                    </strong>
                  </div>
                </div>
              )}

              {(form.campaignType === 'Influencer' || form.campaignType === 'Hybrid') && (
                <div className="review-section">
                  <h4>Influencer Requirements</h4>
                  <div className="review-item">
                    <span>Creator Tiers</span>
                    <strong>
                      {form.creatorTiers
                        .map((t) => CREATOR_TIERS.find((ct) => ct.value === t)?.label)
                        .join(', ')}
                    </strong>
                  </div>
                  <div className="review-item">
                    <span>Niche</span>
                    <strong>{form.influencerNiche}</strong>
                  </div>
                  <div className="review-item">
                    <span>Platforms</span>
                    <strong>{form.influencerPlatforms.join(', ')}</strong>
                  </div>
                  <div className="review-item">
                    <span>Budget</span>
                    <strong>
                      {BUDGET_OPTIONS.find((b) => b.value === form.influencerBudget)?.label}
                    </strong>
                  </div>
                </div>
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
            ×
          </button>
        </div>

        <div className="wizard-content">{renderStepContent()}</div>

        <div className="wizard-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={currentStep === STEPS.NAME ? onClose : handleBack}
          >
            {currentStep === STEPS.NAME ? 'Cancel' : 'Back'}
          </button>
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
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
