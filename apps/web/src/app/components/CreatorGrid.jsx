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

const formatPlatforms = (creator) => {
  const platforms = [];
  if (creator.tiktok_url || creator.tiktok_handle) platforms.push('TikTok');
  if (creator.instagram_url || creator.instagram_handle) platforms.push('Instagram');
  return platforms.join(', ') || '—';
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
          createColumn('platforms', 'Platforms', (creator) => formatPlatforms(creator)),
          createColumn('niche', 'Niche', (creator) => creator.niche || creator.category || '—'),
          createColumn('gender', 'Gender', (creator) => creator.gender || '—'),
        ];

  const maxColumns = type === 'ugc' ? 4 : includeInfluencerRate ? 6 : 5;
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
}) {
  if (creators.length === 0) {
    return (
      <EmptyState
        title={type === 'ugc' ? 'No UGC creators found' : 'No influencers found'}
        description="Try adjusting your filters."
      />
    );
  }

  const baseColumns =
    Array.isArray(customColumns) && customColumns.length > 0
      ? customColumns
      : getColumns(type, { includeInfluencerRate });
  const columns = baseColumns;
  const isDenseLayout = columns.length >= 5;
  const gridTemplateColumns = `minmax(var(--creator-col-main-min, 260px), 2fr) repeat(${columns.length}, minmax(var(--creator-col-metric-min, 100px), 0.8fr)) minmax(var(--creator-col-actions-min, 150px), 0.95fr)`;
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
