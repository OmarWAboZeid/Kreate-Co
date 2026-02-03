import { useMemo } from 'react';
import StatusPill from '../components/StatusPill.jsx';
import { useAppState, storage } from '../state.jsx';

export default function CreatorAssignmentsPage() {
  const { campaigns, contentItems, creators } = useAppState();
  const creatorId = storage.getCreator() || creators[0]?.id;

  const assignments = useMemo(() => {
    if (!creatorId) return [];
    const items = contentItems.filter((item) => item.creatorId === creatorId);
    if (items.length > 0) return items;
    return campaigns.map((campaign) => ({
      id: campaign.id,
      campaignId: campaign.id,
      status: campaign.status,
      type: 'Draft request',
    }));
  }, [campaigns, contentItems, creatorId]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Assignments</h2>
          <p>Track what needs to be delivered next.</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="empty-state">
          <h3>No assignments yet</h3>
          <p>You'll see campaign requests here as soon as they are assigned.</p>
        </div>
      ) : (
        <div className="card-grid">
          {assignments.map((assignment) => {
            const campaign = campaigns.find((item) => item.id === assignment.campaignId);
            return (
              <div key={assignment.id} className="card">
                <StatusPill status={assignment.status} />
                <h3>{campaign?.name || 'Campaign'}</h3>
                <p>{assignment.type}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
