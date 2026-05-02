const Profile = require('../models/Profile');
const FeaturedAlumni = require('../models/FeaturedAlumni');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filters are anchored on sub-document arrays the EJS profile actually captures:
// certifications, courses, employment, degrees. Free-text fields use a
// case-insensitive partial-match regex so "AWS" matches "AWS Certified Developer".
const buildProfileFilter = (query) => {
  const filter = {};

  // Certification element match: combines title regex + completionDate range so
  // both clauses must be satisfied by the SAME certification entry.
  const certElem = {};
  if (query.certification) {
    certElem.title = { $regex: new RegExp(escapeRegex(query.certification), 'i') };
  }
  if (query.certYearFrom || query.certYearTo) {
    certElem.completionDate = {};
    if (query.certYearFrom) certElem.completionDate.$gte = new Date(`${query.certYearFrom}-01-01T00:00:00.000Z`);
    if (query.certYearTo) certElem.completionDate.$lte = new Date(`${query.certYearTo}-12-31T23:59:59.999Z`);
  }
  if (Object.keys(certElem).length > 0) {
    filter.certifications = { $elemMatch: certElem };
  }

  // Employment element match: company + jobTitle on the same employment record.
  const empElem = {};
  if (query.company) {
    empElem.company = { $regex: new RegExp(escapeRegex(query.company), 'i') };
  }
  if (query.jobTitle) {
    empElem.jobTitle = { $regex: new RegExp(escapeRegex(query.jobTitle), 'i') };
  }
  if (Object.keys(empElem).length > 0) {
    filter.employment = { $elemMatch: empElem };
  }

  return filter;
};

// GET /api/analytics/alumni
// Returns one row per alumnus with derived "latest" fields the dashboard table
// can render directly — keeps the React side free of date-sorting logic.
const listAlumni = async (req, res, next) => {
  try {
    const filter = buildProfileFilter(req.query);
    const profiles = await Profile.find(filter)
      .select('firstName lastName linkedInUrl certifications courses employment degrees')
      .sort({ updatedAt: -1 })
      .limit(500);

    const items = profiles.map((p) => {
      // Latest employment by startDate desc, falling back to array order if dates missing.
      const employmentSorted = [...(p.employment || [])].sort((a, b) => {
        const at = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bt = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bt - at;
      });
      const latestEmployment = employmentSorted[0] || null;

      // Top certification = most recently completed.
      const certsSorted = [...(p.certifications || [])].sort((a, b) => {
        const at = a.completionDate ? new Date(a.completionDate).getTime() : 0;
        const bt = b.completionDate ? new Date(b.completionDate).getTime() : 0;
        return bt - at;
      });
      const topCertification = certsSorted[0]?.title || '';

      return {
        _id: p._id,
        firstName: p.firstName,
        lastName: p.lastName,
        linkedInUrl: p.linkedInUrl || '',
        latestJobTitle: latestEmployment?.jobTitle || '',
        latestCompany: latestEmployment?.company || '',
        topCertification,
        certificationsCount: (p.certifications || []).length,
        coursesCount: (p.courses || []).length,
        degreesCount: (p.degrees || []).length,
      };
    });

    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/summary
const getSummary = async (req, res, next) => {
  try {
    const filter = buildProfileFilter(req.query);
    const profiles = await Profile.find(filter).select('employment certifications');

    const employedCount = profiles.filter((p) => p.employment && p.employment.length > 0).length;
    const certCount = profiles.reduce((acc, p) => acc + (p.certifications?.length || 0), 0);

    res.json({
      totalAlumniTracked: profiles.length,
      employmentRate: profiles.length ? Math.round((employedCount / profiles.length) * 100) : 0,
      avgCertificationsPerAlumnus: profiles.length ? Number((certCount / profiles.length).toFixed(2)) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/charts
// All aggregations are derived from sub-document arrays the EJS profile UI
// actually populates: certifications, courses, employment, degrees.
const getChartData = async (req, res, next) => {
  try {
    const filter = buildProfileFilter(req.query);
    const profiles = await Profile.find(filter).select(
      'certifications courses employment degrees'
    );

    const byMapTop = (mapObj, top = 10) =>
      Object.entries(mapObj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .map(([label, value]) => ({ label, value }));

    const certs = {};
    const issuingBodies = {};
    const jobTitles = {};
    const employers = {};
    const courseProviders = {};
    const degreeInstitutions = {};
    const certTrendByYear = {};

    for (const p of profiles) {
      (p.certifications || []).forEach((c) => {
        if (c?.title) certs[c.title] = (certs[c.title] || 0) + 1;
        if (c?.issuingBody) issuingBodies[c.issuingBody] = (issuingBodies[c.issuingBody] || 0) + 1;
        const year = c?.completionDate ? new Date(c.completionDate).getUTCFullYear() : null;
        if (year) certTrendByYear[year] = (certTrendByYear[year] || 0) + 1;
      });

      (p.employment || []).forEach((e) => {
        if (e?.jobTitle) jobTitles[e.jobTitle] = (jobTitles[e.jobTitle] || 0) + 1;
        if (e?.company) employers[e.company] = (employers[e.company] || 0) + 1;
      });

      (p.courses || []).forEach((c) => {
        if (c?.provider) courseProviders[c.provider] = (courseProviders[c.provider] || 0) + 1;
      });

      (p.degrees || []).forEach((d) => {
        if (d?.institution) degreeInstitutions[d.institution] = (degreeInstitutions[d.institution] || 0) + 1;
      });
    }

    const total = profiles.length || 1;
    const skillsGap = byMapTop(certs, 10).map((item) => {
      const pct = Math.round((item.value / total) * 100);
      const severity = pct > 70 ? 'critical' : pct > 50 ? 'significant' : pct > 30 ? 'emerging' : 'monitor';
      return { label: item.label, percentage: pct, severity };
    });

    const trend = Object.entries(certTrendByYear)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, value]) => ({ year, value }));

    res.json({
      skillsGap,
      certificationTrend: trend,
      topIssuingBodies: byMapTop(issuingBodies, 10),
      commonJobTitles: byMapTop(jobTitles, 10),
      topEmployers: byMapTop(employers, 10),
      topCourseProviders: byMapTop(courseProviders, 10),
      topDegreeInstitutions: byMapTop(degreeInstitutions, 10),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/donations-summary
// Lightweight donation/sponsorship summary so read:donations scope is enforceable.
const getDonationsSummary = async (req, res, next) => {
  try {
    const filter = buildProfileFilter(req.query);
    const profiles = await Profile.find(filter).select('_id');
    const profileIds = profiles.map((p) => p._id);

    const wins = await FeaturedAlumni.find({ profileId: { $in: profileIds } }).select('winningBidAmount');
    const totalSponsored = wins.reduce((sum, w) => sum + (w.winningBidAmount || 0), 0);

    res.json({
      featuredWins: wins.length,
      totalSponsoredAmount: Number(totalSponsored.toFixed(2)),
      averageSponsoredAmount: wins.length ? Number((totalSponsored / wins.length).toFixed(2)) : 0,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAlumni,
  getSummary,
  getChartData,
  getDonationsSummary,
};
