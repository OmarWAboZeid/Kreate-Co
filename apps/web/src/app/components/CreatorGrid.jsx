import EmptyState from './EmptyState.jsx';

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

export default function CreatorGrid({ creators, type, onOpenProfile }) {
  if (creators.length === 0) {
    return (
      <EmptyState
        title={type === 'ugc' ? 'No UGC creators found' : 'No influencers found'}
        description="Try adjusting your filters."
      />
    );
  }

  const metricLabels =
    type === 'ugc'
      ? { one: 'Age', two: 'Skills', three: 'Base Rate' }
      : { one: 'Followers', two: 'ER', three: 'Views' };

  return (
    <div className="creator-list-v3">
      <div className="creator-list-v3-header">
        <span>Creator</span>
        <span>{metricLabels.one}</span>
        <span>{metricLabels.two}</span>
        <span>{metricLabels.three}</span>
        <span>Actions</span>
      </div>
      {creators.map((creator) => {
        const metricOne =
          type === 'ugc'
            ? creator.age
              ? `${creator.age}`
              : '—'
            : formatCompactNumber(creator.followers);
        const metricTwo =
          type === 'ugc'
            ? creator.skills_rating
              ? `${creator.skills_rating}/5`
              : '—'
            : creator.engagement_rate
              ? `${creator.engagement_rate}%`
              : '—';
        const metricThree =
          type === 'ugc' ? formatMoney(creator.base_rate) : formatCompactNumber(creator.avg_views);
        const handle = resolveHandle(creator);
        return (
          <div key={creator.id} className="creator-list-v3-row">
            <div className="creator-list-v3-main">
              <div className="creator-list-v3-avatar">
                {creator.profile_image ? (
                  <img src={creator.profile_image} alt={creator.name} />
                ) : (
                  <img src="/assets/default-avatar.png" alt={creator.name} />
                )}
              </div>
              <div className="creator-list-v3-info">
                <h4>{creator.name}</h4>
                <p>
                  {handle} · {creator.niche || creator.category || 'General'}
                </p>
              </div>
            </div>
            <div className="creator-list-v3-metric" data-label={metricLabels.one}>
              <strong>{metricOne}</strong>
            </div>
            <div className="creator-list-v3-metric" data-label={metricLabels.two}>
              <strong>{metricTwo}</strong>
            </div>
            <div className="creator-list-v3-metric" data-label={metricLabels.three}>
              <strong>{metricThree}</strong>
            </div>
            <div className="creator-list-v3-actions">
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
