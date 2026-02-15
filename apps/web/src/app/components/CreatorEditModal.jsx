import Modal from './Modal.jsx';
import { handleAvatarError, resolveAvatarSrc } from '../utils/avatar.js';

const CREATOR_TYPE_OPTIONS = ['UGC', 'Influencer'];
const STATUS_OPTIONS = ['active', 'inactive', 'draft'];
const GENDER_OPTIONS = ['Female', 'Male', 'Any', 'Other'];

const textValue = (value) => (value == null ? '' : String(value));

export default function CreatorEditModal({
  open,
  loading,
  saving,
  uploadingImage,
  uploadingVideo,
  form,
  error,
  onClose,
  onChange,
  onUploadImage,
  onUploadVideo,
  onAddVideoUrl,
  onUpdateVideoUrlAt,
  onRemoveVideoUrlAt,
  onSubmit,
}) {
  const creatorType = String(form?.creator_type || '').toLowerCase();
  const showPortfolioField = creatorType === 'influencer';
  const showUgcVideos = creatorType === 'ugc';
  const videoUrls = Array.isArray(form?.ugc_video_urls) ? form.ugc_video_urls : [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Creator"
      description="Update creator details and save changes."
      size="large"
    >
      {loading ? (
        <p className="loading-state">Loading creator details...</p>
      ) : !form ? (
        <p className="error-text">{error || 'Unable to load creator details.'}</p>
      ) : (
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="creator-edit-grid">
            <label className="full-width">
              <span>Name</span>
              <input
                className="input"
                value={textValue(form.display_name)}
                onChange={(event) => onChange('display_name', event.target.value)}
              />
            </label>

            <label>
              <span>Creator Type</span>
              <select
                className="input"
                value={textValue(form.creator_type)}
                onChange={(event) => onChange('creator_type', event.target.value)}
              >
                <option value="">Select type</option>
                {CREATOR_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                className="input"
                value={textValue(form.status)}
                onChange={(event) => onChange('status', event.target.value)}
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Niche</span>
              <input
                className="input"
                value={textValue(form.primary_niche)}
                onChange={(event) => onChange('primary_niche', event.target.value)}
              />
            </label>

            <label>
              <span>Category</span>
              <input
                className="input"
                value={textValue(form.category)}
                onChange={(event) => onChange('category', event.target.value)}
              />
            </label>

            <label>
              <span>Country</span>
              <input
                className="input"
                value={textValue(form.country)}
                onChange={(event) => onChange('country', event.target.value)}
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                className="input"
                value={textValue(form.phone)}
                onChange={(event) => onChange('phone', event.target.value)}
              />
            </label>

            <label>
              <span>Handle</span>
              <input
                className="input"
                value={textValue(form.handle)}
                onChange={(event) => onChange('handle', event.target.value)}
              />
            </label>

            <label>
              <span>TikTok URL</span>
              <input
                className="input"
                value={textValue(form.tiktok_url)}
                onChange={(event) => onChange('tiktok_url', event.target.value)}
              />
            </label>

            <label>
              <span>TikTok Handle</span>
              <input
                className="input"
                value={textValue(form.tiktok_handle)}
                onChange={(event) => onChange('tiktok_handle', event.target.value)}
              />
            </label>

            <label>
              <span>Instagram URL</span>
              <input
                className="input"
                value={textValue(form.instagram_url)}
                onChange={(event) => onChange('instagram_url', event.target.value)}
              />
            </label>

            <label>
              <span>Instagram Handle</span>
              <input
                className="input"
                value={textValue(form.instagram_handle)}
                onChange={(event) => onChange('instagram_handle', event.target.value)}
              />
            </label>

            <label>
              <span>Followers</span>
              <input
                className="input"
                type="number"
                min="0"
                value={textValue(form.followers)}
                onChange={(event) => onChange('followers', event.target.value)}
              />
            </label>

            <label>
              <span>Avg Views</span>
              <input
                className="input"
                type="number"
                min="0"
                value={textValue(form.avg_views)}
                onChange={(event) => onChange('avg_views', event.target.value)}
              />
            </label>

            <label>
              <span>Engagement Rate (%)</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={textValue(form.engagement_rate)}
                onChange={(event) => onChange('engagement_rate', event.target.value)}
              />
            </label>

            <label>
              <span>Rate</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={textValue(form.base_rate)}
                onChange={(event) => onChange('base_rate', event.target.value)}
              />
            </label>

            <label>
              <span>Age</span>
              <input
                className="input"
                type="number"
                min="0"
                value={textValue(form.age)}
                onChange={(event) => onChange('age', event.target.value)}
              />
            </label>

            <label>
              <span>Gender</span>
              <select
                className="input"
                value={textValue(form.gender)}
                onChange={(event) => onChange('gender', event.target.value)}
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Languages</span>
              <input
                className="input"
                value={textValue(form.languages)}
                onChange={(event) => onChange('languages', event.target.value)}
              />
            </label>

            <label>
              <span>Turnaround Time</span>
              <input
                className="input"
                value={textValue(form.turnaround_time)}
                onChange={(event) => onChange('turnaround_time', event.target.value)}
              />
            </label>

            {showPortfolioField ? (
              <label>
                <span>Portfolio URL</span>
                <input
                  className="input"
                  value={textValue(form.portfolio_url)}
                  onChange={(event) => onChange('portfolio_url', event.target.value)}
                />
              </label>
            ) : null}

            {showUgcVideos ? (
              <div className="creator-video-upload full-width">
                <span>UGC Videos</span>
                <div className="creator-video-url-list">
                  {videoUrls.length > 0 ? (
                    videoUrls.map((url, index) => (
                      <div key={`ugc-video-${index}`} className="creator-video-url-row">
                        <input
                          className="input"
                          placeholder="/objects/... or https://..."
                          value={textValue(url)}
                          onChange={(event) =>
                            onUpdateVideoUrlAt && onUpdateVideoUrlAt(index, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => onRemoveVideoUrlAt && onRemoveVideoUrlAt(index)}
                          disabled={saving || uploadingImage || uploadingVideo}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="creator-video-upload-empty">No videos added yet.</p>
                  )}
                </div>
                <div className="creator-video-upload-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => onAddVideoUrl && onAddVideoUrl()}
                    disabled={saving || uploadingImage || uploadingVideo}
                  >
                    Add Video URL
                  </button>
                  <label className="btn btn-secondary btn-small creator-image-upload-btn">
                    {uploadingVideo ? 'Uploading...' : 'Upload Video'}
                    <input
                      type="file"
                      accept="video/*"
                      disabled={saving || uploadingImage || uploadingVideo}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file && onUploadVideo) {
                          onUploadVideo(file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="creator-image-upload full-width">
              <span>Profile Image</span>
              <div className="creator-image-upload-row">
                <div className="creator-image-preview">
                  {form.profile_image ? (
                    <img
                      src={resolveAvatarSrc(form.profile_image)}
                      alt={textValue(form.display_name) || 'Creator'}
                      onError={handleAvatarError}
                    />
                  ) : (
                    <img src={resolveAvatarSrc('')} alt="Creator preview" onError={handleAvatarError} />
                  )}
                </div>
                <div className="creator-image-upload-controls">
                  <input
                    className="input"
                    placeholder="Image URL or uploaded path"
                    value={textValue(form.profile_image)}
                    onChange={(event) => onChange('profile_image', event.target.value)}
                  />
                  <label className="btn btn-secondary btn-small creator-image-upload-btn">
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file && onUploadImage) {
                          onUploadImage(file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <label className="full-width">
              <span>Notes</span>
              <textarea
                className="input textarea"
                rows={4}
                value={textValue(form.notes)}
                onChange={(event) => onChange('notes', event.target.value)}
              />
            </label>
          </div>

          <div className="creator-edit-booleans">
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.accepts_gifted_collab)}
                onChange={(event) => onChange('accepts_gifted_collab', event.target.checked)}
              />
              <span>Accepts Gifted Collab</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.has_mock_video)}
                onChange={(event) => onChange('has_mock_video', event.target.checked)}
              />
              <span>Has Mock Video</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.has_equipment)}
                onChange={(event) => onChange('has_equipment', event.target.checked)}
              />
              <span>Has Equipment</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.can_voiceover)}
                onChange={(event) => onChange('can_voiceover', event.target.checked)}
              />
              <span>Can Voiceover</span>
            </label>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving || uploadingImage || uploadingVideo}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploadingImage || uploadingVideo}
            >
              {saving
                ? 'Saving...'
                : uploadingImage
                  ? 'Uploading image...'
                  : uploadingVideo
                    ? 'Uploading video...'
                    : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
