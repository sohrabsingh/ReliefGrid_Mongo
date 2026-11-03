const express = require('express');
const Need = require('../models/Need');
const { checkAndFlagDuplicate } = require('../services/duplicateDetection');
const { sendSms } = require('../services/notify');
const { publicWriteLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const DEFAULT_URGENCY = { medical: 5, rescue: 5, water: 3, shelter: 3, food: 2, other: 2 };

/**
 * The real Twilio SMS/IVR webhook shape ({ From, Body }). Point an actual Twilio
 * number's webhook at this URL and it works unchanged - without a Twilio account
 * (the default), simulate a text with the curl command in the README instead; the
 * confirmation reply below just gets logged rather than actually sent (see services/notify.js).
 *
 * Expected Body from the field, kept deliberately simple for a helpline operator to relay:
 *   "<category> <qty> <item> <lat> <lng> [vulnerableCount]"
 *   e.g. "medical 2 insulin 8.5241 76.9558 2"
 */
router.post('/inbound', publicWriteLimiter, async (req, res) => {
  const { From, Body } = req.body;
  if (!Body) return res.status(400).json({ error: 'missing Body' });

  const parts = Body.trim().split(/\s+/);
  const [category, qtyStr, item, latStr, lngStr, vulnStr] = parts;

  const qty = Number(qtyStr);
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!category || !Number.isFinite(qty) || !item || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      error: 'expected Body format: "<category> <qty> <item> <lat> <lng> [vulnerableCount]"',
    });
  }

  try {
    const need = await Need.create({
      category,
      items: [{ name: item, qty }],
      urgency: DEFAULT_URGENCY[category] || 2,
      vulnerableCount: Number(vulnStr) || 0,
      description: Body,
      location: { type: 'Point', coordinates: [lng, lat] },
      reportedBy: { phone: From || 'unknown', channel: 'sms' },
    });

    const duplicateOf = await checkAndFlagDuplicate(need);

    await sendSms(
      From,
      duplicateOf
        ? `ReliefGrid: got it, but this looks like an existing report nearby. An officer will confirm.`
        : `ReliefGrid: request received (${category}, ${qty} ${item}). We're finding the nearest responder.`
    );

    // Twilio expects a 200 with optional TwiML; a plain ack is enough for this demo.
    res.status(201).json({ need, flaggedDuplicateOf: duplicateOf?._id || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
