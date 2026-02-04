import { Link } from 'react-router-dom';
import StatusPill from './StatusPill.jsx';

export default function CampaignGrid({ campaigns }) {
  return (
    <div className="card-grid">
      {campaigns.map((campaign) => (
        <Link key={campaign.id} to={campaign.id} className="card campaign-card">
          <div>
            <StatusPill status={campaign.status} />
            <h3>{campaign.name}</h3>
            <p>{campaign.brand}</p>
          </div>
          <div className="campaign-meta">
            <span>{campaign.platforms.join(' / ')}</span>
            <span>
              {campaign.timeline.start || 'TBD'} → {campaign.timeline.end || 'TBD'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
