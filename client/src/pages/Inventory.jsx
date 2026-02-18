import React, { useState, useEffect, useCallback } from 'react';
import { getItems, deleteItem } from '../services/api';
import ItemCard from '../components/ItemCard';
import Modal from '../components/Modal';
import ItemDetail from './ItemDetail';

export default function Inventory({ addToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 100;

  const loadItems = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await getItems(LIMIT, newOffset);
      if (reset) {
        setItems(data.items);
        setOffset(LIMIT);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setOffset((prev) => prev + LIMIT);
      }
      setHasMore(data.items.length === LIMIT);
    } catch (err) {
      addToast('Failed to load items: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [offset, addToast]);

  useEffect(() => {
    loadItems(true);
  }, []);

  const handleDelete = async (item) => {
    if (!confirm(`Remove "${item.name}" from inventory?`)) return;
    try {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast('Item removed', 'success');
    } catch (err) {
      addToast('Failed to remove: ' + err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>All Items</h1>
          <p>{items.length} items in your inventory</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn-icon ${viewMode === 'grid' ? '' : ''}`}
            style={{ background: viewMode === 'grid' ? 'var(--accent-dim)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setViewMode('grid')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            className={`btn-icon`}
            style={{ background: viewMode === 'list' ? 'var(--accent-dim)' : 'transparent', color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setViewMode('list')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3>No items yet</h3>
          <p>Upload a voice note or add items manually to get started.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="card-grid">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={setSelectedItem}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="item-list">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} compact onClick={setSelectedItem} />
          ))}
        </div>
      )}

      {hasMore && items.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => loadItems(false)} disabled={loading}>
            {loading ? <><div className="spinner" /> Loading...</> : 'Load More'}
          </button>
        </div>
      )}

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.name || 'Item'}>
        {selectedItem && (
          <ItemDetail
            item={selectedItem}
            addToast={addToast}
            onClose={() => setSelectedItem(null)}
            onUpdate={() => loadItems(true)}
          />
        )}
      </Modal>
    </div>
  );
}
