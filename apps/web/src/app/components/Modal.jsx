import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ open, onClose, title, description, children, size = 'medium' }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return createPortal(
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className={`modal-content modal-${size}`}>
        {onClose && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        {title && <h3>{title}</h3>}
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}
