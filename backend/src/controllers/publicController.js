const FeaturedAlumni = require('../models/FeaturedAlumni');
const Profile = require('../models/Profile');

// helper — UTC date string (same logic as biddingController)
const getTodayUTC = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .split('T')[0];
};

// ─── GET /api/public/alumni-of-the-day ────────────────────────────────────────
// Returns today's featured alumnus profile. Requires a valid API key (Bearer token).
// Sensitive user data (email, password, tokens) is never included.

const getAlumniOfTheDay = async (req, res, next) => {
  try {
    const today = getTodayUTC();

    const featured = await FeaturedAlumni.findOne({ date: today })
      .populate({
        path: 'profileId',
        select: '-__v',
        populate: {
          path: 'userId',
          select: 'email role createdAt', // no password, no tokens
        },
      });

    if (!featured) {
      return res.status(404).json({
        message: 'No featured alumni for today yet. Check back after midnight UTC.',
        date: today,
      });
    }

    const profile = featured.profileId;

    // shape the response — only fields relevant to the AR client
    res.json({
      featuredDate: featured.date,
      profile: {
        _id: profile._id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        bio: profile.bio,
        linkedInUrl: profile.linkedInUrl,
        profileImagePath: profile.profileImagePath,
        degrees: profile.degrees,
        certifications: profile.certifications,
        licences: profile.licences,
        courses: profile.courses,
        employment: profile.employment,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAlumniOfTheDay };
