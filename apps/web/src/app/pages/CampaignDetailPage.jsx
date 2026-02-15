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
import { handleAvatarError, resolveAvatarSrc } from '../utils/avatar.js';

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

const toText = (value) => String(value || '').trim().toLowerCase();

const matchesNiche = (creator, selectedNiche) => {
  if (!selectedNiche) return true;
  const haystack = toText(`${creator?.niche || ''} ${creator?.category || ''}`);
  const needle = toText(selectedNiche);
  if (!haystack) return false;
  if (needle === 'f&b') {
    return /(f&b|food|beverage|restaurant|cafe|kitchen)/.test(haystack);
  }
  return haystack.includes(needle);
};

const matchesAgeRange = (ageValue, selectedRange) => {
  if (!selectedRange) return true;
  const age = Number(ageValue);
  if (!Number.isFinite(age)) return false;
  if (selectedRange === '45+') return age >= 45;
  const [min, max] = selectedRange.split('-').map(Number);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  return age >= min && age <= max;
};

const matchesFollowerRange = (creator, selectedRange) => {
  if (!selectedRange) return true;
  const followers = Number(creator?.followers ?? creator?.followers_count);
  if (!Number.isFinite(followers)) return false;
  if (selectedRange === 'nano') return followers >= 1000 && followers < 10000;
  if (selectedRange === 'micro') return followers >= 10000 && followers < 100000;
  if (selectedRange === 'macro') return followers >= 100000 && followers < 1000000;
  if (selectedRange === 'mega') return followers >= 1000000;
  return true;
};

const matchesPlatform = (creator, selectedPlatform) => {
  if (!selectedPlatform) return true;
  if (selectedPlatform === 'tiktok') {
    return Boolean(creator?.tiktok_url || creator?.tiktok_handle);
  }
  if (selectedPlatform === 'instagram') {
    return Boolean(creator?.instagram_url || creator?.instagram_handle);
  }
  return true;
};

const matchesEngagementRate = (engagementValue, selectedRange) => {
  if (!selectedRange) return true;
  const engagement = Number(engagementValue);
  if (!Number.isFinite(engagement)) return false;
  if (selectedRange === 'low') return engagement < 2;
  if (selectedRange === 'medium') return engagement >= 2 && engagement < 5;
  if (selectedRange === 'high') return engagement >= 5 && engagement < 10;
  if (selectedRange === 'viral') return engagement >= 10;
  return true;
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

const extractContentLink = (item) => {
  if (!item) return '';
  const firstAssetUrl = Array.isArray(item.assets)
    ? item.assets.find((asset) => asset && asset.url)?.url
    : '';
  return item.publishedUrl || firstAssetUrl || item.link || '';
};

const formatVideoType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Video';
  if (raw.toLowerCase() === 'reel') return 'Video';
  return raw;
};

const formatShortDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCompactFollowers = (value) => {
  if (value == null || value === '') return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(parsed);
};

const normalizeExternalUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

const getCreatorSocialLinks = (creator) =>
  [
    { label: 'TikTok', url: creator?.tiktok_url },
    { label: 'Instagram', url: creator?.instagram_url },
    { label: 'YouTube', url: creator?.youtube_url },
    { label: 'Facebook', url: creator?.facebook_url },
    { label: 'Portfolio', url: creator?.portfolio_url },
  ]
    .map((entry) => ({ ...entry, href: normalizeExternalUrl(entry.url) }))
    .filter((entry) => entry.href);

const DEFAULT_CREATOR_STAGE_OPTIONS = {
  UGC: ['Sourced', 'Brief Sent', 'Filming', 'Submitted', 'Approved', 'Published'],
  Influencer: ['Sourced', 'Outreach', 'Contracted', 'Posted', 'Reporting'],
  Hybrid: ['Sourced', 'In Progress', 'Submitted', 'Approved', 'Published'],
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
  const [showAddCreatorsModal, setShowAddCreatorsModal] = useState(false);
  const [brandTab, setBrandTab] = useState('brief');
  const [adminTab, setAdminTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
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
  });
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [creatorStageDefinitions, setCreatorStageDefinitions] = useState([]);

  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestTab, setSuggestTab] = useState('ugc');
  const [ugcFilters, setUgcFilters] = useState({
    search: '',
    gender: '',
    age: '',
    niche: '',
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
  const [adminCreatorFilterTab, setAdminCreatorFilterTab] = useState('ugc');
  const [adminUgcCreatorFilters, setAdminUgcCreatorFilters] = useState({
    search: '',
    gender: '',
    age: '',
    niche: '',
  });
  const [adminInfluencerCreatorFilters, setAdminInfluencerCreatorFilters] = useState({
    search: '',
    followerCount: '',
    gender: '',
    niche: '',
    platform: '',
    engagementRate: '',
  });
  const [brandAnalyticsSearch, setBrandAnalyticsSearch] = useState('');
  const [brandAnalyticsSortBy, setBrandAnalyticsSortBy] = useState('views');
  const [brandAnalyticsSortDirection, setBrandAnalyticsSortDirection] = useState('desc');
  const [adminAnalyticsSearch, setAdminAnalyticsSearch] = useState('');
  const [adminAnalyticsSortBy, setAdminAnalyticsSortBy] = useState('views');
  const [adminAnalyticsSortDirection, setAdminAnalyticsSortDirection] = useState('desc');
  const [adminAnalyticsPlatformFilter, setAdminAnalyticsPlatformFilter] = useState('all');
  const [adminAnalyticsStatusFilter, setAdminAnalyticsStatusFilter] = useState('all');

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isBrand = role === 'brand';
  const canManageCreators = isAdmin || isEmployee;
  const numericBrandSortColumns = new Set([
    'submissions',
    'published',
    'views',
    'likes',
    'comments',
    'shares',
    'saves',
    'er',
  ]);
  const numericAdminSortColumns = new Set(['views', 'er', 'date']);
  const brandSortIndicator = (columnKey) =>
    brandAnalyticsSortBy === columnKey ? (brandAnalyticsSortDirection === 'asc' ? '↑' : '↓') : '↕';
  const adminSortIndicator = (columnKey) =>
    adminAnalyticsSortBy === columnKey ? (adminAnalyticsSortDirection === 'asc' ? '↑' : '↓') : '↕';
  const handleBrandAnalyticsSort = (columnKey) => {
    if (brandAnalyticsSortBy === columnKey) {
      setBrandAnalyticsSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setBrandAnalyticsSortBy(columnKey);
    setBrandAnalyticsSortDirection(numericBrandSortColumns.has(columnKey) ? 'desc' : 'asc');
  };
  const handleAdminAnalyticsSort = (columnKey) => {
    if (adminAnalyticsSortBy === columnKey) {
      setAdminAnalyticsSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setAdminAnalyticsSortBy(columnKey);
    setAdminAnalyticsSortDirection(numericAdminSortColumns.has(columnKey) ? 'desc' : 'asc');
  };
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

  useEffect(() => {
    let ignore = false;
    const fetchCreatorStages = async () => {
      try {
        const res = await fetch('/api/creator-stages');
        const data = await res.json();
        if (!ignore && res.ok && data.ok) {
          setCreatorStageDefinitions(data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch creator stages:', err);
        }
      }
    };
    fetchCreatorStages();
    return () => {
      ignore = true;
    };
  }, []);

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

  useEffect(() => {
    let ignore = false;

    const fetchContentItems = async () => {
      try {
        const res = await fetch('/api/content?limit=1000');
        const data = await res.json();
        if (!ignore && data.ok) {
          dispatch({ type: 'SET_CONTENT_ITEMS', payload: data.data || [] });
        }
      } catch (err) {
        console.error('Failed to fetch content items:', err);
      }
    };

    fetchContentItems();
    return () => {
      ignore = true;
    };
  }, [dispatch, campaignId]);

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
      const searchText = toText(`${creator?.name || ''} ${creator?.handle || ''} ${creator?.niche || ''}`);
      if (ugcFilters.search && !searchText.includes(toText(ugcFilters.search))) {
        return false;
      }
      if (!matchesNiche(creator, ugcFilters.niche)) return false;
      if (ugcFilters.gender && toText(creator.gender) !== toText(ugcFilters.gender)) return false;
      if (!matchesAgeRange(creator.age, ugcFilters.age)) return false;
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencerCreators = useMemo(() => {
    return influencers.filter((creator) => {
      const searchText = toText(
        `${creator?.name || ''} ${creator?.tiktok_handle || ''} ${creator?.instagram_handle || ''} ${creator?.niche || ''} ${creator?.category || ''}`
      );
      if (influencerFilters.search && !searchText.includes(toText(influencerFilters.search))) {
        return false;
      }
      if (!matchesFollowerRange(creator, influencerFilters.followerCount)) return false;
      if (
        influencerFilters.gender &&
        toText(creator?.gender || '') !== toText(influencerFilters.gender)
      ) {
        return false;
      }
      if (!matchesNiche(creator, influencerFilters.niche)) return false;
      if (!matchesPlatform(creator, influencerFilters.platform)) return false;
      if (
        !matchesEngagementRate(
          creator?.engagement_rate ?? creator?.engagementRate,
          influencerFilters.engagementRate
        )
      ) {
        return false;
      }
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
  const adminCreatorTypeBuckets = useMemo(() => splitCreatorsByType(shortlistCreators), [shortlistCreators]);
  const hasAdminInfluencerEngagementData = useMemo(
    () =>
      adminCreatorTypeBuckets.influencer.some((creator) => {
        const value = Number(creator?.engagement_rate ?? creator?.engagementRate);
        return Number.isFinite(value);
      }),
    [adminCreatorTypeBuckets.influencer]
  );
  useEffect(() => {
    if (!hasAdminInfluencerEngagementData && adminInfluencerCreatorFilters.engagementRate) {
      setAdminInfluencerCreatorFilters((prev) => ({ ...prev, engagementRate: '' }));
    }
  }, [hasAdminInfluencerEngagementData, adminInfluencerCreatorFilters.engagementRate]);
  const filteredAdminCreators = useMemo(() => {
    const selectedType = adminCreatorFilterTab;
    const typeFiltered = shortlistCreators.filter((creator) => inferCreatorType(creator) === selectedType);
    if (selectedType === 'ugc') {
      return typeFiltered.filter((creator) => {
        const searchText = toText(`${creator?.name || ''} ${creator?.handle || ''} ${creator?.niche || ''}`);
        if (adminUgcCreatorFilters.search && !searchText.includes(toText(adminUgcCreatorFilters.search))) {
          return false;
        }
        if (!matchesNiche(creator, adminUgcCreatorFilters.niche)) return false;
        if (
          adminUgcCreatorFilters.gender &&
          toText(creator?.gender || '') !== toText(adminUgcCreatorFilters.gender)
        ) {
          return false;
        }
        if (!matchesAgeRange(creator?.age, adminUgcCreatorFilters.age)) return false;
        return true;
      });
    }
    return typeFiltered.filter((creator) => {
      const searchText = toText(
        `${creator?.name || ''} ${creator?.tiktok_handle || ''} ${creator?.instagram_handle || ''} ${creator?.niche || ''} ${creator?.category || ''}`
      );
      if (
        adminInfluencerCreatorFilters.search &&
        !searchText.includes(toText(adminInfluencerCreatorFilters.search))
      ) {
        return false;
      }
      if (!matchesFollowerRange(creator, adminInfluencerCreatorFilters.followerCount)) return false;
      if (
        adminInfluencerCreatorFilters.gender &&
        toText(creator?.gender || '') !== toText(adminInfluencerCreatorFilters.gender)
      ) {
        return false;
      }
      if (!matchesNiche(creator, adminInfluencerCreatorFilters.niche)) return false;
      if (!matchesPlatform(creator, adminInfluencerCreatorFilters.platform)) return false;
      if (
        !matchesEngagementRate(
          creator?.engagement_rate ?? creator?.engagementRate,
          adminInfluencerCreatorFilters.engagementRate
        )
      ) {
        return false;
      }
      return true;
    });
  }, [
    shortlistCreators,
    adminCreatorFilterTab,
    adminUgcCreatorFilters,
    adminInfluencerCreatorFilters,
  ]);

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
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: mappedDecision, note: '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to update decision.');
      }
      await refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update decision:', err);
    }
  };

  const handleWorkflowStatusUpdate = async (creatorId, workflowStatus) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to update creator stage.');
      }
      await refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update creator stage:', err);
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

  const handleUndoSuggestCreator = async (creatorId) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${creatorId}/suggest`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to undo suggestion.');
      }
      await refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to undo suggestion:', err);
    }
  };

  const openAddCreatorsModal = () => {
    setShowAddCreatorsModal(true);
  };

  const closeAddCreatorsModal = () => {
    setShowAddCreatorsModal(false);
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
      status: campaign.status || 'Planning',
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
  const campaignStageType = ['UGC', 'Influencer', 'Hybrid'].includes(campaignType)
    ? campaignType
    : 'Hybrid';
  const creatorStageOptions = useMemo(() => {
    const configuredStages = creatorStageDefinitions
      .filter(
        (item) =>
          item &&
          item.active !== false &&
          String(item.campaign_type || '').trim() === campaignStageType &&
          String(item.label || '').trim()
      )
      .sort((left, right) => {
        const sortDelta = Number(left.sort_order || 0) - Number(right.sort_order || 0);
        if (sortDelta !== 0) return sortDelta;
        return String(left.label || '').localeCompare(String(right.label || ''));
      })
      .map((item) => String(item.label).trim());

    if (configuredStages.length > 0) {
      return configuredStages;
    }
    return DEFAULT_CREATOR_STAGE_OPTIONS[campaignStageType] || DEFAULT_CREATOR_STAGE_OPTIONS.Hybrid;
  }, [creatorStageDefinitions, campaignStageType]);
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
  const platformCountLabel =
    Array.isArray(campaign.platforms) && campaign.platforms.length > 0
      ? `${campaign.platforms.length} platform${campaign.platforms.length > 1 ? 's' : ''}`
      : 'Platform TBD';
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
  const resolveCreatorById = (creatorId) =>
    creatorMap.get(creatorId) ||
    creatorMap.get(Number(creatorId)) ||
    shortlistCreators.find((item) => String(item.id) === creatorId);
  const creatorAnalyticsRows = analyticsCreatorIds
    .map((creatorId) => {
      const creator = resolveCreatorById(creatorId);
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
  const brandAnalyticsRows = useMemo(() => {
    const searchNeedle = String(brandAnalyticsSearch || '').trim().toLowerCase();
    const rowValueForColumn = (row, columnKey) => {
      switch (columnKey) {
        case 'creator':
          return row.creatorName;
        case 'type':
          return row.creatorType;
        case 'approval':
          return row.decision;
        case 'submissions':
          return row.submissionCount;
        case 'published':
          return row.publishedCount;
        case 'views':
          return row.metrics.views;
        case 'likes':
          return row.metrics.likes;
        case 'comments':
          return row.metrics.comments;
        case 'shares':
          return row.metrics.shares;
        case 'saves':
          return row.metrics.saves;
        case 'er':
          return row.metrics.views > 0 ? (row.interactions / row.metrics.views) * 100 : 0;
        default:
          return '';
      }
    };
    const compareValues = (leftValue, rightValue, directionFactor) => {
      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        const leftNumber = toFiniteNumber(leftValue);
        const rightNumber = toFiniteNumber(rightValue);
        const delta = leftNumber - rightNumber;
        if (delta !== 0) return delta * directionFactor;
      } else {
        const delta = String(leftValue || '').localeCompare(String(rightValue || ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (delta !== 0) return delta * directionFactor;
      }
      return 0;
    };
    const sortFactor = brandAnalyticsSortDirection === 'asc' ? 1 : -1;
    const filtered = creatorAnalyticsRows.filter((row) => {
      return searchNeedle ? String(row.creatorName || '').toLowerCase().includes(searchNeedle) : true;
    });
    return [...filtered].sort((left, right) => {
      const leftValue = rowValueForColumn(left, brandAnalyticsSortBy);
      const rightValue = rowValueForColumn(right, brandAnalyticsSortBy);
      const primaryDelta = compareValues(leftValue, rightValue, sortFactor);
      if (primaryDelta !== 0) return primaryDelta;
      return compareValues(left.creatorName, right.creatorName, sortFactor);
    });
  }, [
    creatorAnalyticsRows,
    brandAnalyticsSearch,
    brandAnalyticsSortBy,
    brandAnalyticsSortDirection,
  ]);
  const brandAnalyticsVisibleTotals = useMemo(
    () =>
      brandAnalyticsRows.reduce(
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
      ),
    [brandAnalyticsRows]
  );
  const creatorVideoGroups = analyticsCreatorIds
    .map((creatorId) => {
      const creator = resolveCreatorById(creatorId);
      const creatorContent = campaignContent
        .filter((item) => String(item.creatorId) === creatorId)
        .sort(
          (left, right) =>
            new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
        );
      const workflowEntry =
        creatorState.outreach?.[creatorId] ||
        creatorState.outreach?.[creator?.id] ||
        {};
      const videos = creatorContent.map((item, index) => {
        const metrics = item.metrics || createEmptyMetrics();
        const interactions =
          toFiniteNumber(metrics.likes) +
          toFiniteNumber(metrics.comments) +
          toFiniteNumber(metrics.shares) +
          toFiniteNumber(metrics.saves);
        return {
          id: item.id || `${creatorId}-content-${index}`,
          platform: item.platform || 'Unspecified',
          type: formatVideoType(item.type),
          status: item.status || 'Pending Review',
          link: extractContentLink(item),
          createdAt: item.createdAt || '',
          metrics,
          interactions,
          source: 'content',
        };
      });
      const workflowVideoLink = String(workflowEntry.finalVideoLink || '').trim();
      if (
        workflowVideoLink &&
        !videos.some((video) => String(video.link || '').trim() === workflowVideoLink)
      ) {
        videos.unshift({
          id: `${creatorId}-workflow`,
          platform: 'Unspecified',
          type: 'Video',
          status: workflowEntry.workflowStatus || 'Submitted',
          link: workflowVideoLink,
          createdAt: '',
          metrics: createEmptyMetrics(),
          interactions: 0,
          source: 'workflow',
        });
      }
      const creatorType = creator ? (inferCreatorType(creator) === 'ugc' ? 'UGC' : 'Influencer') : 'Creator';
      const creatorName = creator?.name || creator?.display_name || `Creator ${creatorId}`;
      const metrics = videos.reduce((acc, item) => mergeMetrics(acc, item.metrics), createEmptyMetrics());
      const interactions = videos.reduce((acc, item) => acc + toFiniteNumber(item.interactions), 0);
      return {
        creatorId,
        creator,
        creatorName,
        creatorType,
        videos,
        metrics,
        interactions,
      };
    })
    .filter((group) => group.videos.length > 0)
    .sort((left, right) => {
      if (right.videos.length !== left.videos.length) return right.videos.length - left.videos.length;
      return right.metrics.views - left.metrics.views;
    });
  const adminAnalyticsFilterOptions = useMemo(() => {
    const platformSet = new Set();
    const statusSet = new Set();
    creatorVideoGroups.forEach((group) => {
      group.videos.forEach((video) => {
        const platform = String(video.platform || '').trim();
        const status = String(video.status || '').trim();
        if (platform) platformSet.add(platform);
        if (status) statusSet.add(status);
      });
    });
    return {
      platforms: Array.from(platformSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
      ),
      statuses: Array.from(statusSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
      ),
    };
  }, [creatorVideoGroups]);
  const adminAnalyticsGroups = useMemo(() => {
    const searchNeedle = String(adminAnalyticsSearch || '').trim().toLowerCase();
    const selectedPlatform = String(adminAnalyticsPlatformFilter || '').toLowerCase();
    const selectedStatus = String(adminAnalyticsStatusFilter || '').toLowerCase();
    const videoValueForColumn = (video, creatorName, columnKey) => {
      switch (columnKey) {
        case 'creator':
          return creatorName;
        case 'video':
          return video.type;
        case 'platform':
          return video.platform;
        case 'status':
          return video.status;
        case 'views':
          return video.metrics.views;
        case 'er':
          return video.metrics.views > 0 ? (video.interactions / video.metrics.views) * 100 : 0;
        case 'link':
          return video.link;
        case 'date':
          return video.createdAt;
        default:
          return '';
      }
    };
    const compareValues = (leftValue, rightValue, directionFactor, asDate = false) => {
      if (asDate) {
        const leftDate = new Date(leftValue || 0).getTime();
        const rightDate = new Date(rightValue || 0).getTime();
        const delta = leftDate - rightDate;
        if (delta !== 0) return delta * directionFactor;
        return 0;
      }
      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        const leftNumber = toFiniteNumber(leftValue);
        const rightNumber = toFiniteNumber(rightValue);
        const delta = leftNumber - rightNumber;
        if (delta !== 0) return delta * directionFactor;
        return 0;
      }
      const delta = String(leftValue || '').localeCompare(String(rightValue || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (delta !== 0) return delta * directionFactor;
      return 0;
    };
    const sortFactor = adminAnalyticsSortDirection === 'asc' ? 1 : -1;
    const compareVideos = (leftVideo, rightVideo, creatorName) => {
      const leftValue = videoValueForColumn(leftVideo, creatorName, adminAnalyticsSortBy);
      const rightValue = videoValueForColumn(rightVideo, creatorName, adminAnalyticsSortBy);
      const primaryDelta = compareValues(
        leftValue,
        rightValue,
        sortFactor,
        adminAnalyticsSortBy === 'date'
      );
      if (primaryDelta !== 0) return primaryDelta;
      return compareValues(leftVideo.id, rightVideo.id, sortFactor);
    };
    const groups = creatorVideoGroups
      .filter((group) =>
        searchNeedle ? String(group.creatorName || '').toLowerCase().includes(searchNeedle) : true
      )
      .map((group) => {
        const filteredVideos = group.videos.filter((video) => {
          const platformOk =
            selectedPlatform === 'all' ||
            String(video.platform || '')
              .trim()
              .toLowerCase() === selectedPlatform;
          const statusOk =
            selectedStatus === 'all' ||
            String(video.status || '')
              .trim()
              .toLowerCase() === selectedStatus;
          return platformOk && statusOk;
        });
        if (filteredVideos.length === 0) return null;
        const sortedVideos = [...filteredVideos].sort((leftVideo, rightVideo) =>
          compareVideos(leftVideo, rightVideo, group.creatorName)
        );
        const metrics = sortedVideos.reduce(
          (acc, item) => mergeMetrics(acc, item.metrics),
          createEmptyMetrics()
        );
        const interactions = sortedVideos.reduce(
          (acc, item) => acc + toFiniteNumber(item.interactions),
          0
        );
        return {
          ...group,
          videos: sortedVideos,
          metrics,
          interactions,
        };
      })
      .filter(Boolean);
    const groupValueForColumn = (group, columnKey) => {
      switch (columnKey) {
        case 'creator':
          return group.creatorName;
        case 'views':
          return group.metrics.views;
        case 'er':
          return group.metrics.views > 0 ? (group.interactions / group.metrics.views) * 100 : 0;
        case 'video':
        case 'platform':
        case 'status':
        case 'link':
        case 'date':
          return videoValueForColumn(group.videos[0] || {}, group.creatorName, columnKey);
        default:
          return group.metrics.views;
      }
    };
    groups.sort((left, right) => {
      const primaryDelta = compareValues(
        groupValueForColumn(left, adminAnalyticsSortBy),
        groupValueForColumn(right, adminAnalyticsSortBy),
        sortFactor,
        adminAnalyticsSortBy === 'date'
      );
      if (primaryDelta !== 0) return primaryDelta;
      return compareValues(left.creatorName, right.creatorName, sortFactor);
    });
    return groups;
  }, [
    creatorVideoGroups,
    adminAnalyticsSearch,
    adminAnalyticsSortBy,
    adminAnalyticsSortDirection,
    adminAnalyticsPlatformFilter,
    adminAnalyticsStatusFilter,
  ]);
  const adminAnalyticsVisibleTotals = useMemo(
    () =>
      adminAnalyticsGroups.reduce(
        (acc, group) => {
          acc.creators += 1;
          acc.videos += group.videos.length;
          acc.metrics = mergeMetrics(acc.metrics, group.metrics);
          acc.interactions += group.interactions;
          return acc;
        },
        {
          creators: 0,
          videos: 0,
          metrics: createEmptyMetrics(),
          interactions: 0,
        }
      ),
    [adminAnalyticsGroups]
  );
  const brandAnalyticsCard = (
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
            <strong>{brandAnalyticsVisibleTotals.creators}</strong>
          </div>
          <div>
            <span>Approved Creators</span>
            <strong>{brandAnalyticsVisibleTotals.approvedCreators}</strong>
          </div>
          <div>
            <span>Submissions</span>
            <strong>{brandAnalyticsVisibleTotals.submissions}</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{brandAnalyticsVisibleTotals.publishedSubmissions}</strong>
          </div>
          <div>
            <span>Total Views</span>
            <strong>{formatMetricNumber(brandAnalyticsVisibleTotals.metrics.views)}</strong>
          </div>
          <div>
            <span>Engagement Rate</span>
            <strong>
              {formatEngagementRate(
                brandAnalyticsVisibleTotals.metrics.views,
                brandAnalyticsVisibleTotals.interactions
              )}
            </strong>
          </div>
        </div>

        <div className="analytics-table-controls">
          <input
            type="text"
            className="input analytics-control-search"
            placeholder="Search creators..."
            value={brandAnalyticsSearch}
            onChange={(event) => setBrandAnalyticsSearch(event.target.value)}
          />
          <select
            className="input"
            value={brandAnalyticsSortBy}
            onChange={(event) => setBrandAnalyticsSortBy(event.target.value)}
          >
            <option value="creator">Creator</option>
            <option value="type">Type</option>
            <option value="approval">Approval</option>
            <option value="submissions">Submissions</option>
            <option value="published">Published</option>
            <option value="views">Views</option>
            <option value="likes">Likes</option>
            <option value="comments">Comments</option>
            <option value="shares">Shares</option>
            <option value="saves">Saves</option>
            <option value="er">ER</option>
          </select>
          <select
            className="input"
            value={brandAnalyticsSortDirection}
            onChange={(event) => setBrandAnalyticsSortDirection(event.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {brandAnalyticsRows.length === 0 ? (
          <EmptyState
            title={creatorAnalyticsRows.length === 0 ? 'No analytics yet' : 'No matching analytics'}
            description={
              creatorAnalyticsRows.length === 0
                ? 'Analytics will appear here after creators are suggested and content is submitted.'
                : 'Try adjusting search or sorting.'
            }
          />
        ) : (
          <div className="analytics-table-wrapper brand-analytics-table-wrapper">
            <table className="analytics-table brand-analytics-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('creator')}>
                      Creator <span>{brandSortIndicator('creator')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('type')}>
                      Type <span>{brandSortIndicator('type')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('approval')}>
                      Approval <span>{brandSortIndicator('approval')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('submissions')}>
                      Submissions <span>{brandSortIndicator('submissions')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('published')}>
                      Published <span>{brandSortIndicator('published')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('views')}>
                      Views <span>{brandSortIndicator('views')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('likes')}>
                      Likes <span>{brandSortIndicator('likes')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('comments')}>
                      Comments <span>{brandSortIndicator('comments')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('shares')}>
                      Shares <span>{brandSortIndicator('shares')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('saves')}>
                      Saves <span>{brandSortIndicator('saves')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className="analytics-sort-btn" onClick={() => handleBrandAnalyticsSort('er')}>
                      ER <span>{brandSortIndicator('er')}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {brandAnalyticsRows.map((row) => (
                  <tr key={row.creatorId}>
                    <td>
                      <div className="creator-cell">
                        <img
                          src={resolveAvatarSrc(row.creator?.profile_image)}
                          alt={row.creatorName}
                          className="creator-avatar-sm"
                          onError={handleAvatarError}
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
  const adminAnalyticsCard = (
    <section className="detail-card brand-analytics-section admin-analytics-section">
      <div className="detail-card-header">
        <div>
          <h3>Campaign Analytics</h3>
          <p className="section-description">
            Video-level performance grouped by creator across all platforms.
          </p>
        </div>
      </div>
      <div className="detail-card-content brand-analytics-content admin-analytics-content">
        <div className="metrics-grid brand-analytics-metrics-grid admin-analytics-metrics-grid">
          <div>
            <span>Total Creators</span>
            <strong>{adminAnalyticsVisibleTotals.creators}</strong>
          </div>
          <div>
            <span>Total Videos</span>
            <strong>{adminAnalyticsVisibleTotals.videos}</strong>
          </div>
          <div>
            <span>Total Views</span>
            <strong>{formatMetricNumber(adminAnalyticsVisibleTotals.metrics.views)}</strong>
          </div>
          <div>
            <span>Engagement Rate</span>
            <strong>
              {formatEngagementRate(
                adminAnalyticsVisibleTotals.metrics.views,
                adminAnalyticsVisibleTotals.interactions
              )}
            </strong>
          </div>
        </div>

        <div className="analytics-table-controls admin-analytics-controls">
          <input
            type="text"
            className="input analytics-control-search"
            placeholder="Search creators..."
            value={adminAnalyticsSearch}
            onChange={(event) => setAdminAnalyticsSearch(event.target.value)}
          />
          <select
            className="input"
            value={adminAnalyticsSortBy}
            onChange={(event) => setAdminAnalyticsSortBy(event.target.value)}
          >
            <option value="views">Views</option>
            <option value="er">ER</option>
          </select>
          <button
            type="button"
            className="analytics-direction-toggle"
            onClick={() =>
              setAdminAnalyticsSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            }
            aria-label={
              adminAnalyticsSortDirection === 'asc'
                ? 'Sorting ascending. Click to sort descending.'
                : 'Sorting descending. Click to sort ascending.'
            }
            title={adminAnalyticsSortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {adminAnalyticsSortDirection === 'asc' ? '↑' : '↓'}
          </button>
          <select
            className="input"
            value={adminAnalyticsPlatformFilter}
            onChange={(event) => setAdminAnalyticsPlatformFilter(event.target.value)}
          >
            <option value="all">All Platforms</option>
            {adminAnalyticsFilterOptions.platforms.map((platform) => (
              <option key={platform} value={platform.toLowerCase()}>
                {platform}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={adminAnalyticsStatusFilter}
            onChange={(event) => setAdminAnalyticsStatusFilter(event.target.value)}
          >
            <option value="all">All Statuses</option>
            {adminAnalyticsFilterOptions.statuses.map((status) => (
              <option key={status} value={status.toLowerCase()}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {adminAnalyticsGroups.length === 0 ? (
          <EmptyState
            title={creatorVideoGroups.length === 0 ? 'No videos submitted yet' : 'No matching analytics'}
            description={
              creatorVideoGroups.length === 0
                ? 'Creator analytics will appear once videos are uploaded or linked.'
                : 'Try adjusting search, sorting, or filters.'
            }
          />
        ) : (
          <div className="admin-analytics-groups">
            {adminAnalyticsGroups.map((group) => (
              <article key={group.creatorId} className="admin-analytics-group">
                <div className="admin-analytics-group-head">
                  <div className="creator-cell">
                    <img
                      src={resolveAvatarSrc(group.creator?.profile_image)}
                      alt={group.creatorName}
                      className="creator-avatar-sm"
                      onError={handleAvatarError}
                    />
                    <div className="creator-cell-info">
                      <span className="creator-name">{group.creatorName}</span>
                      <span>{group.creatorType}</span>
                    </div>
                  </div>
                  <div className="admin-analytics-group-kpis">
                    <span>{group.videos.length} videos</span>
                    <span>{formatMetricNumber(group.metrics.views)} views</span>
                    <span>{formatEngagementRate(group.metrics.views, group.interactions)} ER</span>
                  </div>
                </div>
                <div className="analytics-table-wrapper admin-analytics-video-wrap">
                  <table className="analytics-table admin-analytics-video-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="analytics-sort-btn" onClick={() => handleAdminAnalyticsSort('video')}>
                            Video <span>{adminSortIndicator('video')}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="analytics-sort-btn" onClick={() => handleAdminAnalyticsSort('platform')}>
                            Platform <span>{adminSortIndicator('platform')}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="analytics-sort-btn" onClick={() => handleAdminAnalyticsSort('status')}>
                            Status <span>{adminSortIndicator('status')}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="analytics-sort-btn" onClick={() => handleAdminAnalyticsSort('views')}>
                            Views <span>{adminSortIndicator('views')}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="analytics-sort-btn" onClick={() => handleAdminAnalyticsSort('er')}>
                            ER <span>{adminSortIndicator('er')}</span>
                          </button>
                        </th>
                        <th>Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.videos.map((video) => (
                        <tr key={video.id}>
                          <td>
                            <div className="admin-analytics-video-meta">
                              <strong>{video.type}</strong>
                              <span>
                                {formatShortDate(video.createdAt) ||
                                  (video.source === 'workflow' ? 'From workflow' : 'No date')}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="chip">{video.platform}</span>
                          </td>
                          <td>
                            <StatusPill status={video.status} />
                          </td>
                          <td>{formatMetricNumber(video.metrics.views)}</td>
                          <td className="engagement-cell">
                            {formatEngagementRate(video.metrics.views, video.interactions)}
                          </td>
                          <td>
                            {video.link ? (
                              isLikelyVideoUrl(video.link) ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-small"
                                  onClick={() =>
                                    openVideoPreview(video.link, `${group.creatorName} - ${video.type}`)
                                  }
                                >
                                  Preview
                                </button>
                              ) : (
                                <a
                                  href={video.link}
                                  className="btn btn-secondary btn-small"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              )
                            ) : (
                              <span className="creator-social-empty">No link</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const brandCreatorTypeSections = [
    { key: 'influencer', type: 'influencer', label: 'Influencer Creators', tone: 'influencer' },
    { key: 'ugc', type: 'ugc', label: 'UGC Creators', tone: 'ugc' },
  ];

  const renderBrandPendingActions = (creator) => (
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
  );

  const renderBrandApprovedActions = (creator) => {
    const workflowStatus =
      creatorState.outreach?.[creator.id]?.workflowStatus ||
      creatorStageOptions[0] ||
      'In Progress';
    const finalLink = creatorState.outreach?.[creator.id]?.finalVideoLink || '';
    if (!finalLink) {
      return (
        <>
          <span className="creator-stage-pill">{workflowStatus}</span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => handleDecision(creator.id, 'Suggested')}
          >
            Undo Decision
          </button>
        </>
      );
    }
    if (isLikelyVideoUrl(finalLink)) {
      return (
        <>
          <span className="creator-stage-pill">{workflowStatus}</span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              openVideoPreview(finalLink, `${creator.name || 'Creator'} - submitted video`)
            }
          >
            Preview Video
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => handleDecision(creator.id, 'Suggested')}
          >
            Undo Decision
          </button>
        </>
      );
    }
    return (
      <>
        <span className="creator-stage-pill">{workflowStatus}</span>
        <a
          className="btn btn-secondary btn-small"
          href={finalLink}
          target="_blank"
          rel="noreferrer"
        >
          View Link
        </a>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => handleDecision(creator.id, 'Suggested')}
        >
          Undo Decision
        </button>
      </>
    );
  };

  const renderBrandRejectedActions = (creator) => (
    <button
      type="button"
      className="btn btn-secondary btn-small"
      onClick={() => handleDecision(creator.id, 'Suggested')}
    >
      Undo Decision
    </button>
  );

  const renderBrandCreatorTypeSections = (typedCreators, renderActions) =>
    brandCreatorTypeSections.map((section) => {
      const creatorsByType = typedCreators?.[section.key] || [];
      if (creatorsByType.length === 0) return null;

      return (
        <div
          key={section.key}
          className={`brand-creator-type-section brand-creator-type-section-${section.tone}`}
        >
          <div className="brand-creator-type-header">
            <span className={`brand-creator-type-pill brand-creator-type-pill-${section.tone}`}>
              {section.label}
            </span>
            <span className="brand-creator-type-count">
              {creatorsByType.length} {creatorsByType.length === 1 ? 'creator' : 'creators'}
            </span>
          </div>
          <CreatorGrid
            creators={creatorsByType}
            type={section.type}
            onOpenProfile={openCreatorProfile}
            renderActions={renderActions}
          />
        </div>
      );
    });

  const briefCard = (
    <section className="detail-card brand-brief-card">
      <div className="detail-card-header">
        <div>
          <h3>Campaign Summary & Requirements</h3>
          <p className="section-description">A single view of the full brief.</p>
        </div>
        <StatusPill status={campaign.status || 'Planning'} />
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
        <div className="campaign-header-main">
          <button type="button" className="link-button" onClick={() => navigate(-1)}>
            ← Back to campaigns
          </button>
          <div className="campaign-details-title">
            <div className="campaign-title-row">
              <h1>{campaign.name}</h1>
            </div>
            <p className="campaign-brand-name">{campaign.brand}</p>
          </div>
        </div>
        <div className="campaign-header-meta">
          <StatusPill status={campaign.status} />
          <span className="campaign-meta-chip">{campaignType}</span>
          <span className="campaign-meta-chip">{platformCountLabel}</span>
        </div>
      </div>

      {isBrand && (
        <div className="campaign-details-tab-row campaign-details-tab-row-brand">
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
              Creator Review
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
        </div>
      )}

      {!isBrand && (
        <div className="campaign-details-tab-row">
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
              Creators
              <span className="tab-count">{shortlistCreators.length}</span>
            </button>
            <button
              type="button"
              className={adminTab === 'analytics' ? 'active' : undefined}
              onClick={() => setAdminTab('analytics')}
            >
              Analytics
            </button>
          </div>
          {isAdmin && (
            <div className="campaign-tab-actions">
              <button type="button" className="btn btn-secondary" onClick={openEditModal}>
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {isBrand && brandTab === 'brief' ? briefCard : null}
      {isBrand && brandTab === 'analytics' ? brandAnalyticsCard : null}
      {!isBrand && adminTab === 'overview' ? briefCard : null}
      {!isBrand && adminTab === 'analytics' ? adminAnalyticsCard : null}

      {isBrand && brandTab === 'creators' ? (
        <section className="detail-card brand-creator-section">
          <div className="detail-card-header">
            <div>
              <h3>Creator Review</h3>
              <p className="section-description">
                Review suggested creators, compare profiles, and approve the strongest match.
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
          <div className="detail-card-content brand-creator-content">
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
                  <div className="brand-creator-group brand-creator-group-pending">
                    <div className="brand-creator-group-header">
                      <h4>Awaiting your approval</h4>
                      <span>{filteredCreatorBuckets.pending.length} creators</span>
                    </div>
                    {renderBrandCreatorTypeSections(
                      filteredCreatorBucketsByType.pending,
                      renderBrandPendingActions
                    )}
                  </div>
                )}

                {filteredCreatorBuckets.approved.length > 0 && (
                  <div className="brand-creator-group brand-creator-group-approved">
                    <div className="brand-creator-group-header">
                      <h4>Approved creators</h4>
                      <span>{filteredCreatorBuckets.approved.length} creators</span>
                    </div>
                    {renderBrandCreatorTypeSections(
                      filteredCreatorBucketsByType.approved,
                      renderBrandApprovedActions
                    )}
                  </div>
                )}

                {filteredCreatorBuckets.rejected.length > 0 && (
                  <div className="brand-creator-group brand-creator-group-rejected">
                    <div className="brand-creator-group-header">
                      <h4>Rejected creators</h4>
                      <span>{filteredCreatorBuckets.rejected.length} creators</span>
                    </div>
                    {renderBrandCreatorTypeSections(
                      filteredCreatorBucketsByType.rejected,
                      renderBrandRejectedActions
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
            <div>
              <h3>Creators</h3>
              <p className="section-description">
                Manage campaign creators with one workflow for status and delivery.
              </p>
            </div>
            <div className="creator-network-filters">
              <div className="add-creators-modal-tabs campaign-creators-filter-tabs">
                <button
                  type="button"
                  className={`tab-button ${adminCreatorFilterTab === 'ugc' ? 'active' : ''}`}
                  onClick={() => setAdminCreatorFilterTab('ugc')}
                >
                  UGC Creators ({adminCreatorTypeBuckets.ugc.length})
                </button>
                <button
                  type="button"
                  className={`tab-button ${adminCreatorFilterTab === 'influencer' ? 'active' : ''}`}
                  onClick={() => setAdminCreatorFilterTab('influencer')}
                >
                  Influencers ({adminCreatorTypeBuckets.influencer.length})
                </button>
              </div>
              <CreatorFilters
                type={adminCreatorFilterTab}
                filters={
                  adminCreatorFilterTab === 'ugc'
                    ? adminUgcCreatorFilters
                    : adminInfluencerCreatorFilters
                }
                onChange={
                  adminCreatorFilterTab === 'ugc'
                    ? setAdminUgcCreatorFilters
                    : setAdminInfluencerCreatorFilters
                }
                disableEngagementRate={!hasAdminInfluencerEngagementData}
              />
              {canManageCreators ? (
                <button
                  type="button"
                  className="btn btn-primary add-creators-button"
                  onClick={openAddCreatorsModal}
                >
                  Add Creators
                </button>
              ) : null}
            </div>
          </div>
          <div className="detail-card-content creator-table-content">
            {filteredAdminCreators.length === 0 ? (
              <EmptyState
                title="No creators assigned"
                description="Try adjusting filters or add creators to this campaign."
              />
            ) : (
              <div className="campaign-creators-table-wrap">
                <div className="campaign-creators-table">
                  <div className="campaign-creators-row campaign-creators-row-head">
                    <div className="campaign-creators-col-head">
                      <span className="campaign-creators-col-title">Creator Profile</span>
                      <span className="campaign-creators-col-hint">Name, audience, niche</span>
                    </div>
                    <div className="campaign-creators-col-head">
                      <span className="campaign-creators-col-title">Workflow & Actions</span>
                      <span className="campaign-creators-col-hint">Stage, decision, delivery</span>
                    </div>
                    <div className="campaign-creators-col-head">
                      <span className="campaign-creators-col-title">Channels</span>
                      <span className="campaign-creators-col-hint">Social links and portfolio</span>
                    </div>
                  </div>
                  {filteredAdminCreators.map((creator) => {
                    const creatorType = inferCreatorType(creator) === 'ugc' ? 'UGC' : 'Influencer';
                    const followersLabel = formatCompactFollowers(
                      creator.followers ?? creator.followers_count
                    );
                    const currentDecision = creatorState.approvals?.[creator.id] || 'Suggested';
                    const hasWorkflowEntry = Boolean(creatorState.outreach?.[creator.id]);
                    const currentWorkflowStatus =
                      creatorState.outreach?.[creator.id]?.workflowStatus ||
                      (hasWorkflowEntry ? creatorStageOptions[0] || '' : '');
                    const socialLinks = getCreatorSocialLinks(creator);
                    return (
                      <div key={creator.id} className="campaign-creators-row">
                        <div className="campaign-creators-main">
                          <img
                            src={resolveAvatarSrc(creator.profile_image)}
                            alt={creator.name || creator.display_name || 'Creator'}
                            className="creator-avatar-sm"
                            onError={handleAvatarError}
                          />
                          <div className="campaign-creators-main-info">
                            <strong>{creator.name || creator.display_name || 'Creator'}</strong>
                            <span>
                              {followersLabel} followers · {creator.niche || creator.category || 'General'} ·{' '}
                              {creatorType}
                            </span>
                          </div>
                        </div>
                        <div className="campaign-creators-status">
                          <select
                            className="input creator-status-select"
                            value={currentWorkflowStatus}
                            onChange={(event) =>
                              handleWorkflowStatusUpdate(creator.id, event.target.value)
                            }
                            disabled={!canManageCreators || !hasWorkflowEntry}
                          >
                            {!hasWorkflowEntry ? (
                              <option value="">Awaiting approval</option>
                            ) : (
                              creatorStageOptions.map((statusLabel) => (
                                <option key={statusLabel} value={statusLabel}>
                                  {statusLabel}
                                </option>
                              ))
                            )}
                          </select>
                          <div className="campaign-creators-status-meta">
                            <StatusPill status={currentDecision} />
                          </div>
                          <div className="campaign-creators-status-actions">
                            {canManageCreators && currentDecision === 'Suggested' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => handleUndoSuggestCreator(creator.id)}
                              >
                                Undo Suggest
                              </button>
                            ) : null}
                            {canManageCreators ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setAddContentModal({ open: true, creator })}
                              >
                                Add Content
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={() => openCreatorProfile(creator, inferCreatorType(creator))}
                            >
                              View
                            </button>
                          </div>
                        </div>
                        <div className="campaign-creators-social">
                          {socialLinks.length === 0 ? (
                            <span className="creator-social-empty">No links</span>
                          ) : (
                            socialLinks.map((entry) => (
                              <a
                                key={`${creator.id}-${entry.label}`}
                                href={entry.href}
                                className="creator-social-link"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {entry.label}
                              </a>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <Modal
        open={showAddCreatorsModal && canManageCreators && !isBrand && adminTab === 'creators'}
        onClose={closeAddCreatorsModal}
        title="Add Creators"
        description="Browse the creator network and suggest creators for this campaign."
        size="large"
      >
        <div className="add-creators-modal-body">
          <div className="add-creators-modal-tabs">
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
          <div className="add-creators-modal-search">
            <input
              type="text"
              className="input"
              placeholder="Search by name"
              value={suggestTab === 'ugc' ? ugcFilters.search : influencerFilters.search}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (suggestTab === 'ugc') {
                  setUgcFilters((prev) => ({ ...prev, search: nextValue }));
                } else {
                  setInfluencerFilters((prev) => ({ ...prev, search: nextValue }));
                }
              }}
            />
          </div>
          <div className="add-creators-modal-filters">
            <CreatorFilters
              type={suggestTab}
              filters={suggestTab === 'ugc' ? ugcFilters : influencerFilters}
              onChange={suggestTab === 'ugc' ? setUgcFilters : setInfluencerFilters}
              hideSearch
            />
          </div>
          <div className="add-creators-modal-results">
            {loading ? (
              <div className="loading-state">Loading creators...</div>
            ) : suggestCreators.length === 0 ? (
              <EmptyState
                title="No creators found"
                description="Try adjusting your search or filters."
              />
            ) : (
              <div className="add-creators-modal-list">
                <div className="add-creators-modal-list-row add-creators-modal-list-head">
                  <span aria-hidden="true"></span>
                  <span>Creator</span>
                  <span>Actions</span>
                </div>
                {suggestCreators.map((creator) => {
                  const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
                  const currentDecision = creatorState.approvals?.[creator.id] || 'Suggested';
                  const canUndoSuggestion = isAlreadySuggested && currentDecision === 'Suggested';
                  const followersLabel = formatCompactFollowers(
                    creator.followers ?? creator.followers_count
                  );
                  return (
                    <div key={creator.id} className="add-creators-modal-list-row">
                      <div className="add-creators-modal-avatar">
                        <img
                          src={resolveAvatarSrc(creator.profile_image)}
                          alt={creator.name || creator.display_name || 'Creator'}
                          onError={handleAvatarError}
                        />
                      </div>
                      <div className="add-creators-modal-creator-col">
                        <strong>{creator.name || creator.display_name || 'Creator'}</strong>
                        <span>{followersLabel} followers</span>
                        <span>{creator.niche || creator.category || 'General'}</span>
                      </div>
                      <div className="add-creators-modal-actions-col">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => openCreatorProfile(creator, suggestTab)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={`btn btn-small ${
                            canUndoSuggestion ? 'btn-danger' : isAlreadySuggested ? 'btn-secondary' : 'btn-primary'
                          }`}
                          disabled={isAlreadySuggested && !canUndoSuggestion}
                          onClick={() =>
                            canUndoSuggestion
                              ? handleUndoSuggestCreator(creator.id)
                              : handleSuggestCreator(creator)
                          }
                        >
                          {canUndoSuggestion ? 'Undo Suggest' : isAlreadySuggested ? 'Added' : 'Suggest'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeAddCreatorsModal}>
            Close
          </button>
        </div>
      </Modal>

      <CreatorProfileModal
        creator={selectedCreator}
        type={selectedCreatorType}
        viewerRole={role}
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
