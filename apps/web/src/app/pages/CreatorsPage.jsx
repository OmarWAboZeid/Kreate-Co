import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';

const ITEMS_PER_PAGE = 12;
const NICHES = ['Fashion', 'F&B', 'Beauty', 'Lifestyle', 'Tech'];

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
    gender: '',
    age: '',
    niche: '',
    experienceLevel: '',
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
          <div className="filters-bar filters-bar-wrap">
            <input
              className="input"
              placeholder="Search UGC creators"
              value={ugcFilters.search}
              onChange={(e) => setUgcFilters({ ...ugcFilters, search: e.target.value })}
            />
            <select
              className="input"
              value={ugcFilters.gender}
              onChange={(e) => setUgcFilters({ ...ugcFilters, gender: e.target.value })}
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
            <select
              className="input"
              value={ugcFilters.age}
              onChange={(e) => setUgcFilters({ ...ugcFilters, age: e.target.value })}
            >
              <option value="">All Ages</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45+">45+</option>
            </select>
            <select
              className="input"
              value={ugcFilters.niche}
              onChange={(e) => setUgcFilters({ ...ugcFilters, niche: e.target.value })}
            >
              <option value="">All Niches</option>
              {NICHES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              value={ugcFilters.experienceLevel}
              onChange={(e) => setUgcFilters({ ...ugcFilters, experienceLevel: e.target.value })}
            >
              <option value="">Experience Level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div className="compact-creator-grid">
            {filteredUgc.length === 0 ? (
              <EmptyState title="No UGC creators found" description="Try adjusting your filters." />
            ) : (
              filteredUgc.map((creator) => (
                <div key={creator.id} className="creator-card-v2" onClick={() => openProfile(creator, 'ugc')}>
                  <div className="card-v2-image">
                    {creator.profile_image ? (
                      <img src={creator.profile_image} alt={creator.name} />
                    ) : (
                      <img src="/assets/default-avatar.png" alt={creator.name} />
                    )}
                    <span className="card-v2-badge">{creator.accepts_gifted_collab ? 'GIFTED' : 'PAID'}</span>
                  </div>
                  <div className="card-v2-content">
                    <h4 className="card-v2-name">{creator.name}</h4>
                    <div className="card-v2-tags">
                      {(creator.niche || 'General').split(',').slice(0, 2).map((tag, i) => (
                        <span key={i} className="card-v2-tag">#{tag.trim().toLowerCase()}</span>
                      ))}
                    </div>
                    <div className="card-v2-stats">
                      <span className="card-v2-followers">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        {creator.followers || '—'}
                      </span>
                    </div>
                    <div className="card-v2-socials">
                      {creator.instagram_handle && (
                        <span className="card-v2-social instagram" title={creator.instagram_handle}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </span>
                      )}
                      {creator.tiktok_handle && (
                        <span className="card-v2-social tiktok" title={creator.tiktok_handle}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                          </svg>
                        </span>
                      )}
                      {!creator.instagram_handle && !creator.tiktok_handle && (
                        <span className="card-v2-social-none">No socials</span>
                      )}
                    </div>
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
          <div className="filters-bar filters-bar-wrap">
            <input
              className="input"
              placeholder="Search influencers"
              value={influencerFilters.search}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, search: e.target.value })}
            />
            <select
              className="input"
              value={influencerFilters.followerCount}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, followerCount: e.target.value })}
            >
              <option value="">Follower Count</option>
              <option value="nano">Nano (1K-10K)</option>
              <option value="micro">Micro (10K-100K)</option>
              <option value="macro">Macro (100K-1M)</option>
              <option value="mega">Mega (1M+)</option>
            </select>
            <select
              className="input"
              value={influencerFilters.gender}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, gender: e.target.value })}
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
            <select
              className="input"
              value={influencerFilters.niche}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, niche: e.target.value })}
            >
              <option value="">All Niches</option>
              {NICHES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              value={influencerFilters.platform}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, platform: e.target.value })}
            >
              <option value="">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
            <select
              className="input"
              value={influencerFilters.engagementRate}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, engagementRate: e.target.value })}
            >
              <option value="">Engagement Rate</option>
              <option value="low">Low (&lt;2%)</option>
              <option value="medium">Medium (2-5%)</option>
              <option value="high">High (5-10%)</option>
              <option value="viral">Viral (10%+)</option>
            </select>
          </div>

          <div className="compact-creator-grid">
            {filteredInfluencers.length === 0 ? (
              <EmptyState title="No influencers found" description="Try adjusting your filters." />
            ) : (
              filteredInfluencers.map((creator) => (
                <div key={creator.id} className="creator-card-v2" onClick={() => openProfile(creator, 'influencer')}>
                  <div className="card-v2-image">
                    {creator.profile_image ? (
                      <img src={creator.profile_image} alt={creator.name} />
                    ) : (
                      <img src="/assets/default-avatar.png" alt={creator.name} />
                    )}
                    <span className="card-v2-badge influencer">{creator.category || 'Influencer'}</span>
                  </div>
                  <div className="card-v2-content">
                    <h4 className="card-v2-name">{creator.name}</h4>
                    <div className="card-v2-tags">
                      {(creator.niche || 'General').split(',').slice(0, 2).map((tag, i) => (
                        <span key={i} className="card-v2-tag">#{tag.trim().toLowerCase()}</span>
                      ))}
                    </div>
                    <div className="card-v2-stats">
                      <span className="card-v2-followers">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        {creator.followers || '—'}
                      </span>
                    </div>
                    <div className="card-v2-socials">
                      {creator.instagram_handle && (
                        <span className="card-v2-social instagram" title={creator.instagram_handle}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </span>
                      )}
                      {creator.tiktok_handle && (
                        <span className="card-v2-social tiktok" title={creator.tiktok_handle}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                          </svg>
                        </span>
                      )}
                      {!creator.instagram_handle && !creator.tiktok_handle && (
                        <span className="card-v2-social-none">No socials</span>
                      )}
                    </div>
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
