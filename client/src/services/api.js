const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Voice Notes
export async function uploadVoiceNote(file, onProgress) {
  const formData = new FormData();
  formData.append('audio', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/voice/upload`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.send(formData);
  });
}

export function processVoiceNote(id) {
  return request(`/voice/${id}/process`, { method: 'POST' });
}

export function getVoiceNoteStatus(id) {
  return request(`/voice/${id}/status`);
}

export function getVoiceNotes() {
  return request('/voice');
}

export function getVoiceTranscript(id) {
  return request(`/voice/${id}/transcript`);
}

// Items
export function getItems(limit = 100, offset = 0) {
  return request(`/items?limit=${limit}&offset=${offset}`);
}

export function getItem(id) {
  return request(`/items/${id}`);
}

export function searchItems(query) {
  return request(`/items/search?q=${encodeURIComponent(query)}`);
}

export function addItem(data) {
  return request('/items', { method: 'POST', body: JSON.stringify(data) });
}

export function updateItem(id, data) {
  return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function moveItem(id, containerId, locationId) {
  return request(`/items/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ container_id: containerId, location_id: locationId }),
  });
}

export function deleteItem(id) {
  return request(`/items/${id}`, { method: 'DELETE' });
}

export function getItemsByContainer(containerId) {
  return request(`/items/container/${containerId}`);
}

export function getItemsByLocation(locationId) {
  return request(`/items/location/${locationId}`);
}

export function getItemsByCategory(category) {
  return request(`/items/category/${encodeURIComponent(category)}`);
}

// Containers
export function getContainers() {
  return request('/containers');
}

export function getContainer(id) {
  return request(`/containers/${id}`);
}

export function createContainer(data) {
  return request('/containers', { method: 'POST', body: JSON.stringify(data) });
}

// Locations
export function getLocations() {
  return request('/locations');
}

export function getLocation(id) {
  return request(`/locations/${id}`);
}

export function createLocation(data) {
  return request('/locations', { method: 'POST', body: JSON.stringify(data) });
}

// Stats
export function getStats() {
  return request('/stats');
}

export function getActivity(limit = 50) {
  return request(`/stats/activity?limit=${limit}`);
}

// Command
export function sendCommand(text) {
  return request('/command', { method: 'POST', body: JSON.stringify({ text }) });
}
