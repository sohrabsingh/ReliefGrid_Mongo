const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function authHeaders() {
  const token = localStorage.getItem('reliefgrid_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed: ${res.status}`);
  return data;
}

export const api = {
  API_URL,
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),

  listNeeds: (params = {}) => request(`/api/needs?${new URLSearchParams(params)}`),
  createNeed: (need) => request('/api/needs', { method: 'POST', body: need }),
  verifyNeed: (id, action) => request(`/api/needs/${id}/verify`, { method: 'PATCH', body: { action } }),
  getCandidates: (id) => request(`/api/needs/${id}/candidates`),
  dispatchNeed: (id, resourceId) => request(`/api/needs/${id}/dispatch`, { method: 'POST', body: { resourceId } }),

  listResources: (params = {}) => request(`/api/resources?${new URLSearchParams(params)}`),
  createResource: (resource) => request('/api/resources', { method: 'POST', body: resource }),

  listShelters: () => request('/api/shelters'),
  createShelter: (shelter) => request('/api/shelters', { method: 'POST', body: shelter }),
  updateShelter: (id, patch) => request(`/api/shelters/${id}`, { method: 'PATCH', body: patch }),

  listVolunteers: () => request('/api/volunteers'),
  createVolunteer: (volunteer) => request('/api/volunteers', { method: 'POST', body: volunteer }),
  verifyVolunteer: (id, verificationLevel) =>
    request(`/api/volunteers/${id}/verify`, { method: 'PATCH', body: { verificationLevel } }),

  listDeliveries: (params = {}) => request(`/api/deliveries?${new URLSearchParams(params)}`),
  confirmDelivery: (id, photoUrl, otp) =>
    request(`/api/deliveries/${id}/confirm`, { method: 'PATCH', body: { photoUrl, otp } }),
};
