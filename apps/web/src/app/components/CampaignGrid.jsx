import { Link } from 'react-router-dom';
import StatusPill from './StatusPill.jsx';

const formatDate = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const resolveCampaignMinWidth = (count) => {
  if (count <= 1) return '560px';
  if (count === 2) return '420px';
  if (count <= 4) return '340px';
  if (count <= 8) return '300px';
  return '272px';
};

export default function CampaignGrid({ campaigns }) {
  const cardMinWidth = resolveCampaignMinWidth(campaigns.length);

  return (
    <div className="card-grid campaign-grid" style={{ '--campaign-card-min': cardMinWidth }}>
      {campaigns.map((campaign) => {
        const platforms = Array.isArray(campaign.platforms) ? campaign.platforms.filter(Boolean) : [];
        const startLabel = campaign.timeline?.start ? formatDate(campaign.timeline.start) : null;
        const endLabel = campaign.timeline?.end ? formatDate(campaign.timeline.end) : null;
        const timelineLabel =
          startLabel || endLabel ? `${startLabel || 'TBD'} - ${endLabel || 'TBD'}` : 'Timeline not set';
        const typeLabel = campaign.campaignType || 'General';

        return (
          <Link key={campaign.id} to={campaign.id} className="card campaign-card">
            <div className="campaign-card-head">
              <StatusPill status={campaign.status} />
              <span className="campaign-card-timeline">{timelineLabel}</span>
            </div>

            <div className="campaign-card-body">
              <h3>{campaign.name || 'Untitled campaign'}</h3>
              <p className="campaign-card-brandline">{campaign.brand || 'Unassigned brand'}</p>
            </div>

            <div className="campaign-meta">
              <span className="campaign-platform-chip type">{typeLabel}</span>
              <div className="campaign-platforms">
                {platforms.length ? (
                  platforms.slice(0, 2).map((platform) => (
                    <span key={platform} className="campaign-platform-chip">
                      {platform}
                    </span>
                  ))
                ) : (
                  <span className="campaign-platform-chip muted">No platform</span>
                )}
                {platforms.length > 2 ? (
                  <span className="campaign-platform-chip muted">+{platforms.length - 2}</span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
