import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJson } from '../api/client.js';
import CreatorFilters from '../components/CreatorFilters.jsx';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const formatHandle = (creator) => {
  if (!creator) return '';
  const raw =
    creator.instagram_handle || creator.tiktok_handle || creator.handle || creator.instagramHandle || creator.tiktokHandle;
  if (!raw) return '';
  return raw.startsWith('@') ? raw : `@${raw}`;
};

const formatCompactNumber = (value) => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
};

export default function CampaignDetailPage() {
  const { role, campaignId } = useParams();
  const navigate = useNavigate();
  const { campaigns, campaignCreators, contentItems, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });
  const [contentForm, setContentForm] = useState({ link: '', platform: '', type: '', notes: '' });
  const [rejectModal, setRejectModal] = useState({ open: false, creator: null });
  const [rejectReason, setRejectReason] = useState('');
  const [loadingCreatorsState, setLoadingCreatorsState] = useState(false);
  const [brandTab, setBrandTab] = useState('brief');
  const [adminTab, setAdminTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    brand: '',
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
  });
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);

  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestTab, setSuggestTab] = useState('ugc');
  const [ugcFilters, setUgcFilters] = useState({
    search: '',
    gender: '',
    age: '',
    niche: '',
    experienceLevel: '',
  });
  const [influencerFilters, setInfluencerFilters] = useState({
    search: '',
    followerCount: '',
    gender: '',
    niche: '',
    platform: '',
    engagementRate: '',
  });

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isBrand = role === 'brand';
  const canManageCreators = isAdmin || isEmployee;
  const brandNames = brands.map((b) => (typeof b === 'string' ? b : b.name));

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setLoading(true);
        const [ugcRes, infRes] = await Promise.all([
          getJson('/api/ugc-creators?limit=100', 'Failed to fetch UGC creators'),
          getJson('/api/influencers?limit=100', 'Failed to fetch influencers'),
        ]);
        setUgcCreators(ugcRes?.data || []);
        setInfluencers(infRes?.data || []);
      } catch (err) {
        console.error('Failed to fetch creators:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCreators();
  }, []);

  useEffect(() => {
    if (brands.length > 0 || !isAdmin) return;
    const fetchBrands = async () => {
      setLoadingBrands(true);
      try {
        const res = await fetch('/api/brands');
        const data = await res.json();
        if (data.ok) {
          dispatch({ type: 'SET_BRANDS', payload: data.data });
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      } finally {
        setLoadingBrands(false);
      }
    };
    fetchBrands();
  }, [brands.length, dispatch, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch('/api/packages');
        const data = await res.json();
        if (data.ok) {
          setPackages(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch packages:', err);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, [isAdmin]);

  const refreshCampaignCreators = async () => {
    if (!campaignId) return;
    setLoadingCreatorsState(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`);
      const data = await res.json();
      if (data.ok) {
        dispatch({
          type: 'SET_CAMPAIGN_CREATORS',
          payload: { campaignId, data: data.data },
        });
      }
    } catch (err) {
      console.error('Failed to fetch campaign creators:', err);
    } finally {
      setLoadingCreatorsState(false);
    }
  };

  useEffect(() => {
    refreshCampaignCreators();
  }, [campaignId]);

  const campaign = campaigns.find((item) => item.id === campaignId);
  const brandOptions = useMemo(() => {
    const options = new Set(brandNames);
    if (campaign?.brand) {
      options.add(campaign.brand);
    }
    return Array.from(options);
  }, [brandNames, campaign?.brand]);

  const allCreators = useMemo(() => [...ugcCreators, ...influencers], [ugcCreators, influencers]);

  const creatorMap = useMemo(() => {
    const map = new Map();
    allCreators.forEach((creator) => map.set(creator.id, creator));
    return map;
  }, [allCreators]);

  const filteredUgcCreators = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (ugcFilters.search && !creator.name.toLowerCase().includes(ugcFilters.search.toLowerCase())) {
        return false;
      }
      if (ugcFilters.niche && creator.niche !== ugcFilters.niche) return false;
      if (ugcFilters.gender && creator.gender !== ugcFilters.gender) return false;
      if (ugcFilters.age) {
        const [min, max] = ugcFilters.age.split('-').map(Number);
        const age = parseInt(creator.age);
        if (isNaN(age) || age < min || age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencerCreators = useMemo(() => {
    return influencers.filter((creator) => {
      if (influencerFilters.search && !creator.name.toLowerCase().includes(influencerFilters.search.toLowerCase())) {
        return false;
      }
      if (influencerFilters.niche && creator.niche !== influencerFilters.niche) return false;
      return true;
    });
  }, [influencers, influencerFilters]);

  if (!campaign) {
    return (
      <div className="page-stack">
        <button type="button" className="link-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <EmptyState title="Campaign not found" description="Try selecting a different campaign." />
      </div>
    );
  }

  const creatorState = campaignCreators[campaign.id] || {
    shortlist: [],
    approvals: {},
    outreach: {},
    rejectionReasons: {},
  };
  const shortlistCreators = creatorState.shortlist.map((id) => creatorMap.get(id)).filter(Boolean);

  const filteredCreators = useMemo(() => {
    let result = shortlistCreators;
    if (creatorFilter === 'approved') {
      result = result.filter((c) => creatorState.approvals[c.id] === 'Brand Approved');
    } else if (creatorFilter === 'rejected') {
      result = result.filter((c) => creatorState.approvals[c.id] === 'Brand Rejected');
    } else if (creatorFilter === 'pending') {
      result = result.filter(
        (c) => !creatorState.approvals[c.id] || creatorState.approvals[c.id] === 'Suggested'
      );
    }
    if (creatorSearch) {
      const search = creatorSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(search));
    }
    return result;
  }, [shortlistCreators, creatorFilter, creatorSearch, creatorState.approvals]);

  const handleStatusChange = async (creatorId, status) => {
    try {
      await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowStatus: status }),
      });
      refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update workflow status:', err);
    }
  };

  const handleFinalLinkChange = async (creatorId, link) => {
    try {
      await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalVideoLink: link }),
      });
      refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update final link:', err);
    }
  };

  const handleDecision = async (creatorId, decision) => {
    const mappedDecision =
      decision === 'Brand Approved'
        ? 'approved'
        : decision === 'Brand Rejected'
          ? 'rejected'
          : 'pending';
    try {
      await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: mappedDecision, note: '' }),
      });
      refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update decision:', err);
    }
  };

  const handleSuggestCreator = async (creator) => {
    const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
    if (isAlreadySuggested) return;
    try {
      await fetch(`/api/campaigns/${campaign.id}/creators/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: creator.id }),
      });
      refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to suggest creator:', err);
    }
  };

  const closeAddContentModal = () => {
    setAddContentModal({ open: false, creator: null });
    setContentForm({ link: '', platform: '', type: '', notes: '' });
  };

  const closeRejectModal = () => {
    setRejectModal({ open: false, creator: null });
    setRejectReason('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.creator || !rejectReason.trim()) return;
    try {
      await fetch(`/api/campaigns/${campaign.id}/creators/${rejectModal.creator.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'rejected', note: rejectReason }),
      });
      closeRejectModal();
      refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to reject creator:', err);
    }
  };

  const openRejectModal = (creator) => {
    setRejectModal({ open: true, creator });
    setRejectReason('');
  };

  const openEditModal = () => {
    if (!campaign) return;
    const objectivesValue = Array.isArray(campaign.objectives)
      ? campaign.objectives
      : campaign.objectives
        ? [campaign.objectives]
        : [];
    setEditForm({
      name: campaign.name || '',
      brand: campaign.brand || '',
      platforms: campaign.platforms || [],
      startDate: campaign.timeline?.start || campaign.startDate || '',
      endDate: campaign.timeline?.end || campaign.endDate || '',
      description: campaign.description || '',
      objectives: objectivesValue.map((item) => String(item).toLowerCase()),
      targetAudience: campaign.targetAudience || '',
      creatorType: campaign.campaignType || '',
      campaignTypeDetail: campaign.campaignTypeDetail || '',
      creatorTiers: campaign.creatorTiers || [],
      dealType: campaign.dealType || '',
      campaignPackage: campaign.package?.id || '',
      customPackage: campaign.customPackageLabel || '',
      deliverables: campaign.deliverables || '',
      contentFormat: campaign.contentFormat || [],
      notes: campaign.notes || '',
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
  };

  const updateEditForm = (field, value) => {
    setEditForm((prev) => {
      if (field === 'creatorType' && value !== 'Hybrid') {
        return { ...prev, creatorType: value, campaignTypeDetail: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleEditPlatform = (platform) => {
    setEditForm((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists
          ? prev.platforms.filter((item) => item !== platform)
          : [...prev.platforms, platform],
      };
    });
  };

  const toggleEditContentFormat = (format) => {
    setEditForm((prev) => {
      const exists = prev.contentFormat.includes(format);
      return {
        ...prev,
        contentFormat: exists
          ? prev.contentFormat.filter((item) => item !== format)
          : [...prev.contentFormat, format],
      };
    });
  };

  const toggleEditObjective = (objective) => {
    setEditForm((prev) => {
      const exists = prev.objectives.includes(objective);
      return {
        ...prev,
        objectives: exists
          ? prev.objectives.filter((item) => item !== objective)
          : [...prev.objectives, objective],
      };
    });
  };

  const toggleEditCreatorTier = (tier) => {
    setEditForm((prev) => {
      const exists = prev.creatorTiers.includes(tier);
      return {
        ...prev,
        creatorTiers: exists
          ? prev.creatorTiers.filter((item) => item !== tier)
          : [...prev.creatorTiers, tier],
      };
    });
  };

  const handleAddContent = () => {
    if (!contentForm.link || !addContentModal.creator) return;

    const newContent = {
      id: makeId('content'),
      campaignId: campaign.id,
      creatorId: addContentModal.creator.id,
      platform: contentForm.platform || 'TikTok',
      type: contentForm.type || 'Reel',
      caption: contentForm.notes || '',
      hashtags: '',
      assets: [{ url: contentForm.link, label: 'Submitted content' }],
      status: 'Pending Review',
      revisionCount: 0,
      feedback: [],
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'LOG_CONTENT_DELIVERY', payload: { content: newContent } });
    closeAddContentModal();
  };

  const handleUpdateCampaign = async () => {
    if (!campaignId) {
      throw new Error('Missing campaign id.');
    }
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        brand: editForm.brand,
        platforms: editForm.platforms,
        objectives: editForm.objectives,
        contentFormat: editForm.contentFormat,
        creatorTiers: editForm.creatorTiers,
        campaignType: editForm.creatorType,
        campaignTypeDetail: editForm.campaignTypeDetail,
        dealType: editForm.dealType,
        targetAudience: editForm.targetAudience,
        deliverables: editForm.deliverables,
        notes: editForm.notes,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        packageId: editForm.campaignPackage || null,
        customPackageLabel: editForm.customPackage || null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Failed to update campaign.');
    }
    dispatch({ type: 'UPDATE_CAMPAIGN', payload: data.data });
    closeEditModal();
    return data.data;
  };

  const campaignContent = contentItems.filter((c) => c.campaignId === campaignId);
  const campaignContentByCreator = useMemo(() => {
    const map = new Map();
    campaignContent.forEach((content) => {
      const existing = map.get(content.creatorId) || [];
      existing.push(content);
      map.set(content.creatorId, existing);
    });
    return map;
  }, [campaignContent]);

  const campaignType = campaign.campaignType || 'Hybrid';
  const isHybrid = campaignType === 'Hybrid';
  const isUGC = campaignType === 'UGC';
  const isInfluencer = campaignType === 'Influencer';
  const showUGC = isUGC || isHybrid || !campaignType;
  const showInfluencer = isInfluencer || isHybrid || !campaignType;
  const objectives = Array.isArray(campaign.objectives)
    ? campaign.objectives
    : [campaign.objectives || 'Awareness'];
  const platformSummary = (campaign.platforms || []).length
    ? campaign.platforms.join(', ')
    : 'TBD';
  const formatSummary = (campaign.contentFormat || []).length
    ? campaign.contentFormat.join(', ')
    : 'TBD';
  const creatorTierSummary = Array.isArray(campaign.creatorTiers) && campaign.creatorTiers.length > 0
    ? campaign.creatorTiers.join(', ')
    : 'TBD';
  const brandCreatorBuckets = useMemo(() => {
    const buckets = { pending: [], approved: [], rejected: [] };
    shortlistCreators.forEach((creator) => {
      const decision = creatorState.approvals[creator.id] || 'Suggested';
      if (decision === 'Brand Approved') {
        buckets.approved.push(creator);
      } else if (decision === 'Brand Rejected') {
        buckets.rejected.push(creator);
      } else {
        buckets.pending.push(creator);
      }
    });
    return buckets;
  }, [shortlistCreators, creatorState.approvals]);

  const briefCard = (
    <section className="detail-card brand-brief-card">
      <div className="detail-card-header">
        <div>
          <h3>Campaign Summary & Requirements</h3>
          <p className="section-description">A single view of the full brief.</p>
        </div>
        <StatusPill status={campaign.status || 'Draft'} />
      </div>
      <div className="detail-card-content">
        <div className="brand-brief-table">
          <div className="brand-brief-group">Campaign Summary</div>
          <div className="brand-brief-row">
            <span>Campaign Type</span>
            <strong>{campaignType}</strong>
          </div>
          {campaign.campaignTypeDetail ? (
            <div className="brand-brief-row">
              <span>Hybrid Detail</span>
              <strong>{campaign.campaignTypeDetail}</strong>
            </div>
          ) : null}
          <div className="brand-brief-row">
            <span>Deal Type</span>
            <strong>{campaign.dealType || campaign.paymentType || 'Paid'}</strong>
          </div>
          <div className="brand-brief-row">
            <span>Start Date</span>
            <strong>{campaign.timeline?.start || campaign.startDate || 'TBD'}</strong>
          </div>
          <div className="brand-brief-row">
            <span>Package</span>
            <strong>{campaign.package?.name || campaign.customPackageLabel || 'Custom'}</strong>
          </div>
          <div className="brand-brief-row">
            <span>Platforms</span>
            <strong>{platformSummary}</strong>
          </div>
          <div className="brand-brief-row">
            <span>Content Formats</span>
            <strong>{formatSummary}</strong>
          </div>
          <div className="brand-brief-row brand-brief-row-wide">
            <span>Objectives</span>
            <div className="brand-brief-tags">
              {objectives.map((obj) => (
                <span key={obj} className="chip">
                  {obj}
                </span>
              ))}
            </div>
          </div>

          {showUGC && (
            <>
              <div className="brand-brief-group">UGC Requirements</div>
              <div className="brand-brief-row">
                <span>Persona</span>
                <strong>{campaign.ugc?.persona || 'Any'}</strong>
              </div>
              <div className="brand-brief-row">
                <span>Gender</span>
                <strong>{campaign.ugc?.gender || 'Any'}</strong>
              </div>
              <div className="brand-brief-row">
                <span>Age Range</span>
                <strong>{campaign.ugc?.ageRange || '18-35'}</strong>
              </div>
              <div className="brand-brief-row">
                <span>Videos</span>
                <strong>{campaign.ugcCount || 'TBD'}</strong>
              </div>
            </>
          )}

          {showInfluencer && (
            <>
              <div className="brand-brief-group">Creator Requirements</div>
              <div className="brand-brief-row">
                <span>Creator Tiers</span>
                <strong>{creatorTierSummary}</strong>
              </div>
              <div className="brand-brief-row">
                <span>Niche</span>
                <strong>{campaign.influencer?.niche || campaign.criteria?.niche || 'Lifestyle'}</strong>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="campaign-details-page">
      <div className="campaign-details-header">
        <button type="button" className="link-button" onClick={() => navigate(-1)}>
          ← Back to campaigns
        </button>
        <div className="campaign-details-title">
          <div className="campaign-title-row">
            <h1>{campaign.name}</h1>
            <StatusPill status={campaign.status} />
          </div>
          <p className="campaign-brand-name">{campaign.brand}</p>
        </div>
        {isAdmin && (
          <div className="campaign-details-actions">
            <button type="button" className="btn btn-secondary" onClick={openEditModal}>
              Edit
            </button>
            <button type="button" className="btn btn-secondary">
              Archive
            </button>
          </div>
        )}
      </div>

      {isBrand && (
        <div className="brand-tab-bar">
          <button
            type="button"
            className={brandTab === 'brief' ? 'active' : undefined}
            onClick={() => setBrandTab('brief')}
          >
            Campaign Brief
          </button>
          <button
            type="button"
            className={brandTab === 'creators' ? 'active' : undefined}
            onClick={() => setBrandTab('creators')}
          >
            Creator Approvals
            <span className="tab-count">{brandCreatorBuckets.pending.length}</span>
          </button>
        </div>
      )}

      {!isBrand && (
        <div className="brand-tab-bar">
          <button
            type="button"
            className={adminTab === 'overview' ? 'active' : undefined}
            onClick={() => setAdminTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={adminTab === 'creators' ? 'active' : undefined}
            onClick={() => setAdminTab('creators')}
          >
            Creator Network
            <span className="tab-count">{shortlistCreators.length}</span>
          </button>
          {canManageCreators && (
            <button
              type="button"
              className={adminTab === 'suggest' ? 'active' : undefined}
              onClick={() => setAdminTab('suggest')}
            >
              Suggest Creators
            </button>
          )}
        </div>
      )}

      {isBrand && brandTab === 'brief' ? briefCard : null}
      {!isBrand && adminTab === 'overview' ? briefCard : null}

      {isBrand && brandTab === 'creators' ? (
        <section className="detail-card brand-creator-section">
          <div className="detail-card-header">
            <div>
              <h3>Creator Approvals</h3>
              <p className="section-description">
                Review suggested creators and approve the best fits.
              </p>
            </div>
            <div className="brand-approval-stats">
              <span>
                <strong>{brandCreatorBuckets.pending.length}</strong> Pending
              </span>
              <span>
                <strong>{brandCreatorBuckets.approved.length}</strong> Approved
              </span>
              <span>
                <strong>{brandCreatorBuckets.rejected.length}</strong> Rejected
              </span>
            </div>
          </div>
          <div className="detail-card-content">
            <div className="brand-creator-group">
              <div className="brand-creator-group-header">
                <h4>Awaiting your approval</h4>
                <span>{brandCreatorBuckets.pending.length} creators</span>
              </div>
              {brandCreatorBuckets.pending.length === 0 ? (
                <p className="brand-empty">No creators are waiting for approval.</p>
              ) : (
                <div className="brand-creator-list">
                  {brandCreatorBuckets.pending.map((creator) => {
                    const handleLabel = formatHandle(creator);
                    return (
                      <div key={creator.id} className="brand-creator-card">
                        <div className="brand-creator-main">
                          <div className="creator-avatar">{creator.name.charAt(0).toUpperCase()}</div>
                          <div className="brand-creator-info">
                            <div className="brand-creator-title">
                              <h4>{creator.name}</h4>
                              <StatusPill status="Suggested" />
                            </div>
                            <p>
                              {handleLabel || '@creator'} · {creator.niche}
                            </p>
                          </div>
                        </div>
                        <div className="brand-creator-actions">
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleDecision(creator.id, 'Brand Approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => openRejectModal(creator)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="brand-creator-group">
              <div className="brand-creator-group-header">
                <h4>Approved creators</h4>
                <span>{brandCreatorBuckets.approved.length} creators</span>
              </div>
              {brandCreatorBuckets.approved.length === 0 ? (
                <p className="brand-empty">No creators approved yet.</p>
              ) : (
                <div className="brand-creator-list compact">
                  {brandCreatorBuckets.approved.map((creator) => {
                    const handleLabel = formatHandle(creator);
                    const outreach = creatorState.outreach[creator.id] || {};
                    const finalLink = outreach.finalVideoLink || '';
                    return (
                      <div key={creator.id} className="brand-creator-card compact">
                        <div className="brand-creator-main">
                          <div className="creator-avatar">{creator.name.charAt(0).toUpperCase()}</div>
                          <div className="brand-creator-info">
                            <div className="brand-creator-title">
                              <h4>{creator.name}</h4>
                              <StatusPill status="Brand Approved" />
                            </div>
                            <p>
                              {handleLabel || '@creator'} · {creator.niche}
                            </p>
                          </div>
                        </div>
                        {finalLink && (
                          <div className="brand-creator-video">
                            <span>Final video</span>
                            <a href={finalLink} target="_blank" rel="noreferrer">
                              View video
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="brand-creator-group">
              <div className="brand-creator-group-header">
                <h4>Rejected creators</h4>
                <span>{brandCreatorBuckets.rejected.length} creators</span>
              </div>
              {brandCreatorBuckets.rejected.length === 0 ? (
                <p className="brand-empty">No creators rejected.</p>
              ) : (
                <div className="brand-creator-list compact">
                  {brandCreatorBuckets.rejected.map((creator) => {
                    const handleLabel = formatHandle(creator);
                    const rejectionReason = creatorState.rejectionReasons?.[creator.id];
                    return (
                      <div key={creator.id} className="brand-creator-card compact">
                        <div className="brand-creator-main">
                          <div className="creator-avatar">{creator.name.charAt(0).toUpperCase()}</div>
                          <div className="brand-creator-info">
                            <div className="brand-creator-title">
                              <h4>{creator.name}</h4>
                              <StatusPill status="Brand Rejected" />
                            </div>
                            <p>
                              {handleLabel || '@creator'} · {creator.niche}
                            </p>
                          </div>
                        </div>
                        {rejectionReason && (
                          <p className="brand-reject-reason">
                            <strong>Reason:</strong> {rejectionReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : !isBrand && adminTab === 'creators' ? (
        <section className="detail-card creator-network-section">
          <div className="detail-card-header">
            <h3>Creator Network</h3>
            <div className="creator-network-filters">
              <input
                type="text"
                className="input"
                placeholder="Search creators..."
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
              />
              <select
                className="input"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
              >
                <option value="all">All Creators</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="detail-card-content creator-table-content">
            {filteredCreators.length === 0 ? (
              <EmptyState
                title="No creators assigned"
                description="Creators will appear here once they are shortlisted for this campaign."
              />
            ) : (
              <div className="creator-network-list">
                <div className="creator-network-header">
                  <span>Creator</span>
                  <span>Followers</span>
                  <span>ER</span>
                  <span>Views</span>
                  <span>Actions</span>
                </div>
                {filteredCreators.map((creator) => {
                  const decision = creatorState.approvals[creator.id] || 'Suggested';
                  const outreach = creatorState.outreach[creator.id] || {};
                  const status = outreach.workflowStatus || 'Filming';
                  const finalLink = outreach.finalVideoLink || '';
                  const creatorContent = campaignContentByCreator.get(creator.id) || [];
                  const handleLabel = formatHandle(creator);
                  const hasFinalLink = Boolean(finalLink);
                  const showBrandWorkflow = isBrand && hasFinalLink;
                  const followerCount = creator.followers ?? creator.followers_count;
                  const followerLabel = formatCompactNumber(followerCount);
                  const engagementLabel = creator.engagementRate
                    ? `${creator.engagementRate}%`
                    : creator.engagement_rate
                      ? `${creator.engagement_rate}%`
                      : '—';
                  const viewsLabel = creator.avgViews
                    ? formatCompactNumber(creator.avgViews)
                    : creator.avg_views
                      ? formatCompactNumber(creator.avg_views)
                      : '—';
                  const nicheLabel = creator.niche || creator.category || 'General';

                  return (
                    <div key={creator.id} className="creator-network-card">
                      <div className="creator-network-row">
                        <div className="creator-row-main">
                          <div className="creator-avatar">{creator.name.charAt(0).toUpperCase()}</div>
                          <div className="creator-row-info">
                            <div className="creator-row-title">
                              <h4>{creator.name}</h4>
                              <StatusPill status={decision} />
                            </div>
                            <p>
                              {handleLabel || '@creator'} · {nicheLabel}
                            </p>
                            {decision === 'Brand Rejected' &&
                              creatorState.rejectionReasons?.[creator.id] && (
                                <p className="rejection-reason">
                                  <strong>Rejection reason:</strong>{' '}
                                  {creatorState.rejectionReasons[creator.id]}
                                </p>
                              )}
                          </div>
                        </div>
                        <div className="creator-metric">
                          <span>Followers</span>
                          <strong>{followerLabel}</strong>
                        </div>
                        <div className="creator-metric">
                          <span>ER</span>
                          <strong>{engagementLabel}</strong>
                        </div>
                        <div className="creator-metric">
                          <span>Views</span>
                          <strong>{viewsLabel}</strong>
                        </div>
                        <div className="creator-row-actions">
                          {canManageCreators && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => setAddContentModal({ open: true, creator })}
                            >
                              Add Content
                            </button>
                          )}
                        </div>
                      </div>

                      {canManageCreators ? (
                        <div className="creator-row-extra creator-workflow">
                          <div className="workflow-field">
                            <label>Status</label>
                            <select
                              className="input"
                              value={status}
                              onChange={(e) => handleStatusChange(creator.id, e.target.value)}
                            >
                              <option value="Filming">Filming</option>
                              <option value="Brief Sent">Brief Sent</option>
                              <option value="Posted">Posted</option>
                              <option value="Need Alternative">Need Alternative</option>
                            </select>
                          </div>
                          <div className="workflow-field">
                            <label>Final Video Link</label>
                            <input
                              type="url"
                              className="input"
                              placeholder="Enter video URL"
                              value={finalLink}
                              onChange={(e) => handleFinalLinkChange(creator.id, e.target.value)}
                            />
                          </div>
                        </div>
                      ) : showBrandWorkflow ? (
                        <div className="creator-row-extra creator-workflow creator-workflow-readonly">
                          <div className="workflow-field">
                            <label>Status</label>
                            <div className="workflow-value">{status}</div>
                          </div>
                          <div className="workflow-field">
                            <label>Final Video Link</label>
                            <a
                              className="workflow-link"
                              href={finalLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View video
                            </a>
                          </div>
                        </div>
                      ) : null}

                      {creatorContent.length > 0 && (
                        <div className="creator-row-extra creator-submitted-content">
                          <h5>Submitted Content ({creatorContent.length})</h5>
                          <div className="submitted-content-list">
                            {creatorContent.map((content) => (
                              <div key={content.id} className="submitted-content-item">
                                <a
                                  href={content.assets?.[0]?.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="link-button"
                                >
                                  {content.platform} {content.type}
                                </a>
                                <StatusPill status={content.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {canManageCreators && (!isBrand && adminTab === 'suggest') && (
        <section className="detail-card suggest-creators-section">
          <div className="detail-card-header">
            <h3>Suggest Creators</h3>
            <p className="section-description">Browse and add creators to this campaign</p>
          </div>
          <div className="tab-group">
            <button
              type="button"
              className={`tab-button ${suggestTab === 'ugc' ? 'active' : ''}`}
              onClick={() => setSuggestTab('ugc')}
            >
              UGC Creators ({ugcCreators.length})
            </button>
            <button
              type="button"
              className={`tab-button ${suggestTab === 'influencer' ? 'active' : ''}`}
              onClick={() => setSuggestTab('influencer')}
            >
              Influencers ({influencers.length})
            </button>
          </div>
          <div className="suggest-filters">
            <CreatorFilters
              type={suggestTab}
              filters={suggestTab === 'ugc' ? ugcFilters : influencerFilters}
              onChange={suggestTab === 'ugc' ? setUgcFilters : setInfluencerFilters}
            />
          </div>
          <div className="detail-card-content">
            {loading ? (
              <div className="loading-state">Loading creators...</div>
            ) : (
              <div className="suggest-creators-grid">
                {(suggestTab === 'ugc' ? filteredUgcCreators : filteredInfluencerCreators).map((creator) => {
                  const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
                  const handleLabel = formatHandle(creator);
                  return (
                    <div key={creator.id} className="suggest-creator-card">
                      <div className="creator-avatar">{creator.name.charAt(0).toUpperCase()}</div>
                      <div className="suggest-creator-info">
                        <h4>{creator.name}</h4>
                        <p className="creator-meta">
                          {handleLabel}
                          {handleLabel && creator.niche ? ' · ' : ''}
                          {creator.niche || ''}
                        </p>
                        {suggestTab === 'ugc' && creator.gender && (
                          <p className="creator-meta">{creator.gender} · Age: {creator.age || 'N/A'}</p>
                        )}
                        {suggestTab === 'influencer' && creator.followers && (
                          <p className="creator-meta">{creator.followers.toLocaleString()} followers</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`btn ${isAlreadySuggested ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={isAlreadySuggested}
                        onClick={() => handleSuggestCreator(creator)}
                      >
                        {isAlreadySuggested ? 'Added' : 'Suggest'}
                      </button>
                    </div>
                  );
                })}
                {(suggestTab === 'ugc' ? filteredUgcCreators : filteredInfluencerCreators).length === 0 && (
                  <EmptyState
                    title="No creators found"
                    description="Try adjusting your filters or search terms."
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <CampaignFormModal
        open={showEditModal}
        form={editForm}
        brands={brandOptions}
        role={role}
        packages={packages}
        loadingPackages={loadingPackages || loadingBrands}
        title="Edit Campaign"
        subtitle="Update campaign details for the brand."
        submitLabel="Save Changes"
        onClose={closeEditModal}
        onChange={updateEditForm}
        onTogglePlatform={toggleEditPlatform}
        onToggleContentFormat={toggleEditContentFormat}
        onToggleObjective={toggleEditObjective}
        onToggleCreatorTier={toggleEditCreatorTier}
        onSubmit={handleUpdateCampaign}
      />

      <Modal
        open={addContentModal.open}
        onClose={closeAddContentModal}
        title="Add Submitted Content"
        description={`Add content submitted by ${addContentModal.creator?.name || ''}`}
      >
        <div className="modal-form">
          <label>
            <span>Content Link *</span>
            <input
              type="url"
              className="input"
              placeholder="https://..."
              value={contentForm.link}
              onChange={(e) => setContentForm((prev) => ({ ...prev, link: e.target.value }))}
              required
            />
          </label>
          <label>
            <span>Platform</span>
            <select
              className="input"
              value={contentForm.platform}
              onChange={(e) => setContentForm((prev) => ({ ...prev, platform: e.target.value }))}
            >
              <option value="">Select platform</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
            </select>
          </label>
          <label>
            <span>Content Type</span>
            <select
              className="input"
              value={contentForm.type}
              onChange={(e) => setContentForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="">Select type</option>
              <option value="Reel">Reel</option>
              <option value="Post">Post</option>
              <option value="Story">Story</option>
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea
              className="input"
              placeholder="Optional notes..."
              rows={3}
              value={contentForm.notes}
              onChange={(e) => setContentForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeAddContentModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAddContent}
            disabled={!contentForm.link}
          >
            Add Content
          </button>
        </div>
      </Modal>

      <Modal
        open={rejectModal.open}
        onClose={closeRejectModal}
        title="Reject Creator"
        description={`Please provide a reason for rejecting ${rejectModal.creator?.name || ''}`}
      >
        <div className="modal-form">
          <label>
            <span>Rejection Reason *</span>
            <textarea
              className="input"
              placeholder="Why are you rejecting this creator?"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeRejectModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleRejectConfirm}
            disabled={!rejectReason.trim()}
          >
            Confirm Rejection
          </button>
        </div>
      </Modal>
    </div>
  );
}
