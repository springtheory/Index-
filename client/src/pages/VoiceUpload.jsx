import React, { useState, useEffect, useRef } from 'react';
import { uploadVoiceNote, processVoiceNote, getVoiceNoteStatus, getVoiceNotes } from '../services/api';
import VoiceRecorder from '../components/VoiceRecorder';

export default function VoiceUpload({ addToast }) {
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [processing, setProcessing] = useState(null); // { id, status }
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadVoiceNotes();
    return () => clearInterval(pollRef.current);
  }, []);

  const loadVoiceNotes = async () => {
    try {
      const notes = await getVoiceNotes();
      setVoiceNotes(notes);

      // Resume polling if any are processing
      const inProgress = notes.find((n) => n.status === 'processing' || n.status === 'transcribed' || n.status === 'parsed');
      if (inProgress) {
        setProcessing({ id: inProgress.id, status: inProgress.status });
        startPolling(inProgress.id);
      }
    } catch (err) {
      console.error('Failed to load voice notes:', err);
    }
  };

  const handleFileUpload = async (file) => {
    setUploadProgress(0);
    try {
      const result = await uploadVoiceNote(file, setUploadProgress);
      setUploadProgress(null);
      addToast('Voice note uploaded! Starting processing...', 'success');

      // Start processing
      setProcessing({ id: result.id, status: 'uploaded' });
      await processVoiceNote(result.id);
      setProcessing({ id: result.id, status: 'processing' });
      startPolling(result.id);
      loadVoiceNotes();
    } catch (err) {
      setUploadProgress(null);
      addToast('Upload failed: ' + err.message, 'error');
    }
  };

  const startPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getVoiceNoteStatus(id);
        setProcessing({ id, ...status });

        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(pollRef.current);
          loadVoiceNotes();
          if (status.status === 'completed') {
            addToast(
              `Voice note processed! ${status.summary?.itemsFound || 0} items catalogued.`,
              'success'
            );
          } else {
            addToast('Processing failed: ' + (status.error || 'Unknown error'), 'error');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  const handleRecordingComplete = (file) => {
    handleFileUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover');
  };

  const retryProcessing = async (id) => {
    try {
      setProcessing({ id, status: 'processing' });
      await processVoiceNote(id);
      startPolling(id);
      addToast('Retrying processing...', 'info');
    } catch (err) {
      addToast('Failed to retry: ' + err.message, 'error');
    }
  };

  const processingSteps = [
    { key: 'uploaded', label: 'File uploaded' },
    { key: 'processing', label: 'Transcribing audio with AI...' },
    { key: 'transcribed', label: 'Parsing inventory from transcript...' },
    { key: 'parsed', label: 'Storing items in database...' },
    { key: 'completed', label: 'Done! Items catalogued.' },
  ];

  const getStepStatus = (stepKey) => {
    if (!processing) return 'pending';
    const stepOrder = processingSteps.map((s) => s.key);
    const currentIdx = stepOrder.indexOf(processing.status);
    const stepIdx = stepOrder.indexOf(stepKey);
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Voice Upload</h1>
        <p>Record or upload a voice note describing your inventory. AI will catalogue everything.</p>
      </div>

      {/* Recording */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--text-secondary)' }}>Option 1: Record directly</h3>
        <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
      </div>

      {/* File upload */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--text-secondary)' }}>Option 2: Upload an audio file</h3>
        <div
          className="upload-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <h3>Drop audio file here or click to browse</h3>
          <p>Supports MP3, WAV, M4A, WebM, OGG, FLAC, AAC &mdash; up to 2 hours</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files[0]) handleFileUpload(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Uploading...</h3>
          <div className="progress-bar">
            <div className="fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{uploadProgress}% uploaded</p>
        </div>
      )}

      {/* Processing status */}
      {processing && processing.status !== 'completed' && processing.status !== 'error' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Processing Voice Note</h3>
          <div className="processing-steps">
            {processingSteps.map((step) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className={`step ${status}`}>
                  <div className="step-icon">
                    {status === 'done' ? (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : status === 'active' ? (
                      <div className="spinner" />
                    ) : (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    )}
                  </div>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed/Error status */}
      {processing && processing.status === 'completed' && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--success)' }}>Processing Complete</h3>
              {processing.summary && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Found {processing.summary.itemsFound} items in {processing.summary.containersFound} containers across {processing.summary.locationsFound} locations
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {processing && processing.status === 'error' && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--danger)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--danger)', marginBottom: 8 }}>Processing Failed</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>{processing.error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => retryProcessing(processing.id)}>Retry</button>
        </div>
      )}

      {/* Previous voice notes */}
      {voiceNotes.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Previous Voice Notes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {voiceNotes.map((note) => (
              <div key={note.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{note.original_name || `Voice Note #${note.id}`}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {note.duration_seconds ? `${Math.round(note.duration_seconds / 60)}min` : ''}{' '}
                    {note.file_size ? `${(note.file_size / 1024 / 1024).toFixed(1)}MB` : ''}{' '}
                    &mdash; {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`tag ${
                    note.status === 'completed' ? 'tag-location' :
                    note.status === 'error' ? '' :
                    'tag-category'
                  }`} style={note.status === 'error' ? { background: 'var(--danger-dim)', color: 'var(--danger)' } : {}}>
                    {note.status}
                  </span>
                  {note.status === 'error' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => retryProcessing(note.id)}>Retry</button>
                  )}
                  {note.status === 'uploaded' && (
                    <button className="btn btn-primary btn-sm" onClick={() => retryProcessing(note.id)}>Process</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 24, background: 'var(--accent-dim)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: 12 }}>Tips for the best results</h3>
        <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Speak clearly and at a natural pace</li>
          <li>Mention the bin/box/container first, then list what's inside</li>
          <li>Include details like color, brand, size, and quantity when relevant</li>
          <li>Say the location (e.g., "left shelf in the garage", "under the workbench")</li>
          <li>For large collections, go bin by bin &mdash; there's no time limit up to 2 hours</li>
          <li>Example: "In the big black bin on the top shelf of the garage, I've got about 20 Christmas ornaments, three strands of lights, a tree topper, and some hooks..."</li>
        </ul>
      </div>
    </div>
  );
}
