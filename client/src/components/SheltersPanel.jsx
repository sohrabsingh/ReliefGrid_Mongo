import { useState } from 'react';
import { api } from '../api.js';

const emptyForm = {
  name: '',
  capacity: 100,
  occupancy: 0,
  facilities: 'kitchen, water_point',
  lat: 8.5241,
  lng: 76.9558,
  contactName: '',
  contactPhone: '',
};

export default function SheltersPanel({ shelters, isOfficer, onRefresh }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createShelter({
        name: form.name,
        capacity: Number(form.capacity),
        occupancy: Number(form.occupancy),
        facilities: form.facilities.split(',').map((s) => s.trim()).filter(Boolean),
        location: { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] },
        contact: { name: form.contactName, phone: form.contactPhone },
      });
      setMessage('Shelter registered.');
      setForm(emptyForm);
      onRefresh();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const adjustOccupancy = async (shelter, delta) => {
    setBusyId(shelter._id);
    try {
      const next = Math.max(0, Math.min(shelter.capacity, shelter.occupancy + delta));
      await api.updateShelter(shelter._id, { occupancy: next });
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <h3>Register a shelter</h3>
        {!isOfficer && <p className="hint">Log in as officer1 to register a shelter.</p>}
        <form onSubmit={submit} className="form">
          <label>Name<input value={form.name} onChange={set('name')} disabled={!isOfficer} required /></label>
          <label>Capacity<input type="number" min="0" value={form.capacity} onChange={set('capacity')} disabled={!isOfficer} /></label>
          <label>Current occupancy<input type="number" min="0" value={form.occupancy} onChange={set('occupancy')} disabled={!isOfficer} /></label>
          <label>Facilities (comma-separated)<input value={form.facilities} onChange={set('facilities')} disabled={!isOfficer} /></label>
          <label>Latitude<input type="number" step="0.0001" value={form.lat} onChange={set('lat')} disabled={!isOfficer} /></label>
          <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={set('lng')} disabled={!isOfficer} /></label>
          <label>Contact name<input value={form.contactName} onChange={set('contactName')} disabled={!isOfficer} /></label>
          <label>Contact phone<input value={form.contactPhone} onChange={set('contactPhone')} disabled={!isOfficer} /></label>
          <button type="submit" disabled={!isOfficer}>Register</button>
        </form>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="card wide">
        <h3>Shelters ({shelters.length})</h3>
        <table>
          <thead>
            <tr><th>name</th><th>occupancy</th><th>facilities</th>{isOfficer && <th>actions</th>}</tr>
          </thead>
          <tbody>
            {shelters.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.occupancy} / {s.capacity}</td>
                <td>{(s.facilities || []).join(', ')}</td>
                {isOfficer && (
                  <td className="actions-cell">
                    <button disabled={busyId === s._id} onClick={() => adjustOccupancy(s, 1)}>+1 arrival</button>
                    <button disabled={busyId === s._id} onClick={() => adjustOccupancy(s, -1)}>-1 departure</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
