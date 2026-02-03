import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';

export default function CreatorsPage() {
  const { role } = useParams();
  const [activeTab, setActiveTab] = useState('ugc');
  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const fetchCreators = async () => {
      try {
        const [ugcRes, influencerRes] = await Promise.all([
          fetch('/api/ugc-creators'),
          fetch('/api/influencers'),
        ]);
        
        if (!ugcRes.ok || !influencerRes.ok) {
          throw new Error('Failed to fetch creator data');
        }
        
        const ugcData = await ugcRes.json();
        const influencerData = await influencerRes.json();
        
        if (ugcData.ok) setUgcCreators(ugcData.data || []);
        if (influencerData.ok) setInfluencers(influencerData.data || []);
      } catch (err) {
        console.error('Failed to fetch creators:', err);
        setError('Unable to load creators. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCreators();
  }, []);

  const filteredUgc = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (ugcFilters.search && !creator.name.toLowerCase().includes(ugcFilters.search.toLowerCase())) return false;
      if (ugcFilters.niche && creator.niche && !creator.niche.toLowerCase().includes(ugcFilters.niche.toLowerCase())) return false;
      if (ugcFilters.gender && creator.gender !== ugcFilters.gender) return false;
      if (ugcFilters.language && creator.languages && !creator.languages.toLowerCase().includes(ugcFilters.language.toLowerCase())) return false;
      if (ugcFilters.age) {
        const [min, max] = ugcFilters.age.split('-').map(Number);
        if (!creator.age || creator.age < min || creator.age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((creator) => {
      if (influencerFilters.search && !creator.name.toLowerCase().includes(influencerFilters.search.toLowerCase())) return false;
      if (influencerFilters.niche && creator.niche && !creator.niche.toLowerCase().includes(influencerFilters.niche.toLowerCase())) return false;
      if (influencerFilters.category && creator.category !== influencerFilters.category) return false;
      return true;
    });
  }, [influencers, influencerFilters]);

  const niches = useMemo(() => {
    const allNiches = [...ugcCreators, ...influencers]
      .map(c => c.niche)
      .filter(Boolean)
      .flatMap(n => n.split(/[,\/]/))
      .map(n => n.trim())
      .filter(Boolean);
    return [...new Set(allNiches)].sort();
  }, [ugcCreators, influencers]);

  const categories = useMemo(() => {
    return [...new Set(influencers.map(c => c.category).filter(Boolean))].sort();
  }, [influencers]);

  const languages = useMemo(() => {
    const allLangs = ugcCreators
      .map(c => c.languages)
      .filter(Boolean)
      .flatMap(l => l.split(/[,\/]/))
      .map(l => l.trim())
      .filter(Boolean);
    return [...new Set(allLangs)].sort();
  }, [ugcCreators]);

  if (role !== 'admin') {
    return (
      <EmptyState
        title="Creators directory"
        description="Creator profiles are visible to admins only in Phase 1."
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
          UGC Creators ({ugcCreators.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'influencer' ? 'active' : ''}`}
          onClick={() => setActiveTab('influencer')}
        >
          Influencers ({influencers.length})
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
              value={ugcFilters.age}
              onChange={(e) => setUgcFilters({ ...ugcFilters, age: e.target.value })}
            >
              <option value="">All Ages</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-99">45+</option>
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
            <select
              className="input"
              value={ugcFilters.language}
              onChange={(e) => setUgcFilters({ ...ugcFilters, language: e.target.value })}
            >
              <option value="">All Languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="creator-directory">
            {filteredUgc.length === 0 ? (
              <EmptyState title="No UGC creators found" description="Try adjusting your filters." />
            ) : (
              filteredUgc.map((creator) => (
                <div key={creator.id} className="card creator-card">
                  <div className="creator-info">
                    <h3>{creator.name}</h3>
                    <p className="creator-meta">
                      {creator.niche || 'General'} · {creator.region || 'Egypt'}
                      {creator.gender && creator.age && ` · ${creator.gender}, ${creator.age} yrs`}
                    </p>
                    <p className="creator-details">
                      {creator.has_mock_video && <span className="pill">Has Mock Video</span>}
                      {creator.accepts_gifted_collab && <span className="pill pill-sand">Gifted Collab</span>}
                      {creator.languages && creator.languages.split(',').map((lang) => (
                        <span key={lang.trim()} className="pill pill-outline">{lang.trim()}</span>
                      ))}
                    </p>
                    {creator.notes && <p className="muted">{creator.notes}</p>}
                  </div>
                  <div className="creator-contact">
                    {creator.phone && <span className="contact-item"><i className="fas fa-phone"></i> {creator.phone}</span>}
                    {creator.portfolio_url && (
                      <a href={creator.portfolio_url} target="_blank" rel="noopener noreferrer" className="btn-view-profile">
                        View Portfolio
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
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

          <div className="influencer-grid">
            {filteredInfluencers.length === 0 ? (
              <EmptyState title="No influencers found" description="Try adjusting your filters." />
            ) : (
              filteredInfluencers.map((creator) => {
                const tiktokHandle = creator.tiktok_url ? 
                  creator.tiktok_url.match(/@([^?/]+)/)?.[1] || 'TikTok' : null;
                return (
                  <div key={creator.id} className="influencer-card">
                    <div className="influencer-card-header">
                      <div className="influencer-avatar">
                        <div className="avatar-placeholder">
                          {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      </div>
                      <div className="influencer-niche-badge">{creator.category || 'General'}</div>
                    </div>
                    <div className="influencer-card-body">
                      <h3 className="influencer-name">{creator.name}</h3>
                      {tiktokHandle && <p className="influencer-handle">@{tiktokHandle}</p>}
                      <p className="influencer-region">
                        <i className="fas fa-map-marker-alt"></i> {creator.region || 'Egypt'}
                      </p>
                      {creator.followers && (
                        <div className="influencer-stats-row">
                          <div className="influencer-stat">
                            <span className="stat-value">{creator.followers}</span>
                            <span className="stat-label">Followers</span>
                          </div>
                        </div>
                      )}
                      <div className="influencer-platforms">
                        {creator.tiktok_url && (
                          <a href={creator.tiktok_url} target="_blank" rel="noopener noreferrer" className="platform-icon" title="TikTok">
                            <i className="fab fa-tiktok"></i>
                          </a>
                        )}
                        {creator.instagram_url && (
                          <a href={creator.instagram_url} target="_blank" rel="noopener noreferrer" className="platform-icon" title="Instagram">
                            <i className="fab fa-instagram"></i>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="influencer-card-footer">
                      <span className="campaign-count available">
                        {creator.niche || 'Available'}
                      </span>
                      {creator.phone && (
                        <a href={`tel:${creator.phone}`} className="btn-view-profile">
                          <i className="fas fa-phone"></i> Contact
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
