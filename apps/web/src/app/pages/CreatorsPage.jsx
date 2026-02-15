import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AddContentModal from '../components/AddContentModal.jsx';
import BrandRecommendations from '../components/BrandRecommendations.jsx';
import CreatorEditModal from '../components/CreatorEditModal.jsx';
import CreatorFilters from '../components/CreatorFilters.jsx';
import CreatorGrid from '../components/CreatorGrid.jsx';
import CreatorProfileModal from '../components/CreatorProfileModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RejectionModal from '../components/RejectionModal.jsx';
import UgcCreatorCreateModal from '../components/UgcCreatorCreateModal.jsx';
import { getJson } from '../api/client.js';
import { NICHES, WORKFLOW_STATUSES } from '../config/options.js';

const ITEMS_PER_PAGE = 12;
const MAX_FETCH_LIMIT = 1000;
const API_BASE = '/api';

const toText = (value) => String(value || '').trim().toLowerCase();

const matchesNiche = (creator, selectedNiche) => {
  if (!selectedNiche) return true;
  const haystack = toText(`${creator.niche || ''} ${creator.category || ''}`);
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

const matchesFollowerRange = (followerCount, selectedRange) => {
  if (!selectedRange) return true;
  const followers = Number(followerCount);
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
    return Boolean(creator.tiktok_url || creator.tiktok_handle);
  }
  if (selectedPlatform === 'instagram') {
    return Boolean(creator.instagram_url || creator.instagram_handle);
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

const normalizeVideoUrls = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeCreatorForm = (creator) => ({
  id: creator?.id || '',
  display_name: creator?.display_name || creator?.name || '',
  primary_niche: creator?.primary_niche || creator?.niche || '',
  country: creator?.country || creator?.region || '',
  status: creator?.status || 'active',
  creator_type: creator?.creator_type || '',
  phone: creator?.phone || '',
  handle: creator?.handle || '',
  tiktok_url: creator?.tiktok_url || '',
  instagram_url: creator?.instagram_url || '',
  instagram_handle: creator?.instagram_handle || '',
  tiktok_handle: creator?.tiktok_handle || '',
  followers:
    creator?.followers === null || creator?.followers === undefined ? '' : String(creator.followers),
  category: creator?.category || '',
  portfolio_url: creator?.portfolio_url || '',
  age: creator?.age === null || creator?.age === undefined ? '' : String(creator.age),
  gender: creator?.gender || '',
  languages: creator?.languages || '',
  accepts_gifted_collab: Boolean(creator?.accepts_gifted_collab),
  turnaround_time: creator?.turnaround_time || '',
  has_equipment: Boolean(creator?.has_equipment),
  can_voiceover: Boolean(creator?.can_voiceover),
  base_rate:
    creator?.base_rate === null || creator?.base_rate === undefined ? '' : String(creator.base_rate),
  profile_image: creator?.profile_image || '',
  has_mock_video: Boolean(creator?.has_mock_video),
  notes: creator?.notes || '',
  ugc_video_urls: normalizeVideoUrls(creator?.ugc_video_urls),
  engagement_rate:
    creator?.engagement_rate === null || creator?.engagement_rate === undefined
      ? ''
      : String(creator.engagement_rate),
  avg_views:
    creator?.avg_views === null || creator?.avg_views === undefined ? '' : String(creator.avg_views),
});

const defaultUgcCreatorForm = () => ({
  name: '',
  phone: '',
  handle: '',
  niche: '',
  has_mock_video: false,
  age: '',
  gender: '',
  languages: '',
  accepts_gifted_collab: false,
  turnaround_time: '',
  has_equipment: false,
  can_voiceover: false,
  base_rate: '',
  region: '',
  notes: '',
  profile_image: '',
  ugc_video_urls: [],
});

export default function CreatorsPage() {
  const { role } = useParams();
  const isAdmin = role === 'admin';
  const [activeTab, setActiveTab] = useState('ugc');
  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorType, setCreatorType] = useState(null);

  const [ugcPage, setUgcPage] = useState(1);
  const [influencerPage, setInfluencerPage] = useState(1);

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

  const [error, setError] = useState(null);
  const [linkImport, setLinkImport] = useState({
    url: '',
    loading: false,
    error: '',
    success: '',
  });
  const [ugcCreateModal, setUgcCreateModal] = useState({
    open: false,
    saving: false,
    imageUploading: false,
    error: '',
    form: defaultUgcCreatorForm(),
  });
  const [editModal, setEditModal] = useState({
    open: false,
    loading: false,
    saving: false,
    imageUploading: false,
    videoUploading: false,
    error: '',
    form: null,
  });

  const fetchCreators = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ugcData, influencerData] = await Promise.all([
        getJson(`/api/ugc-creators?page=1&limit=${MAX_FETCH_LIMIT}`, 'Failed to fetch UGC creators'),
        getJson(`/api/influencers?page=1&limit=${MAX_FETCH_LIMIT}`, 'Failed to fetch influencers'),
      ]);

      if (ugcData.ok) {
        setUgcCreators(ugcData.data || []);
      }
      if (influencerData.ok) {
        setInfluencers(influencerData.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch creators:', err);
      setError('Unable to load creators.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  useEffect(() => {
    setUgcPage(1);
  }, [ugcFilters]);

  useEffect(() => {
    setInfluencerPage(1);
  }, [influencerFilters]);

  const filteredUgc = useMemo(() => {
    return ugcCreators.filter((creator) => {
      const searchText = toText(
        `${creator.name || ''} ${creator.handle || ''} ${creator.niche || ''}`
      );
      if (ugcFilters.search && !searchText.includes(toText(ugcFilters.search))) {
        return false;
      }
      if (!matchesNiche(creator, ugcFilters.niche)) return false;
      if (ugcFilters.gender && toText(creator.gender) !== toText(ugcFilters.gender)) {
        return false;
      }
      if (!matchesAgeRange(creator.age, ugcFilters.age)) return false;
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((creator) => {
      const searchText = toText(
        `${creator.name || ''} ${creator.tiktok_handle || ''} ${creator.instagram_handle || ''} ${creator.niche || ''} ${creator.category || ''}`
      );
      if (influencerFilters.search && !searchText.includes(toText(influencerFilters.search))) {
        return false;
      }
      if (!matchesFollowerRange(creator.followers, influencerFilters.followerCount)) return false;
      if (
        influencerFilters.gender &&
        toText(creator.gender || '') !== toText(influencerFilters.gender)
      ) {
        return false;
      }
      if (!matchesNiche(creator, influencerFilters.niche)) return false;
      if (!matchesPlatform(creator, influencerFilters.platform)) return false;
      if (
        !matchesEngagementRate(
          creator.engagement_rate ?? creator.engagementRate,
          influencerFilters.engagementRate
        )
      ) {
        return false;
      }
      return true;
    });
  }, [influencers, influencerFilters]);

  const hasInfluencerEngagementData = useMemo(
    () =>
      influencers.some((creator) => {
        const value = Number(creator.engagement_rate ?? creator.engagementRate);
        return Number.isFinite(value);
      }),
    [influencers]
  );

  useEffect(() => {
    if (!hasInfluencerEngagementData && influencerFilters.engagementRate) {
      setInfluencerFilters((prev) => ({ ...prev, engagementRate: '' }));
    }
  }, [hasInfluencerEngagementData, influencerFilters.engagementRate]);

  const ugcTotalPages = Math.max(1, Math.ceil(filteredUgc.length / ITEMS_PER_PAGE));
  const influencerTotalPages = Math.max(1, Math.ceil(filteredInfluencers.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (ugcPage > ugcTotalPages) {
      setUgcPage(ugcTotalPages);
    }
  }, [ugcPage, ugcTotalPages]);

  useEffect(() => {
    if (influencerPage > influencerTotalPages) {
      setInfluencerPage(influencerTotalPages);
    }
  }, [influencerPage, influencerTotalPages]);

  const paginatedUgc = useMemo(() => {
    const start = (ugcPage - 1) * ITEMS_PER_PAGE;
    return filteredUgc.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUgc, ugcPage]);

  const paginatedInfluencers = useMemo(() => {
    const start = (influencerPage - 1) * ITEMS_PER_PAGE;
    return filteredInfluencers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInfluencers, influencerPage]);

  const openProfile = (creator, type) => {
    setSelectedCreator(creator);
    setCreatorType(type);
  };

  const closeProfile = () => {
    setSelectedCreator(null);
    setCreatorType(null);
  };

  const [recommendedCreators, setRecommendedCreators] = useState([]);
  const [rejectionModal, setRejectionModal] = useState({ open: false, creator: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [creatorStatuses, setCreatorStatuses] = useState({});
  const [expandedCreator, setExpandedCreator] = useState(null);
  const [creatorWorkflowStatus, setCreatorWorkflowStatus] = useState({});
  const [creatorVideoLinks, setCreatorVideoLinks] = useState({});
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });

  const updateWorkflowStatus = (creatorId, status) => {
    setCreatorWorkflowStatus((prev) => ({ ...prev, [creatorId]: status }));
  };

  const updateVideoLink = (creatorId, link) => {
    setCreatorVideoLinks((prev) => ({ ...prev, [creatorId]: link }));
  };

  useEffect(() => {
    if (role === 'brand') {
      const mockRecommended = [...ugcCreators.slice(0, 4), ...influencers.slice(0, 4)].map(
        (creator) => ({
          ...creator,
          recommendedFor: 'Spring Social Launch',
          matchScore: Math.floor(Math.random() * 20) + 80,
        })
      );
      setRecommendedCreators(mockRecommended);
    }
  }, [role, ugcCreators, influencers]);

  const handleApprove = (creator) => {
    setCreatorStatuses((prev) => ({ ...prev, [creator.id]: 'approved' }));
  };

  const handleReject = (creator) => {
    setRejectionModal({ open: true, creator });
  };

  const submitRejection = () => {
    if (rejectionModal.creator && rejectionReason.trim()) {
      setCreatorStatuses((prev) => ({
        ...prev,
        [rejectionModal.creator.id]: { status: 'rejected', reason: rejectionReason },
      }));
      setRejectionModal({ open: false, creator: null });
      setRejectionReason('');
    }
  };

  const closeRejectionModal = () => {
    setRejectionModal({ open: false, creator: null });
    setRejectionReason('');
  };

  const toggleExpandedCreator = (creatorId) => {
    setExpandedCreator((prev) => (prev === creatorId ? null : creatorId));
  };

  const openAddContentModal = (creator) => {
    setAddContentModal({ open: true, creator });
  };

  const closeAddContentModal = () => {
    setAddContentModal({ open: false, creator: null });
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to encode image.'));
      };
      reader.onerror = () => reject(new Error('Failed to encode image.'));
      reader.readAsDataURL(file);
    });

  const uploadCreatorImage = async (file) => {
    try {
      const urlRes = await fetch(`${API_BASE}/uploads/request-url`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok || !urlData.uploadURL || !urlData.objectPath) {
        throw new Error(urlData.error || 'Failed to get upload URL');
      }
      const uploadRes = await fetch(urlData.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload image file');
      }
      return urlData.objectPath;
    } catch (error) {
      console.warn('Signed creator image upload failed, using inline fallback.', error);
      return fileToDataUrl(file);
    }
  };

  const openEditCreator = async (creator) => {
    if (!isAdmin) return;
    setEditModal({
      open: true,
      loading: true,
      saving: false,
      imageUploading: false,
      videoUploading: false,
      error: '',
      form: null,
    });
    try {
      const data = await getJson(`/api/creators/${creator.id}`, 'Failed to fetch creator details');
      if (!data.ok || !data.data) {
        throw new Error(data?.error || 'Creator not found');
      }
      setEditModal({
        open: true,
        loading: false,
        saving: false,
        imageUploading: false,
        videoUploading: false,
        error: '',
        form: normalizeCreatorForm(data.data),
      });
    } catch (err) {
      setEditModal({
        open: true,
        loading: false,
        saving: false,
        imageUploading: false,
        videoUploading: false,
        error: err?.message || 'Failed to load creator details.',
        form: null,
      });
    }
  };

  const closeEditModal = () => {
    setEditModal({
      open: false,
      loading: false,
      saving: false,
      imageUploading: false,
      videoUploading: false,
      error: '',
      form: null,
    });
  };

  const updateEditField = (field, value) => {
    setEditModal((prev) => ({
      ...prev,
      error: '',
      form: prev.form ? { ...prev.form, [field]: value } : prev.form,
    }));
  };

  const handleUploadCreatorImage = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setEditModal((prev) => ({
        ...prev,
        error: 'Please select an image file.',
      }));
      return;
    }
    setEditModal((prev) => ({
      ...prev,
      imageUploading: true,
      error: '',
    }));
    try {
      const imagePath = await uploadCreatorImage(file);
      setEditModal((prev) => ({
        ...prev,
        imageUploading: false,
        error: '',
        form: prev.form ? { ...prev.form, profile_image: imagePath } : prev.form,
      }));
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        imageUploading: false,
        error: err?.message || 'Failed to upload creator image.',
      }));
    }
  };

  const uploadCreatorVideo = async (file) => {
    const urlRes = await fetch(`${API_BASE}/uploads/request-url`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    const urlData = await urlRes.json();
    if (!urlRes.ok || !urlData.ok || !urlData.uploadURL || !urlData.objectPath) {
      throw new Error(urlData?.error || 'Failed to generate upload URL');
    }
    const uploadRes = await fetch(urlData.uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'video/mp4' },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error('Failed to upload video file');
    }
    return urlData.objectPath;
  };

  const addEditVideoUrl = () => {
    setEditModal((prev) => {
      if (!prev.form) return prev;
      const current = Array.isArray(prev.form.ugc_video_urls) ? prev.form.ugc_video_urls : [];
      return {
        ...prev,
        form: { ...prev.form, ugc_video_urls: [...current, ''] },
      };
    });
  };

  const updateEditVideoUrlAt = (index, value) => {
    setEditModal((prev) => {
      if (!prev.form) return prev;
      const current = Array.isArray(prev.form.ugc_video_urls) ? [...prev.form.ugc_video_urls] : [];
      if (index < 0 || index >= current.length) return prev;
      current[index] = value;
      return {
        ...prev,
        error: '',
        form: { ...prev.form, ugc_video_urls: current },
      };
    });
  };

  const removeEditVideoUrlAt = (index) => {
    setEditModal((prev) => {
      if (!prev.form) return prev;
      const current = Array.isArray(prev.form.ugc_video_urls) ? [...prev.form.ugc_video_urls] : [];
      if (index < 0 || index >= current.length) return prev;
      current.splice(index, 1);
      return {
        ...prev,
        form: { ...prev.form, ugc_video_urls: current },
      };
    });
  };

  const handleUploadCreatorVideo = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('video/')) {
      setEditModal((prev) => ({
        ...prev,
        error: 'Please select a video file.',
      }));
      return;
    }
    setEditModal((prev) => ({
      ...prev,
      videoUploading: true,
      error: '',
    }));
    try {
      const videoPath = await uploadCreatorVideo(file);
      setEditModal((prev) => {
        const current = Array.isArray(prev.form?.ugc_video_urls) ? prev.form.ugc_video_urls : [];
        return {
          ...prev,
          videoUploading: false,
          error: '',
          form: prev.form
            ? {
                ...prev.form,
                ugc_video_urls: [...current, videoPath],
              }
            : prev.form,
        };
      });
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        videoUploading: false,
        error: err?.message || 'Failed to upload video.',
      }));
    }
  };

  const openUgcCreateModal = () => {
    if (!isAdmin) return;
    setUgcCreateModal({
      open: true,
      saving: false,
      imageUploading: false,
      error: '',
      form: defaultUgcCreatorForm(),
    });
  };

  const closeUgcCreateModal = () => {
    setUgcCreateModal({
      open: false,
      saving: false,
      imageUploading: false,
      error: '',
      form: defaultUgcCreatorForm(),
    });
  };

  const updateUgcCreateField = (field, value) => {
    setUgcCreateModal((prev) => ({
      ...prev,
      error: '',
      form: { ...prev.form, [field]: value },
    }));
  };

  const handleUploadUgcCreateImage = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setUgcCreateModal((prev) => ({
        ...prev,
        error: 'Please select an image file.',
      }));
      return;
    }
    setUgcCreateModal((prev) => ({
      ...prev,
      imageUploading: true,
      error: '',
    }));
    try {
      const imagePath = await uploadCreatorImage(file);
      setUgcCreateModal((prev) => ({
        ...prev,
        imageUploading: false,
        error: '',
        form: { ...prev.form, profile_image: imagePath },
      }));
    } catch (err) {
      setUgcCreateModal((prev) => ({
        ...prev,
        imageUploading: false,
        error: err?.message || 'Failed to upload creator image.',
      }));
    }
  };

  const submitUgcCreator = async () => {
    const form = ugcCreateModal.form;
    if (!form) return;
    if (ugcCreateModal.imageUploading) {
      setUgcCreateModal((prev) => ({
        ...prev,
        error: 'Image upload is in progress. Please wait.',
      }));
      return;
    }

    const requiredFields = [
      ['name', 'Name is required.'],
      ['handle', 'Handle is required.'],
      ['niche', 'Niche is required.'],
      ['age', 'Age is required.'],
      ['gender', 'Gender is required.'],
      ['languages', 'Languages are required.'],
      ['turnaround_time', 'Turnaround time is required.'],
      ['base_rate', 'Base rate is required.'],
    ];

    for (const [field, message] of requiredFields) {
      if (!String(form[field] ?? '').trim()) {
        setUgcCreateModal((prev) => ({ ...prev, error: message }));
        return;
      }
    }

    setUgcCreateModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        base_rate: Number(form.base_rate),
      };
      delete payload.portfolio_url;
      const res = await fetch(`${API_BASE}/ugc-creators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to add UGC creator.');
      }
      closeUgcCreateModal();
      setActiveTab('ugc');
      await fetchCreators();
    } catch (err) {
      setUgcCreateModal((prev) => ({
        ...prev,
        saving: false,
        error: err?.message || 'Failed to add UGC creator.',
      }));
    }
  };

  const saveEditedCreator = async () => {
    if (!editModal.form?.id) return;
    if (editModal.imageUploading || editModal.videoUploading) {
      setEditModal((prev) => ({
        ...prev,
        error: 'A file upload is in progress. Please wait.',
      }));
      return;
    }
    setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const payload = { ...editModal.form };
      delete payload.id;
      payload.ugc_video_urls = normalizeVideoUrls(payload.ugc_video_urls);
      if (payload.creator_type !== 'UGC') {
        payload.ugc_video_urls = [];
      }
      const res = await fetch(`/api/creators/${editModal.form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to update creator.');
      }
      closeEditModal();
      await fetchCreators();
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        saving: false,
        error: err?.message || 'Failed to update creator.',
      }));
    }
  };

  const importCreatorFromLink = async () => {
    if (!isAdmin) return;
    const profileUrl = linkImport.url.trim();
    if (!profileUrl) {
      setLinkImport((prev) => ({
        ...prev,
        error: 'Please enter a TikTok profile link.',
        success: '',
      }));
      return;
    }
    setLinkImport((prev) => ({
      ...prev,
      loading: true,
      error: '',
      success: '',
    }));
    try {
      const res = await fetch(`${API_BASE}/creators/import-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: profileUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to import creator.');
      }
      const importedName = data?.data?.name || 'Creator';
      const action = data?.meta?.action === 'created' ? 'added' : 'updated';
      setLinkImport({
        url: '',
        loading: false,
        error: '',
        success: `${importedName} ${action} successfully.`,
      });
      setActiveTab('influencer');
      await fetchCreators();
    } catch (err) {
      setLinkImport((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to import creator.',
        success: '',
      }));
    }
  };

  const importActions = isAdmin ? (
    <div className="page-header-actions creator-import-actions">
      <div className="creator-import-row">
        <input
          type="text"
          className="input"
          placeholder="Paste TikTok profile link"
          value={linkImport.url}
          onChange={(event) =>
            setLinkImport((prev) => ({
              ...prev,
              url: event.target.value,
              error: '',
              success: '',
            }))
          }
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={importCreatorFromLink}
          disabled={linkImport.loading}
        >
          {linkImport.loading ? 'Importing...' : 'Import Creator'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={openUgcCreateModal}
          disabled={linkImport.loading}
        >
          Add UGC Creator
        </button>
      </div>
      {linkImport.error ? <p className="creator-import-feedback error">{linkImport.error}</p> : null}
      {linkImport.success ? (
        <p className="creator-import-feedback success">{linkImport.success}</p>
      ) : null}
    </div>
  ) : null;

  if (role === 'creator') {
    return (
      <EmptyState
        title="Creator directory coming soon"
        description="As a creator, you'll be able to connect with other creators and explore collaboration opportunities."
      />
    );
  }

  if (role === 'brand') {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2>Creators</h2>
            <p>Review creators suggested by our team for your campaigns.</p>
          </div>
        </div>

        <BrandRecommendations
          loading={loading}
          recommendedCreators={recommendedCreators}
          creatorStatuses={creatorStatuses}
          expandedCreator={expandedCreator}
          onToggleExpand={toggleExpandedCreator}
          onApprove={handleApprove}
          onReject={handleReject}
          workflowStatuses={WORKFLOW_STATUSES}
          workflowStatusMap={creatorWorkflowStatus}
          onWorkflowStatusChange={updateWorkflowStatus}
          videoLinks={creatorVideoLinks}
          onVideoLinkChange={updateVideoLink}
          onOpenAddContent={openAddContentModal}
        />

        <RejectionModal
          open={rejectionModal.open}
          creator={rejectionModal.creator}
          reason={rejectionReason}
          onChange={setRejectionReason}
          onSubmit={submitRejection}
          onClose={closeRejectionModal}
        />

        <AddContentModal
          open={addContentModal.open}
          creator={addContentModal.creator}
          onClose={closeAddContentModal}
          onSubmit={closeAddContentModal}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2>Creators</h2>
            <p>Loading creator profiles...</p>
          </div>
          {importActions}
        </div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <EmptyState title="Error loading creators" description={error} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Creators</h2>
          <p>Review all creator profiles and performance context.</p>
        </div>
        {importActions}
      </div>

      <div className="tabs-container">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ugc' ? 'active' : ''}`}
          onClick={() => setActiveTab('ugc')}
        >
          UGC Creators ({filteredUgc.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'influencer' ? 'active' : ''}`}
          onClick={() => setActiveTab('influencer')}
        >
          Influencers ({filteredInfluencers.length})
        </button>
      </div>

      {activeTab === 'ugc' && (
        <>
          <CreatorFilters
            type="ugc"
            filters={ugcFilters}
            onChange={setUgcFilters}
            niches={NICHES}
          />

          <div className="compact-creator-grid">
            <CreatorGrid
              creators={paginatedUgc}
              type="ugc"
              onOpenProfile={openProfile}
              canEdit={isAdmin}
              onEditCreator={openEditCreator}
            />
          </div>

          {ugcTotalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setUgcPage((prev) => Math.max(1, prev - 1))}
                disabled={ugcPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {ugcPage} of {ugcTotalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setUgcPage((prev) => Math.min(ugcTotalPages, prev + 1))}
                disabled={ugcPage === ugcTotalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'influencer' && (
        <>
          <CreatorFilters
            type="influencer"
            filters={influencerFilters}
            onChange={setInfluencerFilters}
            niches={NICHES}
            disableEngagementRate={!hasInfluencerEngagementData}
          />

          <div className="compact-creator-grid">
            <CreatorGrid
              creators={paginatedInfluencers}
              type="influencer"
              onOpenProfile={openProfile}
              canEdit={isAdmin}
              onEditCreator={openEditCreator}
            />
          </div>

          {influencerTotalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setInfluencerPage((prev) => Math.max(1, prev - 1))}
                disabled={influencerPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {influencerPage} of {influencerTotalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setInfluencerPage((prev) => Math.min(influencerTotalPages, prev + 1))}
                disabled={influencerPage === influencerTotalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <CreatorProfileModal
        creator={selectedCreator}
        type={creatorType}
        viewerRole={role}
        onClose={closeProfile}
      />
      <CreatorEditModal
        open={editModal.open}
        loading={editModal.loading}
        saving={editModal.saving}
        uploadingImage={editModal.imageUploading}
        uploadingVideo={editModal.videoUploading}
        error={editModal.error}
        form={editModal.form}
        onClose={closeEditModal}
        onChange={updateEditField}
        onUploadImage={handleUploadCreatorImage}
        onUploadVideo={handleUploadCreatorVideo}
        onAddVideoUrl={addEditVideoUrl}
        onUpdateVideoUrlAt={updateEditVideoUrlAt}
        onRemoveVideoUrlAt={removeEditVideoUrlAt}
        onSubmit={saveEditedCreator}
      />
      <UgcCreatorCreateModal
        open={ugcCreateModal.open}
        saving={ugcCreateModal.saving}
        uploadingImage={ugcCreateModal.imageUploading}
        form={ugcCreateModal.form}
        error={ugcCreateModal.error}
        onClose={closeUgcCreateModal}
        onChange={updateUgcCreateField}
        onUploadImage={handleUploadUgcCreateImage}
        onSubmit={submitUgcCreator}
      />
    </div>
  );
}
