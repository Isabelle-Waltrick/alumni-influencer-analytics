const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────
// Each sub-schema represents a single item in an embedded array on the profile.
// Kept intentionally minimal — only fields needed per section are defined.

// Represents a formal academic degree (e.g. BSc, MSc)
const degreeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

// Represents a professional certification awarded by an external body
const certificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  issuingBody: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

// Represents a professional licence required to practise in a regulated field
const licenceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  awardingBody: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

// Represents a short course or online learning achievement
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  provider: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

// Represents a single employment record in the alumnus's career history
const employmentSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  industry: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null }, // null = currently employed here
});

// ─── Main Profile Schema ─────────────────────────────────────────────────────
// One profile per user (enforced by unique: true on userId).
// Stores public-facing information, alumni-of-the-day state, bidding limits,
// and all embedded credential/employment arrays.
const profileSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // ── Public-facing profile fields ──────────────────────────────────────────
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 1000 },
    linkedInUrl: { type: String, trim: true },
    profileImagePath: { type: String, default: null },
    programme: { type: String, trim: true, default: '' },
    graduationDate: { type: Date, default: null },
    industrySector: { type: String, trim: true, default: '' },
    currentCountry: { type: String, trim: true, default: '' },

    // ── Alumni-of-the-day flag ─────────────────────────────────────────────────
    // set true when this person is the active alumni of the day
    isActiveToday: { type: Boolean, default: false },

    // ── Bidding / win tracking ─────────────────────────────────────────────────
    // monthly win tracking — resets when lastWinMonth != current month
    monthlyWins: { type: Number, default: 0 },
    lastWinMonth: { type: Number, default: null }, // 1-12

    // attending a uni alumni event grants an extra slot (4th bid that month)
    hasEventBonus: { type: Boolean, default: false },

    // ── Embedded credential & employment arrays ──────────────────────────────
    degrees: [degreeSchema],
    certifications: [certificationSchema],
    licences: [licenceSchema],
    courses: [courseSchema],
    employment: [employmentSchema],
  },
  {
    timestamps: true,
  }
);

// ─── Instance Methods ────────────────────────────────────────────────────────

// canBidThisMonth — returns true if the alumnus has not yet reached their
// monthly bid limit (3 standard, 4 with the event bonus).
// Treats a stale lastWinMonth as if wins were 0 (handles month rollover).
profileSchema.methods.canBidThisMonth = function () {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // if it's a new month, their wins effectively reset
  const effectiveWins = this.lastWinMonth === currentMonth ? this.monthlyWins : 0;
  const limit = this.hasEventBonus ? 4 : 3;

  return effectiveWins < limit;
};

// recordWin — increments the win counter for the current month.
// If the stored lastWinMonth differs from the current month, the counter
// resets to 1 rather than incrementing (handles month rollover automatically).
profileSchema.methods.recordWin = function () {
  const currentMonth = new Date().getMonth() + 1;

  if (this.lastWinMonth !== currentMonth) {
    this.monthlyWins = 1;
    this.lastWinMonth = currentMonth;
  } else {
    this.monthlyWins += 1;
  }
};

module.exports = mongoose.model('Profile', profileSchema);
