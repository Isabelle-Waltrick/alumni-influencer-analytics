const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
    },

    bidWindowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BidWindow',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, 'Bid must be at least £1'],
    },

    // true once the cron job runs and this bid is the highest
    isWinner: {
      type: Boolean,
      default: false,
    },

    // lets us soft-cancel a bid without deleting the record
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// one active bid per user per window — enforced at DB level
// controller should also check before insert to give a clean error message
bidSchema.index({ userId: 1, bidWindowId: 1 }, { unique: true });

module.exports = mongoose.model('Bid', bidSchema);
