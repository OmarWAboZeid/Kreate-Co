import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import CampaignGrid from '../components/CampaignGrid.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CampaignWizard from '../components/CampaignWizard.jsx';
import {
  useBrandsQuery,
  useCampaignsQuery,
  useCreateCampaignMutation,
  usePackagesQuery,
} from '../queries/index.js';
import { useAppDispatch, useAppState } from '../state.jsx';

const defaultForm = {
  name: '',
  brand: '',
  status: 'Planning',
  platforms: [],
  startDate: '',
  endDate: '',
  description: '',
  objectives: [],
  targetAudience: '',
  creatorType: '',
  campaignTypeDetail: '',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const brandsQuery = useBrandsQuery();
  const campaignsQuery = useCampaignsQuery();
  const packagesQuery = usePackagesQuery();
  const createCampaignMutation = useCreateCampaignMutation();
  const packages = useMemo(() => packagesQuery.data?.data || [], [packagesQuery.data]);
  const loadingCampaigns = campaignsQuery.isLoading;
  const loadingPackages = packagesQuery.isLoading;
  const brandSource = brandsQuery.data?.data || brands;
  const brandNames = brandSource.map((b) => (typeof b === 'string' ? b : b.name));
  const campaignSource = campaignsQuery.data?.data || campaigns;

  useEffect(() => {
    const payload = brandsQuery.data?.data;
    if (!payload) return;
    dispatch({ type: 'SET_BRANDS', payload });
  }, [brandsQuery.data, dispatch]);

  useEffect(() => {
    const payload = campaignsQuery.data?.data;
    if (!payload) return;
    dispatch({ type: 'SET_CAMPAIGNS', payload });
  }, [campaignsQuery.data, dispatch]);

  const brandFilter = role === 'brand' ? brandNames[0] || null : null;
  const visibleCampaigns = useMemo(() => {
    let filtered = campaignSource;
    if ((role === 'admin' || role === 'employee') && adminBrandFilter) {
      filtered = filtered.filter((campaign) => campaign.brand === adminBrandFilter);
    }
    if (statusFilter) {
      const normalizedStatus = statusFilter.toLowerCase();
      filtered = filtered.filter(
        (campaign) => (campaign.status || '').toLowerCase() === normalizedStatus
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((campaign) => {
        return (
          (campaign.name || '').toLowerCase().includes(query) ||
          (campaign.brand || '').toLowerCase().includes(query)
        );
      });
    }
    return filtered;
  }, [campaignSource, role, adminBrandFilter, searchQuery, statusFilter]);

  const openModal = () => {
    if (role === 'brand' && brandFilter) {
      setForm({ ...defaultForm, brand: brandFilter });
    } else {
      setForm(defaultForm);
    }
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      if (field === 'creatorType' && value !== 'Hybrid') {
        return { ...prev, creatorType: value, campaignTypeDetail: '' };
      }
      return { ...prev, [field]: value };
    });
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

  const handleWizardSubmit = async (wizardData) => {
    try {
      const response = await createCampaignMutation.mutateAsync({
        name: wizardData.name,
        brand: wizardData.brand,
        status: 'Planning',
        platforms: wizardData.influencer?.platforms || [],
        objectives: wizardData.objectives,
        campaignType: wizardData.campaignType,
        campaignTypeDetail: wizardData.campaignTypeDetail || null,
        dealType: wizardData.paymentType ? wizardData.paymentType.toLowerCase() : null,
        targetAudience: wizardData.creatorAgeRange
          ? `Creator age range: ${wizardData.creatorAgeRange}`
          : null,
        creatorTiers: wizardData.creatorTiers,
        startDate: wizardData.startDate,
        ugcVideoCount: wizardData.ugcCount || null,
        influencerVideoCount: wizardData.influencerCount || null,
        customPackageLabel: wizardData.ugcVideosOther || null,
      });
      if (response?.data) {
        dispatch({ type: 'CREATE_CAMPAIGN', payload: response.data, actor: 'Brand' });
        setShowWizard(false);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const handleCreateCampaign = async () => {
    const response = await createCampaignMutation.mutateAsync({
      name: form.name,
      brand: form.brand,
      status: role === 'admin' ? form.status || 'Planning' : 'Planning',
      platforms: form.platforms,
      objectives: form.objectives,
      contentFormat: form.contentFormat,
      creatorTiers: form.creatorTiers,
      campaignType: form.creatorType,
      campaignTypeDetail: form.campaignTypeDetail,
      dealType: form.dealType,
      targetAudience: form.targetAudience,
      deliverables: form.deliverables,
      notes: form.notes,
      startDate: form.startDate,
      endDate: form.endDate,
      packageId: form.campaignPackage || null,
      customPackageLabel: form.customPackage || null,
    });
    if (!response?.data) {
      throw new Error('Failed to create campaign.');
    }
    dispatch({ type: 'CREATE_CAMPAIGN', payload: response.data, actor: 'Admin' });
    closeModal();
    return response.data;
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
        <input
          className="input"
          placeholder="Search campaigns"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">Status</option>
          <option value="Planning">Planning</option>
          <option value="In Progress">In Progress</option>
          <option value="Published">Published</option>
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

      {loadingCampaigns ? (
        <div className="loading-state">Loading campaigns...</div>
      ) : visibleCampaigns.length === 0 ? (
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
        packages={packages}
        loadingPackages={loadingPackages}
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
