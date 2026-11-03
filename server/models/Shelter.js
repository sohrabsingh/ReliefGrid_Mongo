const { mongoose } = require('../config/db');
const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const shelterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    occupancy: { type: Number, default: 0, min: 0 },
    facilities: { type: [String], default: [] },
    location: { type: pointSchema, required: true },
    contact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

shelterSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.Shelter || mongoose.model('Shelter', shelterSchema);
