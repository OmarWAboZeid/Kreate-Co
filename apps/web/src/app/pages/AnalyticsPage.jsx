import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import { storage, useAppState } from '../state.jsx';

export default function AnalyticsPage() {
  const { role } = useParams();
  const { campaigns, contentItems, creators, brands } = useAppState();

  const brandNames = brands.map((brand) => (typeof brand === 'string' ? brand : brand.name));
  const brandFilter = role === 'brand' ? storage.getBrand() || brandNames[0] : null;

  const visibleCampaigns = useMemo(() => {
    if (!brandFilter) return campaigns;
    return campaigns.filter((campaign) => campaign.brand === brandFilter);
  }, [brandFilter, campaigns]);

  const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));

  const totals = useMemo(() => {
    return contentItems.reduce(
      (acc, item) => {
        if (brandFilter) {
          const campaign = campaigns.find((camp) => camp.id === item.campaignId);
          if (!campaign || campaign.brand !== brandFilter) return acc;
        }
        if (!item.metrics) return acc;
        acc.views += item.metrics.views || 0;
        acc.likes += item.metrics.likes || 0;
        acc.comments += item.metrics.comments || 0;
        acc.shares += item.metrics.shares || 0;
        acc.saves += item.metrics.saves || 0;
        return acc;
      },
      { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
    );
  }, [brandFilter, campaigns, contentItems]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Analytics & Reporting</h2>
          <p>Daily refresh for the first 7 days, weekly thereafter.</p>
        </div>
        <button type="button" className="btn btn-secondary">
          Export
        </button>
      </div>

      <div className="metrics-grid">
        <div>
          <span>Views</span>
          <strong>{totals.views.toLocaleString()}</strong>
        </div>
        <div>
          <span>Likes</span>
          <strong>{totals.likes.toLocaleString()}</strong>
        </div>
        <div>
          <span>Comments</span>
          <strong>{totals.comments.toLocaleString()}</strong>
        </div>
        <div>
          <span>Shares</span>
          <strong>{totals.shares.toLocaleString()}</strong>
        </div>
        <div>
          <span>Saves</span>
          <strong>{totals.saves.toLocaleString()}</strong>
        </div>
      </div>

      <div className="card">
        <h3>Campaign Performance</h3>
        <div className="table">
          <div className="table-row header">
            <span>Campaign</span>
            <span>Status</span>
            <span>Creators</span>
            <span>Content</span>
            <span>Trend</span>
          </div>
          {visibleCampaigns.map((campaign) => {
            const campaignContent = contentItems.filter((item) => item.campaignId === campaign.id);
            return (
              <div key={campaign.id} className="table-row">
                <span>{campaign.name}</span>
                <StatusPill status={campaign.status} />
                <span>{campaignContent.length}</span>
                <span>
                  {campaignContent.filter((item) => item.status === 'Published').length} published
                </span>
                <span className="muted">↗ 12%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Creator Analytics</h3>
        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Saves</th>
                <th>Shares</th>
                <th>Engagement Rate</th>
              </tr>
            </thead>
            <tbody>
              {creators.slice(0, 10).map((creator) => {
                const creatorContent = contentItems.filter((item) => {
                  if (item.creatorId !== creator.id) return false;
                  if (brandFilter) {
                    const campaign = campaigns.find((camp) => camp.id === item.campaignId);
                    return campaign?.brand === brandFilter;
                  }
                  return true;
                });
                const metrics = creatorContent.reduce(
                  (acc, item) => {
                    if (!item.metrics) return acc;
                    acc.views += item.metrics.views || 0;
                    acc.likes += item.metrics.likes || 0;
                    acc.comments += item.metrics.comments || 0;
                    acc.saves += item.metrics.saves || 0;
                    acc.shares += item.metrics.shares || 0;
                    return acc;
                  },
                  { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 }
                );

                const engagementRate =
                  metrics.views > 0
                    ? (
                        ((metrics.likes + metrics.comments + metrics.saves + metrics.shares) /
                          metrics.views) *
                        100
                      ).toFixed(2)
                    : '0.00';

                return (
                  <tr key={creator.id}>
                    <td>
                      <div className="creator-cell">
                        <img
                          src={creator.profile_image || '/assets/default-avatar.png'}
                          alt={creator.name}
                          className="creator-avatar-sm"
                        />
                        <span>{creator.name}</span>
                      </div>
                    </td>
                    <td>{metrics.views.toLocaleString()}</td>
                    <td>{metrics.likes.toLocaleString()}</td>
                    <td>{metrics.comments.toLocaleString()}</td>
                    <td>{metrics.saves.toLocaleString()}</td>
                    <td>{metrics.shares.toLocaleString()}</td>
                    <td>
                      <span
                        className={`engagement-badge ${parseFloat(engagementRate) >= 5 ? 'high' : parseFloat(engagementRate) >= 2 ? 'medium' : 'low'}`}
                      >
                        {engagementRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
