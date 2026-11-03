import { useState } from 'react';
import { api } from '../api.js';

function findById(list, id) {
  return list.find((x) => x._id === id);
}

export default function DeliveriesPanel({ deliveries, needs, resources, isOfficer, onRefresh }) {
  const [busyId, setBusyId] = useState(null);

  const confirm = async (id) => {
    setBusyId(id);
    try {
      await api.confirmDelivery(id, `https://example.local/proof/${id}.jpg`, String(Math.floor(1000 + Math.random() * 9000)));
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card wide">
      <h3>Deliveries ({deliveries.length})</h3>
      <table>
        <thead>
          <tr><th>need</th><th>resource</th><th>qty</th><th>status</th><th>assigned</th><th>actions</th></tr>
        </thead>
        <tbody>
          {deliveries.map((d) => {
            const need = findById(needs, d.needId);
            const resource = findById(resources, d.resourceId);
            return (
              <tr key={d._id}>
                <td>{need ? `${need.category} (${need.ward || '-'})` : d.needId}</td>
                <td>{resource ? resource.ownerOrg : d.resourceId}</td>
                <td>{d.qty}</td>
                <td><span className={`status-badge status-${d.status}`}>{d.status}</span></td>
                <td>{new Date(d.assignedAt).toLocaleTimeString()}</td>
                <td>
                  {isOfficer && d.status !== 'delivered' && d.status !== 'cancelled' && (
                    <button disabled={busyId === d._id} onClick={() => confirm(d._id)}>
                      Confirm delivered (photo + OTP)
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
