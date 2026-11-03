const express = require('express');
const Delivery = require('../models/Delivery');
const Need = require('../models/Need');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendSms } = require('../services/notify');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  res.json(await Delivery.find(filter).sort({ createdAt: -1 }));
});

// "Delivery is closed with a photo and OTP." - the field responder confirms the drop.
router.patch('/:id/confirm', requireAuth, requireRole('officer', 'volunteer'), asyncHandler(async (req, res) => {
  const { photoUrl, otp } = req.body;
  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'not found' });

  delivery.status = 'delivered';
  delivery.proof = { photoUrl: photoUrl || null, otp: otp || null, confirmedAt: new Date() };
  delivery.statusHistory.push({ status: 'delivered', at: new Date() });
  await delivery.save();

  const need = await Need.findByIdAndUpdate(delivery.needId, { status: 'fulfilled' }, { new: true });

  if (need?.reportedBy?.phone) {
    await sendSms(need.reportedBy.phone, `ReliefGrid: your delivery has been confirmed. Stay safe.`);
  }

  res.json({ delivery, need });
}));

module.exports = router;
