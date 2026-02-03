import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';

const ITEMS_PER_PAGE = 12;

export default function CreatorsPage() {
  const { role } = useParams();
  const [activeTab, setActiveTab] = useState('ugc');
  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorType, setCreatorType] = useState(null);
  
  const [ugcPage, setUgcPage] = useState(1);
  const [influencerPage, setInfluencerPage] = useState(1);
  const [ugcPagination, setUgcPagination] = useState({ total: 0, totalPages: 1 });
  const [influencerPagination, setInfluencerPagination] = useState({ total: 0, totalPages: 1 });

  const [ugcFilters, setUgcFilters] = useState({
    search: '',
    niche: '',
    age: '',
    gender: '',
    language: '',
  });

  const [influencerFilters, setInfluencerFilters] = useState({
    search: '',
    niche: '',
    category: '',
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUgc = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/ugc-creators?page=${ugcPage}&limit=${ITEMS_PER_PAGE}`);
        if (!res.ok) throw new Error('Failed to fetch UGC creators');
        const data = await res.json();
        if (data.ok) {
          setUgcCreators(data.data || []);
          setUgcPagination(data.pagination || { total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to fetch UGC creators:', err);
        setError('Unable to load creators.');
      } finally {
        setLoading(false);
      }
    };
    fetchUgc();
  }, [ugcPage]);

  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/influencers?page=${influencerPage}&limit=${ITEMS_PER_PAGE}`);
        if (!res.ok) throw new Error('Failed to fetch influencers');
        const data = await res.json();
        if (data.ok) {
          setInfluencers(data.data || []);
          setInfluencerPagination(data.pagination || { total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to fetch influencers:', err);
        setError('Unable to load creators.');
      } finally {
        setLoading(false);
      }
    };
    fetchInfluencers();
  }, [influencerPage]);

  const niches = useMemo(() => {
    const allNiches = [...ugcCreators, ...influencers].map(c => c.niche).filter(Boolean);
    return [...new Set(allNiches)].sort();
  }, [ugcCreators, influencers]);

  const languages = useMemo(() => {
    const allLangs = ugcCreators.flatMap(c => c.languages ? c.languages.split(',').map(l => l.trim()) : []);
    return [...new Set(allLangs)].sort();
  }, [ugcCreators]);

  const categories = useMemo(() => {
    const allCats = influencers.map(c => c.category).filter(Boolean);
    return [...new Set(allCats)].sort();
  }, [influencers]);

  const filteredUgc = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (ugcFilters.search && !creator.name.toLowerCase().includes(ugcFilters.search.toLowerCase())) return false;
      if (ugcFilters.niche && creator.niche !== ugcFilters.niche) return false;
      if (ugcFilters.gender && creator.gender !== ugcFilters.gender) return false;
      if (ugcFilters.language && (!creator.languages || !creator.languages.toLowerCase().includes(ugcFilters.language.toLowerCase()))) return false;
      if (ugcFilters.age) {
        const [min, max] = ugcFilters.age.split('-').map(Number);
        const age = parseInt(creator.age);
        if (isNaN(age) || age < min || age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((creator) => {
      if (influencerFilters.search && !creator.name.toLowerCase().includes(influencerFilters.search.toLowerCase())) return false;
      if (influencerFilters.niche && creator.niche !== influencerFilters.niche) return false;
      if (influencerFilters.category && creator.category !== influencerFilters.category) return false;
      return true;
    });
  }, [influencers, influencerFilters]);

  const openProfile = (creator, type) => {
    setSelectedCreator(creator);
    setCreatorType(type);
  };

  const closeProfile = () => {
    setSelectedCreator(null);
    setCreatorType(null);
  };

  if (role === 'creator') {
    return (
      <EmptyState
        title="Creator directory coming soon"
        description="As a creator, you'll be able to connect with other creators and explore collaboration opportunities."
      />
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
        </div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <EmptyState
          title="Error loading creators"
          description={error}
        />
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
      </div>

      <div className="tabs-container">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ugc' ? 'active' : ''}`}
          onClick={() => setActiveTab('ugc')}
        >
          UGC Creators ({ugcPagination.total || ugcCreators.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'influencer' ? 'active' : ''}`}
          onClick={() => setActiveTab('influencer')}
        >
          Influencers ({influencerPagination.total || influencers.length})
        </button>
      </div>

      {activeTab === 'ugc' && (
        <>
          <div className="filters-bar">
            <input
              className="input"
              placeholder="Search UGC creators"
              value={ugcFilters.search}
              onChange={(e) => setUgcFilters({ ...ugcFilters, search: e.target.value })}
            />
            <select
              className="input"
              value={ugcFilters.niche}
              onChange={(e) => setUgcFilters({ ...ugcFilters, niche: e.target.value })}
            >
              <option value="">All Niches</option>
              {niches.slice(0, 20).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              value={ugcFilters.gender}
              onChange={(e) => setUgcFilters({ ...ugcFilters, gender: e.target.value })}
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>

          <div className="compact-creator-grid">
            {filteredUgc.length === 0 ? (
              <EmptyState title="No UGC creators found" description="Try adjusting your filters." />
            ) : (
              filteredUgc.map((creator) => (
                <div key={creator.id} className="compact-creator-card" onClick={() => openProfile(creator, 'ugc')}>
                  <div className="compact-card-avatar">
                    {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="compact-card-info">
                    <h4>{creator.name}</h4>
                    <p className="compact-card-meta">{creator.niche || 'General'}</p>
                    <p className="compact-card-region">{creator.region || 'Egypt'}</p>
                  </div>
                  <div className="compact-card-badge">
                    {creator.accepts_gifted_collab ? 'Gifted' : 'Paid'}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {ugcPagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="btn btn-secondary" 
                onClick={() => setUgcPage(p => Math.max(1, p - 1))}
                disabled={ugcPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {ugcPage} of {ugcPagination.totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                onClick={() => setUgcPage(p => Math.min(ugcPagination.totalPages, p + 1))}
                disabled={ugcPage === ugcPagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'influencer' && (
        <>
          <div className="filters-bar">
            <input
              className="input"
              placeholder="Search influencers"
              value={influencerFilters.search}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, search: e.target.value })}
            />
            <select
              className="input"
              value={influencerFilters.niche}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, niche: e.target.value })}
            >
              <option value="">All Niches</option>
              {niches.slice(0, 20).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              value={influencerFilters.category}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, category: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="compact-creator-grid">
            {filteredInfluencers.length === 0 ? (
              <EmptyState title="No influencers found" description="Try adjusting your filters." />
            ) : (
              filteredInfluencers.map((creator) => (
                <div key={creator.id} className="compact-creator-card" onClick={() => openProfile(creator, 'influencer')}>
                  <div className="compact-card-avatar">
                    {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="compact-card-info">
                    <h4>{creator.name}</h4>
                    <p className="compact-card-meta">{creator.niche || 'General'}</p>
                    <p className="compact-card-region">{creator.region || 'Egypt'}</p>
                  </div>
                  <div className="compact-card-badge">
                    {creator.followers || '—'}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {influencerPagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="btn btn-secondary" 
                onClick={() => setInfluencerPage(p => Math.max(1, p - 1))}
                disabled={influencerPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {influencerPage} of {influencerPagination.totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                onClick={() => setInfluencerPage(p => Math.min(influencerPagination.totalPages, p + 1))}
                disabled={influencerPage === influencerPagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedCreator && (
        <div className="profile-modal-overlay" onClick={closeProfile}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={closeProfile}>×</button>
            
            <div className="profile-modal-header">
              <div className="profile-modal-avatar">
                {selectedCreator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="profile-modal-title">
                <h2>{selectedCreator.name}</h2>
                <p className="profile-modal-type">{creatorType === 'ugc' ? 'UGC Creator' : 'Influencer'}</p>
              </div>
            </div>

            <div className="profile-modal-stats">
              {creatorType === 'influencer' && selectedCreator.followers && (
                <div className="profile-stat">
                  <span className="profile-stat-value">{selectedCreator.followers}</span>
                  <span className="profile-stat-label">Followers</span>
                </div>
              )}
              {creatorType === 'ugc' && selectedCreator.base_rate && (
                <div className="profile-stat">
                  <span className="profile-stat-value">${selectedCreator.base_rate}</span>
                  <span className="profile-stat-label">Base Rate</span>
                </div>
              )}
              {creatorType === 'ugc' && selectedCreator.skills_rating && (
                <div className="profile-stat">
                  <span className="profile-stat-value">{selectedCreator.skills_rating}/5</span>
                  <span className="profile-stat-label">Skills Rating</span>
                </div>
              )}
              <div className="profile-stat">
                <span className="profile-stat-value">{selectedCreator.region || 'Egypt'}</span>
                <span className="profile-stat-label">Region</span>
              </div>
            </div>

            <div className="profile-modal-section">
              <h3>Details</h3>
              <div className="profile-details-grid">
                <div className="profile-detail">
                  <span className="detail-label">Niche</span>
                  <span className="detail-value">{selectedCreator.niche || 'General'}</span>
                </div>
                {creatorType === 'influencer' && (
                  <>
                    <div className="profile-detail">
                      <span className="detail-label">Category</span>
                      <span className="detail-value">{selectedCreator.category || '—'}</span>
                    </div>
                  </>
                )}
                {creatorType === 'ugc' && (
                  <>
                    <div className="profile-detail">
                      <span className="detail-label">Age</span>
                      <span className="detail-value">{selectedCreator.age || '—'}</span>
                    </div>
                    <div className="profile-detail">
                      <span className="detail-label">Gender</span>
                      <span className="detail-value">{selectedCreator.gender || '—'}</span>
                    </div>
                    <div className="profile-detail">
                      <span className="detail-label">Languages</span>
                      <span className="detail-value">{selectedCreator.languages || '—'}</span>
                    </div>
                    <div className="profile-detail">
                      <span className="detail-label">Turnaround</span>
                      <span className="detail-value">{selectedCreator.turnaround_time || '—'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {creatorType === 'ugc' && (
              <div className="profile-modal-section">
                <h3>Capabilities</h3>
                <div className="profile-capabilities">
                  {selectedCreator.has_mock_video && <span className="capability-pill">Has Mock Video</span>}
                  {selectedCreator.accepts_gifted_collab && <span className="capability-pill">Accepts Gifted</span>}
                  {selectedCreator.has_equipment && <span className="capability-pill">Has Equipment</span>}
                  {selectedCreator.has_editing_skills && <span className="capability-pill">Can Edit</span>}
                  {selectedCreator.can_voiceover && <span className="capability-pill">Voiceover</span>}
                </div>
              </div>
            )}

            {creatorType === 'influencer' && (
              <div className="profile-modal-section">
                <h3>Social Profiles</h3>
                <div className="profile-social-links">
                  {selectedCreator.tiktok_url && (
                    <a href={selectedCreator.tiktok_url} target="_blank" rel="noopener noreferrer" className="social-link">
                      <i className="fab fa-tiktok"></i> TikTok
                    </a>
                  )}
                  {selectedCreator.instagram_url && (
                    <a href={selectedCreator.instagram_url} target="_blank" rel="noopener noreferrer" className="social-link">
                      <i className="fab fa-instagram"></i> Instagram
                    </a>
                  )}
                </div>
              </div>
            )}

            {selectedCreator.notes && (
              <div className="profile-modal-section">
                <h3>Notes</h3>
                <p className="profile-notes">{selectedCreator.notes}</p>
              </div>
            )}

            <div className="profile-modal-actions">
              {selectedCreator.phone && (
                <a href={`tel:${selectedCreator.phone}`} className="btn btn-primary">
                  <i className="fas fa-phone"></i> Call {selectedCreator.phone}
                </a>
              )}
              {creatorType === 'ugc' && selectedCreator.portfolio_url && (
                <a href={selectedCreator.portfolio_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  View Portfolio
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
