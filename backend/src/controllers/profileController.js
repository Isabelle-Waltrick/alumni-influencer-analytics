const fs = require('fs');
const path = require('path');
const Profile = require('../models/Profile');

// GET /api/profile/me
const getMyProfile = async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ userId: req.session.userId });

    // auto-create an empty profile on first access so the user has something to fill in
    if (!profile) {
      profile = await Profile.create({ userId: req.session.userId, firstName: '', lastName: '' });
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile/me
const updateMyProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      bio,
      linkedInUrl,
      programme,
      graduationDate,
      industrySector,
      currentCountry,
    } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { userId: req.session.userId },
      {
        firstName,
        lastName,
        bio,
        linkedInUrl,
        programme,
        graduationDate,
        industrySector,
        currentCountry,
      },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    res.json(profile);
  } catch (err) {
    next(err);
  }
};

// POST /api/profile/image
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const profile = await Profile.findOne({ userId: req.session.userId });

    // delete the old image from disk if one exists
    if (profile && profile.profileImagePath) {
      const oldPath = path.join(__dirname, '../../uploads', path.basename(profile.profileImagePath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { userId: req.session.userId },
      { profileImagePath: `/uploads/${req.file.filename}` },
      { returnDocument: 'after', upsert: true }
    );

    res.json({ profileImagePath: updatedProfile.profileImagePath });
  } catch (err) {
    next(err);
  }
};

// GET /api/profile/completion
const getCompletionStatus = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.session.userId });

    if (!profile) {
      return res.json({ percentage: 0, breakdown: {} });
    }

    const checks = {
      personalInfo: !!(profile.firstName && profile.lastName && profile.bio && profile.linkedInUrl),
      profileImage: !!profile.profileImagePath,
      degrees: profile.degrees.length > 0,
      certifications: profile.certifications.length > 0,
      licences: profile.licences.length > 0,
      courses: profile.courses.length > 0,
      employment: profile.employment.length > 0,
    };

    // weights add up to 100
    const weights = {
      personalInfo: 25,
      profileImage: 10,
      degrees: 15,
      certifications: 15,
      licences: 10,
      courses: 10,
      employment: 15,
    };

    let percentage = 0;
    for (const [key, passed] of Object.entries(checks)) {
      if (passed) percentage += weights[key];
    }

    res.json({ percentage, breakdown: checks });
  } catch (err) {
    next(err);
  }
};

// ─── Sub-document helpers ────────────────────────────────────────────────────
// Rather than duplicating add/update/remove logic for each section,
// this factory returns three handlers for any given sub-document array.
//
// uniqueFields: the fields that together define a "duplicate" entry.
// All comparisons are case-insensitive so "AWS" and "aws" are treated as the same.

const makeSubDocHandlers = (section, uniqueFields = ['title']) => {
  const add = async (req, res, next) => {
    try {
      // build a match condition from the uniqueFields values in the request body
      const dupMatch = {};
      for (const field of uniqueFields) {
        const val = req.body[field];
        if (val) {
          // escape special regex chars before using the value
          const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          dupMatch[field] = { $regex: new RegExp(`^${escaped}$`, 'i') };
        }
      }

      const existing = await Profile.findOne({
        userId: req.session.userId,
        [section]: { $elemMatch: dupMatch },
      });

      if (existing) {
        return res.status(409).json({ message: `This entry already exists in your ${section}` });
      }

      const profile = await Profile.findOneAndUpdate(
        { userId: req.session.userId },
        { $push: { [section]: req.body } },
        { returnDocument: 'after', upsert: true, runValidators: true }
      );

      // return just the new item (last in array)
      const items = profile[section];
      res.status(201).json(items[items.length - 1]);
    } catch (err) {
      next(err);
    }
  };

  const update = async (req, res, next) => {
    try {
      const { itemId } = req.params;

      // build a positional update object for the matched subdoc
      const updateFields = {};
      for (const [key, val] of Object.entries(req.body)) {
        updateFields[`${section}.$.${key}`] = val;
      }

      const profile = await Profile.findOneAndUpdate(
        { userId: req.session.userId, [`${section}._id`]: itemId },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
      );

      if (!profile) {
        return res.status(404).json({ message: 'Item not found' });
      }

      const updated = profile[section].id(itemId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

  const remove = async (req, res, next) => {
    try {
      const { itemId } = req.params;

      const profile = await Profile.findOneAndUpdate(
        { userId: req.session.userId },
        { $pull: { [section]: { _id: itemId } } },
        { returnDocument: 'after' }
      );

      if (!profile) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.json({ message: 'Deleted' });
    } catch (err) {
      next(err);
    }
  };

  return { add, update, remove };
};

// uniqueFields per section — what combination makes an entry a "duplicate"
const degrees = makeSubDocHandlers('degrees', ['title', 'institution']);
const certifications = makeSubDocHandlers('certifications', ['title']);
const licences = makeSubDocHandlers('licences', ['title']);
const courses = makeSubDocHandlers('courses', ['title']);
const employment = makeSubDocHandlers('employment', ['jobTitle', 'company']);

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadImage,
  getCompletionStatus,
  degrees,
  certifications,
  licences,
  courses,
  employment,
};
