import { useEffect } from 'react';
import { createPortal } from 'react-dom';

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

const getInitials = (name) =>
  String(name || 'Creator')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function CreatorProfileModal({ creator, type, onClose }) {
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
  const nicheValue = creator.niche || creator.primary_niche || creator.category || 'General';
  const regionValue = creator.region || creator.country || '—';

  return createPortal(
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="profile-modal-header">
          <div className="profile-modal-avatar">
            {creator.profile_image ? (
              <img src={creator.profile_image} alt={displayName} />
            ) : (
              initials
            )}
          </div>
          <div className="profile-modal-title">
            <h2>{displayName}</h2>
            <p className="profile-modal-type">{isInfluencer ? 'Influencer' : 'UGC Creator'}</p>
          </div>
        </div>

        <div className="profile-modal-stats">
          {isInfluencer ? (
            <>
              <div className="profile-stat">
                <span className="profile-stat-value">{formatCompactNumber(creator.followers)}</span>
                <span className="profile-stat-label">Followers</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">
                  {creator.engagement_rate != null ? `${creator.engagement_rate}%` : '—'}
                </span>
                <span className="profile-stat-label">ER</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{formatCompactNumber(creator.avg_views)}</span>
                <span className="profile-stat-label">Avg Views</span>
              </div>
            </>
          ) : (
            <>
              <div className="profile-stat">
                <span className="profile-stat-value">{formatMoney(creator.base_rate)}</span>
                <span className="profile-stat-label">Base Rate</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">
                  {creator.skills_rating != null ? `${creator.skills_rating}/5` : '—'}
                </span>
                <span className="profile-stat-label">Skills</span>
              </div>
            </>
          )}
          <div className="profile-stat">
            <span className="profile-stat-value">{regionValue}</span>
            <span className="profile-stat-label">Region</span>
          </div>
        </div>

        <div className="profile-modal-section">
          <h3>Details</h3>
          <div className="profile-details-grid">
            <div className="profile-detail">
              <span className="detail-label">Niche</span>
              <span className="detail-value">{nicheValue}</span>
            </div>
            {isInfluencer ? (
              <div className="profile-detail">
                <span className="detail-label">Category</span>
                <span className="detail-value">{creator.category || '—'}</span>
              </div>
            ) : (
              <>
                <div className="profile-detail">
                  <span className="detail-label">Age</span>
                  <span className="detail-value">{creator.age || '—'}</span>
                </div>
                <div className="profile-detail">
                  <span className="detail-label">Gender</span>
                  <span className="detail-value">{creator.gender || '—'}</span>
                </div>
                <div className="profile-detail">
                  <span className="detail-label">Languages</span>
                  <span className="detail-value">{creator.languages || '—'}</span>
                </div>
                <div className="profile-detail">
                  <span className="detail-label">Turnaround</span>
                  <span className="detail-value">{creator.turnaround_time || '—'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!isInfluencer && (
          <div className="profile-modal-section">
            <h3>Capabilities</h3>
            <div className="profile-capabilities">
              {creator.has_mock_video && <span className="capability-pill">Has Mock Video</span>}
              {creator.accepts_gifted_collab && (
                <span className="capability-pill">Accepts Gifted</span>
              )}
              {creator.has_equipment && <span className="capability-pill">Has Equipment</span>}
              {creator.has_editing_skills && <span className="capability-pill">Can Edit</span>}
              {creator.can_voiceover && <span className="capability-pill">Voiceover</span>}
            </div>
          </div>
        )}

        {isInfluencer && (
          <div className="profile-modal-section">
            <h3>Social Profiles</h3>
            <div className="profile-social-links">
              {creator.tiktok_url && (
                <a
                  href={creator.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  TikTok
                </a>
              )}
              {creator.instagram_url && (
                <a
                  href={creator.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  Instagram
                </a>
              )}
              {!creator.tiktok_url && !creator.instagram_url && (
                <span className="detail-value">No social profile links.</span>
              )}
            </div>
          </div>
        )}

        {creator.notes && (
          <div className="profile-modal-section">
            <h3>Notes</h3>
            <p className="profile-notes">{creator.notes}</p>
          </div>
        )}

        <div className="profile-modal-actions">
          {creator.phone && (
            <a href={`tel:${creator.phone}`} className="btn btn-primary">
              Call {creator.phone}
            </a>
          )}
          {!isInfluencer && creator.portfolio_url && (
            <a
              href={creator.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View Portfolio
            </a>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
