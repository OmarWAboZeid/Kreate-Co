import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import StatusPill from '../components/StatusPill.jsx';
import { storage, useAppState } from '../state.jsx';

export default function AnalyticsPage() {
  const { role } = useParams();
  const { campaigns, contentItems, creators, brands } = useAppState();

  const brandFilter = role === 'brand' ? storage.getBrand() || brands[0] : null;

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
          Export (Phase 2)
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
                <span>{campaignContent.filter((item) => item.status === 'Published').length} published</span>
                <span className="muted">↗ 12%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Creator Breakdown</h3>
        <div className="table">
          <div className="table-row header">
            <span>Creator</span>
            <span>Campaign</span>
            <span>Status</span>
            <span>Views</span>
          </div>
          {contentItems
            .filter((item) => {
              if (!brandFilter) return true;
              const campaign = campaigns.find((camp) => camp.id === item.campaignId);
              return campaign?.brand === brandFilter;
            })
            .map((item) => (
              <div key={item.id} className="table-row">
                <span>{creatorMap.get(item.creatorId)?.name}</span>
                <span>{campaigns.find((camp) => camp.id === item.campaignId)?.name}</span>
                <span>{item.status}</span>
                <span>{item.metrics?.views || '—'}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
