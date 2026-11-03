import { useState } from 'react';
import { api } from '../api.js';

const CATEGORIES = ['medical', 'food', 'water', 'shelter', 'rescue', 'other'];

const emptyForm = {
  ownerOrg: '',
  category: 'medical',
  stock: 10,
  itemName: 'insulin',
  lat: 8.5241,
  lng: 76.9558,
  vehicle: 'van',
};

export default function ResourcesPanel({ resources, isOfficer, onRefresh }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createResource({
        ownerOrg: form.ownerOrg,
        category: form.category,
        stock: Number(form.stock),
        items: [{ name: form.itemName, qty: Number(form.stock) }],
        location: { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] },
        vehicle: form.vehicle,
      });
      setMessage('Resource registered.');
      onRefresh();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <h3>Register a resource</h3>
        {!isOfficer && <p className="hint">Log in as officer1 or volunteer1 to register a resource.</p>}
        <form onSubmit={submit} className="form">
          <label>Owner org<input value={form.ownerOrg} onChange={set('ownerOrg')} disabled={!isOfficer} required /></label>
          <label>
            Category
            <select value={form.category} onChange={set('category')} disabled={!isOfficer}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Item name<input value={form.itemName} onChange={set('itemName')} disabled={!isOfficer} /></label>
          <label>Stock<input type="number" min="0" value={form.stock} onChange={set('stock')} disabled={!isOfficer} /></label>
          <label>Latitude<input type="number" step="0.0001" value={form.lat} onChange={set('lat')} disabled={!isOfficer} /></label>
          <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={set('lng')} disabled={!isOfficer} /></label>
          <label>Vehicle<input value={form.vehicle} onChange={set('vehicle')} disabled={!isOfficer} /></label>
          <button type="submit" disabled={!isOfficer}>Register</button>
        </form>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="card wide">
        <h3>Resources ({resources.length})</h3>
        <table>
          <thead>
            <tr><th>org</th><th>category</th><th>stock</th><th>availability</th><th>vehicle</th></tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r._id}>
                <td>{r.ownerOrg}</td>
                <td>{r.category}</td>
                <td>{r.stock}</td>
                <td><span className={`avail-badge avail-${r.availability}`}>{r.availability}</span></td>
                <td>{r.vehicle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
