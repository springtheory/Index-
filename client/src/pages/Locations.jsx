import React, { useState, useEffect } from 'react';
import { getLocations, getLocation, createLocation } from '../services/api';
import Modal from '../components/Modal';
import ItemCard from '../components/ItemCard';

export default function Locations({ addToast }) {
  const [locations, setLocationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await getLocations();
      setLocationsList(data);
    } catch (err) {
      addToast('Failed to load locations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (loc) => {
    try {
      const data = await getLocation(loc.id);
      setSelectedLocation(loc);
      setLocationData(data);
    } catch (err) {
      addToast('Failed to load location details', 'error');
    }
  };

  const handleAdd = async () => {
    try {
      if (!form.name.trim()) { addToast('Location name is required', 'error'); return; }
      await createLocation(form);
      addToast('Location created', 'success');
      setShowAdd(false);
      setForm({ name: '', description: '' });
      loadLocations();
    } catch (err) {
      addToast('Failed to create location: ' + err.message, 'error');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Locations</h1>
          <p>{locations.length} areas in your home</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Location
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="empty-state">
          <h3>No locations yet</h3>
          <p>Locations are created automatically from voice notes, or you can add them manually.</p>
        </div>
      ) : (
        <div className="card-grid">
          {locations.map((loc) => (
            <div key={loc.id} className="card" style={{ cursor: 'pointer' }} onClick={() => handleSelect(loc)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: '1.05rem' }}>{loc.name}</h3>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{loc.container_count} containers</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{loc.item_count} items</span>
              </div>
              {loc.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>{loc.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Location detail modal */}
      <Modal isOpen={!!selectedLocation} onClose={() => { setSelectedLocation(null); setLocationData(null); }} title={selectedLocation?.name || 'Location'}>
        {locationData && (
          <div>
            {locationData.description && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{locationData.description}</p>
            )}

            {locationData.containers && locationData.containers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Containers ({locationData.containers.length})
                </h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {locationData.containers.map((c) => (
                    <span key={c.id} className="tag tag-container" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                      {c.label} ({c.item_count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {locationData.items && locationData.items.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Items ({locationData.items.length})
                </h4>
                <div className="item-list">
                  {locationData.items.map((item) => (
                    <ItemCard key={item.id} item={item} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add location modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Location">
        <div className="form-group">
          <label>Name *</label>
          <input className="form-input" placeholder="e.g., Garage, Basement, Bedroom Closet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-input" placeholder="Any details about this location..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Create Location</button>
        </div>
      </Modal>
    </div>
  );
}
