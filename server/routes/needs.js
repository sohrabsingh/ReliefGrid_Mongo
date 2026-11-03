const express = require('express');
const Need = require('../models/Need');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkAndFlagDuplicate } = require('../services/duplicateDetection');
const { getCandidates, dispatchNeed, NoCapacityError } = require('../services/dispatch');
const { sendSms } = require('../services/notify');
const { publicWriteLimiter } = require('../middleware/rateLimit');
const { parseLimit } = require('../utils/pagination');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Anyone (citizen app, SMS gateway, field officer) can raise a need - no auth required,
// mirroring "raise a need in 20 seconds" from the field. Rate-limited since it's public.
router.post('/', publicWriteLimiter, async (req, res) => {
  try {
    const { category, items, urgency, vulnerableCount, description, location, ward, district, reportedBy } = req.body;
    const need = await Need.create({
      category,
      items,
      urgency,
      vulnerableCount,
      description,
      location,
      ward,
      district,
      reportedBy,
    });

    const duplicateOf = await checkAndFlagDuplicate(need);

    res.status(201).json({ need, flaggedDuplicateOf: duplicateOf?._id || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', asyncHandler(async (req, res) => {
  const { status, category, district, q } = req.query;
  const limit = parseLimit(req.query);
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (district) filter.district = district;

  // Full-text search over the free-form `description` field (helpline notes, raw SMS).
  // Local MongoDB text index today; swap to $search for Atlas Search's relevance
  // ranking and typo tolerance once this points at an Atlas cluster (see model comment).
  if (q) {
    filter.$text = { $search: q };
    const needs = await Need.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);
    return res.json(needs);
  }

  const needs = await Need.find(filter).sort({ status: 1, urgency: -1, createdAt: 1 }).limit(limit);
  res.json(needs);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const need = await Need.findById(req.params.id);
  if (!need) return res.status(404).json({ error: 'not found' });
  res.json(need);
}));

// Officer resolves a plain/flagged need: either verifies it as real and distinct,
// or confirms it really is a duplicate and closes it.
router.patch('/:id/verify', requireAuth, requireRole('officer'), asyncHandler(async (req, res) => {
  const { action } = req.body; // 'verify' | 'confirm_duplicate'
  const need = await Need.findById(req.params.id);
  if (!need) return res.status(404).json({ error: 'not found' });

  if (action === 'confirm_duplicate') {
    need.status = 'duplicate';
  } else {
    need.status = 'verified';
    need.duplicateOf = null;
  }
  need.verifiedBy = req.user.username;
  need.verifiedAt = new Date();
  await need.save();

  res.json(need);
}));

// Preview stage - the top-3 ranked candidates, before a human commits to one.
router.get('/:id/candidates', requireAuth, requireRole('officer'), asyncHandler(async (req, res) => {
  const need = await Need.findById(req.params.id);
  if (!need) return res.status(404).json({ error: 'not found' });

  const candidates = await getCandidates(need);
  res.json({ need, candidates });
}));

router.post('/:id/dispatch', requireAuth, requireRole('officer'), async (req, res) => {
  try {
    const { resourceId } = req.body;
    const { need, resource, delivery } = await dispatchNeed(req.params.id, { resourceId });

    if (need.reportedBy?.phone) {
      await sendSms(need.reportedBy.phone, `ReliefGrid: help is on the way from ${resource.ownerOrg}.`);
    }

    res.json({ need, resource, delivery });
  } catch (err) {
    if (err instanceof NoCapacityError) return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
