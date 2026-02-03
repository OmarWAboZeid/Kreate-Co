import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ActivityLog from '../components/ActivityLog.jsx';
import ContentLogModal from '../components/ContentLogModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { storage, useAppDispatch, useAppState, utils } from '../state.jsx';

export default function ContentPage() {
  const { role } = useParams();
  const { contentItems, creators, campaigns, activity, brands } = useAppState();
  const dispatch = useAppDispatch();
  const [showModal, setShowModal] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ note: '', tags: [] });
  const [creatorForm, setCreatorForm] = useState({
    campaignId: '',
    platform: 'Instagram',
    type: 'Reel',
    link: '',
    caption: '',
    hashtags: '',
  });

  const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const brandFilter = role === 'brand' ? storage.getBrand() || brands[0] : null;
  const creatorFilter = role === 'creator' ? storage.getCreator() || creators[0]?.id : null;
  const visibleContentItems = contentItems.filter((item) => {
    if (brandFilter && campaignMap.get(item.campaignId)?.brand !== brandFilter) return false;
    if (creatorFilter && item.creatorId !== creatorFilter) return false;
    return true;
  });

  useEffect(() => {
    if ((role === 'brand' || role === 'creator') && !selectedContentId && visibleContentItems.length > 0) {
      setSelectedContentId(visibleContentItems[0].id);
    }
  }, [role, selectedContentId, visibleContentItems]);

  useEffect(() => {
    setFeedbackForm({ note: '', tags: [] });
  }, [selectedContentId]);

  useEffect(() => {
    if (role === 'creator' && !creatorForm.campaignId && campaigns.length > 0) {
      setCreatorForm((prev) => ({ ...prev, campaignId: campaigns[0].id }));
    }
  }, [campaigns, creatorForm.campaignId, role]);

  const selectedContent = visibleContentItems.find((content) => content.id === selectedContentId);

  const handlePublish = (contentId) => {
    const url = window.prompt('Enter published URL');
    if (!url) return;
    dispatch({ type: 'MARK_PUBLISHED', payload: { contentId, url } });
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
    if (status === 'Revision Requested' && !feedbackForm.note) return;
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

  const handleCreatorSubmit = () => {
    if (!creatorFilter || !creatorForm.campaignId) return;
    const content = {
      id: utils.makeId('cnt'),
      campaignId: creatorForm.campaignId,
      creatorId: creatorFilter,
      platform: creatorForm.platform,
      type: creatorForm.type,
      status: 'Pending Review',
      revisionCount: 0,
      caption: creatorForm.caption,
      hashtags: creatorForm.hashtags,
      assets: creatorForm.link ? [{ type: 'link', label: 'Delivery link', url: creatorForm.link }] : [],
      submittedAt: new Date().toISOString().slice(0, 10),
      notes: 'Submitted by creator (test flow).',
      feedback: [],
    };
    dispatch({ type: 'LOG_CONTENT_DELIVERY', payload: { content } });
    setCreatorForm((prev) => ({ ...prev, link: '', caption: '', hashtags: '' }));
    setSelectedContentId(content.id);
  };

  if (visibleContentItems.length === 0 && role !== 'creator') {
    return (
      <EmptyState
        title={role === 'brand' ? 'No saved content yet' : 'No content logged'}
        description={role === 'brand' ? 'Approved content from your campaigns will appear here.' : 'Log creator deliveries to start the review flow.'}
        action={
          role === 'admin' ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
              Log content
            </button>
          ) : null
        }
      />
    );
  }

  if (role === 'brand') {
    const approvedContent = visibleContentItems.filter(item => item.status === 'Approved' || item.status === 'Published');
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2>Saved Content</h2>
            <p>Your approved content library for download and repurposing.</p>
          </div>
        </div>

        {approvedContent.length === 0 ? (
          <EmptyState
            title="No saved content yet"
            description="Content approved from your campaigns will appear here."
          />
        ) : (
          <div className="saved-content-grid">
            {approvedContent.map((item) => {
              const campaign = campaigns.find(c => c.id === item.campaignId);
              const creator = creatorMap.get(item.creatorId);
              return (
                <div key={item.id} className="saved-content-card">
                  <div className="saved-content-preview">
                    {item.type === 'Reel' ? '🎬' : item.type === 'Post' ? '📷' : item.type === 'Story' ? '📱' : '🎥'}
                  </div>
                  <div className="saved-content-info">
                    <h4>{item.type} - {item.platform}</h4>
                    <p className="saved-content-meta">
                      {creator?.name || 'Unknown'} • {campaign?.name || 'Unknown Campaign'}
                    </p>
                    <p className="saved-content-meta">
                      {item.submittedAt}
                    </p>
                    <div className="saved-content-actions">
                      <button type="button" className="btn btn-secondary">Download</button>
                      <button type="button" className="btn btn-primary">View</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>{role === 'admin' ? 'Content Queue' : 'Content Review'}</h2>
          <p>Track submissions, approvals, and revisions.</p>
        </div>
        {role === 'admin' && (
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            Log new content delivery
          </button>
        )}
      </div>

      {role === 'creator' ? (
        <>
          <div className="card">
            <h3>Submit Delivery</h3>
            <div className="wizard-panel">
              <label>
                Campaign
                <select
                  className="input"
                  value={creatorForm.campaignId}
                  onChange={(e) => setCreatorForm((prev) => ({ ...prev, campaignId: e.target.value }))}
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-row">
                <label>
                  Platform
                  <select
                    className="input"
                    value={creatorForm.platform}
                    onChange={(e) => setCreatorForm((prev) => ({ ...prev, platform: e.target.value }))}
                  >
                    <option>Instagram</option>
                    <option>TikTok</option>
                  </select>
                </label>
                <label>
                  Type
                  <select
                    className="input"
                    value={creatorForm.type}
                    onChange={(e) => setCreatorForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option>Reel</option>
                    <option>Post</option>
                    <option>Story</option>
                    <option>Video</option>
                  </select>
                </label>
              </div>
              <label>
                Delivery link
                <input
                  className="input"
                  value={creatorForm.link}
                  onChange={(e) => setCreatorForm((prev) => ({ ...prev, link: e.target.value }))}
                  placeholder="Paste Drive or Dropbox link"
                />
              </label>
              <label>
                Caption
                <textarea
                  className="input"
                  rows="2"
                  value={creatorForm.caption}
                  onChange={(e) => setCreatorForm((prev) => ({ ...prev, caption: e.target.value }))}
                />
              </label>
              <label>
                Hashtags
                <input
                  className="input"
                  value={creatorForm.hashtags}
                  onChange={(e) => setCreatorForm((prev) => ({ ...prev, hashtags: e.target.value }))}
                />
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleCreatorSubmit}>
              Submit for Review
            </button>
          </div>

          {visibleContentItems.length === 0 ? (
            <EmptyState title="No deliveries yet" description="Submit your first delivery to begin review." />
          ) : (
            <div className="content-grid">
              <div className="content-list">
                {visibleContentItems.map((content) => {
                  const creator = creatorMap.get(content.creatorId);
                  return (
                    <button
                      key={content.id}
                      type="button"
                      className={selectedContentId === content.id ? 'content-row active' : 'content-row'}
                      onClick={() => setSelectedContentId(content.id)}
                    >
                      <div>
                        <strong>{creator?.name}</strong>
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
                    <div className="content-activity">
                      <h4>Activity</h4>
                      <ActivityLog entries={activity.content[selectedContent.id] || []} />
                    </div>
                  </div>
                ) : (
                  <p className="muted">Select a delivery to review its status.</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : role === 'admin' ? (
        <div className="table">
          <div className="table-row header">
            <span>Campaign</span>
            <span>Creator</span>
            <span>Platform</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {visibleContentItems.map((content) => {
            const campaign = campaignMap.get(content.campaignId);
            const creator = creatorMap.get(content.creatorId);
            return (
              <div key={content.id} className="table-row">
                <span>{campaign?.name}</span>
                <span>{creator?.name}</span>
                <span>
                  {content.platform} · {content.type}
                </span>
                <StatusPill status={content.status} />
                {content.status === 'Approved' ? (
                  <button type="button" className="link-button" onClick={() => handlePublish(content.id)}>
                    Mark published
                  </button>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="content-grid">
          <div className="content-list">
            {visibleContentItems.map((content) => {
              const creator = creatorMap.get(content.creatorId);
              return (
                <button
                  key={content.id}
                  type="button"
                  className={selectedContentId === content.id ? 'content-row active' : 'content-row'}
                  onClick={() => setSelectedContentId(content.id)}
                >
                  <div>
                    <strong>{creator?.name}</strong>
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

      <ContentLogModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
