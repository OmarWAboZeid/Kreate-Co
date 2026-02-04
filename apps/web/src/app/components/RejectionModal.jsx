export default function RejectionModal({ open, creator, reason, onChange, onSubmit, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay active">
      <div className="rejection-modal">
        <h3>Reason for Rejection</h3>
        <p>Please provide feedback for {creator?.name}</p>
        <textarea
          className="input textarea"
          value={reason}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter your reason for rejecting this creator..."
          rows={4}
          autoFocus
        />
        <div className="rejection-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onSubmit}
            disabled={!reason.trim()}
          >
            Submit Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
