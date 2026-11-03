const { mongoose } = require('../config/db');
const { Schema } = mongoose;

const CATEGORIES = ['medical', 'food', 'water', 'shelter', 'rescue', 'other'];

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (v) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v[0] >= -180 &&
          v[0] <= 180 &&
          v[1] >= -90 &&
          v[1] <= 90,
        message: 'location.coordinates must be a well-formed [lng, lat] pair',
      },
    },
  },
  { _id: false }
);

const itemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'unit' },
  },
  { _id: false }
);

const needSchema = new Schema(
  {
    category: { type: String, enum: CATEGORIES, required: true },
    items: {
      type: [itemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'a need must list at least one item',
      },
    },
    urgency: { type: Number, required: true, min: 1, max: 5 },
    vulnerableCount: { type: Number, default: 0, min: 0 },
    // Free-form text - what a helpline operator actually typed, or the raw SMS body.
    // Indexed for full-text search (see routes/needs.js GET /?q=).
    description: { type: String, trim: true, default: '' },
    location: { type: pointSchema, required: true },
    ward: { type: String, trim: true },
    district: { type: String, trim: true, default: 'Trivandrum' },
    status: {
      type: String,
      enum: [
        'pending', // just captured, not yet checked for duplicates
        'flagged_duplicate', // looks like a duplicate of an existing need, awaiting officer decision
        'verified', // officer confirmed it is real and distinct
        'matched', // top candidates computed, awaiting dispatch
        'dispatched', // a resource has been assigned and reserved
        'fulfilled', // delivery confirmed
        'duplicate', // officer confirmed it IS a duplicate, closed
        'expired', // TTL-cleaned, nobody ever verified it
        'cancelled',
      ],
      default: 'pending',
    },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Need', default: null },
    reportedBy: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      channel: { type: String, enum: ['app', 'sms', 'officer'], default: 'app' },
    },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    // Stale, never-verified needs auto-expire so the live picture doesn't fill with dead requests.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

needSchema.virtual('totalQty').get(function () {
  return (this.items || []).reduce((sum, it) => sum + it.qty, 0);
});
needSchema.set('toJSON', { virtuals: true });
needSchema.set('toObject', { virtuals: true });

// Geospatial lookups ("what is nearest?") and the priority queue view for the command centre.
needSchema.index({ location: '2dsphere' });
needSchema.index({ status: 1, urgency: -1 });
// TTL: only meaningful while status stays 'pending' - matched/dispatched/fulfilled needs are cleared elsewhere.
needSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Full-text search over free-form descriptions (helpline notes, raw SMS bodies).
// This is a standard MongoDB text index, which works on any deployment including a
// local mongod. Atlas Search (Lucene-backed, typo-tolerant, relevance-tuned) is a
// strict upgrade available only on Atlas - see docs/atlas-search.md for the one-line
// swap ($text -> $search) once this project is pointed at an Atlas cluster.
needSchema.index({ description: 'text' });

module.exports = mongoose.models.Need || mongoose.model('Need', needSchema);
module.exports.CATEGORIES = CATEGORIES;
