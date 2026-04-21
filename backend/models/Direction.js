/**
 * CyberCoderCRM - Direction Model
 */

const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema(
  {
    price: { type: Number, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const directionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceHistory: {
      type: [priceHistorySchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

directionSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.models.Direction || mongoose.model('Direction', directionSchema);
