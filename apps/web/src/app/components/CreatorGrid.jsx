import EmptyState from './EmptyState.jsx';
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

const formatPercent = (value) => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${num}%`;
};

const resolveHandle = (creator) => {
  const raw =
    creator.tiktok_handle ||
    creator.instagram_handle ||
    creator.handle ||
    creator.tiktok_url ||
    creator.instagram_url;
  if (!raw) return '@creator';
  if (String(raw).startsWith('@')) return raw;
  if (String(raw).includes('tiktok.com/@')) {
    const match = String(raw).match(/tiktok\.com\/@([^/?]+)/i);
    if (match) return `@${match[1]}`;
  }
  if (String(raw).includes('instagram.com/')) {
    const match = String(raw).match(/instagram\.com\/([^/?]+)/i);
    if (match) return `@${match[1]}`;
  }
  return `@${String(raw).replace(/^@/, '')}`;
};

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const formatCreatorLabel = (creator) => creator.name || creator.display_name || 'Creator';

const normalizeExternalUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

const getCreatorSocialEntries = (creator) =>
  [
    { key: 'tiktok', label: 'TikTok', short: 'TT', href: normalizeExternalUrl(creator.tiktok_url) },
    {
      key: 'instagram',
      label: 'Instagram',
      short: 'IG',
      href: normalizeExternalUrl(creator.instagram_url),
    },
    { key: 'youtube', label: 'YouTube', short: 'YT', href: normalizeExternalUrl(creator.youtube_url) },
    {
      key: 'facebook',
      label: 'Facebook',
      short: 'FB',
      href: normalizeExternalUrl(creator.facebook_url),
    },
  ].filter((entry) => entry.href);

const SocialPlatformIcon = ({ platform }) => {
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="17.5" cy="6.8" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="2.8" y="5.2" width="18.4" height="13.6" rx="4.2" ry="4.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M10 9.1 15.2 12 10 14.9z" fill="currentColor" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13.8 21v-7.2h2.4l.4-2.7h-2.8V9.3c0-.8.2-1.3 1.4-1.3h1.5V5.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v1.6H8.2v2.7h2.4V21z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.1 5.2c-1 0-1.9-.4-2.5-1.1v9.2a4.3 4.3 0 1 1-3-4.1v2.2a2.2 2.2 0 1 0 .9 1.8V3h2.2c.2 1.5 1.3 2.2 2.4 2.2z" fill="currentColor" />
    </svg>
  );
};

const createColumn = (key, label, render) => ({ key, label, render });

const getColumns = (type, options = {}) => {
  const { includeInfluencerRate = false } = options;
  const definitions =
    type === 'ugc'
      ? [
          createColumn('age', 'Age', (creator) => (hasValue(creator.age) ? `${creator.age}` : '—')),
          createColumn('gender', 'Gender', (creator) => creator.gender || '—'),
          createColumn('base_rate', 'Rate', (creator) => formatMoney(creator.base_rate)),
        ]
      : [
          createColumn(
            'followers',
            'Followers',
            (creator) => formatCompactNumber(creator.followers ?? creator.followers_count)
          ),
          createColumn(
            'engagement',
            'ER',
            (creator) => formatPercent(creator.engagement_rate ?? creator.engagementRate)
          ),
          createColumn(
            'avg_views',
            'Avg Views',
            (creator) => formatCompactNumber(creator.avg_views ?? creator.avgViews)
          ),
          ...(includeInfluencerRate
            ? [createColumn('base_rate', 'Rate', (creator) => formatMoney(creator.base_rate))]
            : []),
          createColumn('gender', 'Gender', (creator) => creator.gender || '—'),
        ];

  const maxColumns = type === 'ugc' ? 4 : includeInfluencerRate ? 5 : 4;
  return definitions.slice(0, maxColumns);
};

export default function CreatorGrid({
  creators,
  type,
  onOpenProfile,
  canEdit = false,
  onEditCreator,
  renderActions,
  customColumns,
  renderMainMeta,
  actionsLabel = 'Actions',
  showViewButton = true,
  includeInfluencerRate = false,
  showSocialIcons = false,
}) {
  if (creators.length === 0) {
    return (
      <EmptyState
        title={type === 'ugc' ? 'No UGC creators found' : 'No influencers found'}
        description="Try adjusting your filters."
      />
    );
  }

  const hasCustomColumns = Array.isArray(customColumns);
  const columns = hasCustomColumns
    ? customColumns
    : getColumns(type, { includeInfluencerRate });
  const isDenseLayout = columns.length >= 5;
  const metricColumnsTemplate =
    columns.length > 0
      ? ` repeat(${columns.length}, minmax(var(--creator-col-metric-min, 100px), 0.8fr))`
      : '';
  const gridTemplateColumns = `minmax(var(--creator-col-main-min, 260px), 2fr)${metricColumnsTemplate} minmax(var(--creator-col-actions-min, 150px), 0.95fr)`;
  const gridStyle = {
    '--creator-grid-columns': gridTemplateColumns,
    '--creator-col-main-min': isDenseLayout ? '236px' : '260px',
    '--creator-col-metric-min': type === 'influencer' ? '84px' : '100px',
    '--creator-col-actions-min': isDenseLayout ? '150px' : '168px',
  };

  return (
    <div className={`creator-list-v3 creator-list-v3-${type}`}>
      <div className="creator-list-v3-header" style={gridStyle}>
        <span>Creator</span>
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        <span>{actionsLabel}</span>
      </div>
      {creators.map((creator) => {
        const creatorType = type === 'ugc' ? 'ugc' : 'influencer';
        const handle = resolveHandle(creator);
        const defaultMeta = `${handle} · ${creator.niche || creator.category || 'General'}`;
        const metaContent = renderMainMeta
          ? renderMainMeta(creator, { handle, defaultMeta })
          : defaultMeta;
        const socialEntries = showSocialIcons ? getCreatorSocialEntries(creator) : [];
        return (
          <div key={creator.id} className="creator-list-v3-row" style={gridStyle}>
            <div className="creator-list-v3-main">
              <div className="creator-list-v3-avatar">
                <img
                  src={resolveAvatarSrc(creator.profile_image)}
                  alt={formatCreatorLabel(creator)}
                  onError={handleAvatarError}
                />
              </div>
              <div className="creator-list-v3-info">
                <h4>
                  {onOpenProfile ? (
                    <button
                      type="button"
                      className="creator-list-v3-name-btn"
                      onClick={() => onOpenProfile(creator, creatorType)}
                    >
                      {formatCreatorLabel(creator)}
                    </button>
                  ) : (
                    formatCreatorLabel(creator)
                  )}
                </h4>
                {metaContent ? <p>{metaContent}</p> : null}
                {socialEntries.length > 0 ? (
                  <div className="creator-list-v3-social-icons">
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
            {columns.map((column) => (
              <div
                key={column.key}
                className={`creator-list-v3-metric ${column.className || ''}`.trim()}
                data-label={column.label}
              >
                {column.raw ? column.render(creator) : <strong>{column.render(creator)}</strong>}
              </div>
            ))}
            <div className="creator-list-v3-actions">
              {renderActions ? renderActions(creator, creatorType) : null}
              {canEdit && onEditCreator && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => onEditCreator(creator, creatorType)}
                >
                  Edit
                </button>
              )}
              {showViewButton && onOpenProfile ? (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => onOpenProfile(creator, creatorType)}
                >
                  View
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
