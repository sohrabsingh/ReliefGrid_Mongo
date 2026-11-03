import { useState } from 'react';
import { api } from '../api.js';

const QUEUE_STATUSES = ['pending', 'flagged_duplicate', 'verified', 'matched'];

export default function CommandCentre({ needs, onRefresh }) {
  const [candidatesByNeed, setCandidatesByNeed] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [errorByNeed, setErrorByNeed] = useState({});

  const queue = needs
    .filter((n) => QUEUE_STATUSES.includes(n.status))
    .sort((a, b) => b.urgency - a.urgency || new Date(a.createdAt) - new Date(b.createdAt));

  const act = async (id, fn) => {
    setBusyId(id);
    setErrorByNeed((e) => ({ ...e, [id]: null }));
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      setErrorByNeed((e) => ({ ...e, [id]: err.message }));
    } finally {
      setBusyId(null);
    }
  };

  const verify = (id) => act(id, () => api.verifyNeed(id, 'verify'));
  const confirmDuplicate = (id) => act(id, () => api.verifyNeed(id, 'confirm_duplicate'));

  const findMatches = (id) =>
    act(id, async () => {
      const { candidates } = await api.getCandidates(id);
      setCandidatesByNeed((c) => ({ ...c, [id]: candidates }));
    });

  const dispatch = (id, resourceId) => act(id, () => api.dispatchNeed(id, resourceId));

  return (
    <div className="card wide">
      <h3>Command Centre - priority queue ({queue.length})</h3>
      <table>
        <thead>
          <tr>
            <th>urgency</th><th>category</th><th>items</th><th>status</th><th>ward</th><th>actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((n) => (
            <tr key={n._id}>
              <td className="urgency-cell">{n.urgency}</td>
              <td>{n.category}</td>
              <td>{(n.items || []).map((i) => `${i.qty} ${i.name}`).join(', ')}</td>
              <td><span className={`status-badge status-${n.status}`}>{n.status}</span></td>
              <td>{n.ward || '-'}</td>
              <td className="actions-cell">
                {n.status === 'pending' && (
                  <button disabled={busyId === n._id} onClick={() => verify(n._id)}>Verify</button>
                )}
                {n.status === 'flagged_duplicate' && (
                  <>
                    <button disabled={busyId === n._id} onClick={() => verify(n._id)}>Not a duplicate</button>
                    <button disabled={busyId === n._id} onClick={() => confirmDuplicate(n._id)}>Confirm duplicate</button>
                  </>
                )}
                {(n.status === 'verified' || n.status === 'matched') && (
                  <>
                    <button disabled={busyId === n._id} onClick={() => findMatches(n._id)}>Find matches</button>
                    <button disabled={busyId === n._id} onClick={() => dispatch(n._id)}>Auto-dispatch top match</button>
                  </>
                )}
                {errorByNeed[n._id] && <div className="error small">{errorByNeed[n._id]}</div>}

                {candidatesByNeed[n._id] && (
                  <div className="candidates">
                    {candidatesByNeed[n._id].length === 0 && <div className="hint">no free responder found nearby</div>}
                    {candidatesByNeed[n._id].map((c) => (
                      <div key={c._id} className="candidate-row">
                        <span>{c.ownerOrg} - {Math.round(c.distanceM)}m - score {c.score.toFixed(1)} - stock {c.stock}</span>
                        <button disabled={busyId === n._id} onClick={() => dispatch(n._id, c._id)}>Dispatch here</button>
                      </div>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
