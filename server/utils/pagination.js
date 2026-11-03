// A defensive cap on list endpoints, not real pagination - the dashboard just needs
// "everything," but an unbounded find() means a flood simulation (600+ needs) or an
// abusive client can make one query try to return an unbounded result set. `limit`
// lets a client ask for fewer; nobody can ask for more than MAX.
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function parseLimit(query) {
  const requested = Number(query.limit);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_LIMIT;
  return Math.min(requested, MAX_LIMIT);
}

module.exports = { parseLimit, DEFAULT_LIMIT, MAX_LIMIT };
