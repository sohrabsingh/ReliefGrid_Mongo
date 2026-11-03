const express = require('express');
const Volunteer = require('../models/Volunteer');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicWriteLimiter } = require('../middleware/rateLimit');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Self-registration - no auth required, mirroring "register skills, vehicles, stock" from the field.
router.post('/', publicWriteLimiter, async (req, res) => {
  try {
    const volunteer = await Volunteer.create(req.body);
    res.status(201).json(volunteer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const volunteers = await Volunteer.find(req.query.verified ? { verificationLevel: { $gte: 1 } } : {});
  res.json(volunteers);
});

// Officer bumps a self-registered volunteer from unverified (0) to verified (1) or lead (2).
router.patch('/:id/verify', requireAuth, requireRole('officer'), asyncHandler(async (req, res) => {
  const level = Number(req.body.verificationLevel);
  if (![0, 1, 2].includes(level)) {
    return res.status(400).json({ error: 'verificationLevel must be 0, 1 or 2' });
  }
  const volunteer = await Volunteer.findByIdAndUpdate(req.params.id, { verificationLevel: level }, { new: true });
  if (!volunteer) return res.status(404).json({ error: 'not found' });
  res.json(volunteer);
}));

module.exports = router;
