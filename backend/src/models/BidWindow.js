const mongoose = require('mongoose');

// one BidWindow per day — represents the bidding session for that day
// bids placed today are competing for the featured slot tomorrow

const bidWindowSchema = new mongoose.Schema(
  {
    // the calendar date this window is FOR (YYYY-MM-DD stored as a string for easy lookups)
    date: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ['open', 'closed', 'resolved'],
      default: 'open',
    },

    // populated once the cron job picks a winner at midnight
    winnerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
    },

    // kept internal — never returned to clients
    winnerBidAmount: {
      type: Number,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BidWindow', bidWindowSchema);
