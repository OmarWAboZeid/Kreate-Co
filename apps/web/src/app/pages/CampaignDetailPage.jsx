import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export default function CampaignDetailPage() {
  const { role, campaignId } = useParams();
  const navigate = useNavigate();
  const { campaigns, creators, campaignCreators, contentItems } = useAppState();
  const dispatch = useAppDispatch();
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });
  const [contentForm, setContentForm] = useState({ link: '', platform: '', type: '', notes: '' });

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

  const filteredCreators = useMemo(() => {
    let result = shortlistCreators;
    if (creatorFilter === 'approved') {
      result = result.filter((c) => creatorState.approvals[c.id] === 'Brand Approved');
    } else if (creatorFilter === 'rejected') {
      result = result.filter((c) => creatorState.approvals[c.id] === 'Brand Rejected');
    } else if (creatorFilter === 'pending') {
      result = result.filter((c) => !creatorState.approvals[c.id] || creatorState.approvals[c.id] === 'Suggested');
    }
    if (creatorSearch) {
      const search = creatorSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(search));
    }
    return result;
  }, [shortlistCreators, creatorFilter, creatorSearch, creatorState.approvals]);

  const handleStatusChange = (creatorId, status) => {
    dispatch({
      type: 'SET_CREATOR_WORKFLOW_STATUS',
      payload: { campaignId: campaign.id, creatorId, status },
    });
  };

  const handleFinalLinkChange = (creatorId, link) => {
    dispatch({
      type: 'SET_CREATOR_WORKFLOW_STATUS',
      payload: { campaignId: campaign.id, creatorId, finalVideoLink: link },
    });
  };

  const handleDecision = (creatorId, decision) => {
    dispatch({
      type: 'SET_CREATOR_DECISION',
      payload: {
        campaignId: campaign.id,
        creatorId,
        decision,
        actor: role === 'brand' ? 'Brand' : 'Admin',
        note: '',
      },
    });
  };

  const handleAddContent = () => {
    if (!contentForm.link || !addContentModal.creator) return;
    
    const newContent = {
      id: makeId('content'),
      campaignId: campaign.id,
      creatorId: addContentModal.creator.id,
      platform: contentForm.platform || 'TikTok',
      type: contentForm.type || 'Reel',
      caption: contentForm.notes || '',
      hashtags: '',
      assets: [{ url: contentForm.link, label: 'Submitted content' }],
      status: 'Pending Review',
      revisionCount: 0,
      feedback: [],
      createdAt: new Date().toISOString(),
    };
    
    dispatch({ type: 'LOG_CONTENT_DELIVERY', payload: { content: newContent } });
    setAddContentModal({ open: false, creator: null });
    setContentForm({ link: '', platform: '', type: '', notes: '' });
  };

  const campaignContent = contentItems.filter((c) => c.campaignId === campaignId);

  const campaignType = campaign.campaignType || 'Hybrid';
  const isHybrid = campaignType === 'Hybrid';
  const isUGC = campaignType === 'UGC';
  const isInfluencer = campaignType === 'Influencer';
  const showUGC = isUGC || isHybrid || !campaignType;
  const showInfluencer = isInfluencer || isHybrid || !campaignType;

  return (
    <div className="campaign-details-page">
      <div className="campaign-details-header">
        <button type="button" className="link-button" onClick={() => navigate(-1)}>
          ← Back to campaigns
        </button>
        <div className="campaign-details-title">
          <div className="campaign-title-row">
            <h1>{campaign.name}</h1>
            <StatusPill status={campaign.status} />
          </div>
          <p className="campaign-brand-name">{campaign.brand}</p>
        </div>
        {role === 'admin' && (
          <div className="campaign-details-actions">
            <button type="button" className="btn btn-secondary">Edit</button>
            <button type="button" className="btn btn-secondary">Archive</button>
          </div>
        )}
      </div>

      <div className="campaign-details-grid">
        <section className="detail-card">
          <div className="detail-card-header">
            <h3>Overview</h3>
          </div>
          <div className="detail-card-content">
            <div className="detail-row">
              <span className="detail-label">Campaign Type</span>
              <span className="detail-value">{campaign.campaignType || 'Hybrid'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Deal Type</span>
              <span className="detail-value">{campaign.paymentType || 'Paid'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Start Date</span>
              <span className="detail-value">{campaign.timeline?.start || campaign.startDate || 'TBD'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Objectives</span>
              <div className="detail-chips">
                {Array.isArray(campaign.objectives) 
                  ? campaign.objectives.map((obj) => (
                      <span key={obj} className="chip">{obj}</span>
                    ))
                  : <span className="chip">{campaign.objectives || 'Awareness'}</span>
                }
              </div>
            </div>
          </div>
        </section>

        <section className="detail-card">
          <div className="detail-card-header">
            <h3>Package</h3>
          </div>
          <div className="detail-card-content">
            <div className="detail-row">
              <span className="detail-label">Package Type</span>
              <span className="detail-value">{campaign.packageType || 'Custom'}</span>
            </div>
            {campaign.bundle && (
              <div className="detail-row">
                <span className="detail-label">Bundle</span>
                <span className="detail-value">{campaign.bundle}</span>
              </div>
            )}
            {campaign.ugcCount && (
              <div className="detail-row">
                <span className="detail-label">UGC Videos</span>
                <span className="detail-value">{campaign.ugcCount}</span>
              </div>
            )}
            {campaign.influencerCount && (
              <div className="detail-row">
                <span className="detail-label">Influencer Videos</span>
                <span className="detail-value">{campaign.influencerCount}</span>
              </div>
            )}
            {campaign.customPackage && (
              <div className="detail-row">
                <span className="detail-label">Custom Details</span>
                <span className="detail-value">{campaign.customPackage}</span>
              </div>
            )}
          </div>
        </section>

        {showUGC && (
          <section className="detail-card">
            <div className="detail-card-header">
              <h3>UGC Requirements</h3>
            </div>
            <div className="detail-card-content">
              <div className="detail-row">
                <span className="detail-label">Persona</span>
                <span className="detail-value">{campaign.ugc?.persona || 'Any'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Gender</span>
                <span className="detail-value">{campaign.ugc?.gender || 'Any'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Age Range</span>
                <span className="detail-value">{campaign.ugc?.ageRange || '18-35'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Videos</span>
                <span className="detail-value">{campaign.ugcCount || 'TBD'}</span>
              </div>
            </div>
          </section>
        )}

        {showInfluencer && (
          <section className="detail-card">
            <div className="detail-card-header">
              <h3>Influencer Requirements</h3>
            </div>
            <div className="detail-card-content">
              <div className="detail-row">
                <span className="detail-label">Creator Tiers</span>
                <div className="detail-chips">
                  {Array.isArray(campaign.creatorTiers) && campaign.creatorTiers.length > 0
                    ? campaign.creatorTiers.map((tier) => (
                        <span key={tier} className="chip">{tier}</span>
                      ))
                    : <span className="chip">Micro</span>
                  }
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Niche</span>
                <span className="detail-value">{campaign.influencer?.niche || campaign.criteria?.niche || 'Lifestyle'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Platforms</span>
                <div className="detail-chips">
                  {campaign.platforms?.filter(p => p !== 'YouTube').map((platform) => (
                    <span key={platform} className="chip">{platform}</span>
                  ))}
                </div>
              </div>
              <div className="detail-row">
                <span className="detail-label">Content Formats</span>
                <div className="detail-chips">
                  {campaign.contentFormat?.filter(f => f !== 'Live').map((format) => (
                    <span key={format} className="chip">{format}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <section className="detail-card creator-network-section">
        <div className="detail-card-header">
          <h3>Creator Network</h3>
          <div className="creator-network-filters">
            <input
              type="text"
              className="input"
              placeholder="Search creators..."
              value={creatorSearch}
              onChange={(e) => setCreatorSearch(e.target.value)}
            />
            <select
              className="input"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
            >
              <option value="all">All Creators</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="detail-card-content">
          {filteredCreators.length === 0 ? (
            <EmptyState
              title="No creators assigned"
              description="Creators will appear here once they are shortlisted for this campaign."
            />
          ) : (
            <div className="creator-network-list">
              {filteredCreators.map((creator) => {
                const decision = creatorState.approvals[creator.id] || 'Suggested';
                const outreach = creatorState.outreach[creator.id] || {};
                const status = outreach.workflowStatus || 'Filming';
                const finalLink = outreach.finalVideoLink || '';
                const creatorContent = campaignContent.filter((c) => c.creatorId === creator.id);
                return (
                  <div key={creator.id} className="creator-network-card">
                    <div className="creator-info">
                      <div className="creator-avatar">
                        {creator.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="creator-details">
                        <h4>{creator.name}</h4>
                        <p>{creator.handles?.instagram || creator.handle || '@creator'} · {creator.niche}</p>
                        <div className="creator-status-row">
                          <StatusPill status={decision} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="creator-workflow">
                      <div className="workflow-field">
                        <label>Status</label>
                        <select
                          className="input"
                          value={status}
                          onChange={(e) => handleStatusChange(creator.id, e.target.value)}
                        >
                          <option value="Filming">Filming</option>
                          <option value="Brief Sent">Brief Sent</option>
                          <option value="Posted">Posted</option>
                          <option value="Need Alternative">Need Alternative</option>
                        </select>
                      </div>
                      <div className="workflow-field">
                        <label>Final Video Link</label>
                        <input
                          type="url"
                          className="input"
                          placeholder="Enter video URL"
                          value={finalLink}
                          onChange={(e) => handleFinalLinkChange(creator.id, e.target.value)}
                        />
                      </div>
                    </div>

                    {creatorContent.length > 0 && (
                      <div className="creator-submitted-content">
                        <h5>Submitted Content ({creatorContent.length})</h5>
                        <div className="submitted-content-list">
                          {creatorContent.map((content) => (
                            <div key={content.id} className="submitted-content-item">
                              <a href={content.assets?.[0]?.url} target="_blank" rel="noreferrer" className="link-button">
                                {content.platform} {content.type}
                              </a>
                              <StatusPill status={content.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="creator-actions-row">
                      {(role === 'brand' || role === 'admin') && decision === 'Suggested' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleDecision(creator.id, 'Brand Approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDecision(creator.id, 'Brand Rejected')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAddContentModal({ open: true, creator })}
                      >
                        Add Submitted Content
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {addContentModal.open && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <h3>Add Submitted Content</h3>
            <p>Add content submitted by {addContentModal.creator?.name}</p>
            <div className="modal-form">
              <label>
                <span>Content Link *</span>
                <input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={contentForm.link}
                  onChange={(e) => setContentForm(prev => ({ ...prev, link: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Platform</span>
                <select
                  className="input"
                  value={contentForm.platform}
                  onChange={(e) => setContentForm(prev => ({ ...prev, platform: e.target.value }))}
                >
                  <option value="">Select platform</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Instagram">Instagram</option>
                </select>
              </label>
              <label>
                <span>Content Type</span>
                <select
                  className="input"
                  value={contentForm.type}
                  onChange={(e) => setContentForm(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="">Select type</option>
                  <option value="Reel">Reel</option>
                  <option value="Post">Post</option>
                  <option value="Story">Story</option>
                </select>
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  className="input"
                  placeholder="Optional notes..."
                  rows={3}
                  value={contentForm.notes}
                  onChange={(e) => setContentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAddContentModal({ open: false, creator: null });
                  setContentForm({ link: '', platform: '', type: '', notes: '' });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddContent}
                disabled={!contentForm.link}
              >
                Add Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
