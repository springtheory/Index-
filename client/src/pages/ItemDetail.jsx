import React, { useState, useEffect } from 'react';
import { updateItem, moveItem, deleteItem, getContainers, getLocations } from '../services/api';

export default function ItemDetail({ item, addToast, onClose, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    description: item.description || '',
    category: item.category || '',
    quantity: item.quantity || 1,
    notes: item.notes || '',
  });
  const [containers, setContainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [moveTarget, setMoveTarget] = useState({ container_id: '', location_id: '' });

  useEffect(() => {
    if (moving) {
      Promise.all([getContainers(), getLocations()]).then(([c, l]) => {
        setContainers(c);
        setLocations(l);
      });
    }
  }, [moving]);

  const tags = (() => {
    try { return typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || []; }
    catch { return []; }
  })();

  const aliases = (() => {
    try { return typeof item.aliases === 'string' ? JSON.parse(item.aliases) : item.aliases || []; }
    catch { return []; }
  })();

  const handleSave = async () => {
    try {
      await updateItem(item.id, form);
      addToast('Item updated', 'success');
      setEditing(false);
      onUpdate?.();
    } catch (err) {
      addToast('Failed to update: ' + err.message, 'error');
    }
  };

  const handleMove = async () => {
    try {
      const cid = moveTarget.container_id ? parseInt(moveTarget.container_id) : null;
      const lid = moveTarget.location_id ? parseInt(moveTarget.location_id) : null;
      await moveItem(item.id, cid, lid);
      addToast('Item moved', 'success');
      setMoving(false);
      onUpdate?.();
    } catch (err) {
      addToast('Failed to move: ' + err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${item.name}" from inventory?`)) return;
    try {
      await deleteItem(item.id);
      addToast('Item removed', 'success');
      onClose();
      onUpdate?.();
    } catch (err) {
      addToast('Failed to remove: ' + err.message, 'error');
    }
  };

  if (editing) {
    return (
      <div>
        <div className="form-group">
          <label>Name</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label>Category</label>
            <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Quantity</label>
            <input className="form-input" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    );
  }

  if (moving) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          Move <strong>{item.name}</strong> to a different container or location.
        </p>
        <div className="form-group">
          <label>Container</label>
          <select className="form-input" value={moveTarget.container_id} onChange={(e) => setMoveTarget({ ...moveTarget, container_id: e.target.value })}>
            <option value="">-- Select Container --</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>{c.label} {c.location_name ? `(${c.location_name})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Location</label>
          <select className="form-input" value={moveTarget.location_id} onChange={(e) => setMoveTarget({ ...moveTarget, location_id: e.target.value })}>
            <option value="">-- Select Location --</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setMoving(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleMove}>Move Item</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {item.category && <span className="tag tag-category">{item.category}</span>}
          {item.container_label && <span className="tag tag-container">{item.container_label}</span>}
          {item.location_name && <span className="tag tag-location">{item.location_name}</span>}
          {item.quantity > 1 && <span className="tag tag-quantity">Qty: {item.quantity}</span>}
        </div>

        {item.description && (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{item.description}</p>
        )}

        {item.notes && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Note: {item.notes}</p>
        )}
      </div>

      {tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Tags</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: 12, background: 'var(--bg-hover)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      {aliases.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Also known as</label>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{aliases.join(', ')}</p>
        </div>
      )}

      {item.matchReason && (
        <div style={{ padding: '10px 14px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Match reason: {item.matchReason}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setMoving(true)}>Move</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Remove</button>
      </div>
    </div>
  );
}
