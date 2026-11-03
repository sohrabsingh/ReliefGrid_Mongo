import { useState } from 'react';
import { api } from '../api.js';

const CATEGORIES = ['medical', 'food', 'water', 'shelter', 'rescue', 'other'];

const emptyForm = {
  category: 'medical',
  itemName: 'insulin',
  qty: 2,
  unit: 'vial',
  urgency: 4,
  vulnerableCount: 1,
  description: '',
  lat: 8.5241,
  lng: 76.9558,
  name: '',
  phone: '',
};

export default function NeedsPanel({ needs, onRefresh }) {
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const { need, flaggedDuplicateOf } = await api.createNeed({
        category: form.category,
        items: [{ name: form.itemName, qty: Number(form.qty), unit: form.unit }],
        urgency: Number(form.urgency),
        vulnerableCount: Number(form.vulnerableCount),
        description: form.description,
        location: { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] },
        reportedBy: { name: form.name, phone: form.phone, channel: 'app' },
      });
      setMessage(
        flaggedDuplicateOf
          ? `Submitted, but flagged as a likely duplicate of an existing need (${flaggedDuplicateOf}). An officer will confirm.`
          : `Submitted - need ${need._id} is pending verification.`
      );
      onRefresh();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const runSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await api.listNeeds({ q: searchTerm.trim() }));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
  };

  const base = searchResults !== null ? searchResults : needs;
  const filtered = statusFilter ? base.filter((n) => n.status === statusFilter) : base;

  return (
    <div className="panel-grid">
      <div className="card">
        <h3>Raise a need</h3>
        <form onSubmit={submit} className="form">
          <label>
            Category
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>Item name<input value={form.itemName} onChange={set('itemName')} /></label>
          <label>Qty<input type="number" min="1" value={form.qty} onChange={set('qty')} /></label>
          <label>Urgency (1-5)<input type="number" min="1" max="5" value={form.urgency} onChange={set('urgency')} /></label>
          <label>Vulnerable count<input type="number" min="0" value={form.vulnerableCount} onChange={set('vulnerableCount')} /></label>
          <label>
            Description (free text - searchable)
            <input value={form.description} onChange={set('description')} placeholder="e.g. trapped on rooftop, water rising" />
          </label>
          <label>Latitude<input type="number" step="0.0001" value={form.lat} onChange={set('lat')} /></label>
          <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={set('lng')} /></label>
          <label>Your name<input value={form.name} onChange={set('name')} /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <button type="submit">Submit need</button>
        </form>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="card wide">
        <div className="card-header">
          <h3>Needs ({filtered.length})</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">all statuses</option>
            {['pending', 'flagged_duplicate', 'verified', 'matched', 'dispatched', 'fulfilled', 'duplicate'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <form onSubmit={runSearch} className="search-row">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="full-text search descriptions - e.g. rooftop, trapped, generator"
          />
          <button type="submit" disabled={searching}>Search</button>
          {searchResults !== null && <button type="button" onClick={clearSearch}>Clear</button>}
        </form>
        {searchResults !== null && (
          <p className="hint">
            {searchResults.length} match(es) for "{searchTerm}" - searching a MongoDB text index (Atlas Search on Atlas).
          </p>
        )}

        <table>
          <thead>
            <tr><th>category</th><th>items</th><th>description</th><th>urgency</th><th>status</th><th>ward</th><th>created</th></tr>
          </thead>
          <tbody>
            {filtered.map((n) => (
              <tr key={n._id}>
                <td>{n.category}</td>
                <td>{(n.items || []).map((i) => `${i.qty} ${i.name}`).join(', ')}</td>
                <td>{n.description || '-'}</td>
                <td>{n.urgency}</td>
                <td><span className={`status-badge status-${n.status}`}>{n.status}</span></td>
                <td>{n.ward || '-'}</td>
                <td>{new Date(n.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
