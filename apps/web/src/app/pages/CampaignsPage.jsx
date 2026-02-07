import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import CampaignGrid from '../components/CampaignGrid.jsx';
import EmptyState from '../components/EmptyState.jsx';
import CampaignWizard from '../components/CampaignWizard.jsx';
import { storage, useAppDispatch, useAppState } from '../state.jsx';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [packages, setPackages] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

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

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetch(`${API_BASE}/campaigns`);
        const data = await res.json();
        if (data.ok) {
          dispatch({ type: 'SET_CAMPAIGNS', payload: data.data });
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    fetchCampaigns();
  }, [dispatch]);

  useEffect(() => {
    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch(`${API_BASE}/packages`);
        const data = await res.json();
        if (data.ok) {
          setPackages(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching packages:', err);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

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
  }, [brandFilter, campaigns, role, adminBrandFilter, searchQuery, statusFilter]);

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

  const handleWizardSubmit = async (wizardData) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizardData.name,
          brand: wizardData.brand,
          status: 'Draft',
          platforms: wizardData.influencer?.platforms || ['Instagram'],
          objectives: wizardData.objectives,
          campaignType: wizardData.campaignType,
          dealType: wizardData.paymentType ? wizardData.paymentType.toLowerCase() : null,
          creatorTiers: wizardData.creatorTiers,
          startDate: wizardData.startDate,
          ugcVideoCount: wizardData.ugcCount || null,
          influencerVideoCount: wizardData.influencerCount || null,
          customPackageLabel: wizardData.ugcVideosOther || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        dispatch({ type: 'CREATE_CAMPAIGN', payload: data.data, actor: 'Brand' });
        setShowWizard(false);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!form.name || !form.brand || form.platforms.length === 0) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand,
          status: 'Draft',
          platforms: form.platforms,
          objectives: form.objectives,
          contentFormat: form.contentFormat,
          creatorTiers: form.creatorTiers,
          campaignType: form.creatorType,
          dealType: form.dealType,
          targetAudience: form.targetAudience,
          deliverables: form.deliverables,
          notes: form.notes,
          startDate: form.startDate,
          endDate: form.endDate,
          packageId: form.campaignPackage || null,
          customPackageLabel: form.customPackage || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        dispatch({ type: 'CREATE_CAMPAIGN', payload: data.data, actor: 'Admin' });
        closeModal();
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
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
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="In Review">In Review</option>
          <option value="Active">Active</option>
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
