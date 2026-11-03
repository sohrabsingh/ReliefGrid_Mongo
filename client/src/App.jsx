import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';
import MapView from './components/MapView.jsx';
import LoginBar from './components/LoginBar.jsx';
import NeedsPanel from './components/NeedsPanel.jsx';
import ResourcesPanel from './components/ResourcesPanel.jsx';
import VolunteersPanel from './components/VolunteersPanel.jsx';
import SheltersPanel from './components/SheltersPanel.jsx';
import CommandCentre from './components/CommandCentre.jsx';
import DeliveriesPanel from './components/DeliveriesPanel.jsx';

function upsertById(list, doc) {
  const idx = list.findIndex((d) => d._id === doc._id);
  if (idx === -1) return [doc, ...list];
  const next = [...list];
  next[idx] = doc;
  return next;
}

const TABS = ['map', 'needs', 'resources', 'volunteers', 'shelters', 'command centre', 'deliveries'];

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('reliefgrid_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [tab, setTab] = useState('map');
  const [needs, setNeeds] = useState([]);
  const [resources, setResources] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [connected, setConnected] = useState(socket.connected);

  const refreshAll = useCallback(async () => {
    const [n, r, v, s, d] = await Promise.all([
      api.listNeeds(),
      api.listResources(),
      api.listVolunteers(),
      api.listShelters(),
      api.listDeliveries(),
    ]);
    setNeeds(n);
    setResources(r);
    setVolunteers(v);
    setShelters(s);
    setDeliveries(d);
  }, []);

  useEffect(() => {
    refreshAll().catch((err) => console.error('initial load failed', err));

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNeedChange = (doc) => setNeeds((prev) => upsertById(prev, doc));
    const onResourceChange = (doc) => setResources((prev) => upsertById(prev, doc));
    const onVolunteerChange = (doc) => setVolunteers((prev) => upsertById(prev, doc));
    const onShelterChange = (doc) => setShelters((prev) => upsertById(prev, doc));
    const onDeliveryChange = (doc) => setDeliveries((prev) => upsertById(prev, doc));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('need:created', onNeedChange);
    socket.on('need:updated', onNeedChange);
    socket.on('resource:created', onResourceChange);
    socket.on('resource:updated', onResourceChange);
    socket.on('volunteer:created', onVolunteerChange);
    socket.on('volunteer:updated', onVolunteerChange);
    socket.on('shelter:created', onShelterChange);
    socket.on('shelter:updated', onShelterChange);
    socket.on('delivery:created', onDeliveryChange);
    socket.on('delivery:updated', onDeliveryChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('need:created', onNeedChange);
      socket.off('need:updated', onNeedChange);
      socket.off('resource:created', onResourceChange);
      socket.off('resource:updated', onResourceChange);
      socket.off('volunteer:created', onVolunteerChange);
      socket.off('volunteer:updated', onVolunteerChange);
      socket.off('shelter:created', onShelterChange);
      socket.off('shelter:updated', onShelterChange);
      socket.off('delivery:created', onDeliveryChange);
      socket.off('delivery:updated', onDeliveryChange);
    };
  }, [refreshAll]);

  const login = (u, token) => {
    localStorage.setItem('reliefgrid_token', token);
    localStorage.setItem('reliefgrid_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem('reliefgrid_token');
    localStorage.removeItem('reliefgrid_user');
    setUser(null);
  };

  const isOfficer = user?.role === 'officer';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" style={{ background: connected ? '#2ecc71' : '#e74c3c' }} />
          ReliefGrid <span className="subtitle">live coordination</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={tab === t ? 'tab active' : 'tab'}
              onClick={() => setTab(t)}
              disabled={t === 'command centre' && !isOfficer}
              title={t === 'command centre' && !isOfficer ? 'log in as officer1 to use this' : ''}
            >
              {t}
            </button>
          ))}
        </nav>
        <LoginBar user={user} onLogin={login} onLogout={logout} />
      </header>

      <main className="content">
        {tab === 'map' && <MapView needs={needs} resources={resources} shelters={shelters} />}
        {tab === 'needs' && <NeedsPanel needs={needs} onRefresh={refreshAll} />}
        {tab === 'resources' && <ResourcesPanel resources={resources} isOfficer={isOfficer} onRefresh={refreshAll} />}
        {tab === 'volunteers' && <VolunteersPanel volunteers={volunteers} isOfficer={isOfficer} onRefresh={refreshAll} />}
        {tab === 'shelters' && <SheltersPanel shelters={shelters} isOfficer={isOfficer} onRefresh={refreshAll} />}
        {tab === 'command centre' && isOfficer && <CommandCentre needs={needs} onRefresh={refreshAll} />}
        {tab === 'deliveries' && (
          <DeliveriesPanel deliveries={deliveries} needs={needs} resources={resources} isOfficer={isOfficer} onRefresh={refreshAll} />
        )}
      </main>
    </div>
  );
}
