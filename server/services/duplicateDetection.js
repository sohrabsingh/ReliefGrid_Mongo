const Need = require('../models/Need');

const DUPLICATE_RADIUS_M = 300; // "near-identical" = same spot, roughly
const DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000; // look back 6 hours

const ACTIVE_STATUSES = ['pending', 'flagged_duplicate', 'verified', 'matched'];

/**
 * Looks for an existing, still-active need of the same category within a small
 * radius and a recent time window. Returns the earliest match (the "original"),
 * or null if this need looks genuinely new.
 */
async function findPossibleDuplicate(need) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const geometry = { type: 'Point', coordinates: [...need.location.coordinates] };

  const match = await Need.findOne({
    _id: { $ne: need._id },
    category: need.category,
    status: { $in: ACTIVE_STATUSES },
    createdAt: { $gte: since },
    location: {
      $nearSphere: {
        $geometry: geometry,
        $maxDistance: DUPLICATE_RADIUS_M,
      },
    },
  }).sort({ createdAt: 1 });

  return match;
}

/**
 * Flags `need` as a duplicate of an existing request if one is found nearby.
 * The need is NOT closed automatically - an officer still confirms it in one tap
 * (see PATCH /api/needs/:id/verify), since it might genuinely be a second, distinct case.
 */
async function checkAndFlagDuplicate(need) {
  const original = await findPossibleDuplicate(need);
  if (!original) return null;

  need.status = 'flagged_duplicate';
  need.duplicateOf = original._id;
  await need.save();
  return original;
}

module.exports = { findPossibleDuplicate, checkAndFlagDuplicate, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_MS };
