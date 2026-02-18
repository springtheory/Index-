import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStats } from '../services/api';

export default function Dashboard({ addToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => {
        console.error(err);
        setStats({ totalItems: 0, totalContainers: 0, totalLocations: 0, totalVoiceNotes: 0, categories: [], recentActivity: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  const isEmpty = stats.totalItems === 0;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your inventory at a glance</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalItems.toLocaleString()}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalContainers}</div>
          <div className="stat-label">Containers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalLocations}</div>
          <div className="stat-label">Locations</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalVoiceNotes}</div>
          <div className="stat-label">Voice Notes</div>
        </div>
      </div>

      {isEmpty ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 64, height: 64, color: 'var(--text-muted)', margin: '0 auto 16px' }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
          </svg>
          <h3 style={{ fontSize: '1.3rem', marginBottom: 12 }}>Welcome to Index</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Get started by recording a voice note describing what's in your bins, boxes, and shelves.
            Just talk naturally &mdash; "In the first black bin on the left shelf, I've got some Christmas lights,
            a few extension cords, and a box of ornaments..."
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/voice" className="btn btn-primary">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
              Upload Voice Note
            </Link>
            <Link to="/add" className="btn btn-secondary">
              Add Items Manually
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Categories breakdown */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Top Categories</h3>
            {stats.categories.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No categories yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.categories.slice(0, 8).map((cat) => (
                  <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tag tag-category">{cat.category}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{cat.count} items</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Recent Activity</h3>
            {stats.recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No activity yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.recentActivity.slice(0, 8).map((act) => {
                  const details = (() => { try { return JSON.parse(act.details); } catch { return {}; } })();
                  return (
                    <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>
                        <strong style={{ textTransform: 'capitalize' }}>{act.action}</strong>{' '}
                        {details.name || act.entity_type} {act.entity_id && `#${act.entity_id}`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(act.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!isEmpty && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/search" className="btn btn-primary">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            Search Inventory
          </Link>
          <Link to="/voice" className="btn btn-secondary">
            Add More via Voice
          </Link>
          <Link to="/add" className="btn btn-secondary">
            Add Item Manually
          </Link>
        </div>
      )}
    </div>
  );
}
