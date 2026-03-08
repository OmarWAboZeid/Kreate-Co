import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { handleAvatarError, resolveAvatarSrc } from '../utils/avatar.js';

const formatCompactNumber = (value) => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
};

const formatMoney = (value) => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `$${num.toLocaleString()}`;
};

const formatEngagement = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && value.includes('%')) return value;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num}%`;
};

const normalizeExternalUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

const normalizeUrlList = (value) => {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items
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

const isLikelyVideoUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('/objects/')) return true;
  if (url.startsWith('data:video/')) return true;
  return /\.(mp4|mov|m4v|webm|ogg|ogv)(\?|#|$)/i.test(url);
};

const getInitials = (name) =>
  String(name || 'Creator')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function CreatorProfileModal({ creator, type, onClose, viewerRole }) {
  useEffect(() => {
    if (!creator) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [creator]);

  if (!creator || typeof document === 'undefined') return null;

  const displayName = creator.name || creator.display_name || 'Creator';
  const initials = getInitials(displayName);
  const isInfluencer = type === 'influencer';
  const isBrandViewer = viewerRole === 'brand';
  const nicheValue = creator.niche || creator.primary_niche || creator.category || 'General';
  const regionValue = creator.region || creator.country || '—';
  const ugcVideos = isInfluencer
    ? []
    : normalizeUrlList(creator.ugc_video_urls).map(resolveMediaUrl).filter(Boolean);
  const socialLinks = [
    { label: 'TikTok', url: creator.tiktok_url },
    { label: 'Instagram', url: creator.instagram_url },
    { label: 'YouTube', url: creator.youtube_url },
    { label: 'Facebook', url: creator.facebook_url },
    ...(isInfluencer ? [{ label: 'Portfolio', url: creator.portfolio_url }] : []),
  ]
    .map((entry) => ({ ...entry, href: normalizeExternalUrl(entry.url) }))
    .filter((entry) => entry.href);
  const stats = isInfluencer
    ? [
        {
          label: 'Followers',
          value: formatCompactNumber(creator.followers ?? creator.followers_count),
        },
        {
          label: 'Engagement Rate',
          value: formatEngagement(creator.engagement_rate),
        },
        {
          label: 'Avg Views',
          value: formatCompactNumber(creator.avg_views),
        },
        {
          label: 'Region',
          value: regionValue,
        },
      ]
    : [
        {
          label: 'Rate',
          value: formatMoney(creator.base_rate),
        },
        {
          label: 'Age',
          value: creator.age || '—',
        },
        ...(!isBrandViewer
          ? [
              {
                label: 'Turnaround',
                value: creator.turnaround_time || '—',
              },
            ]
          : []),
        {
          label: 'Region',
          value: regionValue,
        },
      ];
  const detailRows = [
    { label: 'Niche', value: nicheValue },
    { label: 'Category', value: creator.category || (isInfluencer ? '—' : 'UGC') },
    { label: 'Gender', value: creator.gender || '—' },
    { label: 'Age', value: creator.age || '—' },
    ...(!isBrandViewer ? [{ label: 'Phone', value: creator.phone || '—' }] : []),
  ];
  const capabilityItems = [
    creator.has_mock_video ? 'Has Mock Video' : '',
    creator.accepts_gifted_collab ? 'Accepts Gifted' : '',
    creator.has_equipment ? 'Has Equipment' : '',
    creator.can_voiceover ? 'Voiceover' : '',
  ].filter(Boolean);

  return createPortal(
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="profile-modal-scroll">
          <div className="profile-modal-header">
            <div className="profile-modal-avatar">
              {creator.profile_image ? (
                <img src={resolveAvatarSrc(creator.profile_image)} alt={displayName} onError={handleAvatarError} />
              ) : (
                initials
              )}
            </div>
            <div className="profile-modal-title-block">
              <h2>{displayName}</h2>
              <div className="profile-modal-meta-row">
                <span className="profile-modal-type">{isInfluencer ? 'Influencer' : 'UGC Creator'}</span>
                <span className="profile-meta-chip">{nicheValue}</span>
                <span className="profile-meta-chip">{regionValue}</span>
              </div>
            </div>
          </div>

          <div className="profile-modal-stats">
            {stats.map((item) => (
              <div key={item.label} className="profile-stat">
                <span className="profile-stat-value">{item.value}</span>
                <span className="profile-stat-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="profile-modal-body-grid">
            <div className="profile-modal-section">
              <h3>Profile Details</h3>
              <div className="profile-details-grid">
                {detailRows.map((item) => (
                  <div key={item.label} className="profile-detail-row">
                    <span className="profile-detail-label">{item.label}</span>
                    <span className="profile-detail-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-modal-side-stack">
              <div className="profile-modal-section">
                <h3>Social Links</h3>
                <div className="profile-social-links">
                  {socialLinks.length > 0 ? (
                    socialLinks.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                      >
                        {item.label}
                      </a>
                    ))
                  ) : (
                    <p className="profile-empty-text">No social profile links.</p>
                  )}
                </div>
              </div>

              {!isInfluencer && !isBrandViewer ? (
                <div className="profile-modal-section">
                  <h3>Capabilities</h3>
                  <div className="profile-capabilities">
                    {capabilityItems.length > 0 ? (
                      capabilityItems.map((item) => (
                        <span key={item} className="capability-pill">
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className="profile-empty-text">No capabilities added.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {!isInfluencer ? (
            <div className="profile-modal-section">
              <h3>UGC Videos</h3>
              {ugcVideos.length > 0 ? (
                <div className="profile-ugc-video-grid">
                  {ugcVideos.map((url, index) => (
                    <div key={`${url}-${index}`} className="profile-ugc-video-card">
                      {isLikelyVideoUrl(url) ? (
                        <video
                          className="profile-ugc-video-player"
                          src={url}
                          controls
                          preload="metadata"
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          onContextMenu={(event) => event.preventDefault()}
                        />
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="social-link"
                        >
                          Open Video {index + 1}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-text">No UGC videos uploaded yet.</p>
              )}
            </div>
          ) : null}

          {!isBrandViewer && creator.notes ? (
            <div className="profile-modal-section profile-modal-notes-card">
              <h3>Notes</h3>
              <p className="profile-notes">{creator.notes}</p>
            </div>
          ) : null}

          <div className="profile-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
