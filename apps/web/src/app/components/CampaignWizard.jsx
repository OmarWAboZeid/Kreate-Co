import { useEffect, useMemo, useState } from 'react';

const STEP_IDS = {
  BASICS: 'basics',
  UGC: 'ugc',
  INFLUENCER: 'influencer',
  REVIEW: 'review',
};

const OBJECTIVES = ['Awareness', 'Sales', 'Launch', 'Content Bank'];
const CAMPAIGN_TYPES = ['UGC', 'Influencer', 'Hybrid'];
const PAYMENT_TYPES = ['Collab', 'Paid', 'Mix'];
const GENDER_OPTIONS = ['Female', 'Male', 'Any'];
const AGE_OPTIONS = ['18-24', '25-34', '35-44', '45+', 'Any'];

const CREATOR_TIERS = [
  { value: 'nano', label: 'Nano', desc: '1K-10K followers' },
  { value: 'micro', label: 'Micro', desc: '10K-50K followers' },
  { value: 'mid-tier', label: 'Mid-tier', desc: '50K-500K followers' },
  { value: 'macro', label: 'Macro', desc: '500K+ followers' },
];

const NICHES = ['Fashion', 'F&B', 'Beauty', 'Lifestyle', 'Tech'];
const PLATFORMS = ['Instagram', 'TikTok', 'Facebook'];

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

const getPaymentTypeLabel = (paymentType) =>
  paymentType === 'Collab' ? 'Barter/Gifted' : paymentType;

const formatList = (values) => values.filter(Boolean).join(', ');

export default function CampaignWizard({ onClose, onSubmit, brandName, brands }) {
  const [layoutOffsets, setLayoutOffsets] = useState({
    top: 0,
    left: 0,
    right: 0,
  });
  const [currentStep, setCurrentStep] = useState(STEP_IDS.BASICS);
  const [form, setForm] = useState({
    name: '',
    brandName: brandName || '',
    objectives: '',
    startDate: '',
    campaignType: '',
    paymentType: '',
    creatorAgeRange: '',
    creatorTiers: [],
    ugcPersona: '',
    ugcGender: '',
    ugcVideos: '',
    ugcVideosOther: '',
    influencerNiche: '',
    influencerPlatforms: [],
    influencerBudget: '',
  });

  const requiresPaymentType =
    form.campaignType === 'Influencer' || form.campaignType === 'Hybrid';
  const showUgcStep = form.campaignType === 'UGC' || form.campaignType === 'Hybrid';
  const showInfluencerStep =
    form.campaignType === 'Influencer' || form.campaignType === 'Hybrid';

  const flowSteps = useMemo(() => {
    const steps = [STEP_IDS.BASICS];
    if (showUgcStep) steps.push(STEP_IDS.UGC);
    if (showInfluencerStep) steps.push(STEP_IDS.INFLUENCER);
    steps.push(STEP_IDS.REVIEW);
    return steps;
  }, [showInfluencerStep, showUgcStep]);

  const currentStepIndex = Math.max(flowSteps.indexOf(currentStep), 0);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCreatorTier = (tier) => {
    setForm((prev) => {
      const exists = prev.creatorTiers.includes(tier);
      return {
        ...prev,
        creatorTiers: exists
          ? prev.creatorTiers.filter((item) => item !== tier)
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
          ? prev.influencerPlatforms.filter((item) => item !== platform)
          : [...prev.influencerPlatforms, platform],
      };
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case STEP_IDS.BASICS:
        if (!form.name.trim()) return false;
        if (brands?.length && !form.brandName) return false;
        if (!form.objectives) return false;
        if (!form.startDate) return false;
        if (!form.campaignType) return false;
        if (requiresPaymentType && !form.paymentType) return false;
        return Boolean(form.creatorAgeRange);
      case STEP_IDS.UGC:
        if (!form.ugcPersona.trim()) return false;
        if (!form.ugcGender) return false;
        if (!form.ugcVideos) return false;
        if (form.ugcVideos === 'other') return form.ugcVideosOther.trim().length > 0;
        return true;
      case STEP_IDS.INFLUENCER:
        if (form.creatorTiers.length === 0) return false;
        if (!form.influencerNiche) return false;
        if (form.influencerPlatforms.length === 0) return false;
        return Boolean(form.influencerBudget);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    const nextStep = flowSteps[currentStepIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStepIndex === 0) return;
    setCurrentStep(flowSteps[currentStepIndex - 1]);
  };

  const handleSubmit = () => {
    const ugcCount = form.ugcVideos === 'other' ? form.ugcVideosOther : form.ugcVideos;

    onSubmit({
      name: form.name,
      brand: form.brandName,
      objectives: form.objectives ? [form.objectives.toLowerCase()] : [],
      startDate: form.startDate,
      campaignType: form.campaignType,
      paymentType: form.paymentType,
      creatorAgeRange: form.creatorAgeRange || null,
      creatorTiers: form.creatorTiers,
      ugcCount: ugcCount || null,
      ugc:
        showUgcStep
          ? {
              persona: form.ugcPersona,
              gender: form.ugcGender,
              ageRange: form.creatorAgeRange,
            }
          : null,
      influencer:
        showInfluencerStep
          ? {
              niche: form.influencerNiche,
              platforms: form.influencerPlatforms,
              tiers: form.creatorTiers,
              ageRange: form.creatorAgeRange,
              budget: form.influencerBudget,
            }
          : null,
    });
  };

  const getProgress = () => Math.min(((currentStepIndex + 1) / flowSteps.length) * 100, 100);

  useEffect(() => {
    const topbar = document.querySelector('.app-topbar');
    const appMain = document.querySelector('.app-main');
    if (!topbar || !appMain) return undefined;

    const updateOffset = () => {
      const topbarRect = topbar.getBoundingClientRect();
      const mainRect = appMain.getBoundingClientRect();
      const nextTop = Math.max(0, Math.ceil(topbarRect.bottom || 0));
      const nextLeft = Math.max(0, Math.ceil(mainRect.left || 0));
      const nextRight = Math.max(
        0,
        Math.ceil(window.innerWidth - (mainRect.right || window.innerWidth))
      );
      setLayoutOffsets((prev) => {
        if (prev.top === nextTop && prev.left === nextLeft && prev.right === nextRight) {
          return prev;
        }
        return { top: nextTop, left: nextLeft, right: nextRight };
      });
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    window.addEventListener('scroll', updateOffset, { passive: true });
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOffset);
      observer.observe(topbar);
      observer.observe(appMain);
    }

    return () => {
      window.removeEventListener('resize', updateOffset);
      window.removeEventListener('scroll', updateOffset);
      if (observer) observer.disconnect();
    };
  }, []);

  const renderSummaryItem = (label, value) => (
    <div className="wizard-summary-item" key={label}>
      <span className="label">{label}</span>
      <span className="value">{value || '—'}</span>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEP_IDS.BASICS:
        return (
          <div className="wizard-step wizard-step-grouped">
            <h3>Campaign basics</h3>
            <p>Start with the shared campaign details. The next step changes with your selections.</p>
            <div className="wizard-step-grid">
              <div className="wizard-input-group">
                <label>Campaign name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="e.g. Summer Collection Launch"
                  autoFocus
                />
              </div>

              {brands?.length > 0 && (
                <div className="wizard-input-group">
                  <label>Brand</label>
                  <select
                    className="input"
                    value={form.brandName}
                    onChange={(event) => updateForm('brandName', event.target.value)}
                  >
                    <option value="">Select a brand</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="wizard-input-group">
                <label>Main objective</label>
                <div className="wizard-options wizard-options-left">
                  {OBJECTIVES.map((objective) => (
                    <button
                      key={objective}
                      type="button"
                      className={`wizard-option ${form.objectives === objective ? 'active' : ''}`}
                      onClick={() => updateForm('objectives', objective)}
                    >
                      {objective}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-step-grid wizard-step-grid-two">
                <div className="wizard-input-group">
                  <label>Start date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => updateForm('startDate', event.target.value)}
                  />
                </div>

                <div className="wizard-input-group">
                  <label>Creator age range</label>
                  <div className="wizard-options wizard-options-left">
                    {AGE_OPTIONS.map((age) => (
                      <button
                        key={age}
                        type="button"
                        className={`wizard-option ${form.creatorAgeRange === age ? 'active' : ''}`}
                        onClick={() => updateForm('creatorAgeRange', age)}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wizard-input-group">
                <label>Campaign type</label>
                <div className="wizard-options-grid wizard-options-grid-left">
                  {CAMPAIGN_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`wizard-option-card ${form.campaignType === type ? 'active' : ''}`}
                      onClick={() => updateForm('campaignType', type)}
                    >
                      <span className="wizard-option-title">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {requiresPaymentType ? (
                <div className="wizard-input-group">
                  <label>Compensation</label>
                  <div className="wizard-options wizard-options-left">
                    {PAYMENT_TYPES.map((paymentType) => (
                      <button
                        key={paymentType}
                        type="button"
                        className={`wizard-option ${form.paymentType === paymentType ? 'active' : ''}`}
                        onClick={() => updateForm('paymentType', paymentType)}
                      >
                        {getPaymentTypeLabel(paymentType)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );

      case STEP_IDS.UGC:
        return (
          <div className="wizard-step wizard-step-grouped">
            <h3>UGC requirements</h3>
            <p>Define the creator profile and output for this UGC brief.</p>
            <div className="wizard-step-grid">
              <div className="wizard-input-group">
                <label>Creator persona</label>
                <textarea
                  className="input wizard-textarea wizard-textarea-wide"
                  value={form.ugcPersona}
                  onChange={(event) => updateForm('ugcPersona', event.target.value)}
                  placeholder="e.g. Young, trendy, lifestyle-focused individual who loves fashion..."
                  rows={4}
                />
              </div>

              <div className="wizard-input-group">
                <label>Preferred gender</label>
                <div className="wizard-options wizard-options-left">
                  {GENDER_OPTIONS.map((gender) => (
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

              <div className="wizard-input-group">
                <label>Number of videos</label>
                <div className="wizard-options wizard-options-left">
                  {UGC_VIDEO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`wizard-option ${form.ugcVideos === option.value ? 'active' : ''}`}
                      onClick={() => updateForm('ugcVideos', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {form.ugcVideos === 'other' ? (
                  <input
                    className="input wizard-input-sm"
                    type="number"
                    value={form.ugcVideosOther}
                    onChange={(event) => updateForm('ugcVideosOther', event.target.value)}
                    placeholder="Videos"
                  />
                ) : null}
              </div>
            </div>
          </div>
        );

      case STEP_IDS.INFLUENCER:
        return (
          <div className="wizard-step wizard-step-grouped">
            <h3>Influencer requirements</h3>
            <p>Choose the tiers, channels, and budget for the influencer shortlist.</p>
            <div className="wizard-step-grid">
              <div className="wizard-input-group">
                <label>Creator tiers</label>
                <div className="wizard-options-grid wizard-options-grid-left">
                  {CREATOR_TIERS.map((tier) => (
                    <button
                      key={tier.value}
                      type="button"
                      className={`wizard-option-card ${form.creatorTiers.includes(tier.value) ? 'active' : ''}`}
                      onClick={() => toggleCreatorTier(tier.value)}
                    >
                      <span className="wizard-option-title">{tier.label}</span>
                      <span className="wizard-option-meta">{tier.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-step-grid wizard-step-grid-two">
                <div className="wizard-input-group">
                  <label>Niche</label>
                  <div className="wizard-options wizard-options-left">
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

                <div className="wizard-input-group">
                  <label>Platforms</label>
                  <div className="wizard-options wizard-options-left">
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
              </div>

              <div className="wizard-input-group">
                <label>Budget</label>
                <div className="wizard-options wizard-options-left">
                  {BUDGET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`wizard-option ${form.influencerBudget === option.value ? 'active' : ''}`}
                      onClick={() => updateForm('influencerBudget', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case STEP_IDS.REVIEW:
        return (
          <div className="wizard-step wizard-review">
            <h3>Campaign overview</h3>
            <div className="wizard-summary">
              {renderSummaryItem('Campaign Name', form.name)}
              {renderSummaryItem('Objective', form.objectives)}
              {renderSummaryItem('Start Date', form.startDate)}
              {renderSummaryItem('Campaign Type', form.campaignType)}
              {renderSummaryItem('Creator Age Range', form.creatorAgeRange)}
              {requiresPaymentType
                ? renderSummaryItem('Payment Type', getPaymentTypeLabel(form.paymentType))
                : null}

              {showUgcStep ? <div className="wizard-summary-section">UGC Requirements</div> : null}
              {showUgcStep ? renderSummaryItem('Persona', form.ugcPersona) : null}
              {showUgcStep ? renderSummaryItem('Gender', form.ugcGender) : null}
              {showUgcStep
                ? renderSummaryItem(
                    'Videos',
                    form.ugcVideos === 'other' ? form.ugcVideosOther : form.ugcVideos
                  )
                : null}

              {showInfluencerStep ? (
                <div className="wizard-summary-section">Influencer Requirements</div>
              ) : null}
              {showInfluencerStep
                ? renderSummaryItem(
                    'Creator Tiers',
                    formatList(
                      form.creatorTiers.map(
                        (tier) => CREATOR_TIERS.find((item) => item.value === tier)?.label || ''
                      )
                    )
                  )
                : null}
              {showInfluencerStep ? renderSummaryItem('Niche', form.influencerNiche) : null}
              {showInfluencerStep
                ? renderSummaryItem('Platforms', formatList(form.influencerPlatforms))
                : null}
              {showInfluencerStep
                ? renderSummaryItem(
                    'Budget',
                    BUDGET_OPTIONS.find((item) => item.value === form.influencerBudget)?.label || ''
                  )
                : null}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="modal-overlay active wizard-overlay"
      style={{
        '--wizard-top-offset': `${layoutOffsets.top}px`,
        '--wizard-left-offset': `${layoutOffsets.left}px`,
        '--wizard-right-offset': `${layoutOffsets.right}px`,
      }}
    >
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
            onClick={currentStepIndex === 0 ? onClose : handleBack}
          >
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>
          {currentStep === STEP_IDS.REVIEW ? (
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              Create Campaign
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
