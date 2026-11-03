const express = require('express');
const Resource = require('../models/Resource');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseLimit } = require('../utils/pagination');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', requireAuth, requireRole('officer', 'volunteer'), async (req, res) => {
  try {
    const resource = await Resource.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const { category, availability, district } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (availability) filter.availability = availability;
  if (district) filter.district = district;

  const resources = await Resource.find(filter).sort({ updatedAt: -1 }).limit(parseLimit(req.query));
  res.json(resources);
});

router.patch('/:id', requireAuth, requireRole('officer', 'volunteer'), asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!resource) return res.status(404).json({ error: 'not found' });

  res.json(resource);
}));

module.exports = router;
