export default function AddContentModal({ open, creator, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <div className="modal-overlay active">
      <div className="rejection-modal">
        <h3>Add Submitted Content</h3>
        <p>Add content submitted by {creator?.name}</p>
        <label>
          <span>Content Link</span>
          <input
            className="input"
            type="url"
            placeholder="Enter content URL (e.g. TikTok, Instagram link)"
          />
        </label>
        <label className="modal-field">
          <span>Content Type</span>
          <select className="input">
            <option value="">Select type</option>
            <option value="Reel">Reel</option>
            <option value="Post">Post</option>
            <option value="Story">Story</option>
            <option value="Video">Video</option>
          </select>
        </label>
        <label className="modal-field">
          <span>Notes</span>
          <textarea className="input textarea" placeholder="Any additional notes..." rows={3} />
        </label>
        <div className="rejection-modal-actions modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>
            Add Content
          </button>
        </div>
      </div>
    </div>
  );
}
