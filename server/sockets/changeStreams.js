const Need = require('../models/Need');
const Resource = require('../models/Resource');
const Delivery = require('../models/Delivery');
const Shelter = require('../models/Shelter');
const Volunteer = require('../models/Volunteer');

/**
 * This is the real-time mechanism the deck describes: dashboards don't poll, they
 * subscribe. Each collection's MongoDB change stream is watched here once, server-side,
 * and every insert/update is re-broadcast to all connected Socket.IO clients as a plain
 * event. Any write to the DB shows up live - whether it came from this API, the seed
 * script, or a second server instance - which is the whole point of using change
 * streams instead of emitting from inside each route handler.
 *
 * Requires MongoDB to be running as a replica set (see docker-compose.yml / Atlas).
 */
function watchCollection(model, eventPrefix, io) {
  const stream = model.watch([], { fullDocument: 'updateLookup' });

  stream.on('change', (change) => {
    const doc = change.fullDocument;
    if (!doc) return;

    if (change.operationType === 'insert') {
      io.emit(`${eventPrefix}:created`, doc);
    } else if (change.operationType === 'update' || change.operationType === 'replace') {
      io.emit(`${eventPrefix}:updated`, doc);
    }
  });

  stream.on('error', (err) => {
    console.error(`[change-stream:${eventPrefix}] error`, err.message);
  });

  return stream;
}

function startChangeStreams(io) {
  const streams = [
    watchCollection(Need, 'need', io),
    watchCollection(Resource, 'resource', io),
    watchCollection(Delivery, 'delivery', io),
    watchCollection(Shelter, 'shelter', io),
    watchCollection(Volunteer, 'volunteer', io),
  ];

  console.log('[change-streams] watching needs, resources, deliveries, shelters, volunteers');
  return () => streams.forEach((s) => s.close());
}

module.exports = { startChangeStreams };
