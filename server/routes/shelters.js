const express = require('express');
const Shelter = require('../models/Shelter');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', requireAuth, requireRole('officer'), async (req, res) => {
  try {
    const shelter = await Shelter.create(req.body);
    res.status(201).json(shelter);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (_req, res) => {
  res.json(await Shelter.find());
});

// District officers watch fulfilment/occupancy update in real time (slide 4) - this is
// how that number actually changes.
router.patch('/:id', requireAuth, requireRole('officer'), asyncHandler(async (req, res) => {
  const { occupancy, capacity, facilities } = req.body;
  const update = {};
  if (occupancy !== undefined) update.occupancy = occupancy;
  if (capacity !== undefined) update.capacity = capacity;
  if (facilities !== undefined) update.facilities = facilities;

  const shelter = await Shelter.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!shelter) return res.status(404).json({ error: 'not found' });
  res.json(shelter);
}));

module.exports = router;
