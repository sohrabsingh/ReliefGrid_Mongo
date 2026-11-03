const rateLimit = require('express-rate-limit');

// A generous ceiling for the whole API - catches anything pathological without
// getting in the way of normal dashboard polling/socket reconnects.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests - slow down' },
});

// Tighter limit for the public, unauthenticated write endpoints (anyone can hit these -
// raising a need, texting in, logging in - with no token). A real flood means bursts of
// genuine reports, not a script hammering one endpoint, so this stays well above normal
// human/SMS-gateway traffic while still blocking abuse.
const publicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests - slow down' },
});

// Login brute-forcing has a much lower legitimate ceiling than "people reporting a
// flood" - nobody genuinely needs more than a handful of login attempts a minute.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many login attempts - slow down' },
});

module.exports = { apiLimiter, publicWriteLimiter, loginLimiter };
