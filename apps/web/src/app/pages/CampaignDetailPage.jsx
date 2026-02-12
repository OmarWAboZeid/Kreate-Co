import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJson } from '../api/client.js';
import CreatorFilters from '../components/CreatorFilters.jsx';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import CreatorGrid from '../components/CreatorGrid.jsx';
import CreatorProfileModal from '../components/CreatorProfileModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const inferCreatorType = (creator) => {
  const explicitType = String(creator?.creator_type || creator?.type || '').toLowerCase();
  if (explicitType.includes('ugc')) return 'ugc';
  if (explicitType.includes('influencer')) return 'influencer';

  const hasInfluencerSignals = Boolean(
    creator?.followers != null ||
      creator?.followers_count != null ||
      creator?.engagement_rate != null ||
      creator?.engagementRate != null ||
      creator?.avg_views != null ||
      creator?.avgViews != null
  );
  return hasInfluencerSignals ? 'influencer' : 'ugc';
};

const splitCreatorsByType = (creators) =>
  creators.reduce(
    (acc, creator) => {
      if (inferCreatorType(creator) === 'ugc') {
        acc.ugc.push(creator);
      } else {
        acc.influencer.push(creator);
      }
      return acc;
    },
    { ugc: [], influencer: [] }
  );

const createEmptyMetrics = () => ({
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  reach: 0,
});

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeMetrics = (base, metrics) => ({
  views: base.views + toFiniteNumber(metrics?.views),
  likes: base.likes + toFiniteNumber(metrics?.likes),
  comments: base.comments + toFiniteNumber(metrics?.comments),
  shares: base.shares + toFiniteNumber(metrics?.shares),
  saves: base.saves + toFiniteNumber(metrics?.saves),
  reach: base.reach + toFiniteNumber(metrics?.reach),
});

const formatMetricNumber = (value) => toFiniteNumber(value).toLocaleString();

const formatEngagementRate = (views, interactions) => {
  const safeViews = toFiniteNumber(views);
  const safeInteractions = toFiniteNumber(interactions);
  if (safeViews <= 0 || safeInteractions <= 0) return '0.00%';
  return `${((safeInteractions / safeViews) * 100).toFixed(2)}%`;
};

export default function CampaignDetailPage() {
  const { role, campaignId } = useParams();
  const navigate = useNavigate();
  const { campaigns, campaignCreators, brands, contentItems } = useAppState();
  const dispatch = useAppDispatch();
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });
  const [contentForm, setContentForm] = useState({ link: '', platform: '', type: '', notes: '' });
  const [contentUploadState, setContentUploadState] = useState({
    uploading: false,
    error: '',
    fileName: '',
  });
  const [videoPreview, setVideoPreview] = useState({
    open: false,
    url: '',
    title: 'Submitted Video',
  });
  const [rejectModal, setRejectModal] = useState({ open: false, creator: null });
  const [rejectReason, setRejectReason] = useState('');
  const [loadingCreatorsState, setLoadingCreatorsState] = useState(false);
  const [brandTab, setBrandTab] = useState('brief');
  const [adminTab, setAdminTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    brand: '',
    status: 'Draft',
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
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [selectedCreatorType, setSelectedCreatorType] = useState('influencer');

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

  const suggestCreators = suggestTab === 'ugc' ? filteredUgcCreators : filteredInfluencerCreators;

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
  const filteredCreatorBuckets = useMemo(() => {
    const buckets = { pending: [], approved: [], rejected: [] };
    filteredCreators.forEach((creator) => {
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
  }, [filteredCreators, creatorState.approvals]);
  const filteredCreatorBucketsByType = useMemo(
    () => ({
      pending: splitCreatorsByType(filteredCreatorBuckets.pending),
      approved: splitCreatorsByType(filteredCreatorBuckets.approved),
      rejected: splitCreatorsByType(filteredCreatorBuckets.rejected),
    }),
    [filteredCreatorBuckets]
  );

  const filteredCreatorsByType = useMemo(() => {
    return splitCreatorsByType(filteredCreators);
  }, [filteredCreators]);

  const openCreatorProfile = (creator, type) => {
    setSelectedCreator(creator);
    setSelectedCreatorType(type);
  };

  const closeCreatorProfile = () => {
    setSelectedCreator(null);
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
    setContentUploadState({ uploading: false, error: '', fileName: '' });
  };

  const closeVideoPreview = () => {
    setVideoPreview({ open: false, url: '', title: 'Submitted Video' });
  };

  const openVideoPreview = (url, title) => {
    if (!url) return;
    setVideoPreview({ open: true, url, title: title || 'Submitted Video' });
  };

  const isLikelyVideoUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('/objects/')) return true;
    return /\.(mp4|mov|m4v|webm|ogv|ogg)(\?|#|$)/i.test(url);
  };

  const uploadSubmittedVideo = async (file) => {
    const signedUrlRes = await fetch('/api/uploads/request-url', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    const signedUrlData = await signedUrlRes.json();
    if (!signedUrlRes.ok || !signedUrlData.ok || !signedUrlData.uploadURL || !signedUrlData.objectPath) {
      throw new Error(signedUrlData?.error || 'Failed to generate upload URL');
    }

    const uploadRes = await fetch(signedUrlData.uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/mp4' },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error('Video upload failed');
    }

    return signedUrlData.objectPath;
  };

  const handleSubmittedVideoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!String(file.type || '').startsWith('video/')) {
      setContentUploadState({
        uploading: false,
        error: 'Please choose a valid video file.',
        fileName: '',
      });
      event.target.value = '';
      return;
    }

    setContentUploadState({
      uploading: true,
      error: '',
      fileName: file.name,
    });

    try {
      const objectPath = await uploadSubmittedVideo(file);
      setContentForm((prev) => ({ ...prev, link: objectPath }));
      setContentUploadState({
        uploading: false,
        error: '',
        fileName: file.name,
      });
    } catch (error) {
      setContentUploadState({
        uploading: false,
        error: error?.message || 'Failed to upload video.',
        fileName: '',
      });
    }
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
      status: campaign.status || 'Draft',
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

  const handleAddContent = async () => {
    if (!contentForm.link || !addContentModal.creator) return;
    if (contentUploadState.uploading) return;

    try {
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

      const workflowRes = await fetch(
        `/api/campaigns/${campaign.id}/creators/${addContentModal.creator.id}/workflow`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finalVideoLink: contentForm.link }),
        }
      );
      const workflowData = await workflowRes.json();
      if (!workflowRes.ok || !workflowData.ok) {
        throw new Error(workflowData?.error || 'Failed to link submitted video');
      }

      dispatch({ type: 'LOG_CONTENT_DELIVERY', payload: { content: newContent } });
      await refreshCampaignCreators();
      closeAddContentModal();
    } catch (error) {
      setContentUploadState((prev) => ({
        ...prev,
        error: error?.message || 'Failed to add content.',
      }));
    }
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
        status: role === 'admin' ? editForm.status : undefined,
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
  const campaignContent = contentItems.filter((item) => item.campaignId === campaign.id);
  const analyticsCreatorIds = Array.from(
    new Set([
      ...creatorState.shortlist.filter((id) => id != null).map((id) => String(id)),
      ...campaignContent
        .filter((item) => item.creatorId != null)
        .map((item) => String(item.creatorId)),
      ...Object.keys(creatorState.outreach || {}).filter(
        (id) => id && id !== 'undefined' && id !== 'null'
      ),
    ])
  ).filter(Boolean);
  const creatorAnalyticsRows = analyticsCreatorIds
    .map((creatorId) => {
      const creator =
        creatorMap.get(creatorId) ||
        creatorMap.get(Number(creatorId)) ||
        shortlistCreators.find((item) => String(item.id) === creatorId);
      const creatorContent = campaignContent.filter((item) => String(item.creatorId) === creatorId);
      const metrics = creatorContent.reduce(
        (acc, item) => mergeMetrics(acc, item.metrics),
        createEmptyMetrics()
      );
      const interactions = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
      const decision =
        creatorState.approvals?.[creatorId] ||
        creatorState.approvals?.[creator?.id] ||
        'Suggested';
      const workflowEntry =
        creatorState.outreach?.[creatorId] ||
        creatorState.outreach?.[creator?.id] ||
        {};
      const fallbackSubmission = workflowEntry.finalVideoLink && creatorContent.length === 0 ? 1 : 0;
      const submissionCount = creatorContent.length + fallbackSubmission;
      const publishedCount = creatorContent.filter((item) => item.status === 'Published').length;
      const approvedSubmissionCount = creatorContent.filter(
        (item) => item.status === 'Approved' || item.status === 'Published'
      ).length;
      const creatorType = creator ? (inferCreatorType(creator) === 'ugc' ? 'UGC' : 'Influencer') : 'Creator';
      const creatorName = creator?.name || creator?.display_name || `Creator ${creatorId}`;
      return {
        creatorId,
        creator,
        creatorName,
        creatorType,
        decision,
        metrics,
        interactions,
        submissionCount,
        approvedSubmissionCount,
        publishedCount,
      };
    })
    .sort((left, right) => {
      const decisionOrder = { 'Brand Approved': 0, Suggested: 1, 'Brand Rejected': 2 };
      const decisionDelta = (decisionOrder[left.decision] ?? 3) - (decisionOrder[right.decision] ?? 3);
      if (decisionDelta !== 0) return decisionDelta;
      if (right.submissionCount !== left.submissionCount) return right.submissionCount - left.submissionCount;
      return right.metrics.views - left.metrics.views;
    });
  const creatorAnalyticsTotals = creatorAnalyticsRows.reduce(
    (acc, row) => {
      acc.creators += 1;
      acc.submissions += row.submissionCount;
      acc.approvedSubmissions += row.approvedSubmissionCount;
      acc.publishedSubmissions += row.publishedCount;
      if (row.decision === 'Brand Approved') acc.approvedCreators += 1;
      if (row.decision === 'Brand Rejected') acc.rejectedCreators += 1;
      if (row.creatorType === 'UGC') acc.ugcCreators += 1;
      if (row.creatorType === 'Influencer') acc.influencerCreators += 1;
      acc.metrics = mergeMetrics(acc.metrics, row.metrics);
      acc.interactions += row.interactions;
      return acc;
    },
    {
      creators: 0,
      submissions: 0,
      approvedSubmissions: 0,
      publishedSubmissions: 0,
      approvedCreators: 0,
      rejectedCreators: 0,
      ugcCreators: 0,
      influencerCreators: 0,
      metrics: createEmptyMetrics(),
      interactions: 0,
    }
  );
  const creatorAnalyticsCard = (
    <section className="detail-card brand-analytics-section">
      <div className="detail-card-header">
        <div>
          <h3>Campaign Analytics</h3>
          <p className="section-description">
            Campaign totals and creator-level performance across UGC and influencer deliveries.
          </p>
        </div>
      </div>
      <div className="detail-card-content brand-analytics-content">
        <div className="metrics-grid brand-analytics-metrics-grid">
          <div>
            <span>Total Creators</span>
            <strong>{creatorAnalyticsTotals.creators}</strong>
          </div>
          <div>
            <span>Approved Creators</span>
            <strong>{creatorAnalyticsTotals.approvedCreators}</strong>
          </div>
          <div>
            <span>Submissions</span>
            <strong>{creatorAnalyticsTotals.submissions}</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{creatorAnalyticsTotals.publishedSubmissions}</strong>
          </div>
          <div>
            <span>Total Views</span>
            <strong>{formatMetricNumber(creatorAnalyticsTotals.metrics.views)}</strong>
          </div>
          <div>
            <span>Engagement Rate</span>
            <strong>
              {formatEngagementRate(
                creatorAnalyticsTotals.metrics.views,
                creatorAnalyticsTotals.interactions
              )}
            </strong>
          </div>
        </div>

        {creatorAnalyticsRows.length === 0 ? (
          <EmptyState
            title="No analytics yet"
            description="Analytics will appear here after creators are suggested and content is submitted."
          />
        ) : (
          <div className="analytics-table-wrapper brand-analytics-table-wrapper">
            <table className="analytics-table brand-analytics-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Type</th>
                  <th>Approval</th>
                  <th>Submissions</th>
                  <th>Published</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Saves</th>
                  <th>ER</th>
                </tr>
              </thead>
              <tbody>
                {creatorAnalyticsRows.map((row) => (
                  <tr key={row.creatorId}>
                    <td>
                      <div className="creator-cell">
                        <img
                          src={row.creator?.profile_image || '/assets/default-avatar.png'}
                          alt={row.creatorName}
                          className="creator-avatar-sm"
                        />
                        <span className="creator-name">{row.creatorName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="chip">{row.creatorType}</span>
                    </td>
                    <td>
                      <StatusPill status={row.decision} />
                    </td>
                    <td>{row.submissionCount}</td>
                    <td>{row.publishedCount}</td>
                    <td>{formatMetricNumber(row.metrics.views)}</td>
                    <td>{formatMetricNumber(row.metrics.likes)}</td>
                    <td>{formatMetricNumber(row.metrics.comments)}</td>
                    <td>{formatMetricNumber(row.metrics.shares)}</td>
                    <td>{formatMetricNumber(row.metrics.saves)}</td>
                    <td className="engagement-cell">
                      {formatEngagementRate(row.metrics.views, row.interactions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );

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
          <button
            type="button"
            className={brandTab === 'analytics' ? 'active' : undefined}
            onClick={() => setBrandTab('analytics')}
          >
            Analytics
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
      {isBrand && brandTab === 'analytics' ? creatorAnalyticsCard : null}
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

            {filteredCreators.length === 0 ? (
              <EmptyState
                title="No creators found"
                description="Try adjusting your filters."
              />
            ) : (
              <div className="brand-creator-list">
                {filteredCreatorBuckets.pending.length > 0 && (
                  <div className="brand-creator-group">
                    <div className="brand-creator-group-header">
                      <h4>Awaiting your approval</h4>
                      <span>{filteredCreatorBuckets.pending.length} creators</span>
                    </div>
                    {filteredCreatorBucketsByType.pending.influencer.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.pending.influencer}
                        type="influencer"
                        onOpenProfile={openCreatorProfile}
                        renderActions={(creator) => (
                          <>
                            <button
                              type="button"
                              className="btn btn-success btn-small"
                              onClick={() => handleDecision(creator.id, 'Brand Approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-small"
                              onClick={() => openRejectModal(creator)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      />
                    )}
                    {filteredCreatorBucketsByType.pending.ugc.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.pending.ugc}
                        type="ugc"
                        onOpenProfile={openCreatorProfile}
                        renderActions={(creator) => (
                          <>
                            <button
                              type="button"
                              className="btn btn-success btn-small"
                              onClick={() => handleDecision(creator.id, 'Brand Approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-small"
                              onClick={() => openRejectModal(creator)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      />
                    )}
                  </div>
                )}

                {filteredCreatorBuckets.approved.length > 0 && (
                  <div className="brand-creator-group">
                    <div className="brand-creator-group-header">
                      <h4>Approved creators</h4>
                      <span>{filteredCreatorBuckets.approved.length} creators</span>
                    </div>
                    {filteredCreatorBucketsByType.approved.influencer.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.approved.influencer}
                        type="influencer"
                        onOpenProfile={openCreatorProfile}
                        renderActions={(creator) => {
                          const finalLink = creatorState.outreach?.[creator.id]?.finalVideoLink || '';
                          if (!finalLink) return null;
                          if (isLikelyVideoUrl(finalLink)) {
                            return (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() =>
                                  openVideoPreview(finalLink, `${creator.name || 'Creator'} - submitted video`)
                                }
                              >
                                Preview Video
                              </button>
                            );
                          }
                          return (
                            <a
                              className="btn btn-secondary btn-small"
                              href={finalLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Link
                            </a>
                          );
                        }}
                      />
                    )}
                    {filteredCreatorBucketsByType.approved.ugc.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.approved.ugc}
                        type="ugc"
                        onOpenProfile={openCreatorProfile}
                        renderActions={(creator) => {
                          const finalLink = creatorState.outreach?.[creator.id]?.finalVideoLink || '';
                          if (!finalLink) return null;
                          if (isLikelyVideoUrl(finalLink)) {
                            return (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() =>
                                  openVideoPreview(finalLink, `${creator.name || 'Creator'} - submitted video`)
                                }
                              >
                                Preview Video
                              </button>
                            );
                          }
                          return (
                            <a
                              className="btn btn-secondary btn-small"
                              href={finalLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Link
                            </a>
                          );
                        }}
                      />
                    )}
                  </div>
                )}

                {filteredCreatorBuckets.rejected.length > 0 && (
                  <div className="brand-creator-group">
                    <div className="brand-creator-group-header">
                      <h4>Rejected creators</h4>
                      <span>{filteredCreatorBuckets.rejected.length} creators</span>
                    </div>
                    {filteredCreatorBucketsByType.rejected.influencer.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.rejected.influencer}
                        type="influencer"
                        onOpenProfile={openCreatorProfile}
                      />
                    )}
                    {filteredCreatorBucketsByType.rejected.ugc.length > 0 && (
                      <CreatorGrid
                        creators={filteredCreatorBucketsByType.rejected.ugc}
                        type="ugc"
                        onOpenProfile={openCreatorProfile}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
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
              <div className="brand-creator-list">
                {filteredCreatorsByType.influencer.length > 0 && (
                  <div className="brand-creator-group">
                    <div className="brand-creator-group-header">
                      <h4>Influencers</h4>
                      <span>{filteredCreatorsByType.influencer.length} creators</span>
                    </div>
                    <CreatorGrid
                      creators={filteredCreatorsByType.influencer}
                      type="influencer"
                      onOpenProfile={openCreatorProfile}
                      renderActions={
                        canManageCreators
                          ? (creator) => (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setAddContentModal({ open: true, creator })}
                              >
                                Add Content
                              </button>
                            )
                          : undefined
                      }
                    />
                  </div>
                )}

                {filteredCreatorsByType.ugc.length > 0 && (
                  <div className="brand-creator-group">
                    <div className="brand-creator-group-header">
                      <h4>UGC Creators</h4>
                      <span>{filteredCreatorsByType.ugc.length} creators</span>
                    </div>
                    <CreatorGrid
                      creators={filteredCreatorsByType.ugc}
                      type="ugc"
                      onOpenProfile={openCreatorProfile}
                      renderActions={
                        canManageCreators
                          ? (creator) => (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setAddContentModal({ open: true, creator })}
                              >
                                Add Content
                              </button>
                            )
                          : undefined
                      }
                    />
                  </div>
                )}
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
            ) : suggestCreators.length === 0 ? (
              <EmptyState
                title="No creators found"
                description="Try adjusting your filters or search terms."
              />
            ) : (
              <div className="compact-creator-grid">
                <CreatorGrid
                  creators={suggestCreators}
                  type={suggestTab}
                  onOpenProfile={openCreatorProfile}
                  renderActions={(creator) => {
                    const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
                    return (
                      <button
                        type="button"
                        className={`btn btn-small ${isAlreadySuggested ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={isAlreadySuggested}
                        onClick={() => handleSuggestCreator(creator)}
                      >
                        {isAlreadySuggested ? 'Added' : 'Suggest'}
                      </button>
                    );
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <CreatorProfileModal
        creator={selectedCreator}
        type={selectedCreatorType}
        onClose={closeCreatorProfile}
      />

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
            <span>Upload Video</span>
            <input
              type="file"
              className="input"
              accept="video/*"
              onChange={handleSubmittedVideoSelect}
              disabled={contentUploadState.uploading}
            />
            {contentUploadState.uploading && <p className="muted">Uploading video...</p>}
            {!contentUploadState.uploading && contentUploadState.fileName && (
              <p className="muted">Uploaded: {contentUploadState.fileName}</p>
            )}
          </label>
          <label>
            <span>Content Link *</span>
            <input
              type="text"
              className="input"
              placeholder="https://... or /objects/..."
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
              <option value="Facebook">Facebook</option>
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
          {contentUploadState.error && <p className="field-error">{contentUploadState.error}</p>}
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
            disabled={!contentForm.link || contentUploadState.uploading}
          >
            Add Content
          </button>
        </div>
      </Modal>

      <Modal
        open={videoPreview.open}
        onClose={closeVideoPreview}
        title={videoPreview.title}
        description="Preview-only mode (download disabled in player controls)."
        size="large"
      >
        <div className="video-preview-wrap">
          <video
            className="video-preview-player"
            src={videoPreview.url}
            controls
            controlsList="nodownload noplaybackrate nofullscreen"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            preload="metadata"
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeVideoPreview}
          >
            Close
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
