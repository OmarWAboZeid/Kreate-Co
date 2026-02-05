import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import CampaignGrid from '../components/CampaignGrid.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CampaignWizard from '../components/CampaignWizard.jsx';
import { storage, useAppDispatch, useAppState, utils } from '../state.jsx';

const API_BASE = '/api';

const defaultForm = {
  name: '',
  brand: '',
  platforms: [],
  startDate: '',
  endDate: '',
  description: '',
  objectives: [],
  targetAudience: '',
  creatorType: '',
  creatorTiers: [],
  dealType: '',
  campaignPackage: '',
  customPackage: '',
  deliverables: '',
  contentFormat: [],
  notes: '',
};

export default function CampaignsPage() {
  const { role } = useParams();
  const { campaigns, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [adminBrandFilter, setAdminBrandFilter] = useState('');

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await fetch(`${API_BASE}/brands`);
        const data = await res.json();
        if (data.ok) {
          dispatch({ type: 'SET_BRANDS', payload: data.data });
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    };
    if (brands.length === 0) {
      fetchBrands();
    }
  }, [dispatch, brands.length]);

  const brandNames = brands.map((b) => (typeof b === 'string' ? b : b.name));
  const brandFilter = role === 'brand' ? storage.getBrand() || brandNames[0] : null;
  const visibleCampaigns = useMemo(() => {
    let filtered = campaigns;
    if (brandFilter) {
      filtered = filtered.filter((campaign) => campaign.brand === brandFilter);
    }
    if ((role === 'admin' || role === 'employee') && adminBrandFilter) {
      filtered = filtered.filter((campaign) => campaign.brand === adminBrandFilter);
    }
    return filtered;
  }, [brandFilter, campaigns, role, adminBrandFilter]);

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

  const toggleObjective = (objective) => {
    setForm((prev) => {
      const exists = prev.objectives.includes(objective);
      return {
        ...prev,
        objectives: exists ? prev.objectives.filter((item) => item !== objective) : [...prev.objectives, objective],
      };
    });
  };

  const toggleCreatorTier = (tier) => {
    setForm((prev) => {
      const exists = prev.creatorTiers.includes(tier);
      return {
        ...prev,
        creatorTiers: exists ? prev.creatorTiers.filter((item) => item !== tier) : [...prev.creatorTiers, tier],
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
      targetAudience: form.targetAudience,
      creatorType: form.creatorType,
      creatorTiers: form.creatorTiers,
      dealType: form.dealType,
      campaignPackage: form.campaignPackage,
      customPackage: form.customPackage,
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
            onClick={() => (role === 'brand' ? setShowWizard(true) : openModal())}
          >
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
        {(role === 'admin' || role === 'employee') && (
          <select
            className="input"
            value={adminBrandFilter}
            onChange={(event) => setAdminBrandFilter(event.target.value)}
          >
            <option value="">All Brands</option>
            {brandNames.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        )}
      </div>

      {visibleCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start building a roster."
          action={
            role === 'admin' || role === 'employee' || role === 'brand' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => (role === 'brand' ? setShowWizard(true) : openModal())}
              >
                Create Campaign
              </button>
            ) : null
          }
        />
      ) : (
        <CampaignGrid campaigns={visibleCampaigns} />
      )}

      <CampaignFormModal
        open={showModal}
        form={form}
        brands={brandNames}
        role={role}
        onClose={closeModal}
        onChange={updateForm}
        onTogglePlatform={togglePlatform}
        onToggleContentFormat={toggleContentFormat}
        onToggleObjective={toggleObjective}
        onToggleCreatorTier={toggleCreatorTier}
        onSubmit={handleCreateCampaign}
      />

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
