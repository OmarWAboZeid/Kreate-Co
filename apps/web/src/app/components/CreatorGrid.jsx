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

const createColumn = (key, label, render, hasData) => ({ key, label, render, hasData });

const getColumns = (type, creators) => {
  const definitions =
    type === 'ugc'
      ? [
          createColumn('age', 'Age', (creator) => (hasValue(creator.age) ? `${creator.age}` : '—'), (creator) =>
            hasValue(creator.age)
          ),
          createColumn(
            'gender',
            'Gender',
            (creator) => creator.gender || '—',
            (creator) => hasValue(creator.gender)
          ),
          createColumn(
            'skills',
            'Skills',
            (creator) => (hasValue(creator.skills_rating) ? `${creator.skills_rating}/5` : '—'),
            (creator) => hasValue(creator.skills_rating)
          ),
          createColumn(
            'base_rate',
            'Base Rate',
            (creator) => formatMoney(creator.base_rate),
            (creator) => hasValue(creator.base_rate)
          ),
          createColumn(
            'languages',
            'Languages',
            (creator) => creator.languages || '—',
            (creator) => hasValue(creator.languages)
          ),
        ]
      : [
          createColumn(
            'followers',
            'Followers',
            (creator) => formatCompactNumber(creator.followers),
            (creator) => hasValue(creator.followers)
          ),
          createColumn(
            'engagement',
            'ER',
            (creator) => (hasValue(creator.engagement_rate) ? `${creator.engagement_rate}%` : '—'),
            (creator) => hasValue(creator.engagement_rate)
          ),
          createColumn(
            'avg_views',
            'Avg Views',
            (creator) => formatCompactNumber(creator.avg_views),
            (creator) => hasValue(creator.avg_views)
          ),
          createColumn(
            'platforms',
            'Platforms',
            (creator) => formatPlatforms(creator),
            (creator) => hasValue(creator.tiktok_url || creator.tiktok_handle || creator.instagram_url || creator.instagram_handle)
          ),
          createColumn(
            'niche',
            'Niche',
            (creator) => creator.niche || creator.category || '—',
            (creator) => hasValue(creator.niche) || hasValue(creator.category)
          ),
          createColumn(
            'gender',
            'Gender',
            (creator) => creator.gender || '—',
            (creator) => hasValue(creator.gender)
          ),
        ];

  const maxColumns = type === 'ugc' ? 4 : 5;
  const withData = definitions.filter((col) => creators.some((creator) => col.hasData(creator)));
  const withoutData = definitions.filter((col) => !withData.some((item) => item.key === col.key));
  return [...withData, ...withoutData].slice(0, maxColumns);
};

export default function CreatorGrid({
  creators,
  type,
  onOpenProfile,
  canEdit = false,
  onEditCreator,
  renderActions,
}) {
  if (creators.length === 0) {
    return (
      <EmptyState
        title={type === 'ugc' ? 'No UGC creators found' : 'No influencers found'}
        description="Try adjusting your filters."
      />
    );
  }

  const columns = getColumns(type, creators);
  const gridTemplateColumns = `minmax(var(--creator-col-main-min, 260px), 2fr) repeat(${columns.length}, minmax(var(--creator-col-metric-min, 100px), 0.8fr)) minmax(var(--creator-col-actions-min, 150px), 0.95fr)`;
  const gridStyle = { '--creator-grid-columns': gridTemplateColumns };

  return (
    <div className="creator-list-v3">
      <div className="creator-list-v3-header" style={gridStyle}>
        <span>Creator</span>
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        <span>Actions</span>
      </div>
      {creators.map((creator) => {
        const handle = resolveHandle(creator);
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
                <h4>{formatCreatorLabel(creator)}</h4>
                <p>
                  {handle} · {creator.niche || creator.category || 'General'}
                </p>
              </div>
            </div>
            {columns.map((column) => (
              <div key={column.key} className="creator-list-v3-metric" data-label={column.label}>
                <strong>{column.render(creator)}</strong>
              </div>
            ))}
            <div className="creator-list-v3-actions">
              {renderActions ? renderActions(creator, type === 'ugc' ? 'ugc' : 'influencer') : null}
              {canEdit && onEditCreator && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => onEditCreator(creator, type === 'ugc' ? 'ugc' : 'influencer')}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={() => onOpenProfile(creator, type === 'ugc' ? 'ugc' : 'influencer')}
              >
                View
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
