const { mongoose } = require('../config/db');
const { Schema } = mongoose;

const deliverySchema = new Schema(
  {
    needId: { type: Schema.Types.ObjectId, ref: 'Need', required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    qty: { type: Number, required: true, min: 1 },
    // Carried over from the matching pipeline, purely for audit / after-action review.
    distanceM: { type: Number },
    score: { type: Number },
    assignedAt: { type: Date, default: Date.now },
    proof: {
      photoUrl: { type: String, default: null },
      otp: { type: String, default: null },
      confirmedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ['assigned', 'in_transit', 'delivered', 'cancelled'],
      default: 'assigned',
    },
    statusHistory: {
      type: [
        {
          status: String,
          at: { type: Date, default: Date.now },
          _id: false,
        },
      ],
      default: () => [{ status: 'assigned', at: new Date() }],
    },
  },
  { timestamps: true }
);

deliverySchema.index({ needId: 1 });
deliverySchema.index({ resourceId: 1 });
deliverySchema.index({ status: 1 });

module.exports = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);
