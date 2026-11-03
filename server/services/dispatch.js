const Need = require('../models/Need');
const Resource = require('../models/Resource');
const Delivery = require('../models/Delivery');
const { findCandidates } = require('./matchEngine');

class NoCapacityError extends Error {
  constructor(message = 'no free responder with enough stock was found nearby') {
    super(message);
    this.name = 'NoCapacityError';
  }
}

function totalQty(need) {
  return (need.items || []).reduce((sum, it) => sum + it.qty, 0) || 1;
}

/** Stage 1-3 of the matching pipeline only - lets the command centre preview candidates. */
async function getCandidates(need) {
  const candidates = await findCandidates(need);
  if (candidates.length && need.status === 'verified') {
    need.status = 'matched';
    await need.save();
  }
  return candidates;
}

/**
 * Reserves a resource for `need` atomically: the $inc + guard condition means two
 * command centres racing on the same delivery can never both succeed - whoever's
 * update lands first wins, the loser's filter no longer matches and gets null back.
 */
async function reserveResource(resourceId, qty) {
  const resource = await Resource.findOneAndUpdate(
    { _id: resourceId, availability: 'free', stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true }
  );
  if (!resource) return null;

  if (resource.stock === 0) {
    resource.availability = 'busy';
    await resource.save();
  }
  return resource;
}

/**
 * Dispatches `need`: either to the given resourceId (officer override) or, failing
 * that, walks the ranked candidate list from the matching engine until a reservation
 * succeeds. Throws NoCapacityError if nothing nearby has capacity left.
 */
async function dispatchNeed(needId, { resourceId } = {}) {
  const need = await Need.findById(needId);
  if (!need) throw new Error('need not found');
  if (['dispatched', 'fulfilled', 'duplicate', 'cancelled'].includes(need.status)) {
    throw new Error(`need is already ${need.status}`);
  }

  const qty = totalQty(need);
  let candidates = [];

  if (resourceId) {
    candidates = [{ _id: resourceId }];
  } else {
    candidates = await findCandidates(need);
    if (!candidates.length) throw new NoCapacityError();
  }

  for (const candidate of candidates) {
    const resource = await reserveResource(candidate._id, qty);
    if (!resource) continue; // lost the race, or stock/availability changed - try the next one

    const delivery = await Delivery.create({
      needId: need._id,
      resourceId: resource._id,
      qty,
      distanceM: candidate.distanceM,
      score: candidate.score,
    });

    need.status = 'dispatched';
    await need.save();

    return { need, resource, delivery };
  }

  throw new NoCapacityError();
}

module.exports = { getCandidates, dispatchNeed, reserveResource, totalQty, NoCapacityError };
