const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', loginLimiter, async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }
  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    username: username.toLowerCase(),
    passwordHash,
    role: ['citizen', 'volunteer', 'officer'].includes(role) ? role : 'citizen',
  });

  res.status(201).json({ token: signToken(user), user: { id: user._id, name, role: user.role } });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: (username || '').toLowerCase() });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, role: user.role },
  });
});

module.exports = router;
