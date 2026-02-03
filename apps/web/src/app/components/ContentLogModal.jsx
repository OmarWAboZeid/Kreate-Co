import { useEffect, useState } from 'react';
import { useAppDispatch, useAppState, utils } from '../state.jsx';

const defaultForm = {
  campaignId: '',
  creatorId: '',
  platform: 'Instagram',
  type: 'Reel',
  link: '',
  caption: '',
  hashtags: '',
  notes: '',
};

export default function ContentLogModal({ open, onClose, initialCampaignId }) {
  const { campaigns, creators } = useAppState();
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ ...defaultForm, campaignId: initialCampaignId || '' });

  useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, campaignId: initialCampaignId || prev.campaignId || '' }));
    }
  }, [initialCampaignId, open]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.campaignId || !form.creatorId) return;
    const content = {
      id: utils.makeId('cnt'),
      campaignId: form.campaignId,
      creatorId: form.creatorId,
      platform: form.platform,
      type: form.type,
      status: 'Pending Review',
      revisionCount: 0,
      caption: form.caption,
      hashtags: form.hashtags,
      assets: form.link ? [{ type: 'link', label: 'Attachment', url: form.link }] : [],
      submittedAt: new Date().toISOString().slice(0, 10),
      notes: form.notes,
      feedback: [],
    };
    dispatch({ type: 'LOG_CONTENT_DELIVERY', payload: { content } });
    onClose();
    setForm({ ...defaultForm, campaignId: initialCampaignId || '' });
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Log New Content Delivery</h3>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="wizard-panel">
          <label>
            Campaign
            <select
              className="input"
              value={form.campaignId}
              onChange={(e) => updateField('campaignId', e.target.value)}
            >
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Creator
            <select
              className="input"
              value={form.creatorId}
              onChange={(e) => updateField('creatorId', e.target.value)}
            >
              <option value="">Select creator</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              Platform
              <select
                className="input"
                value={form.platform}
                onChange={(e) => updateField('platform', e.target.value)}
              >
                <option>Instagram</option>
                <option>TikTok</option>
              </select>
            </label>
            <label>
              Type
              <select
                className="input"
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
              >
                <option>Reel</option>
                <option>Post</option>
                <option>Story</option>
                <option>Video</option>
              </select>
            </label>
          </div>
          <label>
            Asset link
            <input className="input" value={form.link} onChange={(e) => updateField('link', e.target.value)} />
          </label>
          <label>
            Caption
            <textarea
              className="input"
              rows="3"
              value={form.caption}
              onChange={(e) => updateField('caption', e.target.value)}
            />
          </label>
          <label>
            Hashtags
            <input className="input" value={form.hashtags} onChange={(e) => updateField('hashtags', e.target.value)} />
          </label>
          <label>
            Notes
            <textarea className="input" rows="2" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </label>
        </div>
        <div className="wizard-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Log Delivery
          </button>
        </div>
      </div>
    </div>
  );
}
