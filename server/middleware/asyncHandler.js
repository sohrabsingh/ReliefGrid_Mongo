// Express 4 doesn't catch rejected promises from async handlers on its own -
// without this, a bad :id (CastError) or a DB hiccup just hangs the request.
module.exports = (fn) => (req, res, next) => fn(req, res, next).catch(next);
