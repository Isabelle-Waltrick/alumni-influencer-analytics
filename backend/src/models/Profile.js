const mongoose = require('mongoose');

// sub-schemas kept simple — just what's needed per section

const degreeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

const certificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  issuingBody: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

const licenceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  awardingBody: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  provider: { type: String, trim: true },
  url: { type: String, trim: true },
  completionDate: { type: Date },
});

const employmentSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null }, // null means currently working there
});

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 1000 },
    linkedInUrl: { type: String, trim: true },
    profileImagePath: { type: String, default: null },
    programme: { type: String, trim: true, default: '' },
    graduationDate: { type: Date, default: null },
    industrySector: { type: String, trim: true, default: '' },
    currentCountry: { type: String, trim: true, default: '' },

    // set true when this person is the active alumni of the day
    isActiveToday: { type: Boolean, default: false },

    // monthly win tracking — resets when lastWinMonth != current month
    monthlyWins: { type: Number, default: 0 },
    lastWinMonth: { type: Number, default: null }, // 1-12

    // attending a uni alumni event grants an extra slot (4th bid that month)
    hasEventBonus: { type: Boolean, default: false },

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

// helper — check if this alumnus is allowed to bid this month
profileSchema.methods.canBidThisMonth = function () {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // if it's a new month, their wins effectively reset
  const effectiveWins = this.lastWinMonth === currentMonth ? this.monthlyWins : 0;
  const limit = this.hasEventBonus ? 4 : 3;

  return effectiveWins < limit;
};

// called after they win — increments count and updates month tracker
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
