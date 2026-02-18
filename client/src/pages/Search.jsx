import React, { useState, useRef } from 'react';
import { searchItems } from '../services/api';
import ItemCard from '../components/ItemCard';
import Modal from '../components/Modal';
import ItemDetail from './ItemDetail';

export default function Search({ addToast }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchType, setSearchType] = useState('');
  const debounceRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) {
      setResults(null);
      setMessage('');
      return;
    }

    setLoading(true);
    try {
      const data = await searchItems(q);
      setResults(data.results || []);
      setMessage(data.message || '');
      setSearchType(data.searchType || '');
    } catch (err) {
      addToast('Search failed: ' + err.message, 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        doSearch(value);
      }
    }, 500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    doSearch(query);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Search</h1>
        <p>Find anything in your inventory &mdash; just describe what you're looking for</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="What are you looking for? (e.g., 'something to hang pictures with', 'Christmas decorations', 'tools')"
            value={query}
            onChange={handleInput}
            autoFocus
          />
        </div>
      </form>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20, color: 'var(--text-secondary)' }}>
          <div className="spinner" />
          Searching your inventory with AI...
        </div>
      )}

      {!loading && results !== null && (
        <div>
          {message && (
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: 20,
              padding: '12px 16px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
            }}>
              {message}
              {searchType === 'ai' && (
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent)' }}>AI-powered</span>
              )}
            </p>
          )}

          {results.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <h3>No items found</h3>
              <p>Try describing what you're looking for differently. AI search understands natural language &mdash;
                 you don't need exact names.</p>
            </div>
          ) : (
            <div className="card-grid">
              {results.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && results === null && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <h3>Smart Search</h3>
          <p style={{ maxWidth: 480, margin: '0 auto' }}>
            You don't need to know the exact name. Try things like:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, maxWidth: 400, margin: '16px auto 0' }}>
            {[
              '"something to cut wire with"',
              '"holiday stuff"',
              '"things for hanging pictures"',
              '"what\'s in Bin 5?"',
              '"do I have any batteries?"',
            ].map((example) => (
              <button
                key={example}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}
                onClick={() => { setQuery(example.replace(/"/g, '')); doSearch(example.replace(/"/g, '')); }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title="Item Details">
        {selectedItem && <ItemDetail item={selectedItem} addToast={addToast} onClose={() => setSelectedItem(null)} />}
      </Modal>
    </div>
  );
}
