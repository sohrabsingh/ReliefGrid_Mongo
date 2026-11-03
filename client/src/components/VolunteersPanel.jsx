import { useState } from 'react';
import { api } from '../api.js';

const emptyForm = {
  name: '',
  phone: '',
  skills: 'first_aid, driving',
  radiusKm: 5,
  lat: 8.5241,
  lng: 76.9558,
};

const LEVEL_LABEL = { 0: 'unverified', 1: 'verified', 2: 'lead' };

export default function VolunteersPanel({ volunteers, isOfficer, onRefresh }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createVolunteer({
        name: form.name,
        phone: form.phone,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        radiusKm: Number(form.radiusKm),
        currentLocation: { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] },
      });
      setMessage('Registered - awaiting officer verification.');
      setForm(emptyForm);
      onRefresh();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const verify = async (id, level) => {
    setBusyId(id);
    try {
      await api.verifyVolunteer(id, level);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <h3>Register as a volunteer</h3>
        <form onSubmit={submit} className="form">
          <label>Name<input value={form.name} onChange={set('name')} required /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} required /></label>
          <label>Skills (comma-separated)<input value={form.skills} onChange={set('skills')} /></label>
          <label>Service radius (km)<input type="number" min="0" value={form.radiusKm} onChange={set('radiusKm')} /></label>
          <label>Latitude<input type="number" step="0.0001" value={form.lat} onChange={set('lat')} /></label>
          <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={set('lng')} /></label>
          <button type="submit">Register</button>
        </form>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="card wide">
        <h3>Volunteers ({volunteers.length})</h3>
        <table>
          <thead>
            <tr><th>name</th><th>phone</th><th>skills</th><th>radius</th><th>status</th>{isOfficer && <th>actions</th>}</tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v._id}>
                <td>{v.name}</td>
                <td>{v.phone}</td>
                <td>{(v.skills || []).join(', ')}</td>
                <td>{v.radiusKm} km</td>
                <td><span className={`status-badge status-${v.verificationLevel === 0 ? 'pending' : 'fulfilled'}`}>{LEVEL_LABEL[v.verificationLevel]}</span></td>
                {isOfficer && (
                  <td className="actions-cell">
                    {v.verificationLevel !== 1 && (
                      <button disabled={busyId === v._id} onClick={() => verify(v._id, 1)}>Mark verified</button>
                    )}
                    {v.verificationLevel !== 2 && (
                      <button disabled={busyId === v._id} onClick={() => verify(v._id, 2)}>Mark team lead</button>
                    )}
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
