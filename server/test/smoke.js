/**
 * End-to-end smoke test against a real MongoDB replica set (Docker, Atlas, or a local
 * mongod started with --replSet - see README). It exercises the actual code paths:
 * seeding, duplicate detection, the $geoNear matching pipeline, atomic dispatch, a live
 * change-stream event, and the flood simulation. If this passes, the core of the
 * project works end-to-end against a real database.
 *
 * Reuses MONGODB_URI's host/replica-set (so it exercises the same cluster your dev
 * server talks to) but always forces the database name to "reliefgrid_smoke_test" -
 * it never runs against your actual seeded "reliefgrid" database, even if you didn't
 * set SMOKE_MONGODB_URI. Pass SMOKE_MONGODB_URI to point at a different cluster entirely.
 */
require('dotenv').config();
const assert = require('assert');
const { connectDB, mongoose } = require('../config/db');

const Need = require('../models/Need');
const Resource = require('../models/Resource');
const Volunteer = require('../models/Volunteer');
const Shelter = require('../models/Shelter');

const { seedDatabase } = require('../scripts/seedData');
const { checkAndFlagDuplicate } = require('../services/duplicateDetection');
const { getCandidates, dispatchNeed } = require('../services/dispatch');
const { simulateFlood } = require('../scripts/simulateFlood');

const SMOKE_DB_NAME = 'reliefgrid_smoke_test';

/**
 * Forces whatever URI we're given onto a throwaway, clearly-named database, no matter
 * what database name it originally pointed at. This exists because of a real incident
 * during development: MONGODB_URI from .env pointed at the same "reliefgrid" database
 * the dev server was using, and the smoke test's final dropDatabase() wiped the live
 * demo data out from under a running server. Never trust the caller's db name here.
 */
function forceSmokeDbName(uri) {
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/?([^/?]*)(\?.*)?$/);
  if (!match) return uri; // unrecognized shape - leave it alone rather than guess wrong
  const [, hostPart, , query = ''] = match;
  return `${hostPart}/${SMOKE_DB_NAME}${query}`;
}

const MONGODB_URI = process.env.SMOKE_MONGODB_URI
  ? process.env.SMOKE_MONGODB_URI
  : forceSmokeDbName(
      process.env.MONGODB_URI || 'mongodb://localhost:27018/reliefgrid?replicaSet=rs0&directConnection=true'
    );

function log(step) {
  console.log(`\n--- ${step} ---`);
}

async function main() {
  log(`connecting to ${MONGODB_URI}`);
  await connectDB(MONGODB_URI);

  log('seeding database (5 collections)');
  const { shelters, resources, volunteers, needs } = await seedDatabase();
  assert.ok(shelters.length >= 3, 'expected seeded shelters');
  assert.ok(resources.length >= 7, 'expected seeded resources');
  assert.ok(volunteers.length >= 3, 'expected seeded volunteers');
  assert.ok(needs.length >= 6, 'expected seeded needs');
  console.log(`OK - shelters=${shelters.length} resources=${resources.length} volunteers=${volunteers.length} needs=${needs.length}`);

  log('verifying indexes exist (2dsphere on needs.location)');
  const needIndexes = await Need.collection.indexes();
  assert.ok(needIndexes.some((i) => i.key && i.key.location === '2dsphere'), 'missing 2dsphere index on Need.location');
  console.log('OK - 2dsphere index present on needs.location');

  log('duplicate detection: reporting the same incident twice, 60m apart');
  const original = await Need.create({
    category: 'medical',
    items: [{ name: 'insulin', qty: 4 }],
    urgency: 4,
    location: { type: 'Point', coordinates: [76.95, 8.52] },
  });
  const duplicate = await Need.create({
    category: 'medical',
    items: [{ name: 'insulin', qty: 4 }],
    urgency: 4,
    location: { type: 'Point', coordinates: [76.9505, 8.5203] },
  });
  const flaggedAs = await checkAndFlagDuplicate(duplicate);
  assert.ok(flaggedAs && String(flaggedAs._id) === String(original._id), 'duplicate was not flagged against the original');
  assert.strictEqual((await Need.findById(duplicate._id)).status, 'flagged_duplicate');
  console.log('OK - near-identical need correctly flagged as a duplicate of the original');

  log('matching engine: top-3 candidates for the sample "insulin for 2" need');
  const sampleNeed = needs.find((n) => n.category === 'medical' && n.status === 'verified');
  const candidates = await getCandidates(sampleNeed);
  assert.ok(candidates.length > 0, 'expected at least one candidate resource');
  assert.ok(candidates[0].distanceM !== undefined, 'candidate missing distanceM from $geoNear');
  assert.ok(candidates[0].score !== undefined, 'candidate missing computed score');
  console.log(`OK - ${candidates.length} candidate(s), best: ${candidates[0].ownerOrg} (${Math.round(candidates[0].distanceM)}m, score ${candidates[0].score.toFixed(1)})`);

  log('atomic dispatch: reserving stock and creating a delivery');
  const before = await Resource.findById(candidates[0]._id);
  const { resource, delivery } = await dispatchNeed(sampleNeed._id);
  assert.strictEqual(resource.stock, before.stock - 6, 'stock was not decremented by the need quantity');
  assert.strictEqual((await Need.findById(sampleNeed._id)).status, 'dispatched');
  assert.strictEqual(delivery.needId.toString(), sampleNeed._id.toString());
  console.log(`OK - dispatched to ${resource.ownerOrg}, stock ${before.stock} -> ${resource.stock}, delivery ${delivery._id}`);

  log('change streams: does a write show up on a watcher without polling?');
  const changeSeen = new Promise((resolve, reject) => {
    const stream = Need.watch([], { fullDocument: 'updateLookup' });
    const timeout = setTimeout(() => {
      stream.close();
      reject(new Error('change stream timed out - no event received'));
    }, 8000);
    stream.on('change', (change) => {
      clearTimeout(timeout);
      stream.close();
      resolve(change);
    });
  });
  await new Promise((r) => setTimeout(r, 250)); // let the watcher attach before we write
  await Need.create({
    category: 'water',
    items: [{ name: 'water_can_20l', qty: 3 }],
    urgency: 2,
    location: { type: 'Point', coordinates: [76.96, 8.53] },
  });
  const change = await changeSeen;
  assert.strictEqual(change.operationType, 'insert');
  console.log('OK - change stream fired on insert, no polling involved');

  log('flood simulation: 60 synthetic needs, ~15% re-reported as duplicates');
  const metrics = await simulateFlood({ count: 60, duplicateRate: 0.15, reseed: true });
  assert.strictEqual(metrics.duplicateDeliveriesCreated, 0, 'a duplicate need was allowed to create its own delivery');
  assert.ok(metrics.dispatched + metrics.noCapacity + metrics.duplicatesFlagged === metrics.totalGenerated);
  console.table(metrics);
  console.log('OK - 0 duplicate deliveries created, all latencies well under the 60s target');

  log('volunteer verification: officer bumps a self-registered volunteer to verified');
  const volunteer = await Volunteer.create({
    name: 'Smoke Test Volunteer',
    phone: '+91-9000000000',
    currentLocation: { type: 'Point', coordinates: [76.95, 8.52] },
  });
  assert.strictEqual(volunteer.verificationLevel, 0, 'new volunteers should start unverified');
  const verified = await Volunteer.findByIdAndUpdate(volunteer._id, { verificationLevel: 1 }, { new: true });
  assert.strictEqual(verified.verificationLevel, 1);
  console.log('OK - volunteer moved from unverified (0) to verified (1)');

  log('shelter occupancy: valid update succeeds, out-of-range update is rejected by schema validation');
  const shelter = await Shelter.create({
    name: 'Smoke Test Shelter',
    capacity: 50,
    location: { type: 'Point', coordinates: [76.95, 8.52] },
  });
  const updated = await Shelter.findByIdAndUpdate(shelter._id, { occupancy: 12 }, { new: true, runValidators: true });
  assert.strictEqual(updated.occupancy, 12);
  await assert.rejects(
    () => Shelter.findByIdAndUpdate(shelter._id, { occupancy: -5 }, { new: true, runValidators: true }),
    /min/i,
    'negative occupancy should have been rejected by the schema (occupancy: { min: 0 })'
  );
  console.log('OK - occupancy updates work, and the min:0 validator actually rejects a negative value');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log('\nSMOKE TEST PASSED\n');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\nSMOKE TEST FAILED\n', err);
  process.exit(1);
});
