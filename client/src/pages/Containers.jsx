import React, { useState, useEffect } from 'react';
import { getContainers, getContainer, createContainer, getLocations } from '../services/api';
import Modal from '../components/Modal';
import ItemCard from '../components/ItemCard';

export default function Containers({ addToast }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerItems, setContainerItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ label: '', type: 'bin', color: '', size: '', description: '', location_id: '' });

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      const data = await getContainers();
      setContainers(data);
    } catch (err) {
      addToast('Failed to load containers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (container) => {
    try {
      const data = await getContainer(container.id);
      setSelectedContainer(data);
      setContainerItems(data.items || []);
    } catch (err) {
      addToast('Failed to load container details', 'error');
    }
  };

  const handleAdd = async () => {
    try {
      if (!form.label.trim()) { addToast('Container label is required', 'error'); return; }
      await createContainer({
        ...form,
        location_id: form.location_id ? parseInt(form.location_id) : null,
      });
      addToast('Container created', 'success');
      setShowAdd(false);
      setForm({ label: '', type: 'bin', color: '', size: '', description: '', location_id: '' });
      loadContainers();
    } catch (err) {
      addToast('Failed to create container: ' + err.message, 'error');
    }
  };

  const openAdd = async () => {
    try {
      const locs = await getLocations();
      setLocations(locs);
    } catch (err) { /* ignore */ }
    setShowAdd(true);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Containers</h1>
          <p>{containers.length} bins, boxes, and shelves</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Container
        </button>
      </div>

      {containers.length === 0 ? (
        <div className="empty-state">
          <h3>No containers yet</h3>
          <p>Containers are created automatically when you upload voice notes, or you can add them manually.</p>
        </div>
      ) : (
        <div className="card-grid">
          {containers.map((c) => (
            <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => handleSelect(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: '1.05rem' }}>{c.label}</h3>
                <span className="tag tag-quantity">{c.item_count} items</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {c.type && <span className="tag tag-container">{c.type}</span>}
                {c.color && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.color}</span>}
                {c.location_name && <span className="tag tag-location">{c.location_name}</span>}
              </div>
              {c.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 8 }}>{c.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Container detail modal */}
      <Modal isOpen={!!selectedContainer} onClose={() => setSelectedContainer(null)} title={selectedContainer?.label || 'Container'}>
        {selectedContainer && (
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {selectedContainer.type && <span className="tag tag-container">{selectedContainer.type}</span>}
              {selectedContainer.color && <span className="tag" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{selectedContainer.color}</span>}
              {selectedContainer.size && <span className="tag" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{selectedContainer.size}</span>}
              {selectedContainer.location_name && <span className="tag tag-location">{selectedContainer.location_name}</span>}
            </div>
            {selectedContainer.description && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{selectedContainer.description}</p>
            )}
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Items ({containerItems.length})</h4>
            {containerItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No items in this container</p>
            ) : (
              <div className="item-list">
                {containerItems.map((item) => (
                  <ItemCard key={item.id} item={item} compact />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add container modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Container">
        <div className="form-group">
          <label>Label *</label>
          <input className="form-input" placeholder="e.g., Bin #1, Blue Box, Top Shelf" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label>Type</label>
            <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="bin">Bin</option>
              <option value="box">Box</option>
              <option value="shelf">Shelf</option>
              <option value="drawer">Drawer</option>
              <option value="bag">Bag</option>
              <option value="tote">Tote</option>
              <option value="crate">Crate</option>
              <option value="cabinet">Cabinet</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Color</label>
            <input className="form-input" placeholder="e.g., black, clear, blue" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Location</label>
          <select className="form-input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
            <option value="">-- Select Location --</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-input" placeholder="Any details about this container..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Create Container</button>
        </div>
      </Modal>
    </div>
  );
}
