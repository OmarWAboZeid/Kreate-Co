import EmptyState from './EmptyState.jsx';

export default function BrandRecommendations({
  loading,
  recommendedCreators,
  creatorStatuses,
  expandedCreator,
  onToggleExpand,
  onApprove,
  onReject,
  workflowStatuses,
  workflowStatusMap,
  onWorkflowStatusChange,
  videoLinks,
  onVideoLinkChange,
  onOpenAddContent,
}) {
  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  if (recommendedCreators.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Our team will suggest creators for your active campaigns."
      />
    );
  }

  return (
    <div className="brand-creators-list">
      {recommendedCreators.map((creator) => {
        const status = creatorStatuses[creator.id];
        const isApproved = status === 'approved';
        const isRejected = status?.status === 'rejected';
        const isExpanded = expandedCreator === creator.id;

        return (
          <div
            key={creator.id}
            className={`brand-creator-card ${isApproved ? 'approved' : ''} ${
              isRejected ? 'rejected' : ''
            }`}
          >
            <div className="brand-creator-main" onClick={() => onToggleExpand(creator.id)}>
              <div className="brand-creator-avatar">
                <img
                  src={creator.profile_image || '/assets/default-avatar.png'}
                  alt={creator.name}
                />
              </div>
              <div className="brand-creator-info">
                <h4>{creator.name}</h4>
                <p className="brand-creator-meta">
                  {creator.niche || 'General'} • {creator.followers || '—'} followers
                </p>
                <p className="brand-creator-campaign">
                  Recommended for: <strong>{creator.recommendedFor}</strong>
                </p>
              </div>
              <div className="brand-creator-score">
                <span className="match-score">{creator.matchScore}%</span>
                <span className="match-label">Match</span>
              </div>
              {!isApproved && !isRejected && (
                <div className="brand-creator-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={(event) => {
                      event.stopPropagation();
                      onApprove(creator);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReject(creator);
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
              {isApproved && <span className="status-badge approved">Approved</span>}
              {isRejected && <span className="status-badge rejected">Rejected</span>}
            </div>

            {isExpanded && (
              <div className="brand-creator-content-review">
                <div className="creator-workflow-section">
                  <div className="workflow-row">
                    <label>
                      <span>Status</span>
                      <select
                        className="creator-status-dropdown"
                        value={workflowStatusMap[creator.id] || ''}
                        onChange={(event) => onWorkflowStatusChange(creator.id, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <option value="">Select Status</option>
                        {workflowStatuses.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-add-content"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenAddContent(creator);
                      }}
                    >
                      + Add Submitted Content
                    </button>
                  </div>
                  <div className="video-link-input">
                    <input
                      type="url"
                      placeholder="Final video link (for analytics)"
                      value={videoLinks[creator.id] || ''}
                      onChange={(event) => onVideoLinkChange(creator.id, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                </div>
                <h5>Content Review</h5>
                <div className="content-review-empty">
                  <p>No content submitted yet for review.</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
