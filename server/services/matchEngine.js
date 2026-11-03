const Resource = require('../models/Resource');

const MAX_DISTANCE_M = 15000; // 15km search radius

/**
 * Builds the exact three-stage aggregation pipeline from the design doc:
 *   $geoNear (nearest + capability + stock filter, one indexed pass)
 *   -> $addFields (urgency/vulnerability/distance blended into one score)
 *   -> $sort/$limit (top 3 candidates, human makes the final call)
 */
function buildMatchPipeline(need) {
  const qty = (need.items || []).reduce((sum, it) => sum + it.qty, 0) || 1;
  // Normalize to a plain GeoJSON object - `need` is often a live Mongoose document,
  // and $geoNear's `near` must be exactly { type, coordinates }, nothing extra.
  const near = { type: 'Point', coordinates: [...need.location.coordinates] };

  return [
    {
      $geoNear: {
        near,
        distanceField: 'distanceM',
        maxDistance: MAX_DISTANCE_M,
        query: {
          category: need.category,
          availability: 'free',
          stock: { $gte: qty },
        },
        spherical: true,
      },
    },
    {
      $addFields: {
        // -5 points per km keeps distance a real tiebreaker (up to -75 at the 15km
        // search radius) without letting it override a genuinely more urgent need -
        // the original -1/(distance+1) term was so small past a few metres that two
        // candidates 0m and 4km away scored almost identically.
        score: {
          $add: [
            { $multiply: [need.urgency, 20] },
            { $multiply: [need.vulnerableCount || 0, 8] },
            { $multiply: [{ $divide: ['$distanceM', 1000] }, -5] },
          ],
        },
      },
    },
    { $sort: { score: -1, distanceM: 1 } },
    { $limit: 3 },
  ];
}

/** Runs the pipeline and returns up to 3 ranked candidate resources for this need. */
async function findCandidates(need) {
  const pipeline = buildMatchPipeline(need);
  const candidates = await Resource.aggregate(pipeline);
  return candidates;
}

module.exports = { buildMatchPipeline, findCandidates, MAX_DISTANCE_M };
