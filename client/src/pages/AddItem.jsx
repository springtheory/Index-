import React, { useState, useEffect } from 'react';
import { addItem, getContainers, getLocations } from '../services/api';

export default function AddItem({ addToast }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 1,
    container_id: '',
    location_id: '',
    tags: '',
    notes: '',
    force: false,
  });
  const [containers, setContainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    Promise.all([getContainers(), getLocations()]).then(([c, l]) => {
      setContainers(c);
      setLocations(l);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('Item name is required', 'error'); return; }

    setLoading(true);
    setDuplicate(null);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        quantity: form.quantity || 1,
        container_id: form.container_id ? parseInt(form.container_id) : undefined,
        location_id: form.location_id ? parseInt(form.location_id) : undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        notes: form.notes.trim() || undefined,
        force: form.force,
      };

      const result = await addItem(data);
      addToast(`Added "${result.name}" to inventory`, 'success');
      setForm({ name: '', description: '', category: '', quantity: 1, container_id: '', location_id: '', tags: '', notes: '', force: false });
    } catch (err) {
      if (err.message.includes('duplicate') || err.message.includes('Possible')) {
        setDuplicate(err.message);
      } else {
        addToast('Failed to add item: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const forceAdd = async () => {
    setForm({ ...form, force: true });
    setDuplicate(null);
    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        quantity: form.quantity || 1,
        container_id: form.container_id ? parseInt(form.container_id) : undefined,
        location_id: form.location_id ? parseInt(form.location_id) : undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        notes: form.notes.trim() || undefined,
        force: true,
      };
      const result = await addItem(data);
      addToast(`Added "${result.name}" to inventory`, 'success');
      setForm({ name: '', description: '', category: '', quantity: 1, container_id: '', location_id: '', tags: '', notes: '', force: false });
    } catch (err) {
      addToast('Failed to add item: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'tools', 'electronics', 'holiday', 'sports', 'kitchen', 'clothing',
    'documents', 'hardware', 'automotive', 'garden', 'toys', 'office',
    'cleaning', 'seasonal', 'craft', 'medical', 'outdoor', 'storage',
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Add Item</h1>
        <p>Manually add a single item to your inventory</p>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Item Name *</label>
            <input
              className="form-input"
              placeholder="e.g., Phillips Screwdriver, Christmas Lights, Extension Cord"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-input"
              placeholder="Details: brand, color, size, condition..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Category</label>
              <select className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">-- Select --</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Container</label>
              <select className="form-input" value={form.container_id} onChange={(e) => setForm({ ...form, container_id: e.target.value })}>
                <option value="">-- None --</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} {c.location_name ? `(${c.location_name})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <select className="form-input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                <option value="">-- None --</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              className="form-input"
              placeholder="e.g., power tool, cordless, DeWalt, yellow"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              className="form-input"
              placeholder="Any special notes (fragile, borrowed, needs repair...)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {duplicate && (
            <div style={{
              padding: '14px 18px',
              background: 'var(--warning-dim)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 20,
            }}>
              <p style={{ color: 'var(--warning)', fontSize: '0.9rem', marginBottom: 12 }}>
                This might already be in your inventory. Are you sure this is a new item?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDuplicate(null)}>Edit Details</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={forceAdd}>Yes, Add Anyway</button>
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <><div className="spinner" /> Adding...</> : 'Add Item'}
          </button>
        </form>
      </div>
    </div>
  );
}
