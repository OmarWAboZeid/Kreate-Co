import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import CreatorFilters from '../components/CreatorFilters.jsx';
import CampaignFormModal from '../components/CampaignFormModal.jsx';
import CreatorGrid from '../components/CreatorGrid.jsx';
import CreatorProfileModal from '../components/CreatorProfileModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';
import { handleAvatarError, resolveAvatarSrc } from '../utils/avatar.js';
import {
  campaignsApi,
  creatorsApi,
  useBrandsQuery,
  useCampaignCreatorsQuery,
  useCreatorStagesQuery,
  useInfluencersQuery,
  usePackagesQuery,
  useUgcCreatorsQuery,
  useUpdateCampaignMutation,
} from '../queries/index.js';

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
const CAMPAIGN_TIER_LABELS = {
  nano: 'Nano',
  micro: 'Micro',
  'mid-tier': 'Mid-tier',
  macro: 'Macro',
};

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

const matchesCampaignTier = (creator, tier) => {
  const followers = Number(creator?.followers ?? creator?.followers_count);
  if (!Number.isFinite(followers)) return false;
  if (tier === 'nano') return followers >= 1000 && followers < 10000;
  if (tier === 'micro') return followers >= 10000 && followers < 100000;
  if (tier === 'mid-tier') return followers >= 100000 && followers < 500000;
  if (tier === 'macro') return followers >= 500000;
  return true;
};

const matchesAnyCampaignTier = (creator, tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return true;
  return tiers.some((tier) => matchesCampaignTier(creator, tier));
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

const formatPlatformLabel = (value) => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!normalized) return '';
  if (normalized === 'tiktok') return 'TikTok';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'youtube') return 'YouTube';
  return raw;
};

const inferSubmittedContentPlatform = (link, fallbackPlatforms = []) => {
  const source = String(link || '').trim().toLowerCase();
  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('youtube')) return 'YouTube';
  if (!Array.isArray(fallbackPlatforms)) return 'Unspecified';
  const fallback = fallbackPlatforms.map((platform) => formatPlatformLabel(platform)).find(Boolean);
  return fallback || 'Unspecified';
};

const EMPTY_CREATOR_SUBMISSION_SUMMARY = Object.freeze({
  entries: [],
  latestEntry: null,
  totalCount: 0,
  hasDraft: false,
  hasFinal: false,
});

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

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const parseEventTimeToMinutes = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatEventTime = (value) => {
  const minutes = parseEventTimeToMinutes(value);
  if (minutes == null) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parsed = new Date(2000, 0, 1, hours, mins, 0, 0);
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const CALENDAR_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseCalendarDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toCalendarDayKey = (date) => {
  const parsed = parseCalendarDate(date);
  if (!parsed) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const addCalendarDays = (date, days) => {
  const parsed = parseCalendarDate(date);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + Number(days || 0));
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

const formatRatePlaceholder = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 'Current rate not set';
  return `Current: $${parsed.toLocaleString()}`;
};

const formatMessageRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'employee') return 'Team';
  if (normalized === 'brand') return 'Brand';
  return 'Member';
};

const CAMPAIGN_MESSAGE_EMOJIS = [
  '😀',
  '😂',
  '😍',
  '👏',
  '🔥',
  '🎉',
  '✅',
  '👍',
  '🙏',
  '💡',
  '📸',
  '🎥',
  '📦',
  '🚀',
  '❤️',
  '🙌',
];

const CAMPAIGN_MESSAGE_ATTACHMENT_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';

const MAX_CAMPAIGN_MESSAGE_ATTACHMENTS = 10;

const formatFileSize = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getCampaignMessageAttachmentKind = (attachment) => {
  const contentType = String(attachment?.contentType || '').toLowerCase();
  const fileName = String(attachment?.fileName || '').toLowerCase();
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(fileName)) return 'image';
  if (/\.(mp4|mov|m4v|webm|ogv|ogg)$/i.test(fileName)) return 'video';
  if (/\.(mp3|wav|m4a|aac|flac|oga)$/i.test(fileName)) return 'audio';
  return 'file';
};

const normalizeExternalUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

const SocialPlatformIcon = ({ platform }) => {
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          ry="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        />
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="17.5" cy="6.8" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect
          x="2.8"
          y="5.2"
          width="18.4"
          height="13.6"
          rx="4.2"
          ry="4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
        />
        <path d="M10 9.1 15.2 12 10 14.9z" fill="currentColor" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M13.8 21v-7.2h2.4l.4-2.7h-2.8V9.3c0-.8.2-1.3 1.4-1.3h1.5V5.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v1.6H8.2v2.7h2.4V21z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M16.1 5.2c-1 0-1.9-.4-2.5-1.1v9.2a4.3 4.3 0 1 1-3-4.1v2.2a2.2 2.2 0 1 0 .9 1.8V3h2.2c.2 1.5 1.3 2.2 2.4 2.2z"
        fill="currentColor"
      />
    </svg>
  );
};

const normalizeCreatorVideoUrls = (creator) => {
  const raw = creator?.ugc_video_urls;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const resolveMediaUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (
    raw.startsWith('/objects/') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^\/+/, '')}`;
};

const looksLikeVideoUrl = (url) => {
  if (!url) return false;
  const raw = String(url).trim();
  if (!raw) return false;
  if (raw.startsWith('/objects/')) return true;
  return /\.(mp4|mov|m4v|webm|ogv|ogg)(\?|#|$)/i.test(raw);
};

const inferSubmissionStage = (item) => {
  const type = String(item?.type || '').trim().toLowerCase();
  if (type.includes('draft')) return 'Draft';
  const status = String(item?.status || '').trim().toLowerCase();
  if (status === 'draft') return 'Draft';
  return 'Final';
};

const extractUploadedLinksFromNotes = (notes) =>
  String(notes || '')
    .split(/\r?\n/g)
    .map((line) => {
      const match = line.match(/^uploaded file:\s*(.+)$/i);
      return match ? resolveMediaUrl(match[1]) : '';
    })
    .filter(Boolean);

const getSubmissionTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareSubmissionEntries = (left, right) => {
  const timeDelta = getSubmissionTimestamp(right.createdAt) - getSubmissionTimestamp(left.createdAt);
  if (timeDelta !== 0) return timeDelta;
  const leftIsVideo = looksLikeVideoUrl(left.link);
  const rightIsVideo = looksLikeVideoUrl(right.link);
  if (leftIsVideo !== rightIsVideo) {
    return leftIsVideo ? -1 : 1;
  }
  if (left.stage !== right.stage) {
    return left.stage === 'Final' ? -1 : 1;
  }
  return String(left.link || '').localeCompare(String(right.link || ''), undefined, {
    sensitivity: 'base',
  });
};

const getCreatorSocialEntries = (creator) =>
  [
    { key: 'tiktok', label: 'TikTok', url: creator?.tiktok_url },
    { key: 'instagram', label: 'Instagram', url: creator?.instagram_url },
    { key: 'youtube', label: 'YouTube', url: creator?.youtube_url },
    { key: 'facebook', label: 'Facebook', url: creator?.facebook_url },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { campaigns, campaignCreators, brands, contentItems } = useAppState();
  const dispatch = useAppDispatch();
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [creatorTypeFilter, setCreatorTypeFilter] = useState('all');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [approvedGroupExpanded, setApprovedGroupExpanded] = useState(true);
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });
  const [contentForm, setContentForm] = useState({
    submissionStage: 'final',
    link: '',
    uploadedLink: '',
    notes: '',
  });
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
  const [ugcVideosModal, setUgcVideosModal] = useState({
    open: false,
    creator: null,
    videos: [],
  });
  const [rejectModal, setRejectModal] = useState({ open: false, creator: null });
  const [rejectReason, setRejectReason] = useState('');
  const [showAddCreatorsModal, setShowAddCreatorsModal] = useState(false);
  const [brandTab, setBrandTab] = useState('brief');
  const [adminTab, setAdminTab] = useState('overview');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [customCalendarEvents, setCustomCalendarEvents] = useState([]);
  const [customCalendarEventsLoading, setCustomCalendarEventsLoading] = useState(false);
  const [customCalendarEventsError, setCustomCalendarEventsError] = useState('');
  const [campaignMessages, setCampaignMessages] = useState([]);
  const [campaignMessagesLoading, setCampaignMessagesLoading] = useState(false);
  const [campaignMessagesError, setCampaignMessagesError] = useState('');
  const [campaignMessageDraft, setCampaignMessageDraft] = useState('');
  const [campaignMessageAttachments, setCampaignMessageAttachments] = useState([]);
  const [campaignMessageSending, setCampaignMessageSending] = useState(false);
  const [campaignMessageSendError, setCampaignMessageSendError] = useState('');
  const [campaignEmojiPickerOpen, setCampaignEmojiPickerOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const campaignMessageInputRef = useRef(null);
  const campaignMessageAttachmentInputRef = useRef(null);
  const campaignMessagesViewportRef = useRef(null);
  const campaignMessagesBottomRef = useRef(null);
  const shouldStickMessagesToBottomRef = useRef(true);
  const [calendarEventModal, setCalendarEventModal] = useState({
    open: false,
    mode: 'create',
    eventId: null,
    title: '',
    eventDate: '',
    eventTime: '',
    description: '',
    saving: false,
    error: '',
  });
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
  const [suggestInfluencerRates, setSuggestInfluencerRates] = useState({});

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isBrand = role === 'brand';
  const canManageCreators = isAdmin || isEmployee;
  const canManageCalendar = isAdmin || isEmployee || isBrand;
  const campaignMessageHasUploadingAttachments = campaignMessageAttachments.some(
    (attachment) => attachment.status === 'uploading'
  );
  const campaignMessageHasFailedAttachments = campaignMessageAttachments.some(
    (attachment) => attachment.status === 'error'
  );

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    if (!requestedTab) return;

    if (isBrand) {
      if (['brief', 'creators', 'analytics', 'calendar'].includes(requestedTab)) {
        setBrandTab(requestedTab);
      }
      return;
    }

    if (['overview', 'creators', 'analytics', 'calendar'].includes(requestedTab)) {
      setAdminTab(requestedTab);
    }
  }, [isBrand, location.search]);

  const creatorsQueryParams = useMemo(() => ({ limit: 100 }), []);
  const ugcCreatorsQuery = useUgcCreatorsQuery(creatorsQueryParams, {
    enabled: Boolean(campaignId),
  });
  const influencersQuery = useInfluencersQuery(creatorsQueryParams, {
    enabled: Boolean(campaignId),
  });
  const brandsQuery = useBrandsQuery({}, { enabled: isAdmin });
  const packagesQuery = usePackagesQuery({}, { enabled: isAdmin });
  const creatorStagesQuery = useCreatorStagesQuery({}, { enabled: Boolean(campaignId) });
  const campaignCreatorsQuery = useCampaignCreatorsQuery(campaignId, {
    enabled: Boolean(campaignId),
  });
  const updateCampaignMutation = useUpdateCampaignMutation();
  const ugcCreators = useMemo(() => ugcCreatorsQuery.data?.data || [], [ugcCreatorsQuery.data]);
  const influencers = useMemo(
    () => influencersQuery.data?.data || [],
    [influencersQuery.data]
  );
  const loading = ugcCreatorsQuery.isLoading || influencersQuery.isLoading;
  const packages = useMemo(() => packagesQuery.data?.data || [], [packagesQuery.data]);
  const loadingPackages = isAdmin ? packagesQuery.isLoading : false;
  const loadingBrands = isAdmin ? brandsQuery.isLoading : false;
  const creatorStageDefinitions = useMemo(
    () => creatorStagesQuery.data?.data || [],
    [creatorStagesQuery.data]
  );
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
  const brandNamesSource = brandsQuery.data?.data || brands;
  const brandNames = brandNamesSource.map((b) => (typeof b === 'string' ? b : b.name));
  const refreshCampaignCreators = async () => {
    if (!campaignId) return;
    try {
      await campaignCreatorsQuery.refetch();
    } catch (err) {
      console.error('Failed to fetch campaign creators:', err);
    }
  };

  useEffect(() => {
    const payload = campaignCreatorsQuery.data?.data;
    if (!campaignId || !payload) return;
    dispatch({
      type: 'SET_CAMPAIGN_CREATORS',
      payload: { campaignId, data: payload },
    });
  }, [campaignId, campaignCreatorsQuery.data, dispatch]);

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
  useEffect(() => {
    if (!campaign) return;
    const seedDate =
      parseCalendarDate(campaign.timeline?.start) ||
      parseCalendarDate(campaign.startDate) ||
      parseCalendarDate(campaign.timeline?.end) ||
      parseCalendarDate(campaign.endDate) ||
      parseCalendarDate(campaign.createdAt || campaign.created_at) ||
      new Date();
    setCalendarMonth(new Date(seedDate.getFullYear(), seedDate.getMonth(), 1));
  }, [
    campaignId,
    campaign?.timeline?.start,
    campaign?.startDate,
    campaign?.timeline?.end,
    campaign?.endDate,
    campaign?.createdAt,
      campaign?.created_at,
  ]);
  useEffect(() => {
    let ignore = false;
    const loadCalendarEvents = async () => {
      if (!campaignId) return;
      setCustomCalendarEventsLoading(true);
      setCustomCalendarEventsError('');
      try {
        const data = await campaignsApi.listEvents(campaignId);
        if (!ignore) {
          setCustomCalendarEvents(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (error) {
        if (!ignore) {
          setCustomCalendarEventsError(error?.message || 'Failed to load campaign events.');
          setCustomCalendarEvents([]);
        }
      } finally {
        if (!ignore) {
          setCustomCalendarEventsLoading(false);
        }
      }
    };
    loadCalendarEvents();
    return () => {
      ignore = true;
    };
  }, [campaignId]);

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
  const normalizedCampaignType = ['UGC', 'Influencer', 'Hybrid'].includes(campaign?.campaignType)
    ? campaign.campaignType
    : 'Hybrid';
  const campaignAllowsUGC = normalizedCampaignType !== 'Influencer';
  const campaignAllowsInfluencer = normalizedCampaignType !== 'UGC';
  const campaignTierCriteria = useMemo(() => {
    if (!Array.isArray(campaign?.creatorTiers)) return [];
    return campaign.creatorTiers.map((tier) => toText(tier)).filter(Boolean);
  }, [campaign?.creatorTiers]);
  const campaignPlatformCriteria = useMemo(() => {
    if (!Array.isArray(campaign?.platforms)) return [];
    return campaign.platforms
      .map((platform) => toText(platform))
      .filter((platform) => platform === 'instagram' || platform === 'tiktok');
  }, [campaign?.platforms]);

  const filteredUgcCreators = useMemo(() => {
    if (!campaignAllowsUGC) return [];
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
  }, [ugcCreators, ugcFilters, campaignAllowsUGC]);

  const filteredInfluencerCreators = useMemo(() => {
    if (!campaignAllowsInfluencer) return [];
    return influencers.filter((creator) => {
      const searchText = toText(
        `${creator?.name || ''} ${creator?.tiktok_handle || ''} ${creator?.instagram_handle || ''} ${creator?.niche || ''} ${creator?.category || ''}`
      );
      if (influencerFilters.search && !searchText.includes(toText(influencerFilters.search))) {
        return false;
      }
      if (!matchesAnyCampaignTier(creator, campaignTierCriteria)) return false;
      if (
        campaignPlatformCriteria.length > 0 &&
        !campaignPlatformCriteria.some((platform) => matchesPlatform(creator, platform))
      ) {
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
  }, [
    influencers,
    influencerFilters,
    campaignAllowsInfluencer,
    campaignTierCriteria,
    campaignPlatformCriteria,
  ]);

  const suggestCreators = suggestTab === 'ugc' ? filteredUgcCreators : filteredInfluencerCreators;
  useEffect(() => {
    if (campaignAllowsUGC && campaignAllowsInfluencer) return;
    if (!campaignAllowsUGC && suggestTab === 'ugc') {
      setSuggestTab('influencer');
      return;
    }
    if (!campaignAllowsInfluencer && suggestTab === 'influencer') {
      setSuggestTab('ugc');
    }
  }, [campaignAllowsUGC, campaignAllowsInfluencer, suggestTab]);

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
    let result = shortlistCreators.filter(
      (c) => creatorState.approvals[c.id] !== 'Brand Rejected'
    );
    if (creatorFilter === 'approved') {
      result = result.filter((c) => creatorState.approvals[c.id] === 'Brand Approved');
    } else if (creatorFilter === 'pending') {
      result = result.filter(
        (c) => !creatorState.approvals[c.id] || creatorState.approvals[c.id] === 'Suggested'
      );
    }
    if (creatorTypeFilter !== 'all') {
      result = result.filter((c) => inferCreatorType(c) === creatorTypeFilter);
    }
    if (creatorSearch) {
      const search = creatorSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(search));
    }
    return result;
  }, [shortlistCreators, creatorFilter, creatorTypeFilter, creatorSearch, creatorState.approvals]);
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
  const campaignScopedAdminCreators = useMemo(
    () =>
      shortlistCreators.filter((creator) => {
        const creatorType = inferCreatorType(creator);
        if (creatorType === 'ugc') {
          return campaignAllowsUGC;
        }
        if (!campaignAllowsInfluencer) {
          return false;
        }
        if (!matchesAnyCampaignTier(creator, campaignTierCriteria)) {
          return false;
        }
        if (
          campaignPlatformCriteria.length > 0 &&
          !campaignPlatformCriteria.some((platform) => matchesPlatform(creator, platform))
        ) {
          return false;
        }
        return true;
      }),
    [
      shortlistCreators,
      campaignAllowsUGC,
      campaignAllowsInfluencer,
      campaignTierCriteria,
      campaignPlatformCriteria,
    ]
  );
  const adminCreatorTypeBuckets = useMemo(
    () => splitCreatorsByType(campaignScopedAdminCreators),
    [campaignScopedAdminCreators]
  );
  const activeAdminCreatorFilterTab =
    campaignAllowsUGC && campaignAllowsInfluencer
      ? adminCreatorFilterTab
      : campaignAllowsUGC
        ? 'ugc'
        : 'influencer';
  useEffect(() => {
    if (adminCreatorFilterTab !== activeAdminCreatorFilterTab) {
      setAdminCreatorFilterTab(activeAdminCreatorFilterTab);
    }
  }, [adminCreatorFilterTab, activeAdminCreatorFilterTab]);
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
    const selectedType = activeAdminCreatorFilterTab;
    const typeFiltered = campaignScopedAdminCreators.filter(
      (creator) => inferCreatorType(creator) === selectedType
    );
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
    campaignScopedAdminCreators,
    activeAdminCreatorFilterTab,
    adminUgcCreatorFilters,
    adminInfluencerCreatorFilters,
  ]);
  const filteredAdminCreatorBuckets = useMemo(() => {
    const buckets = { pending: [], approved: [], rejected: [] };
    filteredAdminCreators.forEach((creator) => {
      const decision = creatorState.approvals?.[creator.id] || 'Suggested';
      if (decision === 'Brand Approved') {
        buckets.approved.push(creator);
      } else if (decision === 'Brand Rejected') {
        buckets.rejected.push(creator);
      } else {
        buckets.pending.push(creator);
      }
    });
    return buckets;
  }, [filteredAdminCreators, creatorState.approvals]);

  const openCreatorProfile = (creator, type) => {
    setSelectedCreator(creator);
    setSelectedCreatorType(type);
  };

  const closeCreatorProfile = () => {
    setSelectedCreator(null);
  };

  const applyLocalDecisionState = (creatorId, decisionLabel, rejectionReason = '') => {
    const existing = campaignCreators[campaign.id];
    if (!existing) return;

    const nextApprovals = {
      ...existing.approvals,
      [creatorId]: decisionLabel,
    };
    const nextRejectionReasons = {
      ...(existing.rejectionReasons || {}),
    };
    if (decisionLabel === 'Brand Rejected' && rejectionReason) {
      nextRejectionReasons[creatorId] = rejectionReason;
    } else {
      delete nextRejectionReasons[creatorId];
    }

    const nextOutreach = {
      ...(existing.outreach || {}),
    };
    if (decisionLabel === 'Suggested') {
      delete nextOutreach[creatorId];
    }

    dispatch({
      type: 'SET_CAMPAIGN_CREATORS',
      payload: {
        campaignId: campaign.id,
        data: {
          ...existing,
          approvals: nextApprovals,
          rejectionReasons: nextRejectionReasons,
          outreach: nextOutreach,
        },
      },
    });
  };

  const handleDecision = async (creatorId, decision) => {
    const mappedDecision =
      decision === 'Brand Approved'
        ? 'approved'
        : decision === 'Brand Rejected'
          ? 'rejected'
          : 'pending';
    try {
      await campaignsApi.updateCreatorDecision({
        campaignId: campaign.id,
        creatorId,
        payload: { decision: mappedDecision, note: '' },
      });

      const nextDecisionLabel =
        mappedDecision === 'approved'
          ? 'Brand Approved'
          : mappedDecision === 'rejected'
            ? 'Brand Rejected'
            : 'Suggested';
      applyLocalDecisionState(creatorId, nextDecisionLabel);

      refreshCampaignCreators().catch((error) => {
        console.error('Failed to refresh creators after decision update:', error);
      });
    } catch (err) {
      console.error('Failed to update decision:', err);
      alert(err?.message || 'Failed to update decision.');
    }
  };

  const handleWorkflowStatusUpdate = async (creatorId, workflowStatus) => {
    try {
      await campaignsApi.updateCreatorWorkflow({
        campaignId: campaign.id,
        creatorId,
        payload: { workflowStatus },
      });
      await refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to update creator stage:', err);
    }
  };

  const handleSuggestCreator = async (creator) => {
    const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
    if (isAlreadySuggested) return;
    try {
      if (isAdmin && suggestTab === 'influencer') {
        const draftRateRaw = suggestInfluencerRates[creator.id];
        if (draftRateRaw !== undefined && String(draftRateRaw).trim() !== '') {
          const nextRate = Number(draftRateRaw);
          if (!Number.isFinite(nextRate) || nextRate < 0) {
            throw new Error('Rate must be a non-negative number.');
          }
          const currentRate = Number(creator.base_rate);
          if (!Number.isFinite(currentRate) || Math.abs(currentRate - nextRate) > 0.0001) {
            const creatorDetailsRes = await creatorsApi.getById(creator.id);
            const creatorDetails = creatorDetailsRes?.data;
            if (!creatorDetails) {
              throw new Error('Failed to load creator details before updating rate.');
            }
            await creatorsApi.update({
              creatorId: creator.id,
              payload: {
                ...creatorDetails,
                base_rate: nextRate,
              },
            });
            await influencersQuery.refetch();
          }
          setSuggestInfluencerRates((prev) => {
            const next = { ...prev };
            delete next[creator.id];
            return next;
          });
        }
      }

      await campaignsApi.suggestCreator({
        campaignId: campaign.id,
        creatorId: creator.id,
      });
      await refreshCampaignCreators();
    } catch (err) {
      console.error('Failed to suggest creator:', err);
    }
  };

  const handleUndoSuggestCreator = async (creatorId) => {
    try {
      await campaignsApi.unsuggestCreator({
        campaignId: campaign.id,
        creatorId,
      });
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
    setSuggestInfluencerRates({});
  };

  const closeAddContentModal = () => {
    setAddContentModal({ open: false, creator: null });
    setContentForm({
      submissionStage: 'final',
      link: '',
      uploadedLink: '',
      notes: '',
    });
    setContentUploadState({ uploading: false, error: '', fileName: '' });
  };

  const closeVideoPreview = () => {
    setVideoPreview({ open: false, url: '', title: 'Submitted Video' });
  };

  const openVideoPreview = (url, title) => {
    if (!url) return;
    setVideoPreview({ open: true, url, title: title || 'Submitted Video' });
  };

  const openUgcVideosModal = (creator) => {
    const videos = normalizeCreatorVideoUrls(creator).map(resolveMediaUrl).filter(Boolean);
    setUgcVideosModal({
      open: true,
      creator,
      videos,
    });
  };

  const closeUgcVideosModal = () => {
    setUgcVideosModal({
      open: false,
      creator: null,
      videos: [],
    });
  };

  const isLikelyVideoUrl = (url) => looksLikeVideoUrl(url);

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

  const uploadCampaignMessageAttachment = async (file) => {
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
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`Failed to upload ${file.name || 'attachment'}`);
    }

    return {
      objectPath: signedUrlData.objectPath,
      fileName: file.name || 'Attachment',
      contentType: file.type || 'application/octet-stream',
      fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
    };
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
      setContentForm((prev) => {
        if (prev.submissionStage === 'draft') {
          return { ...prev, link: objectPath };
        }
        return {
          ...prev,
          uploadedLink: objectPath,
          link: prev.link || objectPath,
        };
      });
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

  const closeCalendarEventModal = () => {
    setCalendarEventModal({
      open: false,
      mode: 'create',
      eventId: null,
      title: '',
      eventDate: '',
      eventTime: '',
      description: '',
      saving: false,
      error: '',
    });
  };

  const openCreateCalendarEventModal = () => {
    const fallbackDate =
      toCalendarDayKey(new Date()) ||
      campaign?.timeline?.start ||
      campaign?.startDate ||
      '';
    setCalendarEventModal({
      open: true,
      mode: 'create',
      eventId: null,
      title: '',
      eventDate: fallbackDate,
      eventTime: '',
      description: '',
      saving: false,
      error: '',
    });
  };

  const openEditCalendarEventModal = (event) => {
    if (!event) return;
    setCalendarEventModal({
      open: true,
      mode: 'edit',
      eventId: event.persistedId || event.id,
      title: event.title || '',
      eventDate: String(event.eventDate || '').slice(0, 10),
      eventTime: String(event.eventTime || '').slice(0, 5),
      description: event.description || '',
      saving: false,
      error: '',
    });
  };

  const refreshCustomCalendarEvents = async () => {
    if (!campaignId) return;
    const data = await campaignsApi.listEvents(campaignId);
    setCustomCalendarEvents(Array.isArray(data?.data) ? data.data : []);
  };

  const refreshCampaignMessages = async () => {
    if (!campaignId) return;
    const data = await campaignsApi.listMessages(campaignId);
    setCampaignMessages(Array.isArray(data?.data) ? data.data : []);
    setCampaignMessagesError('');
  };

  const insertCampaignMessageEmoji = (emoji) => {
    const value = String(emoji || '');
    if (!value) return;

    const input = campaignMessageInputRef.current;
    if (!input) {
      setCampaignMessageDraft((prev) => `${prev}${value}`);
      setCampaignMessageSendError('');
      setCampaignEmojiPickerOpen(false);
      return;
    }

    const start = input.selectionStart ?? campaignMessageDraft.length;
    const end = input.selectionEnd ?? campaignMessageDraft.length;
    const nextValue = `${campaignMessageDraft.slice(0, start)}${value}${campaignMessageDraft.slice(end)}`;
    const nextCaret = start + value.length;

    setCampaignMessageDraft(nextValue);
    setCampaignMessageSendError('');
    setCampaignEmojiPickerOpen(false);

    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const removeCampaignMessageAttachment = (attachmentId) => {
    setCampaignMessageAttachments((prev) =>
      prev.filter((attachment) => attachment.id !== attachmentId)
    );
    if (campaignMessageSendError) {
      setCampaignMessageSendError('');
    }
  };

  const handleCampaignMessageAttachmentSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_CAMPAIGN_MESSAGE_ATTACHMENTS - campaignMessageAttachments.length;
    if (files.length > remainingSlots) {
      setCampaignMessageSendError(
        `You can attach up to ${MAX_CAMPAIGN_MESSAGE_ATTACHMENTS} files per message.`
      );
      return;
    }

    setCampaignMessageSendError('');
    const queuedAttachments = files.map((file) => ({
      id: makeId('campaign-attachment'),
      fileName: file.name || 'Attachment',
      contentType: file.type || 'application/octet-stream',
      fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
      objectPath: '',
      status: 'uploading',
      error: '',
    }));

    setCampaignMessageAttachments((prev) => [...prev, ...queuedAttachments]);

    queuedAttachments.forEach(async (attachment, index) => {
      try {
        const uploaded = await uploadCampaignMessageAttachment(files[index]);
        setCampaignMessageAttachments((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  ...uploaded,
                  status: 'ready',
                  error: '',
                }
              : item
          )
        );
      } catch (error) {
        setCampaignMessageAttachments((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  status: 'error',
                  error: error?.message || 'Failed to upload attachment.',
                }
              : item
          )
        );
      }
    });
  };

  const submitCalendarEvent = async () => {
    if (!canManageCalendar || !campaignId) return;
    const title = String(calendarEventModal.title || '').trim();
    const eventDate = String(calendarEventModal.eventDate || '').trim();
    const eventTime = String(calendarEventModal.eventTime || '').trim();
    const description = String(calendarEventModal.description || '').trim();

    if (!title) {
      setCalendarEventModal((prev) => ({ ...prev, error: 'Title is required.' }));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      setCalendarEventModal((prev) => ({
        ...prev,
        error: 'Date is required in YYYY-MM-DD format.',
      }));
      return;
    }
    if (eventTime && !/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.test(eventTime)) {
      setCalendarEventModal((prev) => ({
        ...prev,
        error: 'Time must be in HH:MM format.',
      }));
      return;
    }

    setCalendarEventModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const payload = {
        title,
        eventDate,
        eventTime,
        description,
      };
      if (calendarEventModal.mode === 'edit' && calendarEventModal.eventId) {
        await campaignsApi.updateEvent({
          campaignId,
          eventId: calendarEventModal.eventId,
          payload,
        });
      } else {
        await campaignsApi.createEvent({ campaignId, payload });
      }
      await refreshCustomCalendarEvents();
      closeCalendarEventModal();
    } catch (error) {
      setCalendarEventModal((prev) => ({
        ...prev,
        saving: false,
        error: error?.message || 'Failed to save event.',
      }));
    }
  };

  const submitCampaignMessage = async () => {
    if (!campaignId) return;
    const body = String(campaignMessageDraft || '').trim();
    const attachments = campaignMessageAttachments.filter((attachment) => attachment.status === 'ready');

    if (campaignMessageHasUploadingAttachments) {
      setCampaignMessageSendError('Wait for attachments to finish uploading before sending.');
      return;
    }
    if (campaignMessageHasFailedAttachments) {
      setCampaignMessageSendError('Remove failed attachments before sending.');
      return;
    }
    if (!body && attachments.length === 0) {
      setCampaignMessageSendError('Message or attachment is required.');
      return;
    }

    setCampaignMessageSending(true);
    setCampaignMessageSendError('');
    try {
      await campaignsApi.createMessage({
        campaignId,
        payload: {
          body,
          attachments: attachments.map((attachment) => ({
            objectPath: attachment.objectPath,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            fileSize: attachment.fileSize,
          })),
        },
      });
      setCampaignMessageDraft('');
      setCampaignMessageAttachments([]);
      setCampaignEmojiPickerOpen(false);
      await refreshCampaignMessages();
    } catch (error) {
      setCampaignMessageSendError(error?.message || 'Failed to send message.');
    } finally {
      setCampaignMessageSending(false);
    }
  };

  const deleteCalendarEvent = async (eventId) => {
    if (!canManageCalendar || !campaignId || !eventId) return;
    try {
      await campaignsApi.deleteEvent({ campaignId, eventId });
      await refreshCustomCalendarEvents();
    } catch (error) {
      setCustomCalendarEventsError(error?.message || 'Failed to delete event.');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.creator || !rejectReason.trim()) return;
    try {
      await campaignsApi.updateCreatorDecision({
        campaignId: campaign.id,
        creatorId: rejectModal.creator.id,
        payload: { decision: 'rejected', note: rejectReason },
      });
      closeRejectModal();
      await refreshCampaignCreators();
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
    if (!addContentModal.creator) return;
    if (contentUploadState.uploading) return;

    const submissionStage =
      String(contentForm.submissionStage || '').trim().toLowerCase() === 'draft'
        ? 'draft'
        : 'final';
    const contentLink = String(contentForm.link || '').trim();
    const uploadedLink = String(contentForm.uploadedLink || '').trim();
    const resolvedLink = contentLink;

    if (submissionStage === 'draft' && !resolvedLink) {
      setContentUploadState((prev) => ({
        ...prev,
        error: 'Please upload a draft video.',
      }));
      return;
    }
    if (submissionStage === 'final' && !resolvedLink) {
      setContentUploadState((prev) => ({
        ...prev,
        error: 'Content link is required for final submission.',
      }));
      return;
    }

    try {
      const localContentType = submissionStage === 'draft' ? 'Draft Video' : 'Video';
      const inferredPlatform = inferSubmittedContentPlatform(
        resolvedLink || uploadedLink,
        campaign?.platforms
      );
      const localAssets =
        submissionStage === 'final'
          ? [
              { url: resolvedLink, label: 'Final content link' },
              ...(uploadedLink && uploadedLink !== resolvedLink
                ? [{ url: uploadedLink, label: 'Uploaded final video (optional)' }]
                : []),
            ]
          : [{ url: resolvedLink, label: 'Draft video upload' }];
      const newContent = {
        id: makeId('content'),
        campaignId: campaign.id,
        creatorId: addContentModal.creator.id,
        platform: inferredPlatform,
        type: localContentType,
        caption: contentForm.notes || '',
        hashtags: '',
        assets: localAssets,
        status: submissionStage === 'draft' ? 'Draft' : 'Pending Review',
        revisionCount: 0,
        feedback: [],
        createdAt: new Date().toISOString(),
      };

      await campaignsApi.updateCreatorWorkflow({
        campaignId: campaign.id,
        creatorId: addContentModal.creator.id,
        payload: {
          finalVideoLink: resolvedLink,
          submissionStage,
          submissionType: localContentType,
          uploadedVideoLink: submissionStage === 'final' ? uploadedLink || null : null,
          notes:
            [
              contentForm.notes || (submissionStage === 'draft' ? 'Draft submission' : 'Final submission'),
              submissionStage === 'final' && uploadedLink && uploadedLink !== resolvedLink
                ? `Uploaded file: ${uploadedLink}`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
        },
      });

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
    const data = await updateCampaignMutation.mutateAsync({
      campaignId,
      payload: {
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
      },
    });
    const updatedCampaign = data?.data || data;
    dispatch({ type: 'UPDATE_CAMPAIGN', payload: updatedCampaign });
    closeEditModal();
    return updatedCampaign;
  };

  const campaignType = normalizedCampaignType;
  const campaignStageType = campaignType;
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
  const campaignTierCriteriaLabel = campaignTierCriteria
    .map((tier) => CAMPAIGN_TIER_LABELS[tier] || tier)
    .join(', ');
  const campaignPlatformCriteriaLabel = campaignPlatformCriteria
    .map((platform) => platform.charAt(0).toUpperCase() + platform.slice(1))
    .join(', ');
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
  const resolveCreatorById = (creatorId) =>
    creatorMap.get(creatorId) ||
    creatorMap.get(Number(creatorId)) ||
    shortlistCreators.find((item) => String(item.id) === creatorId);
  const creatorSubmissionSummaryById = useMemo(() => {
    const summaryById = {};

    analyticsCreatorIds.forEach((creatorId) => {
      const creatorKey = String(creatorId);
      const workflowEntry = creatorState.outreach?.[creatorKey] || {};
      const entries = [];

      campaignContent
        .filter((item) => String(item.creatorId) === creatorKey)
        .forEach((item, index) => {
          const stage = inferSubmissionStage(item);
          const createdAt = item.createdAt || item.submittedAt || '';
          const defaultStatus =
            String(item.status || '').trim() || (stage === 'Draft' ? 'Draft' : 'Pending Review');
          const registerEntry = (link, options = {}) => {
            const resolvedLink = resolveMediaUrl(link);
            if (!resolvedLink) return;
            entries.push({
              id: options.id || `${creatorKey}-submission-${index}-${entries.length}`,
              link: resolvedLink,
              stage,
              kind: looksLikeVideoUrl(resolvedLink) ? 'Video' : 'URL',
              type: options.type || formatVideoType(item.type),
              status: options.status || defaultStatus,
              platform:
                options.platform ||
                item.platform ||
                inferSubmittedContentPlatform(resolvedLink, campaign?.platforms),
              createdAt,
              source: options.source || 'content',
            });
          };

          const primaryLink = resolveMediaUrl(extractContentLink(item));
          registerEntry(primaryLink, {
            id: item.id || `${creatorKey}-content-${index}`,
          });

          extractUploadedLinksFromNotes(item.notes).forEach((uploadedLink, uploadedIndex) => {
            if (resolveMediaUrl(uploadedLink) === primaryLink) return;
            registerEntry(uploadedLink, {
              id: `${item.id || `${creatorKey}-content-${index}`}-upload-${uploadedIndex}`,
              type: stage === 'Draft' ? 'Draft Video' : 'Uploaded Video',
              source: 'content-upload',
            });
          });
        });

      const workflowVideoLink = resolveMediaUrl(workflowEntry.finalVideoLink);
      if (workflowVideoLink) {
        entries.push({
          id: `${creatorKey}-workflow`,
          link: workflowVideoLink,
          stage: 'Final',
          kind: looksLikeVideoUrl(workflowVideoLink) ? 'Video' : 'URL',
          type: 'Video',
          status: workflowEntry.workflowStatus || 'Submitted',
          platform: inferSubmittedContentPlatform(workflowVideoLink, campaign?.platforms),
          createdAt: '',
          source: 'workflow',
        });
      }

      const seen = new Set();
      const dedupedEntries = entries
        .filter((entry) => entry.link)
        .sort(compareSubmissionEntries)
        .filter((entry) => {
          const dedupeKey = `${String(entry.stage || '').toLowerCase()}::${String(entry.link || '')
            .trim()
            .toLowerCase()}`;
          if (seen.has(dedupeKey)) return false;
          seen.add(dedupeKey);
          return true;
        });

      summaryById[creatorKey] = {
        entries: dedupedEntries,
        latestEntry: dedupedEntries[0] || null,
        totalCount: dedupedEntries.length,
        hasDraft: dedupedEntries.some((entry) => entry.stage === 'Draft'),
        hasFinal: dedupedEntries.some((entry) => entry.stage === 'Final'),
      };
    });

    return summaryById;
  }, [analyticsCreatorIds, campaignContent, creatorState.outreach, campaign?.platforms]);
  const getCreatorSubmissionSummary = (creatorId) =>
    creatorSubmissionSummaryById[String(creatorId)] || EMPTY_CREATOR_SUBMISSION_SUMMARY;
  const campaignCalendarEvents = useMemo(() => {
    const events = [];
    const usedMilestoneDates = new Set();
    const pushMilestone = (id, dateValue, title, subtitle = '') => {
      const parsedDate = parseCalendarDate(dateValue);
      if (!parsedDate) return;
      const key = toCalendarDayKey(parsedDate);
      if (usedMilestoneDates.has(`${id}:${key}`)) return;
      usedMilestoneDates.add(`${id}:${key}`);
      events.push({
        id: `${id}-${key}`,
        date: parsedDate,
        dayKey: key,
        eventDate: key,
        eventTime: '',
        title,
        subtitle,
        type: 'milestone',
        description: '',
        custom: false,
        tone: 'milestone',
      });
    };

    const campaignStartDate =
      parseCalendarDate(campaign.timeline?.start) || parseCalendarDate(campaign.startDate);
    const campaignEndDate =
      parseCalendarDate(campaign.timeline?.end) || parseCalendarDate(campaign.endDate);

    pushMilestone('kickoff', campaignStartDate, 'Campaign kickoff', campaign.name || '');
    pushMilestone('launch', campaignEndDate, 'Target publish date', campaign.name || '');

    if (campaignStartDate && campaignEndDate && campaignEndDate > campaignStartDate) {
      const totalDays = Math.max(
        1,
        Math.round((campaignEndDate.getTime() - campaignStartDate.getTime()) / DAY_IN_MS)
      );
      const checkpoints = [
        { id: 'sourcing', title: 'Creator sourcing checkpoint', progress: 0.25 },
        { id: 'filming', title: 'Filming checkpoint', progress: 0.6 },
        { id: 'review', title: 'Final review checkpoint', progress: 0.85 },
      ];
      checkpoints.forEach((checkpoint) => {
        const dayOffset = Math.max(1, Math.min(totalDays - 1, Math.round(totalDays * checkpoint.progress)));
        const date = addCalendarDays(campaignStartDate, dayOffset);
        pushMilestone(checkpoint.id, date, checkpoint.title, campaign.name || '');
      });
    }

    campaignContent.forEach((item, index) => {
      const contentDate = parseCalendarDate(item.createdAt || item.created_at);
      if (!contentDate) return;
      const creatorId = item.creatorId == null ? '' : String(item.creatorId);
      const creator = resolveCreatorById(creatorId);
      const creatorName = creator?.name || creator?.display_name || 'Creator';
      const platform = String(item.platform || '').trim();
      const status = String(item.status || '').trim().toLowerCase();
      const isPublished = status === 'published';
      const dayKey = toCalendarDayKey(contentDate);
      events.push({
        id: `content-${item.id || `${creatorId || 'creator'}-${index}`}`,
        date: contentDate,
        dayKey,
        eventDate: dayKey,
        eventTime: '',
        title: isPublished ? 'Content published' : 'Content submitted',
        subtitle: `${creatorName}${platform ? ` · ${platform}` : ''}`,
        type: isPublished ? 'published' : 'submission',
        description: '',
        custom: false,
        tone: isPublished ? 'published' : 'submission',
      });
    });

    customCalendarEvents.forEach((event, index) => {
      const parsedDate = parseCalendarDate(event.eventDate || event.date);
      if (!parsedDate) return;
      const dayKey = toCalendarDayKey(parsedDate);
      const eventTime = String(event.eventTime || event.event_time || '').trim().slice(0, 5);
      const timeLabel = formatEventTime(eventTime);
      const description = String(event.description || '').trim();
      events.push({
        id: `custom-${event.id || index}`,
        persistedId: event.id || null,
        date: parsedDate,
        dayKey,
        eventDate: dayKey,
        eventTime,
        title: event.title || 'Event',
        subtitle: [timeLabel, description].filter(Boolean).join(' · '),
        description,
        custom: true,
        tone: 'milestone',
      });
    });

    if (events.length === 0) {
      const createdDate = parseCalendarDate(campaign.createdAt || campaign.created_at);
      if (createdDate) {
        events.push({
          id: `created-${campaign.id}`,
          date: createdDate,
          dayKey: toCalendarDayKey(createdDate),
          eventDate: toCalendarDayKey(createdDate),
          eventTime: '',
          title: 'Campaign created',
          subtitle: campaign.name || '',
          type: 'milestone',
          description: '',
          custom: false,
          tone: 'milestone',
        });
      }
    }

    return events.sort((left, right) => {
      const dateDelta = left.date.getTime() - right.date.getTime();
      if (dateDelta !== 0) return dateDelta;
      const leftTime = parseEventTimeToMinutes(left.eventTime);
      const rightTime = parseEventTimeToMinutes(right.eventTime);
      const leftSortTime = leftTime == null ? Number.MAX_SAFE_INTEGER : leftTime;
      const rightSortTime = rightTime == null ? Number.MAX_SAFE_INTEGER : rightTime;
      const timeDelta = leftSortTime - rightSortTime;
      if (timeDelta !== 0) return timeDelta;
      return String(left.title || '').localeCompare(String(right.title || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }, [
    campaign.id,
    campaign.name,
    campaign.startDate,
    campaign.endDate,
    campaign.timeline?.start,
    campaign.timeline?.end,
    campaign.createdAt,
    campaign.created_at,
    campaignContent,
    customCalendarEvents,
    creatorMap,
    shortlistCreators,
  ]);
  const campaignCalendarEventsByDay = useMemo(() => {
    const map = new Map();
    campaignCalendarEvents.forEach((event) => {
      if (!event.dayKey) return;
      const current = map.get(event.dayKey) || [];
      current.push(event);
      map.set(event.dayKey, current);
    });
    return map;
  }, [campaignCalendarEvents]);
  const calendarDayCells = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      monthStart.getDate() - mondayOffset
    );
    const todayKey = toCalendarDayKey(new Date());
    return Array.from({ length: 42 }, (_, index) => {
      const date = addCalendarDays(gridStart, index);
      const dayKey = toCalendarDayKey(date);
      return {
        key: dayKey,
        date,
        events: campaignCalendarEventsByDay.get(dayKey) || [],
        isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
        isToday: dayKey === todayKey,
      };
    });
  }, [calendarMonth, campaignCalendarEventsByDay]);
  const upcomingCalendarEvents = useMemo(() => {
    const today = parseCalendarDate(new Date());
    const upcoming = campaignCalendarEvents.filter(
      (event) => today && event.date.getTime() >= today.getTime()
    );
    return (upcoming.length > 0 ? upcoming : campaignCalendarEvents).slice(0, 10);
  }, [campaignCalendarEvents]);
  const calendarMonthLabel = calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
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
  const calendarCard = (
    <section className="detail-card campaign-calendar-section">
      <div className="detail-card-header">
        <div>
          <h3>Campaign Calendar</h3>
          <p className="section-description">
            A simple timeline for milestones, submissions, and launch checkpoints.
          </p>
        </div>
        <div className="campaign-calendar-header-actions">
          <div className="campaign-calendar-legend">
            <span className="campaign-calendar-legend-item">
              <i className="campaign-calendar-dot tone-milestone" />
              Milestone
            </span>
            <span className="campaign-calendar-legend-item">
              <i className="campaign-calendar-dot tone-submission" />
              Submission
            </span>
            <span className="campaign-calendar-legend-item">
              <i className="campaign-calendar-dot tone-published" />
              Published
            </span>
          </div>
          {canManageCalendar ? (
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={openCreateCalendarEventModal}
            >
              Add Event
            </button>
          ) : null}
        </div>
      </div>
      <div className="detail-card-content campaign-calendar-content">
        <div className="campaign-calendar-layout">
          <article className="campaign-calendar-panel">
            <div className="campaign-calendar-toolbar">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                aria-label="Previous month"
              >
                ←
              </button>
              <strong>{calendarMonthLabel}</strong>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <div className="campaign-calendar-weekdays">
              {CALENDAR_WEEKDAYS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="campaign-calendar-grid">
              {calendarDayCells.map((cell) => (
                <div
                  key={cell.key}
                  className={[
                    'campaign-calendar-day',
                    cell.isCurrentMonth ? '' : 'is-outside',
                    cell.isToday ? 'is-today' : '',
                    cell.events.length > 0 ? 'has-events' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="campaign-calendar-day-number">{cell.date.getDate()}</span>
                  {cell.events.length > 0 ? (
                    <div className="campaign-calendar-day-dots">
                      {cell.events.slice(0, 3).map((event, index) => (
                        <i
                          key={`${cell.key}-${event.id}-${index}`}
                          className={`campaign-calendar-dot tone-${event.tone}`}
                        />
                      ))}
                      {cell.events.length > 3 ? (
                        <span className="campaign-calendar-day-more">+{cell.events.length - 3}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>

          <aside className="campaign-calendar-timeline">
            <div className="campaign-calendar-timeline-head">
              <h4>Timeline</h4>
              <span>{campaignCalendarEvents.length} events</span>
            </div>
            <p className="campaign-calendar-help">
              Use this to align creator actions, approvals, and delivery windows.
            </p>
            {customCalendarEventsLoading ? (
              <p className="creator-social-empty">Loading events...</p>
            ) : null}
            {customCalendarEventsError ? (
              <p className="error-text">{customCalendarEventsError}</p>
            ) : null}
            {upcomingCalendarEvents.length > 0 ? (
              <ul className="campaign-calendar-event-list">
                {upcomingCalendarEvents.map((event, index) => (
                  <li key={`${event.id}-${index}`} className="campaign-calendar-event-item">
                    <i className={`campaign-calendar-dot tone-${event.tone}`} />
                    <div className="campaign-calendar-event-copy">
                      <strong>{event.title}</strong>
                      <span>
                        {formatShortDate(event.date)}
                        {event.subtitle ? ` · ${event.subtitle}` : ''}
                      </span>
                    </div>
                    {event.custom && canManageCalendar ? (
                      <div className="campaign-calendar-event-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => openEditCalendarEventModal(event)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => deleteCalendarEvent(event.persistedId)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="creator-social-empty">No campaign events yet.</p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );

  const messagesCard = (
    <section className="detail-card campaign-messages-section">
      <div className="detail-card-header">
        <div>
          <h3>Messages</h3>
          <p className="section-description">
            Keep campaign communication in one thread for the brand and admin team.
          </p>
        </div>
        <div className="campaign-messages-header-actions">
          <span className="campaign-meta-chip">{campaignMessages.length} messages</span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={refreshCampaignMessages}
            disabled={campaignMessagesLoading || campaignMessageSending}
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="detail-card-content campaign-messages-content">
        <div className="campaign-messages-shell">
          <div
            ref={campaignMessagesViewportRef}
            className="campaign-messages-thread"
            onScroll={(event) => {
              const element = event.currentTarget;
              const distanceFromBottom =
                element.scrollHeight - element.scrollTop - element.clientHeight;
              shouldStickMessagesToBottomRef.current = distanceFromBottom < 72;
            }}
          >
            <div className="campaign-messages-thread-intro">
              <strong>{campaign.name || 'Campaign thread'}</strong>
              <span>Shared between the brand and the admin team.</span>
            </div>
            {campaignMessagesLoading ? (
              <p className="creator-social-empty">Loading messages...</p>
            ) : null}
            {campaignMessagesError ? <p className="error-text">{campaignMessagesError}</p> : null}
            {!campaignMessagesLoading && !campaignMessagesError && campaignMessages.length === 0 ? (
              <div className="campaign-messages-empty">
                <p className="creator-social-empty">
                  No messages yet. Start the thread for this campaign.
                </p>
              </div>
            ) : null}
            {campaignMessages.length > 0 ? (
              <ul className="campaign-message-list">
                {campaignMessages.map((message) => {
                  const isOwnMessage = sessionUser?.id && sessionUser.id === message.senderUserId;
                  const messageAttachments = Array.isArray(message.attachments)
                    ? message.attachments
                    : [];
                  return (
                    <li
                      key={message.id}
                      className={[
                        'campaign-message-item',
                        isOwnMessage ? 'is-own' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {!isOwnMessage ? (
                        <div className="campaign-message-sender">
                          <strong>{message.senderName || 'Workspace member'}</strong>
                          <span className="campaign-message-role">
                            {formatMessageRole(message.senderRole)}
                          </span>
                        </div>
                      ) : null}
                      <div className="campaign-message-bubble">
                        {messageAttachments.length > 0 ? (
                          <div className="campaign-message-attachments">
                            {messageAttachments.map((attachment, index) => {
                              const attachmentUrl = resolveMediaUrl(attachment.objectPath);
                              const attachmentKind = getCampaignMessageAttachmentKind(attachment);
                              const attachmentLabel = attachment.fileName || `Attachment ${index + 1}`;
                              const attachmentMeta = formatFileSize(attachment.fileSize);

                              if (attachmentKind === 'image') {
                                return (
                                  <a
                                    key={attachment.id || `${message.id}-attachment-${index}`}
                                    className="campaign-message-attachment campaign-message-attachment-image"
                                    href={attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img src={attachmentUrl} alt={attachmentLabel} loading="lazy" />
                                    <span className="campaign-message-attachment-caption">
                                      <strong>{attachmentLabel}</strong>
                                      {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                    </span>
                                  </a>
                                );
                              }

                              if (attachmentKind === 'video') {
                                return (
                                  <div
                                    key={attachment.id || `${message.id}-attachment-${index}`}
                                    className="campaign-message-attachment campaign-message-attachment-video"
                                  >
                                    <video controls preload="metadata" src={attachmentUrl} />
                                    <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                      <strong>{attachmentLabel}</strong>
                                      {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                    </a>
                                  </div>
                                );
                              }

                              if (attachmentKind === 'audio') {
                                return (
                                  <div
                                    key={attachment.id || `${message.id}-attachment-${index}`}
                                    className="campaign-message-attachment campaign-message-attachment-audio"
                                  >
                                    <audio controls preload="none" src={attachmentUrl} />
                                    <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                      <strong>{attachmentLabel}</strong>
                                      {attachmentMeta ? <span>{attachmentMeta}</span> : null}
                                    </a>
                                  </div>
                                );
                              }

                              return (
                                <a
                                  key={attachment.id || `${message.id}-attachment-${index}`}
                                  className="campaign-message-attachment campaign-message-attachment-file"
                                  href={attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <strong>{attachmentLabel}</strong>
                                  <span>{attachmentMeta || 'Open file'}</span>
                                </a>
                              );
                            })}
                          </div>
                        ) : null}
                        {message.body ? <p className="campaign-message-bubble-copy">{message.body}</p> : null}
                        <div className="campaign-message-meta">
                          {isOwnMessage ? (
                            <span className="campaign-message-role">
                              {formatMessageRole(message.senderRole)}
                            </span>
                          ) : null}
                          <time>{formatDateTime(message.createdAt)}</time>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div ref={campaignMessagesBottomRef} />
          </div>

          <form
            className="campaign-message-compose-card"
            onSubmit={(event) => {
              event.preventDefault();
              submitCampaignMessage();
            }}
          >
            <input
              ref={campaignMessageAttachmentInputRef}
              type="file"
              hidden
              multiple
              accept={CAMPAIGN_MESSAGE_ATTACHMENT_ACCEPT}
              onChange={handleCampaignMessageAttachmentSelect}
            />
            <div className="campaign-message-compose-head">
              <h4>Send message</h4>
              <span>
                New messages also show up in notifications for this campaign.
              </span>
            </div>
            <div className="campaign-message-compose-toolbar">
              <div className="campaign-message-compose-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setCampaignEmojiPickerOpen((prev) => !prev)}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => campaignMessageAttachmentInputRef.current?.click()}
                  disabled={
                    campaignMessageSending ||
                    campaignMessageAttachments.length >= MAX_CAMPAIGN_MESSAGE_ATTACHMENTS
                  }
                >
                  Attach files
                </button>
              </div>
              <span>
                Images, videos, audio, PDFs, docs, and other files stay attached to this campaign
                thread.
              </span>
            </div>
            {campaignEmojiPickerOpen ? (
              <div className="campaign-message-emoji-picker">
                {CAMPAIGN_MESSAGE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="campaign-message-emoji-button"
                    onClick={() => insertCampaignMessageEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
            {campaignMessageAttachments.length > 0 ? (
              <ul className="campaign-message-draft-attachments">
                {campaignMessageAttachments.map((attachment) => {
                  const attachmentKind = getCampaignMessageAttachmentKind(attachment);
                  const attachmentUrl = attachment.objectPath
                    ? resolveMediaUrl(attachment.objectPath)
                    : '';
                  const statusLabel =
                    attachment.status === 'uploading'
                      ? 'Uploading...'
                      : attachment.status === 'error'
                        ? attachment.error || 'Upload failed'
                        : formatFileSize(attachment.fileSize) || 'Ready';

                  return (
                    <li
                      key={attachment.id}
                      className={[
                        'campaign-message-draft-attachment',
                        attachment.status === 'error' ? 'is-error' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="campaign-message-draft-attachment-main">
                        {attachmentKind === 'image' && attachmentUrl ? (
                          <img
                            className="campaign-message-draft-attachment-thumb"
                            src={attachmentUrl}
                            alt={attachment.fileName || 'Attachment'}
                          />
                        ) : (
                          <div className="campaign-message-draft-attachment-badge">
                            {attachmentKind === 'video'
                              ? 'Video'
                              : attachmentKind === 'audio'
                                ? 'Audio'
                                : 'File'}
                          </div>
                        )}
                        <div className="campaign-message-draft-attachment-copy">
                          <strong>{attachment.fileName || 'Attachment'}</strong>
                          <span>{statusLabel}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="campaign-message-draft-attachment-remove"
                        onClick={() => removeCampaignMessageAttachment(attachment.id)}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="campaign-message-compose-row">
              <textarea
                ref={campaignMessageInputRef}
                className="input"
                rows={3}
                value={campaignMessageDraft}
                onChange={(event) => {
                  setCampaignMessageDraft(event.target.value);
                  if (campaignMessageSendError) {
                    setCampaignMessageSendError('');
                  }
                }}
                placeholder="Write a campaign update, question, approval note, or send files..."
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={campaignMessageSending || campaignMessageHasUploadingAttachments}
              >
                {campaignMessageSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {campaignMessageSendError ? (
              <p className="field-error">{campaignMessageSendError}</p>
            ) : null}
            <p className="campaign-message-compose-hint">
              Emojis work in text, and file uploads use the same protected object storage as other
              app media.
            </p>
          </form>
        </div>
      </div>
    </section>
  );

  const brandCreatorTypeSections = [
    { key: 'influencer', type: 'influencer', label: 'Influencer Creators', tone: 'influencer' },
    { key: 'ugc', type: 'ugc', label: 'UGC Creators', tone: 'ugc' },
  ];

  const getBrandCampaignWorkflowStatus = (creator) =>
    creatorState.outreach?.[creator.id]?.workflowStatus || creatorStageOptions[0] || 'Sourced';

  const renderBrandCreatorStatusCell = (creator) => {
    const decision = creatorState.approvals?.[creator.id] || 'Suggested';
    if (decision !== 'Brand Approved') {
      return null;
    }
    const workflowStatus = getBrandCampaignWorkflowStatus(creator);
    return (
      <div className="brand-creator-status-cell">
        <StatusPill status={workflowStatus} />
      </div>
    );
  };

  const renderSubmissionActionButton = (
    entry,
    creatorName,
    { videoLabel = 'Preview Video', linkLabel = 'Open Link' } = {}
  ) => {
    const submissionLink = resolveMediaUrl(entry?.link);
    if (!submissionLink) return null;

    if (looksLikeVideoUrl(submissionLink)) {
      return (
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() =>
            openVideoPreview(
              submissionLink,
              `${creatorName || 'Creator'} - ${String(entry?.stage || 'Submitted').toLowerCase()} upload`
            )
          }
        >
          {videoLabel}
        </button>
      );
    }

    return (
      <a
        href={submissionLink}
        className="btn btn-secondary btn-small"
        target="_blank"
        rel="noreferrer"
      >
        {linkLabel}
      </a>
    );
  };

  const renderBrandCreatorContentCell = (creator) => {
    const summary = getCreatorSubmissionSummary(creator.id);
    const latestEntry = summary.latestEntry;

    if (!latestEntry) {
      return (
        <div className="creator-submission-summary creator-submission-summary-empty">
          <span>No upload yet</span>
        </div>
      );
    }

    const dateLabel = formatShortDate(latestEntry.createdAt);
    const summaryLabel =
      summary.totalCount > 1
        ? `${summary.totalCount} uploads`
        : latestEntry.stage === 'Draft'
          ? 'Draft uploaded'
          : latestEntry.kind === 'Video'
            ? 'Video uploaded'
            : 'Link submitted';

    return (
      <div className="creator-submission-summary">
        <div className="creator-submission-summary-badges">
          <span className={`creator-submission-badge creator-submission-badge-${latestEntry.stage.toLowerCase()}`}>
            {latestEntry.stage}
          </span>
          <span className="creator-submission-badge creator-submission-badge-kind">
            {latestEntry.kind}
          </span>
        </div>
        <span className="creator-submission-summary-copy">
          {summaryLabel}
          {dateLabel ? ` · ${dateLabel}` : ''}
        </span>
      </div>
    );
  };

  const renderBrandCreatorMeta = (creator) => {
    const creatorTypeKey = inferCreatorType(creator);
    const followers = formatCompactFollowers(creator?.followers ?? creator?.followers_count);
    const niche = creator?.niche || creator?.category || 'General';
    if (creatorTypeKey !== 'ugc' && followers !== '—') {
      return `${followers} followers · ${niche}`;
    }
    return niche;
  };

  const getBrandCreatorColumns = ({ includeStatus = true, includeContent = false } = {}) => [
    ...(includeStatus
      ? [
          {
            key: 'status',
            label: 'Campaign Status',
            raw: true,
            className: 'creator-list-v3-metric-status',
            render: (creator) => renderBrandCreatorStatusCell(creator),
          },
        ]
      : []),
    ...(includeContent
      ? [
          {
            key: 'submission',
            label: 'Latest Upload',
            raw: true,
            className: 'creator-list-v3-metric-submission',
            render: (creator) => renderBrandCreatorContentCell(creator),
          },
        ]
      : []),
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
    const summary = getCreatorSubmissionSummary(creator.id);
    const latestEntry = summary.latestEntry;
    if (!latestEntry) {
      return (
        <>
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
        {renderSubmissionActionButton(latestEntry, creator.name || creator.display_name || 'Creator', {
          videoLabel: latestEntry.stage === 'Draft' ? 'Preview Draft' : 'Preview Upload',
          linkLabel: latestEntry.stage === 'Draft' ? 'Open Draft' : 'Open Link',
        })}
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

  const renderBrandCreatorTypeSections = (
    typedCreators,
    renderActions,
    { includeStatus = true, includeContent = false } = {}
  ) =>
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
            customColumns={getBrandCreatorColumns({ includeStatus, includeContent })}
            renderMainMeta={renderBrandCreatorMeta}
            showViewButton={false}
            showSocialIcons
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
      <div className="campaign-health-row">
        <div className="campaign-health-stat">
          <strong>{shortlistCreators.length}</strong>
          <span>Creators</span>
        </div>
        <div className="campaign-health-stat approved">
          <strong>{brandCreatorBuckets.approved.length}</strong>
          <span>Approved</span>
        </div>
        <div className="campaign-health-stat pending">
          <strong>{brandCreatorBuckets.pending.length}</strong>
          <span>Pending</span>
        </div>
        <div className="campaign-health-stat content">
          <strong>{campaignContent.length}</strong>
          <span>Content pieces</span>
        </div>
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
          {platformSummary !== 'TBD' && (
            <span className="campaign-meta-chip">{platformSummary}</span>
          )}
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
            </button>
            <button
              type="button"
              className={brandTab === 'analytics' ? 'active' : undefined}
              onClick={() => setBrandTab('analytics')}
            >
              Analytics
            </button>
            <button
              type="button"
              className={brandTab === 'calendar' ? 'active' : undefined}
              onClick={() => setBrandTab('calendar')}
            >
              Calendar
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
            </button>
            <button
              type="button"
              className={adminTab === 'analytics' ? 'active' : undefined}
              onClick={() => setAdminTab('analytics')}
            >
              Analytics
            </button>
            <button
              type="button"
              className={adminTab === 'calendar' ? 'active' : undefined}
              onClick={() => setAdminTab('calendar')}
            >
              Calendar
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
      {isBrand && brandTab === 'calendar' ? calendarCard : null}
      {!isBrand && adminTab === 'overview' ? briefCard : null}
      {!isBrand && adminTab === 'analytics' ? adminAnalyticsCard : null}
      {!isBrand && adminTab === 'calendar' ? calendarCard : null}
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
            </div>
          </div>
          <div className="detail-card-content brand-creator-content">
            <div className="creator-network-filters">
              {isHybrid && (
                <div className="add-creators-modal-tabs campaign-creators-filter-tabs">
                  {[['all', 'All'], ['influencer', 'Influencers'], ['ugc', 'UGC']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`tab-button ${creatorTypeFilter === val ? 'active' : ''}`}
                      onClick={() => setCreatorTypeFilter(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
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
                  <div className="brand-creator-group brand-creator-group-pending brand-creator-group-attention">
                    <div className="brand-creator-group-header">
                      <div className="brand-creator-group-header-label">
                        <span className="brand-creator-attention-dot" />
                        <h4>Awaiting your approval</h4>
                      </div>
                      <span className="brand-creator-group-count">
                        {filteredCreatorBuckets.pending.length} creator{filteredCreatorBuckets.pending.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {renderBrandCreatorTypeSections(
                      filteredCreatorBucketsByType.pending,
                      renderBrandPendingActions,
                      { includeStatus: false, includeContent: false }
                    )}
                  </div>
                )}

                {filteredCreatorBuckets.approved.length > 0 && (
                  <div className="brand-creator-group brand-creator-group-approved">
                    <button
                      type="button"
                      className="brand-creator-group-header brand-creator-group-toggle"
                      onClick={() => setApprovedGroupExpanded((v) => !v)}
                    >
                      <h4>Approved creators</h4>
                      <span className="brand-creator-group-count">
                        {filteredCreatorBuckets.approved.length} creator{filteredCreatorBuckets.approved.length !== 1 ? 's' : ''}
                        <span className="brand-creator-toggle-icon">{approvedGroupExpanded ? '▲' : '▼'}</span>
                      </span>
                    </button>
                    {approvedGroupExpanded && renderBrandCreatorTypeSections(
                      filteredCreatorBucketsByType.approved,
                      renderBrandApprovedActions,
                      { includeStatus: true, includeContent: true }
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
                {showUGC ? (
                  <button
                    type="button"
                    className={`tab-button ${activeAdminCreatorFilterTab === 'ugc' ? 'active' : ''}`}
                    onClick={() => setAdminCreatorFilterTab('ugc')}
                  >
                    UGC Creators
                  </button>
                ) : null}
                {showInfluencer ? (
                  <button
                    type="button"
                    className={`tab-button ${activeAdminCreatorFilterTab === 'influencer' ? 'active' : ''}`}
                    onClick={() => setAdminCreatorFilterTab('influencer')}
                  >
                    Influencers
                  </button>
                ) : null}
              </div>
              <CreatorFilters
                type={activeAdminCreatorFilterTab}
                filters={
                  activeAdminCreatorFilterTab === 'ugc'
                    ? adminUgcCreatorFilters
                    : adminInfluencerCreatorFilters
                }
                onChange={
                  activeAdminCreatorFilterTab === 'ugc'
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
                <table className="campaign-admin-creators-table">
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Brand Decision</th>
                      <th>Campaign Status</th>
                      {activeAdminCreatorFilterTab === 'ugc' ? <th>Channels</th> : null}
                      <th className="campaign-admin-creators-actions-head">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'pending', label: 'Waiting Approval' },
                        { key: 'approved', label: 'Approved' },
                        { key: 'rejected', label: 'Rejected' },
                      ].flatMap((section) => {
                        const creatorsInSection = filteredAdminCreatorBuckets[section.key] || [];
                        if (creatorsInSection.length === 0) return [];
                        return [
                          <tr
                          key={`group-${section.key}`}
                          className={`campaign-admin-creators-group-row campaign-admin-creators-group-row-${section.key}`}
                        >
                          <td colSpan={activeAdminCreatorFilterTab === 'ugc' ? 5 : 4}>
                            <div className="campaign-admin-creators-group-header">
                              <h4>{section.label}</h4>
                              <span>{creatorsInSection.length} creators</span>
                            </div>
                          </td>
                          </tr>,
                          ...creatorsInSection.map((creator) => {
                            const creatorTypeKey = inferCreatorType(creator);
                            const creatorType = creatorTypeKey === 'ugc' ? 'UGC' : 'Influencer';
                            const followersLabel = formatCompactFollowers(
                              creator.followers ?? creator.followers_count
                            );
                            const audienceMeta =
                              creatorTypeKey === 'ugc' || followersLabel === '—'
                                ? `${creator.niche || creator.category || 'General'} · ${creatorType}`
                                : `${followersLabel} followers · ${creator.niche || creator.category || 'General'} · ${creatorType}`;
                            const currentDecision = creatorState.approvals?.[creator.id] || 'Suggested';
                            const isApproved = currentDecision === 'Brand Approved';
                            const isRejected = currentDecision === 'Brand Rejected';
                            const workflowStatus =
                              creatorState.outreach?.[creator.id]?.workflowStatus ||
                              creatorStageOptions[0] ||
                              'Sourced';
                            const submissionSummary = getCreatorSubmissionSummary(creator.id);
                            const latestSubmission = submissionSummary.latestEntry;
                            const decisionLabel = isApproved
                              ? 'Approved'
                              : isRejected
                                ? 'Rejected'
                                : 'Awaiting Approval';
                            const socialEntries = getCreatorSocialEntries(creator);
                            const ugcVideoUrls =
                              creatorTypeKey === 'ugc'
                                ? normalizeCreatorVideoUrls(creator).map(resolveMediaUrl).filter(Boolean)
                                : [];
                            return (
                              <tr key={`${section.key}-${creator.id}`}>
                                <td>
                                  <div className="campaign-admin-creator-cell">
                                    <img
                                      src={resolveAvatarSrc(creator.profile_image)}
                                      alt={creator.name || creator.display_name || 'Creator'}
                                      className="creator-avatar-sm"
                                      onError={handleAvatarError}
                                    />
                                    <div className="campaign-admin-creator-meta">
                                      <strong>
                                        <button
                                          type="button"
                                          className="campaign-creators-name-btn"
                                          onClick={() =>
                                            openCreatorProfile(creator, inferCreatorType(creator))
                                          }
                                        >
                                          {creator.name || creator.display_name || 'Creator'}
                                        </button>
                                      </strong>
                                      <span>{audienceMeta}</span>
                                      {socialEntries.length > 0 ? (
                                        <div className="creator-list-v3-social-icons campaign-admin-creator-social-icons">
                                          {socialEntries.map((entry) => (
                                            <a
                                              key={`${creator.id}-${entry.key}`}
                                              href={entry.href}
                                              className={`creator-list-v3-social-icon ${entry.key}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              title={entry.label}
                                              aria-label={entry.label}
                                            >
                                              <SocialPlatformIcon platform={entry.key} />
                                            </a>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <StatusPill status={decisionLabel} />
                                </td>
                                <td>
                                  {isApproved ? (
                                    <select
                                      className="input creator-status-select"
                                      value={workflowStatus}
                                      onChange={(event) =>
                                        handleWorkflowStatusUpdate(creator.id, event.target.value)
                                      }
                                      disabled={!canManageCreators}
                                    >
                                      {creatorStageOptions.map((statusLabel) => (
                                        <option key={statusLabel} value={statusLabel}>
                                          {statusLabel}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="creator-stage-pill creator-stage-pill-muted">
                                      {isRejected ? 'Not active' : 'Awaiting brand approval'}
                                    </span>
                                  )}
                                </td>
                                {activeAdminCreatorFilterTab === 'ugc' ? (
                                  <td>
                                    <button
                                      type="button"
                                      className="creator-social-link creator-social-link-button"
                                      onClick={() => openUgcVideosModal(creator)}
                                    >
                                      UGC Videos {ugcVideoUrls.length > 0 ? `(${ugcVideoUrls.length})` : ''}
                                    </button>
                                  </td>
                                ) : null}
                                <td className="campaign-admin-creators-actions">
                                  <div className="campaign-admin-creators-actions-wrap">
                                    {isApproved ? (
                                      <div
                                        className={`campaign-admin-upload-indicator${
                                          latestSubmission ? '' : ' campaign-admin-upload-indicator-empty'
                                        }`}
                                      >
                                        {latestSubmission ? (
                                          <>
                                            <div className="campaign-admin-upload-indicator-badges">
                                              <span
                                                className={`creator-submission-badge creator-submission-badge-${latestSubmission.stage.toLowerCase()}`}
                                              >
                                                {latestSubmission.stage}
                                              </span>
                                              <span className="creator-submission-badge creator-submission-badge-kind">
                                                {latestSubmission.kind}
                                              </span>
                                            </div>
                                            <span className="campaign-admin-upload-indicator-copy">
                                              {submissionSummary.totalCount > 1
                                                ? `${submissionSummary.totalCount} uploads`
                                                : latestSubmission.stage === 'Draft'
                                                  ? 'Draft ready'
                                                  : 'Upload ready'}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="campaign-admin-upload-indicator-copy">
                                            No upload yet
                                          </span>
                                        )}
                                      </div>
                                    ) : null}
                                    {isApproved && latestSubmission
                                      ? renderSubmissionActionButton(
                                          latestSubmission,
                                          creator.name || creator.display_name || 'Creator',
                                          {
                                            videoLabel:
                                              latestSubmission.stage === 'Draft'
                                                ? 'Preview Draft'
                                                : 'Preview Upload',
                                            linkLabel:
                                              latestSubmission.stage === 'Draft'
                                                ? 'Open Draft'
                                                : 'Open Link',
                                          }
                                        )
                                      : null}
                                    {canManageCreators && currentDecision === 'Suggested' ? (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={() => handleUndoSuggestCreator(creator.id)}
                                      >
                                        Undo Suggest
                                      </button>
                                    ) : null}
                                    {canManageCreators && isApproved ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-small"
                                        onClick={() => setAddContentModal({ open: true, creator })}
                                      >
                                        Add Content
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          }),
                        ];
                      })}
                    </tbody>
                  </table>
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
            {showUGC ? (
              <button
                type="button"
                className={`tab-button ${suggestTab === 'ugc' ? 'active' : ''}`}
                onClick={() => setSuggestTab('ugc')}
              >
                UGC Creators
              </button>
            ) : null}
            {showInfluencer ? (
              <button
                type="button"
                className={`tab-button ${suggestTab === 'influencer' ? 'active' : ''}`}
                onClick={() => setSuggestTab('influencer')}
              >
                Influencers
              </button>
            ) : null}
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
          {suggestTab === 'influencer' &&
          (campaignTierCriteria.length > 0 || campaignPlatformCriteria.length > 0) ? (
            <p className="muted">
              Auto-filtered by campaign brief:
              {campaignTierCriteria.length > 0 ? ` tiers (${campaignTierCriteriaLabel})` : ''}
              {campaignTierCriteria.length > 0 && campaignPlatformCriteria.length > 0 ? ' ·' : ''}
              {campaignPlatformCriteria.length > 0
                ? ` platforms (${campaignPlatformCriteriaLabel})`
                : ''}
            </p>
          ) : null}
          <div className="add-creators-modal-results">
            {loading ? (
              <div className="loading-state">Loading creators...</div>
            ) : suggestCreators.length === 0 ? (
              <EmptyState
                title="No creators found"
                description={
                  suggestTab === 'influencer' &&
                  (campaignTierCriteria.length > 0 || campaignPlatformCriteria.length > 0)
                    ? 'Try adjusting your search/filters or update campaign brief criteria.'
                    : 'Try adjusting your search or filters.'
                }
              />
            ) : (
              <div className="add-creators-modal-list">
                <div className="add-creators-modal-list-row add-creators-modal-list-head">
                  <span aria-hidden="true"></span>
                  <span>Creator</span>
                  <span>Actions</span>
                </div>
                {suggestCreators.map((creator) => {
                  const creatorTypeKey = inferCreatorType(creator);
                  const isAlreadySuggested = creatorState.shortlist.includes(creator.id);
                  const currentDecision = creatorState.approvals?.[creator.id] || 'Suggested';
                  const canUndoSuggestion = isAlreadySuggested && currentDecision === 'Suggested';
                  const canEditInfluencerRate =
                    isAdmin && creatorTypeKey === 'influencer' && !isAlreadySuggested;
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
                        {creatorTypeKey !== 'ugc' && followersLabel !== '—' ? (
                          <span>{followersLabel} followers</span>
                        ) : null}
                        <span>{creator.niche || creator.category || 'General'}</span>
                      </div>
                      <div className="add-creators-modal-actions-col">
                        {canEditInfluencerRate ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input add-creators-rate-input"
                            placeholder={formatRatePlaceholder(creator.base_rate)}
                            value={suggestInfluencerRates[creator.id] ?? ''}
                            onChange={(event) =>
                              setSuggestInfluencerRates((prev) => ({
                                ...prev,
                                [creator.id]: event.target.value,
                              }))
                            }
                          />
                        ) : null}
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

      <Modal
        open={calendarEventModal.open}
        onClose={closeCalendarEventModal}
        title={calendarEventModal.mode === 'edit' ? 'Edit Calendar Event' : 'Add Calendar Event'}
        description="Events are shared with the campaign workspace."
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitCalendarEvent();
          }}
        >
          <label>
            <span>Title *</span>
            <input
              className="input"
              value={calendarEventModal.title}
              onChange={(event) =>
                setCalendarEventModal((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Date *</span>
            <input
              className="input"
              type="date"
              value={calendarEventModal.eventDate}
              onChange={(event) =>
                setCalendarEventModal((prev) => ({ ...prev, eventDate: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Time</span>
            <input
              className="input"
              type="time"
              value={calendarEventModal.eventTime}
              onChange={(event) =>
                setCalendarEventModal((prev) => ({ ...prev, eventTime: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              className="input"
              rows={3}
              value={calendarEventModal.description}
              onChange={(event) =>
                setCalendarEventModal((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>
          {calendarEventModal.error ? <p className="field-error">{calendarEventModal.error}</p> : null}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeCalendarEventModal}
              disabled={calendarEventModal.saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={calendarEventModal.saving}>
              {calendarEventModal.saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </form>
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
            <span>Submission Stage *</span>
            <select
              className="input"
              value={contentForm.submissionStage}
              onChange={(e) =>
                {
                  const nextStage = e.target.value === 'draft' ? 'draft' : 'final';
                  setContentForm((prev) => ({
                    ...prev,
                    submissionStage: nextStage,
                    ...(nextStage === 'draft'
                      ? { link: '', uploadedLink: '' }
                      : {}),
                  }));
                  setContentUploadState((prev) => ({
                    ...prev,
                    uploading: false,
                    error: '',
                    fileName: '',
                  }));
                }
              }
            >
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </label>
          <label>
            <span>
              {contentForm.submissionStage === 'draft'
                ? 'Upload Draft Video *'
                : 'Upload Final Video (Optional)'}
            </span>
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
          {contentForm.submissionStage === 'final' ? (
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
              {contentForm.uploadedLink ? (
                <p className="muted">Optional upload path: {contentForm.uploadedLink}</p>
              ) : null}
            </label>
          ) : null}
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
            disabled={
              contentUploadState.uploading ||
              (contentForm.submissionStage === 'final'
                ? !String(contentForm.link || '').trim()
                : !String(contentForm.link || '').trim())
            }
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
        open={ugcVideosModal.open}
        onClose={closeUgcVideosModal}
        title={`${ugcVideosModal.creator?.name || ugcVideosModal.creator?.display_name || 'UGC Creator'} Videos`}
        description="Uploaded UGC videos for this creator."
        size="large"
      >
        {ugcVideosModal.videos.length === 0 ? (
          <EmptyState
            title="No videos uploaded yet"
            description="This creator does not have uploaded UGC videos yet."
          />
        ) : (
          <div className="ugc-videos-library-grid">
            {ugcVideosModal.videos.map((url, index) => (
              <article key={`${url}-${index}`} className="ugc-videos-library-card">
                <div className="ugc-videos-library-head">
                  <strong>Video {index + 1}</strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() =>
                      openVideoPreview(
                        url,
                        `${ugcVideosModal.creator?.name || ugcVideosModal.creator?.display_name || 'Creator'} - Video ${
                          index + 1
                        }`
                      )
                    }
                  >
                    Preview
                  </button>
                </div>
                {isLikelyVideoUrl(url) ? (
                  <video
                    className="ugc-videos-library-player"
                    src={url}
                    controls
                    controlsList="nodownload noplaybackrate nofullscreen"
                    disablePictureInPicture
                    onContextMenu={(event) => event.preventDefault()}
                    preload="metadata"
                  />
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-small">
                    Open Link
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeUgcVideosModal}>
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
