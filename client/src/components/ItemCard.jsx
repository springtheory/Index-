import React from 'react';

export default function ItemCard({ item, onClick, onMove, onDelete, compact = false }) {
  const tags = (() => {
    try {
      return typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || [];
    } catch {
      return [];
    }
  })();

  if (compact) {
    return (
      <div className="item-row" onClick={() => onClick?.(item)}>
        <div className="item-name">{item.name}</div>
        <div className="item-meta">
          {item.container_label && <span className="tag tag-container">{item.container_label}</span>}
          {item.location_name && <span className="tag tag-location">{item.location_name}</span>}
          {item.quantity > 1 && <span className="tag tag-quantity">x{item.quantity}</span>}
          {item.category && <span className="tag tag-category">{item.category}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={() => onClick?.(item)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{item.name}</h3>
        {item.quantity > 1 && <span className="tag tag-quantity">x{item.quantity}</span>}
      </div>

      {item.description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12, lineHeight: 1.5 }}>
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {item.category && <span className="tag tag-category">{item.category}</span>}
        {item.container_label && <span className="tag tag-container">{item.container_label}</span>}
        {item.location_name && <span className="tag tag-location">{item.location_name}</span>}
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.slice(0, 6).map((tag, i) => (
            <span key={i} style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 12,
              background: 'var(--bg-hover)',
              color: 'var(--text-muted)'
            }}>
              {tag}
            </span>
          ))}
          {tags.length > 6 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{tags.length - 6} more</span>
          )}
        </div>
      )}

      {(onMove || onDelete) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {onMove && (
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onMove(item); }}>
              Move
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
              Remove
            </button>
          )}
        </div>
      )}

      {item.matchReason && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--accent-dim)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
          color: 'var(--accent)',
        }}>
          {item.matchReason}
        </div>
      )}
    </div>
  );
}
