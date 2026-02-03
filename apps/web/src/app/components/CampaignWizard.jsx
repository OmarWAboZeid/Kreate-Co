import { useState } from 'react';

const STEPS = {
  NAME: 1,
  OBJECTIVES: 2,
  START_DATE: 3,
  CAMPAIGN_TYPE: 4,
  UGC_PERSONA: 5,
  UGC_GENDER: 6,
  UGC_AGE: 7,
  UGC_VIDEOS: 8,
  INFLUENCER_TIER: 9,
  INFLUENCER_NICHE: 10,
  INFLUENCER_BUDGET: 11,
  INFLUENCER_PLATFORMS: 12,
  REVIEW: 13,
};

const OBJECTIVES = [
  'Brand Awareness',
  'Product Launch',
  'Sales & Conversions',
  'Engagement',
  'Content Creation',
];

const INFLUENCER_TIERS = [
  { value: 'nano', label: 'Nano (1K-10K)', desc: 'High engagement, niche audiences' },
  { value: 'micro', label: 'Micro (10K-100K)', desc: 'Strong community connection' },
  { value: 'macro', label: 'Macro (100K-1M)', desc: 'Wide reach, professional content' },
  { value: 'mega', label: 'Mega (1M+)', desc: 'Maximum visibility, celebrity status' },
];

const NICHES = ['Fashion', 'F&B', 'Beauty', 'Lifestyle', 'Tech'];
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook'];

export default function CampaignWizard({ onClose, onSubmit, brandName }) {
  const [currentStep, setCurrentStep] = useState(STEPS.NAME);
  const [form, setForm] = useState({
    name: '',
    objectives: '',
    startDate: '',
    campaignType: '',
    ugcPersona: '',
    ugcGender: '',
    ugcAgeRange: '',
    ugcVideos: '',
    influencerTier: '',
    influencerNiche: '',
    influencerBudget: '',
    influencerPlatforms: [],
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
    if (currentStep === STEPS.CAMPAIGN_TYPE) {
      if (form.campaignType === 'UGC') return STEPS.UGC_PERSONA;
      if (form.campaignType === 'Influencer') return STEPS.INFLUENCER_TIER;
      if (form.campaignType === 'Hybrid') return STEPS.UGC_PERSONA;
    }
    if (currentStep === STEPS.UGC_VIDEOS) {
      if (form.campaignType === 'Hybrid') return STEPS.INFLUENCER_TIER;
      return STEPS.REVIEW;
    }
    if (currentStep === STEPS.INFLUENCER_PLATFORMS) {
      return STEPS.REVIEW;
    }
    return currentStep + 1;
  };

  const getPrevStep = () => {
    if (currentStep === STEPS.UGC_PERSONA) return STEPS.CAMPAIGN_TYPE;
    if (currentStep === STEPS.INFLUENCER_TIER) {
      if (form.campaignType === 'Hybrid') return STEPS.UGC_VIDEOS;
      return STEPS.CAMPAIGN_TYPE;
    }
    if (currentStep === STEPS.REVIEW) {
      if (form.campaignType === 'UGC') return STEPS.UGC_VIDEOS;
      return STEPS.INFLUENCER_PLATFORMS;
    }
    return currentStep - 1;
  };

  const canProceed = () => {
    switch (currentStep) {
      case STEPS.NAME: return form.name.trim().length > 0;
      case STEPS.OBJECTIVES: return form.objectives.length > 0;
      case STEPS.START_DATE: return form.startDate.length > 0;
      case STEPS.CAMPAIGN_TYPE: return form.campaignType.length > 0;
      case STEPS.UGC_PERSONA: return form.ugcPersona.trim().length > 0;
      case STEPS.UGC_GENDER: return form.ugcGender.length > 0;
      case STEPS.UGC_AGE: return form.ugcAgeRange.length > 0;
      case STEPS.UGC_VIDEOS: return form.ugcVideos.length > 0;
      case STEPS.INFLUENCER_TIER: return form.influencerTier.length > 0;
      case STEPS.INFLUENCER_NICHE: return form.influencerNiche.length > 0;
      case STEPS.INFLUENCER_BUDGET: return form.influencerBudget.length > 0;
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

  const handleSubmit = () => {
    onSubmit({
      name: form.name,
      brand: brandName,
      objectives: form.objectives,
      startDate: form.startDate,
      campaignType: form.campaignType,
      ugc: form.campaignType === 'UGC' || form.campaignType === 'Hybrid' ? {
        persona: form.ugcPersona,
        gender: form.ugcGender,
        ageRange: form.ugcAgeRange,
        videos: form.ugcVideos,
      } : null,
      influencer: form.campaignType === 'Influencer' || form.campaignType === 'Hybrid' ? {
        tier: form.influencerTier,
        niche: form.influencerNiche,
        budget: form.influencerBudget,
        platforms: form.influencerPlatforms,
      } : null,
    });
  };

  const getTotalSteps = () => {
    if (form.campaignType === 'UGC') return 9;
    if (form.campaignType === 'Influencer') return 9;
    if (form.campaignType === 'Hybrid') return 13;
    return 4;
  };

  const getProgress = () => {
    const total = getTotalSteps();
    let current = currentStep;
    if (currentStep >= STEPS.INFLUENCER_TIER && form.campaignType === 'Influencer') {
      current = currentStep - 4;
    }
    return Math.min((current / total) * 100, 100);
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
            <p>Total number of UGC videos for this campaign</p>
            <div className="wizard-options">
              {['1-5', '5-10', '10-20', '20+'].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`wizard-option ${form.ugcVideos === count ? 'active' : ''}`}
                  onClick={() => updateForm('ugcVideos', count)}
                >
                  {count} videos
                </button>
              ))}
            </div>
          </div>
        );

      case STEPS.INFLUENCER_TIER:
        return (
          <div className="wizard-step">
            <h3>What influencer tier do you prefer?</h3>
            <p>Select based on follower count and reach</p>
            <div className="wizard-options-grid">
              {INFLUENCER_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  className={`wizard-option-card ${form.influencerTier === tier.value ? 'active' : ''}`}
                  onClick={() => updateForm('influencerTier', tier.value)}
                >
                  <span className="wizard-option-title">{tier.label}</span>
                  <span className="wizard-option-desc">{tier.desc}</span>
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

      case STEPS.INFLUENCER_BUDGET:
        return (
          <div className="wizard-step">
            <h3>What's your influencer budget?</h3>
            <p>Select your budget range for influencer fees</p>
            <div className="wizard-options">
              {['Under $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000+'].map((budget) => (
                <button
                  key={budget}
                  type="button"
                  className={`wizard-option ${form.influencerBudget === budget ? 'active' : ''}`}
                  onClick={() => updateForm('influencerBudget', budget)}
                >
                  {budget}
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
        return (
          <div className="wizard-step wizard-review">
            <h3>Review your campaign</h3>
            <p>Here's a summary of your campaign details</p>
            <div className="wizard-summary">
              <div className="wizard-summary-item">
                <span className="label">Campaign Name</span>
                <span className="value">{form.name}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="label">Objective</span>
                <span className="value">{form.objectives}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="label">Start Date</span>
                <span className="value">{form.startDate}</span>
              </div>
              <div className="wizard-summary-item">
                <span className="label">Campaign Type</span>
                <span className="value">{form.campaignType}</span>
              </div>
              {(form.campaignType === 'UGC' || form.campaignType === 'Hybrid') && (
                <>
                  <div className="wizard-summary-section">UGC Details</div>
                  <div className="wizard-summary-item">
                    <span className="label">Persona</span>
                    <span className="value">{form.ugcPersona}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Gender</span>
                    <span className="value">{form.ugcGender}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Age Range</span>
                    <span className="value">{form.ugcAgeRange}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Videos</span>
                    <span className="value">{form.ugcVideos}</span>
                  </div>
                </>
              )}
              {(form.campaignType === 'Influencer' || form.campaignType === 'Hybrid') && (
                <>
                  <div className="wizard-summary-section">Influencer Details</div>
                  <div className="wizard-summary-item">
                    <span className="label">Tier</span>
                    <span className="value">{INFLUENCER_TIERS.find(t => t.value === form.influencerTier)?.label}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Niche</span>
                    <span className="value">{form.influencerNiche}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Budget</span>
                    <span className="value">{form.influencerBudget}</span>
                  </div>
                  <div className="wizard-summary-item">
                    <span className="label">Platforms</span>
                    <span className="value">{form.influencerPlatforms.join(', ')}</span>
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

        <div className="wizard-body">
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
