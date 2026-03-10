import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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

export default function CampaignsPage() {
  const { role } = useParams();
  const { campaigns, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showWizard, setShowWizard] = useState(false);
  const [adminBrandFilter, setAdminBrandFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const brandsQuery = useBrandsQuery();
  const campaignsQuery = useCampaignsQuery();
  const packagesQuery = usePackagesQuery();
  const createCampaignMutation = useCreateCampaignMutation();
  // keep packages loaded so wizard can use them if needed
  void packagesQuery;
  const brandSource = brandsQuery.data?.data || brands;
  const brandNames = brandSource.map((b) => (typeof b === 'string' ? b : b.name));
  const campaignSource = campaignsQuery.data?.data || campaigns;
  const isBrand = role === 'brand';
  const brandFilter = isBrand ? brandNames[0] || null : null;
  const canCreate = role === 'admin' || role === 'employee' || isBrand;

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

  const visibleCampaigns = useMemo(() => {
    let filtered = campaignSource;
    if ((role === 'admin' || role === 'employee') && adminBrandFilter) {
      filtered = filtered.filter((c) => c.brand === adminBrandFilter);
    }
    if (statusFilter) {
      filtered = filtered.filter(
        (c) => (c.status || '').toLowerCase() === statusFilter.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.brand || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [campaignSource, role, adminBrandFilter, searchQuery, statusFilter]);

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

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Campaigns</h2>
          <p>Track progress from brief to activation.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowWizard(true)}>
            Create Campaign
          </button>
        )}
      </div>


      <div className="filters-bar">
        <input
          className="input"
          placeholder="Search campaigns"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Planning">Planning</option>
          <option value="In Progress">In Progress</option>
          <option value="Published">Published</option>
        </select>
        {(role === 'admin' || role === 'employee') && (
          <select
            className="input"
            value={adminBrandFilter}
            onChange={(e) => setAdminBrandFilter(e.target.value)}
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

      {campaignsQuery.isLoading ? (
        <div className="loading-state">Loading campaigns...</div>
      ) : visibleCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start building a roster."
          action={
            canCreate ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowWizard(true)}
              >
                Create Campaign
              </button>
            ) : null
          }
        />
      ) : (
        <CampaignGrid campaigns={visibleCampaigns} />
      )}

      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
          brandName={brandFilter}
          brands={isBrand ? null : brandNames}
        />
      )}
    </div>
  );
}
