import React from 'react';

export default function PageHeader({ title, description, children }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
