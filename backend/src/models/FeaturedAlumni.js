const mongoose = require('mongoose');

// permanent record of who was Alumni of the Day and when
// this is what the public /alumni-of-the-day endpoint reads from

const featuredAlumniSchema = new mongoose.Schema(
  {
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

    // the actual date they were featured (YYYY-MM-DD)
    date: {
      type: String,
      required: true,
      unique: true,
    },

    // stored internally for records — not exposed via public API
    winningBidAmount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FeaturedAlumni', featuredAlumniSchema);
