export default function CreatorProfileModal({ creator, type, onClose }) {
  if (!creator) return null;

  const initials = creator.name
    .split(' ')
    .map((name) => name[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <button className="profile-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="profile-modal-header">
          <div className="profile-modal-avatar">{initials}</div>
          <div className="profile-modal-title">
            <h2>{creator.name}</h2>
            <p className="profile-modal-type">{type === 'ugc' ? 'UGC Creator' : 'Influencer'}</p>
          </div>
        </div>

        <div className="profile-modal-stats">
          {type === 'influencer' && creator.followers && (
            <div className="profile-stat">
              <span className="profile-stat-value">{creator.followers}</span>
              <span className="profile-stat-label">Followers</span>
            </div>
          )}
          {type === 'ugc' && creator.base_rate && (
            <div className="profile-stat">
              <span className="profile-stat-value">${creator.base_rate}</span>
              <span className="profile-stat-label">Base Rate</span>
            </div>
          )}
          {type === 'ugc' && creator.skills_rating && (
            <div className="profile-stat">
              <span className="profile-stat-value">{creator.skills_rating}/5</span>
              <span className="profile-stat-label">Skills Rating</span>
            </div>
          )}
          <div className="profile-stat">
            <span className="profile-stat-value">{creator.region || 'Egypt'}</span>
            <span className="profile-stat-label">Region</span>
          </div>
        </div>

        <div className="profile-modal-section">
          <h3>Details</h3>
          <div className="profile-details-grid">
            <div className="profile-detail">
              <span className="detail-label">Niche</span>
              <span className="detail-value">{creator.niche || 'General'}</span>
            </div>
            {type === 'influencer' && (
              <div className="profile-detail">
                <span className="detail-label">Category</span>
                <span className="detail-value">{creator.category || '—'}</span>
              </div>
            )}
            {type === 'ugc' && (
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

        {type === 'ugc' && (
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

        {type === 'influencer' && (
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
                  <i className="fab fa-tiktok"></i> TikTok
                </a>
              )}
              {creator.instagram_url && (
                <a
                  href={creator.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <i className="fab fa-instagram"></i> Instagram
                </a>
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
              <i className="fas fa-phone"></i> Call {creator.phone}
            </a>
          )}
          {type === 'ugc' && creator.portfolio_url && (
            <a
              href={creator.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View Portfolio
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
