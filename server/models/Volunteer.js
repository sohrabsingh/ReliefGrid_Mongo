const { mongoose } = require('../config/db');
const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const volunteerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    skills: { type: [String], default: [] },
    currentLocation: { type: pointSchema, required: true },
    radiusKm: { type: Number, default: 5, min: 0 },
    shiftWindow: {
      start: { type: String, default: '08:00' }, // HH:mm, kept simple for a class demo
      end: { type: String, default: '20:00' },
    },
    // 0 = self-registered/unverified, 1 = verified by an officer, 2 = team lead
    verificationLevel: { type: Number, enum: [0, 1, 2], default: 0 },
    linkedResource: { type: Schema.Types.ObjectId, ref: 'Resource', default: null },
  },
  { timestamps: true }
);

volunteerSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.models.Volunteer || mongoose.model('Volunteer', volunteerSchema);
