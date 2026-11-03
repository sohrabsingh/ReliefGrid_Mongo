const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'reliefgrid-dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '12h',
  });
}

/** Verifies the bearer token and attaches { id, username, role } to req.user. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing bearer token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

/** Use after requireAuth. e.g. requireRole('officer') or requireRole('officer', 'volunteer'). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
