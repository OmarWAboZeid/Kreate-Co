import React from 'react';

export default function LoadingSpinner({ size = 'medium', text }) {
  return (
    <div className={`loading-spinner loading-${size}`}>
      <div className="spinner"></div>
      {text && <p>{text}</p>}
    </div>
  );
}
