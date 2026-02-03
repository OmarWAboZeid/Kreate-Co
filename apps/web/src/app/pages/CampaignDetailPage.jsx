import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ActivityLog from '../components/ActivityLog.jsx';
import ContentLogModal from '../components/ContentLogModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';

const tabs = ['Overview', 'Creators', 'Content', 'Analytics', 'Activity'];

export default function CampaignDetailPage() {
  const { role, campaignId } = useParams();
  const navigate = useNavigate();
  const { campaigns, creators, campaignCreators, contentItems, activity } = useAppState();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState('Overview');
  const [processingSearch, setProcessingSearch] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [decisionErrors, setDecisionErrors] = useState({});
  const [outreachDrafts, setOutreachDrafts] = useState({});
  const [selectedContentId, setSelectedContentId] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ note: '', tags: [] });

  const campaign = campaigns.find((item) => item.id === campaignId);

  const creatorMap = useMemo(() => {
    const map = new Map();
    creators.forEach((creator) => map.set(creator.id, creator));
    return map;
  }, [creators]);

  if (!campaign) {
    return (
      <div className="page-stack">
        <button type="button" className="link-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <EmptyState title="Campaign not found" description="Try selecting a different campaign." />
      </div>
    );
  }

  const creatorState = campaignCreators[campaign.id] || { shortlist: [], approvals: {}, outreach: {} };
  const shortlistCreators = creatorState.shortlist.map((id) => creatorMap.get(id)).filter(Boolean);
  const approvedCreators = shortlistCreators.filter(
    (creator) => creatorState.approvals[creator.id] === 'Brand Approved'
  );
  const confirmedCreators = approvedCreators.filter(
    (creator) => creatorState.outreach[creator.id]?.status === 'Confirmed'
  );

  const campaignContent = contentItems.filter((content) => content.campaignId === campaign.id);
  useEffect(() => {
    if (!selectedContentId && campaignContent.length > 0) {
      setSelectedContentId(campaignContent[0].id);
    }
  }, [campaignContent, selectedContentId]);

  useEffect(() => {
    setFeedbackForm({ note: '', tags: [] });
  }, [selectedContentId]);

  const selectedContent = campaignContent.find((content) => content.id === selectedContentId) || null;

  const handleRunSearch = () => {
    setProcessingSearch(true);
    setTimeout(() => {
      setProcessingSearch(false);
      setSearchComplete(true);
    }, 700);
  };

  const handleShortlist = (creatorId) => {
    dispatch({ type: 'SHORTLIST_CREATOR', payload: { campaignId: campaign.id, creatorId } });
  };

  const handleRemoveShortlist = (creatorId) => {
    dispatch({ type: 'REMOVE_SHORTLIST', payload: { campaignId: campaign.id, creatorId } });
  };

  const handleMoveShortlist = (from, to) => {
    dispatch({ type: 'MOVE_SHORTLIST', payload: { campaignId: campaign.id, from, to } });
  };

  const handleSendShortlist = () => {
    dispatch({ type: 'SEND_SHORTLIST', payload: { campaignId: campaign.id } });
  };

  const handleDecision = (creatorId, decision) => {
    if (decision === 'Brand Rejected' && !decisionNotes[creatorId]) {
      setDecisionErrors((prev) => ({ ...prev, [creatorId]: 'Rejection reason required.' }));
      return;
    }
    setDecisionErrors((prev) => ({ ...prev, [creatorId]: '' }));
    dispatch({
      type: 'SET_CREATOR_DECISION',
      payload: {
        campaignId: campaign.id,
        creatorId,
        decision,
        actor: 'Brand',
        note: decisionNotes[creatorId] || '',
      },
    });
  };

  const handleOutreachUpdate = (creatorId, field, value) => {
    setOutreachDrafts((prev) => ({
      ...prev,
      [creatorId]: {
        ...prev[creatorId],
        [field]: value,
      },
    }));
  };

  const handleLogOutreach = (creatorId) => {
    const draft = outreachDrafts[creatorId];
    if (!draft?.method || !draft?.status) return;
    dispatch({
      type: 'LOG_OUTREACH',
      payload: {
        campaignId: campaign.id,
        creatorId,
        method: draft.method,
        status: draft.status,
        note: draft.note || '',
      },
    });
  };

  const handleActivateCampaign = () => {
    dispatch({ type: 'ACTIVATE_CAMPAIGN', payload: { campaignId: campaign.id } });
  };

  const handleFeedbackTag = (tag) => {
    setFeedbackForm((prev) => {
      const tags = prev.tags.includes(tag)
        ? prev.tags.filter((item) => item !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags };
    });
  };

  const handleContentDecision = (status) => {
    if (!selectedContent) return;
    if (status === 'Revision Requested' && !feedbackForm.note) {
      return;
    }
    dispatch({
      type: 'REVIEW_CONTENT',
      payload: {
        contentId: selectedContent.id,
        status,
        actor: 'Brand',
        feedback: {
          note: feedbackForm.note,
          tags: feedbackForm.tags,
        },
      },
    });
    setFeedbackForm({ note: '', tags: [] });
  };

  const handlePublish = (contentId) => {
    const url = window.prompt('Enter published URL');
    if (!url) return;
    dispatch({ type: 'MARK_PUBLISHED', payload: { contentId, url } });
  };

  const canActivate = confirmedCreators.length > 0 && approvedCreators.length > 0;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <button type="button" className="link-button" onClick={() => navigate(-1)}>
            ← Back to campaigns
          </button>
          <h2>{campaign.name}</h2>
          <p>{campaign.brand}</p>
        </div>
        <div className="page-header-actions">
          <StatusPill status={campaign.status} />
          {role === 'admin' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleActivateCampaign}
              disabled={!canActivate}
            >
              Activate Campaign
            </button>
          )}
        </div>
      </div>

      <div className="tab-row">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'active' : undefined}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="overview-grid">
          <div className="card">
            <h3>Campaign Summary</h3>
            <p>Status: {campaign.status}</p>
            <p>Platforms: {campaign.platforms.join(' / ')}</p>
            <p>Budget: {campaign.budgetRange}</p>
            <p>
              Timeline: {campaign.timeline.start || 'TBD'} → {campaign.timeline.end || 'TBD'}
            </p>
          </div>
          <div className="card">
            <h3>Criteria v{campaign.criteriaVersion || 0}</h3>
            <ul className="list">
              <li>Followers: {campaign.criteria.followersMin} - {campaign.criteria.followersMax}</li>
              <li>Niche: {campaign.criteria.niche}</li>
              <li>Region: {campaign.criteria.region}</li>
              <li>Engagement: {campaign.criteria.engagement}</li>
              <li>Language: {campaign.criteria.language}</li>
            </ul>
          </div>
          <div className="card">
            <h3>Objectives</h3>
            <p>{campaign.objectives}</p>
            <h4>Notes</h4>
            <p>{campaign.notes}</p>
          </div>
          <div className="card">
            <h3>Activity Snapshot</h3>
            <ActivityLog entries={(activity.campaigns[campaign.id] || []).slice(0, 3)} />
          </div>
        </div>
      )}

      {activeTab === 'Creators' && role === 'admin' && (
        <div className="page-stack">
          <div className="card">
            <div className="card-header">
              <div>
                <h3>Creator Search</h3>
                <p>Criteria v{campaign.criteriaVersion || 0}</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleRunSearch}>
                {processingSearch ? 'Processing...' : 'Run Search'}
              </button>
            </div>
            <div className="filters-bar">
              <input
                className="input"
                placeholder="Follower min"
                defaultValue={campaign.criteria.followersMin}
                disabled={campaign.status !== 'Draft'}
              />
              <input
                className="input"
                placeholder="Follower max"
                defaultValue={campaign.criteria.followersMax}
                disabled={campaign.status !== 'Draft'}
              />
              <input
                className="input"
                placeholder="Niche"
                defaultValue={campaign.criteria.niche}
                disabled={campaign.status !== 'Draft'}
              />
              <input
                className="input"
                placeholder="Region"
                defaultValue={campaign.criteria.region}
                disabled={campaign.status !== 'Draft'}
              />
            </div>

            {processingSearch && <p className="muted">Processing creator recommendations...</p>}
            {searchComplete && (
              <div className="split-grid">
                <div>
                  <h4>Results</h4>
                  <div className="creator-list">
                    {creators.map((creator) => (
                      <div key={creator.id} className="creator-card">
                        <div>
                          <h5>{creator.name}</h5>
                          <p>
                            {creator.handles.instagram} · {creator.niche}
                          </p>
                          <p>Engagement {creator.engagement}%</p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleShortlist(creator.id)}
                        >
                          Shortlist
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Shortlist</h4>
                  {shortlistCreators.length === 0 ? (
                    <p className="muted">No creators shortlisted yet.</p>
                  ) : (
                    <div className="shortlist">
                      {shortlistCreators.map((creator, index) => (
                        <div key={creator.id} className="shortlist-item">
                          <div>
                            <strong>{creator.name}</strong>
                            <span>{creator.handles.instagram}</span>
                          </div>
                          <div className="shortlist-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleMoveShortlist(index, Math.max(0, index - 1))}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleMoveShortlist(index, Math.min(shortlistCreators.length - 1, index + 1))}
                              disabled={index === shortlistCreators.length - 1}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleRemoveShortlist(creator.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-primary" onClick={handleSendShortlist}>
                    Send shortlist to Brand for review
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Approved Creators & Outreach</h3>
            {approvedCreators.length === 0 ? (
              <p className="muted">No approved creators yet.</p>
            ) : (
              <div className="creator-list">
                {approvedCreators.map((creator) => {
                  const outreach = creatorState.outreach[creator.id] || {};
                  const draft = outreachDrafts[creator.id] || outreach;
                  return (
                    <div key={creator.id} className="creator-card">
                      <div>
                        <h5>{creator.name}</h5>
                        <p>{creator.handles.instagram}</p>
                        <StatusPill status={outreach.status || 'Outreach Pending'} />
                      </div>
                      <div className="outreach-controls">
                        <select
                          className="input"
                          value={draft.method || ''}
                          onChange={(e) => handleOutreachUpdate(creator.id, 'method', e.target.value)}
                        >
                          <option value="">Method</option>
                          <option>WhatsApp</option>
                          <option>Email</option>
                          <option>Other</option>
                        </select>
                        <select
                          className="input"
                          value={draft.status || ''}
                          onChange={(e) => handleOutreachUpdate(creator.id, 'status', e.target.value)}
                        >
                          <option value="">Status</option>
                          <option>Outreach Pending</option>
                          <option>Awaiting Creator Confirmation</option>
                          <option>Confirmed</option>
                          <option>Need Alternative</option>
                        </select>
                        <input
                          className="input"
                          placeholder="Note"
                          value={draft.note || ''}
                          onChange={(e) => handleOutreachUpdate(creator.id, 'note', e.target.value)}
                        />
                        <button type="button" className="btn btn-secondary" onClick={() => handleLogOutreach(creator.id)}>
                          Log
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Creators' && role === 'brand' && (
        <div className="page-stack">
          <div className="card">
            <h3>Creators Awaiting Review</h3>
            {shortlistCreators.length === 0 ? (
              <p className="muted">No creators to review yet.</p>
            ) : (
              <div className="creator-list">
                {shortlistCreators.map((creator) => {
                  const decision = creatorState.approvals[creator.id] || 'Suggested';
                  return (
                    <div key={creator.id} className="creator-card">
                      <div>
                        <h5>{creator.name}</h5>
                        <p>
                          {creator.handles.instagram} · {creator.niche} · {creator.region}
                        </p>
                        <p>Engagement {creator.engagement}%</p>
                        <StatusPill status={decision} />
                        <button type="button" className="link-button">
                          View full profile
                        </button>
                      </div>
                      <div className="creator-actions">
                        <textarea
                          className="input"
                          rows="2"
                          placeholder="Reason if rejecting"
                          value={decisionNotes[creator.id] || ''}
                          onChange={(e) =>
                            setDecisionNotes((prev) => ({ ...prev, [creator.id]: e.target.value }))
                          }
                        />
                        {decisionErrors[creator.id] && <p className="error-text">{decisionErrors[creator.id]}</p>}
                        <div className="button-row">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleDecision(creator.id, 'Brand Approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleDecision(creator.id, 'Brand Rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Content' && (
        <div className="page-stack">
          <div className="page-header">
            <div>
              <h3>Content Queue</h3>
              <p>Track every deliverable and its review state.</p>
            </div>
            {role === 'admin' && (
              <button type="button" className="btn btn-primary" onClick={() => setShowContentModal(true)}>
                Log new content delivery
              </button>
            )}
          </div>
          {campaignContent.length === 0 ? (
            <EmptyState
              title="No content yet"
              description="Log creator deliveries to start the review flow."
              action={
                role === 'admin' ? (
                  <button type="button" className="btn btn-primary" onClick={() => setShowContentModal(true)}>
                    Log content
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="content-grid">
              <div className="content-list">
                {campaignContent.map((content) => {
                  const creator = creatorMap.get(content.creatorId);
                  return (
                    <button
                      key={content.id}
                      type="button"
                      className={selectedContentId === content.id ? 'content-row active' : 'content-row'}
                      onClick={() => setSelectedContentId(content.id)}
                    >
                      <div>
                        <strong>{creator?.name || 'Creator'}</strong>
                        <span>
                          {content.platform} · {content.type}
                        </span>
                      </div>
                      <StatusPill status={content.status} />
                    </button>
                  );
                })}
              </div>
              <div className="content-detail">
                {selectedContent ? (
                  <div>
                    <div className="content-preview">
                      <p>Media preview</p>
                    </div>
                    <h4>{creatorMap.get(selectedContent.creatorId)?.name}</h4>
                    <p>{selectedContent.caption}</p>
                    <p className="muted">{selectedContent.hashtags}</p>
                    {selectedContent.assets?.length > 0 && (
                      <div className="asset-list">
                        {selectedContent.assets.map((asset) => (
                          <a key={asset.url} href={asset.url} className="link-button" target="_blank" rel="noreferrer">
                            {asset.label || asset.url}
                          </a>
                        ))}
                      </div>
                    )}
                    <StatusPill status={selectedContent.status} />
                    <p className="muted">Revisions: {selectedContent.revisionCount}</p>

                    {role === 'brand' && (
                      <div className="review-panel">
                        <p className="label">Feedback tags</p>
                        <div className="pill-group">
                          {['Change hook', 'Adjust tone', 'Fix branding mention', 'Update CTA'].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={feedbackForm.tags.includes(tag) ? 'active' : undefined}
                              onClick={() => handleFeedbackTag(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="input"
                          rows="3"
                          placeholder="Add feedback (required for revision request)"
                          value={feedbackForm.note}
                          onChange={(e) => setFeedbackForm((prev) => ({ ...prev, note: e.target.value }))}
                        />
                        {selectedContent.revisionCount >= 3 && (
                          <p className="warning-text">Maximum revisions reached. Manual escalation required.</p>
                        )}
                        <div className="button-row">
                          <button type="button" className="btn btn-secondary" onClick={() => handleContentDecision('Approved')}>
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleContentDecision('Revision Requested')}
                            disabled={selectedContent.revisionCount >= 3}
                          >
                            Request Revision
                          </button>
                        </div>
                      </div>
                    )}

                    {role === 'admin' && selectedContent.status === 'Approved' && (
                      <button type="button" className="btn btn-primary" onClick={() => handlePublish(selectedContent.id)}>
                        Mark as Published
                      </button>
                    )}

                    <div className="content-activity">
                      <h4>Activity</h4>
                      <ActivityLog entries={activity.content[selectedContent.id] || []} />
                    </div>
                  </div>
                ) : (
                  <p className="muted">Select a content item to review.</p>
                )}
              </div>
            </div>
          )}
          <ContentLogModal
            open={showContentModal}
            onClose={() => setShowContentModal(false)}
            initialCampaignId={campaign.id}
          />
        </div>
      )}

      {activeTab === 'Analytics' && (
        <div className="page-stack">
          <div className="card">
            <h3>Analytics Snapshot</h3>
            <p>Daily refresh (first 7 days), weekly thereafter.</p>
            <div className="metrics-grid">
              <div>
                <span>Views</span>
                <strong>82k</strong>
              </div>
              <div>
                <span>Likes</span>
                <strong>7.4k</strong>
              </div>
              <div>
                <span>Shares</span>
                <strong>210</strong>
              </div>
              <div>
                <span>Engagement</span>
                <strong>10.5%</strong>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Creator Breakdown</h3>
            <div className="table">
              <div className="table-row header">
                <span>Creator</span>
                <span>Content</span>
                <span>Status</span>
                <span>Views</span>
              </div>
              {campaignContent.map((content) => {
                const creator = creatorMap.get(content.creatorId);
                return (
                  <div key={content.id} className="table-row">
                    <span>{creator?.name}</span>
                    <span>{content.type}</span>
                    <span>{content.status}</span>
                    <span>{content.metrics?.views || '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Activity' && (
        <div className="card">
          <h3>Activity Log</h3>
          <ActivityLog entries={activity.campaigns[campaign.id] || []} />
        </div>
      )}
    </div>
  );
}
