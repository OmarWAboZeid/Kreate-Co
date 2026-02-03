import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppState } from '../state.jsx';

export default function CreatorsPage() {
  const { role } = useParams();
  const { creators, campaigns, campaignCreators } = useAppState();

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

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Creators</h2>
          <p>Review all creator profiles and performance context.</p>
        </div>
      </div>

      <div className="filters-bar">
        <input className="input" placeholder="Search creators" />
        <select className="input">
          <option>Niche</option>
          <option>Beauty</option>
          <option>Fashion</option>
        </select>
        <select className="input">
          <option>Region</option>
          <option>US</option>
          <option>Egypt</option>
        </select>
      </div>

      <div className="creator-directory">
        {creators.map((creator) => (
          <div key={creator.id} className="card creator-card">
            <div>
              <h3>{creator.name}</h3>
              <p>
                {creator.handles.instagram} · {creator.niche} · {creator.region}
              </p>
              <p>
                IG {creator.followers.instagram.toLocaleString()} · TikTok {creator.followers.tiktok.toLocaleString()}
              </p>
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
        ))}
      </div>
    </div>
  );
}
