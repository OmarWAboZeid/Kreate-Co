import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { useAppDispatch, useAppState } from '../state.jsx';

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function CreatorKebabMenu({ creator, decision, role, onApprove, onReject, onAddContent }) {
  const [open, setOpen] = useState(false);
  const showApprovalActions = (role === 'brand' || role === 'admin') && decision === 'Suggested';
  
  return (
    <div className="kebab-menu">
      <button 
        type="button" 
        className="kebab-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="kebab-backdrop" onClick={() => setOpen(false)} />
          <div className="kebab-dropdown">
            {showApprovalActions && (
              <>
                <button 
                  type="button" 
                  className="kebab-approve"
                  onClick={(e) => { e.stopPropagation(); onApprove(); setOpen(false); }}
                >
                  Approve
                </button>
                <button 
                  type="button" 
                  className="kebab-reject"
                  onClick={(e) => { e.stopPropagation(); onReject(); setOpen(false); }}
                >
                  Reject
                </button>
              </>
            )}
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); onAddContent(); setOpen(false); }}
            >
              Add Content
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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

      <section className="campaign-section">
        <h3 className="section-title">Campaign Overview</h3>
        <div className="section-stats-row">
          <div className="stat-item">
            <span className="stat-label">Campaign Type</span>
            <span className="stat-value">{campaign.campaignType || 'Hybrid'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Deal Type</span>
            <span className="stat-value">{campaign.paymentType || 'Paid'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Start Date</span>
            <span className="stat-value">{campaign.timeline?.start || campaign.startDate || 'TBD'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Package</span>
            <span className="stat-value">{campaign.packageType || 'Custom'}{campaign.bundle ? ` · ${campaign.bundle}` : ''}</span>
          </div>
        </div>
      </section>

      <section className="campaign-section">
        <h3 className="section-title">Objectives</h3>
        <div className="objectives-display">
          {Array.isArray(campaign.objectives) 
            ? campaign.objectives.map((obj) => (
                <span key={obj} className="objective-tag">{obj}</span>
              ))
            : <span className="objective-tag">{campaign.objectives || 'Awareness'}</span>
          }
        </div>
      </section>

      <div className="requirements-columns">
        {showUGC && (
          <section className="campaign-section requirements-section">
            <h3 className="section-title">UGC Requirements</h3>
            <ul className="requirements-list">
              <li className="requirement-item">
                <span className="requirement-label">Persona</span>
                <span className="requirement-value">{campaign.ugc?.persona || 'Any'}</span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Gender</span>
                <span className="requirement-value">{campaign.ugc?.gender || 'Any'}</span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Age Range</span>
                <span className="requirement-value">{campaign.ugc?.ageRange || '18-35'}</span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Videos</span>
                <span className="requirement-value">{campaign.ugcCount || 'TBD'}</span>
              </li>
            </ul>
          </section>
        )}

        {showInfluencer && (
          <section className="campaign-section requirements-section">
            <h3 className="section-title">Influencer Requirements</h3>
            <ul className="requirements-list">
              <li className="requirement-item">
                <span className="requirement-label">Creator Tiers</span>
                <span className="requirement-badges">
                  {Array.isArray(campaign.creatorTiers) && campaign.creatorTiers.length > 0
                    ? campaign.creatorTiers.map((tier) => (
                        <span key={tier} className="requirement-badge">{tier}</span>
                      ))
                    : <span className="requirement-badge">Micro</span>
                  }
                </span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Niche</span>
                <span className="requirement-value">{campaign.influencer?.niche || campaign.criteria?.niche || 'Lifestyle'}</span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Platforms</span>
                <span className="requirement-badges">
                  {campaign.platforms?.filter(p => p !== 'YouTube').map((platform) => (
                    <span key={platform} className="requirement-badge platform-badge">{platform}</span>
                  ))}
                </span>
              </li>
              <li className="requirement-item">
                <span className="requirement-label">Content Formats</span>
                <span className="requirement-badges">
                  {campaign.contentFormat?.filter(f => f !== 'Live').map((format) => (
                    <span key={format} className="requirement-badge">{format}</span>
                  ))}
                </span>
              </li>
            </ul>
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
        <div className="detail-card-content creator-table-content">
          {filteredCreators.length === 0 ? (
            <EmptyState
              title="No creators assigned"
              description="Creators will appear here once they are shortlisted for this campaign."
            />
          ) : (
            <div className="creators-table-wrapper">
              <table className="creators-table">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th className="hide-mobile">Niche</th>
                    <th>Workflow Status</th>
                    <th className="hide-mobile">Final Video</th>
                    <th>Decision</th>
                    <th className="hide-mobile">Content</th>
                    <th className="actions-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.map((creator) => {
                    const decision = creatorState.approvals[creator.id] || 'Suggested';
                    const outreach = creatorState.outreach[creator.id] || {};
                    const status = outreach.workflowStatus || 'Filming';
                    const finalLink = outreach.finalVideoLink || '';
                    const creatorContent = campaignContent.filter((c) => c.creatorId === creator.id);
                    
                    return (
                      <tr key={creator.id} className="creators-table-row">
                        <td className="creator-name-cell">
                          <div className="creator-cell-info">
                            <div className="creator-avatar-sm">
                              {creator.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="creator-name">{creator.name}</span>
                              <span className="creator-handle">
                                {creator.handles?.instagram || creator.handle || '@creator'}
                              </span>
                            </div>
                          </div>
                          <span className="creator-mobile-meta">
                            {creator.niche} · {status} · {creatorContent.length} content
                          </span>
                        </td>
                        <td className="hide-mobile">
                          <span className="niche-badge">{creator.niche || '—'}</span>
                        </td>
                        <td>
                          <select
                            className="input input-sm"
                            value={status}
                            onChange={(e) => handleStatusChange(creator.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="Filming">Filming</option>
                            <option value="Brief Sent">Brief Sent</option>
                            <option value="Posted">Posted</option>
                            <option value="Need Alternative">Need Alternative</option>
                          </select>
                        </td>
                        <td className="hide-mobile final-link-cell">
                          <div className="final-link-wrapper">
                            <input
                              type="url"
                              className="input input-sm"
                              placeholder="Add video link..."
                              value={finalLink}
                              onChange={(e) => handleFinalLinkChange(creator.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {finalLink && (
                              <a 
                                href={finalLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="view-link-icon"
                                onClick={(e) => e.stopPropagation()}
                                title="Open video"
                              >
                                ↗
                              </a>
                            )}
                          </div>
                        </td>
                        <td>
                          <StatusPill status={decision} />
                        </td>
                        <td className="hide-mobile content-count-cell">
                          {creatorContent.length > 0 ? (
                            <div className="content-items-list">
                              {creatorContent.slice(0, 3).map((content) => (
                                <div key={content.id} className="content-item-inline">
                                  <a 
                                    href={content.assets?.[0]?.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="link-button link-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {content.platform} {content.type}
                                  </a>
                                  <StatusPill status={content.status} size="sm" />
                                </div>
                              ))}
                              {creatorContent.length > 3 && (
                                <span className="content-more">+{creatorContent.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="content-count empty">—</span>
                          )}
                        </td>
                        <td className="actions-col">
                          <CreatorKebabMenu 
                            creator={creator}
                            decision={decision}
                            role={role}
                            onApprove={() => handleDecision(creator.id, 'Brand Approved')}
                            onReject={() => handleDecision(creator.id, 'Brand Rejected')}
                            onAddContent={() => setAddContentModal({ open: true, creator })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
