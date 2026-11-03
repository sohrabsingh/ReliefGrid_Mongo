const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const { CATEGORIES } = require('./Need');

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const polygonSchema = new Schema(
  {
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: { type: [[[Number]]], default: undefined },
  },
  { _id: false }
);

const resourceSchema = new Schema(
  {
    ownerOrg: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    // Total interchangeable units of `category` this resource can still give out right now.
    // The matching pipeline filters on this directly (stock: { $gte: need.qty }).
    stock: { type: Number, required: true, min: 0 },
    items: [
      {
        name: { type: String, trim: true },
        qty: { type: Number, min: 0 },
        unit: { type: String, default: 'unit' },
        _id: false,
      },
    ],
    location: { type: pointSchema, required: true },
    serviceArea: { type: polygonSchema, default: undefined },
    availability: { type: String, enum: ['free', 'busy', 'offline'], default: 'free' },
    vehicle: { type: String, default: 'none' },
    district: { type: String, trim: true, default: 'Trivandrum' },
    contact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

resourceSchema.index({ location: '2dsphere' });
resourceSchema.index({ category: 1, availability: 1, stock: 1 });

module.exports = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);
