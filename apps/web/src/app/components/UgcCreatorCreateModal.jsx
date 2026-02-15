import Modal from './Modal.jsx';
import { handleAvatarError, resolveAvatarSrc } from '../utils/avatar.js';

const GENDER_OPTIONS = ['Female', 'Male', 'Any', 'Other'];

const textValue = (value) => (value == null ? '' : String(value));

export default function UgcCreatorCreateModal({
  open,
  saving,
  uploadingImage,
  form,
  error,
  onClose,
  onChange,
  onUploadImage,
  onSubmit,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add UGC Creator"
      description="Create a UGC creator profile with the required details."
      size="large"
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="creator-edit-grid">
          <label>
            <span>Name *</span>
            <input
              className="input"
              value={textValue(form.name)}
              onChange={(event) => onChange('name', event.target.value)}
              required
            />
          </label>

          <label>
            <span>Handle *</span>
            <input
              className="input"
              value={textValue(form.handle)}
              onChange={(event) => onChange('handle', event.target.value)}
              required
            />
          </label>

          <label>
            <span>Niche *</span>
            <input
              className="input"
              value={textValue(form.niche)}
              onChange={(event) => onChange('niche', event.target.value)}
              required
            />
          </label>

          <label>
            <span>Age *</span>
            <input
              className="input"
              type="number"
              min="13"
              value={textValue(form.age)}
              onChange={(event) => onChange('age', event.target.value)}
              required
            />
          </label>

          <label>
            <span>Gender *</span>
            <select
              className="input"
              value={textValue(form.gender)}
              onChange={(event) => onChange('gender', event.target.value)}
              required
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
            <span>Languages *</span>
            <input
              className="input"
              value={textValue(form.languages)}
              onChange={(event) => onChange('languages', event.target.value)}
              placeholder="e.g. English, Arabic"
              required
            />
          </label>

          <label>
            <span>Turnaround Time *</span>
            <input
              className="input"
              value={textValue(form.turnaround_time)}
              onChange={(event) => onChange('turnaround_time', event.target.value)}
              placeholder="e.g. 3-5 days"
              required
            />
          </label>

          <label>
            <span>Rate *</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={textValue(form.base_rate)}
              onChange={(event) => onChange('base_rate', event.target.value)}
              required
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
            <span>Region</span>
            <input
              className="input"
              value={textValue(form.region)}
              onChange={(event) => onChange('region', event.target.value)}
            />
          </label>

          <div className="creator-image-upload full-width">
            <span>Profile Image</span>
            <div className="creator-image-upload-row">
              <div className="creator-image-preview">
                {form.profile_image ? (
                  <img
                    src={resolveAvatarSrc(form.profile_image)}
                    alt={textValue(form.name) || 'Creator'}
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
              rows={3}
              value={textValue(form.notes)}
              onChange={(event) => onChange('notes', event.target.value)}
            />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving || uploadingImage}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || uploadingImage}>
            {saving ? 'Saving...' : uploadingImage ? 'Uploading image...' : 'Add UGC Creator'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
