import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

const TRIVANDRUM_CENTER = [8.5241, 76.9558];

const STATUS_COLOR = {
  pending: '#f39c12',
  flagged_duplicate: '#e67e22',
  verified: '#3498db',
  matched: '#9b59b6',
  dispatched: '#2980b9',
  fulfilled: '#2ecc71',
  duplicate: '#7f8c8d',
  expired: '#7f8c8d',
  cancelled: '#7f8c8d',
};

const AVAILABILITY_COLOR = { free: '#27ae60', busy: '#c0392b', offline: '#7f8c8d' };

// Clustering (below) groups markers by icon, not SVG shape, so needs/resources use a
// small colored dot icon instead of react-leaflet's vector CircleMarker - that keeps
// the same at-a-glance color coding while letting hundreds of them collapse into a
// single "42" bubble when zoomed out (a real flood scenario after `npm run simulate`
// puts 100+ markers on screen at once).
const iconCache = new Map();
function dotIcon(color, size = 16) {
  const key = `${color}-${size}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: 'dot-icon',
        html: `<span style="background:${color};width:${size}px;height:${size}px"></span>`,
        iconSize: [size, size],
        // Without this, Leaflet defaults to bottom-center anchoring (pin behavior),
        // which would place a symmetric dot noticeably off its true coordinate.
        iconAnchor: [size / 2, size / 2],
      })
    );
  }
  return iconCache.get(key);
}

export default function MapView({ needs, resources, shelters }) {
  return (
    <div className="map-wrap">
      <MapContainer center={TRIVANDRUM_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {needs.map((n) => (
            <Marker
              key={n._id}
              position={[n.location.coordinates[1], n.location.coordinates[0]]}
              icon={dotIcon(STATUS_COLOR[n.status] || '#333', 12 + n.urgency)}
            >
              <Popup>
                <b>NEED</b> · {n.category} · urgency {n.urgency}
                <br />
                status: {n.status}
                <br />
                items: {(n.items || []).map((i) => `${i.qty} ${i.name}`).join(', ')}
                <br />
                vulnerable: {n.vulnerableCount}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {resources.map((r) => (
            <Marker
              key={r._id}
              position={[r.location.coordinates[1], r.location.coordinates[0]]}
              icon={dotIcon(AVAILABILITY_COLOR[r.availability] || '#333', 14)}
            >
              <Popup>
                <b>RESOURCE</b> · {r.ownerOrg}
                <br />
                category: {r.category} · stock: {r.stock}
                <br />
                availability: {r.availability}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Shelters are always a handful, not a flood of points - no clustering needed. */}
        {shelters.map((s) => (
          <CircleMarker
            key={s._id}
            center={[s.location.coordinates[1], s.location.coordinates[0]]}
            radius={8}
            pathOptions={{ color: '#34495e', fillOpacity: 0.3 }}
          >
            <Popup>
              <b>SHELTER</b> · {s.name}
              <br />
              occupancy: {s.occupancy}/{s.capacity}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="legend">
        <div><span className="swatch" style={{ background: '#f39c12' }} /> need: pending</div>
        <div><span className="swatch" style={{ background: '#3498db' }} /> need: verified</div>
        <div><span className="swatch" style={{ background: '#2980b9' }} /> need: dispatched</div>
        <div><span className="swatch" style={{ background: '#2ecc71' }} /> need: fulfilled</div>
        <div><span className="swatch" style={{ background: '#27ae60' }} /> resource: free</div>
        <div><span className="swatch" style={{ background: '#c0392b' }} /> resource: busy</div>
        <div><span className="swatch" style={{ background: '#34495e' }} /> shelter</div>
      </div>
    </div>
  );
}
