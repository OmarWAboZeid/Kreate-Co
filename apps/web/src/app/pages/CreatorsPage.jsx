import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppState } from '../state.jsx';

export default function CreatorsPage() {
  const { role } = useParams();
  const { creators, campaigns, campaignCreators } = useAppState();
  const [activeTab, setActiveTab] = useState('ugc');

  const [ugcFilters, setUgcFilters] = useState({
    search: '',
    niche: '',
    age: '',
    gender: '',
    language: '',
    experience: '',
  });

  const [influencerFilters, setInfluencerFilters] = useState({
    search: '',
    niche: '',
    followers: '',
    engagement: '',
    platform: '',
    gender: '',
  });

  const ugcCreators = useMemo(() => creators.filter((c) => c.type === 'ugc'), [creators]);
  const influencers = useMemo(() => creators.filter((c) => c.type === 'influencer'), [creators]);

  const filteredUgc = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (ugcFilters.search && !creator.name.toLowerCase().includes(ugcFilters.search.toLowerCase())) return false;
      if (ugcFilters.niche && creator.niche !== ugcFilters.niche) return false;
      if (ugcFilters.gender && creator.gender !== ugcFilters.gender) return false;
      if (ugcFilters.language && !creator.languages?.includes(ugcFilters.language)) return false;
      if (ugcFilters.experience && creator.experienceLevel !== ugcFilters.experience) return false;
      if (ugcFilters.age) {
        const [min, max] = ugcFilters.age.split('-').map(Number);
        if (creator.age < min || creator.age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((creator) => {
      if (influencerFilters.search && !creator.name.toLowerCase().includes(influencerFilters.search.toLowerCase())) return false;
      if (influencerFilters.niche && creator.niche !== influencerFilters.niche) return false;
      if (influencerFilters.gender && creator.gender !== influencerFilters.gender) return false;
      if (influencerFilters.platform && !creator.platforms?.includes(influencerFilters.platform)) return false;
      if (influencerFilters.followers) {
        const totalFollowers = Object.values(creator.followers || {}).reduce((a, b) => a + b, 0);
        const [min, max] = influencerFilters.followers.split('-').map((v) => parseInt(v.replace('k', '000').replace('m', '000000')));
        if (totalFollowers < min || (max && totalFollowers > max)) return false;
      }
      if (influencerFilters.engagement) {
        const [min, max] = influencerFilters.engagement.split('-').map(Number);
        if (creator.engagement < min || creator.engagement > max) return false;
      }
      return true;
    });
  }, [influencers, influencerFilters]);

  const creatorCampaigns = useMemo(() => {
    const map = {};
    creators.forEach((creator) => {
      map[creator.id] = [];
    });
    Object.entries(campaignCreators).forEach(([campaignId, data]) => {
      data.shortlist.forEach((creatorId) => {
        map[creatorId] = map[creatorId] || [];
        map[creatorId].push({
          campaign: campaigns.find((item) => item.id === campaignId),
          status: data.approvals[creatorId] || 'Suggested',
        });
      });
    });
    return map;
  }, [campaignCreators, campaigns, creators]);

  if (role !== 'admin') {
    return (
      <EmptyState
        title="Creators directory"
        description="Creator profiles are visible to admins only in Phase 1."
      />
    );
  }

  const niches = [...new Set(creators.map((c) => c.niche))].filter(Boolean);
  const languages = [...new Set(creators.flatMap((c) => c.languages || []))];
  const platforms = [...new Set(creators.flatMap((c) => c.platforms || []))];

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
              {niches.map((n) => (
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
              <option value="Non-binary">Non-binary</option>
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
            <select
              className="input"
              value={ugcFilters.experience}
              onChange={(e) => setUgcFilters({ ...ugcFilters, experience: e.target.value })}
            >
              <option value="">All Experience</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
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
                      {creator.niche} · {creator.region} · {creator.gender}, {creator.age} yrs
                    </p>
                    <p className="creator-details">
                      <span className="pill">{creator.experienceLevel}</span>
                      {creator.languages?.map((lang) => (
                        <span key={lang} className="pill pill-outline">{lang}</span>
                      ))}
                    </p>
                    {creator.notes && <p className="muted">{creator.notes}</p>}
                  </div>
                  <div className="creator-campaigns">
                    {(creatorCampaigns[creator.id] || []).length === 0 ? (
                      <p className="muted">No campaigns yet.</p>
                    ) : (
                      creatorCampaigns[creator.id].map((entry) => (
                        <div key={`${creator.id}-${entry.campaign?.id}`}>
                          <span>{entry.campaign?.name}</span>
                          <StatusPill status={entry.status} />
                        </div>
                      ))
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
              {niches.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              value={influencerFilters.followers}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, followers: e.target.value })}
            >
              <option value="">All Follower Ranges</option>
              <option value="0-50000">0 - 50K</option>
              <option value="50000-100000">50K - 100K</option>
              <option value="100000-500000">100K - 500K</option>
              <option value="500000-1000000">500K - 1M</option>
              <option value="1000000-">1M+</option>
            </select>
            <select
              className="input"
              value={influencerFilters.engagement}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, engagement: e.target.value })}
            >
              <option value="">All Engagement Rates</option>
              <option value="0-2">0% - 2%</option>
              <option value="2-4">2% - 4%</option>
              <option value="4-6">4% - 6%</option>
              <option value="6-100">6%+</option>
            </select>
            <select
              className="input"
              value={influencerFilters.platform}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, platform: e.target.value })}
            >
              <option value="">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="input"
              value={influencerFilters.gender}
              onChange={(e) => setInfluencerFilters({ ...influencerFilters, gender: e.target.value })}
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          <div className="influencer-grid">
            {filteredInfluencers.length === 0 ? (
              <EmptyState title="No influencers found" description="Try adjusting your filters." />
            ) : (
              filteredInfluencers.map((creator) => {
                const totalFollowers = Object.values(creator.followers || {}).reduce((a, b) => a + b, 0);
                const formatFollowers = (num) => {
                  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
                  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
                  return num;
                };
                return (
                  <div key={creator.id} className="influencer-card">
                    <div className="influencer-card-header">
                      <div className="influencer-avatar">
                        {creator.avatar ? (
                          <img src={creator.avatar} alt={creator.name} />
                        ) : (
                          <div className="avatar-placeholder">
                            {creator.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                      </div>
                      <div className="influencer-niche-badge">{creator.niche}</div>
                    </div>
                    <div className="influencer-card-body">
                      <h3 className="influencer-name">{creator.name}</h3>
                      <p className="influencer-handle">{creator.handles?.instagram}</p>
                      <p className="influencer-region">
                        <i className="fas fa-map-marker-alt"></i> {creator.region}
                      </p>
                      <div className="influencer-stats-row">
                        <div className="influencer-stat">
                          <span className="stat-value">{formatFollowers(totalFollowers)}</span>
                          <span className="stat-label">Followers</span>
                        </div>
                        <div className="influencer-stat">
                          <span className="stat-value">{creator.engagement}%</span>
                          <span className="stat-label">Engagement</span>
                        </div>
                      </div>
                      <div className="influencer-platforms">
                        {creator.platforms?.map((platform) => (
                          <span key={platform} className="platform-icon" title={platform}>
                            <i className={`fab fa-${platform.toLowerCase()}`}></i>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="influencer-card-footer">
                      {(creatorCampaigns[creator.id] || []).length === 0 ? (
                        <span className="campaign-count available">Available</span>
                      ) : (
                        <span className="campaign-count active">
                          {creatorCampaigns[creator.id].length} Campaign{creatorCampaigns[creator.id].length > 1 ? 's' : ''}
                        </span>
                      )}
                      <button type="button" className="btn-view-profile">View Profile</button>
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
