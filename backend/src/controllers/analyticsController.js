const Profile = require('../models/Profile');
const FeaturedAlumni = require('../models/FeaturedAlumni');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatDateDDMMYYYY = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Filters are anchored on profile fields the EJS profile captures:
// degree title + degree completion date + employment industry.
const buildProfileFilter = (query) => {
  const filter = {};

  // Employment element match: industry sector.
  const empElem = {};
  if (query.industrySector) {
    empElem.industry = { $regex: new RegExp(escapeRegex(query.industrySector), 'i') };
  }
  if (Object.keys(empElem).length > 0) {
    filter.employment = { $elemMatch: empElem };
  }

  // Degree element match: program title + graduation date on the same degree.
  const degreeElem = {};
  if (query.program) {
    degreeElem.title = { $regex: new RegExp(escapeRegex(query.program), 'i') };
  }
  if (query.graduationDate) {
    const start = new Date(`${query.graduationDate}T00:00:00.000Z`);
    const end = new Date(`${query.graduationDate}T23:59:59.999Z`);
    degreeElem.completionDate = { $gte: start, $lte: end };
  }
  if (Object.keys(degreeElem).length > 0) {
    filter.degrees = { $elemMatch: degreeElem };
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

      const degreesSorted = [...(p.degrees || [])].sort((a, b) => {
        const at = a.completionDate ? new Date(a.completionDate).getTime() : 0;
        const bt = b.completionDate ? new Date(b.completionDate).getTime() : 0;
        return bt - at;
      });
      const programs = degreesSorted
        .map((d) => (d?.title || '').trim())
        .filter(Boolean);
      const graduationDateDisplay = degreesSorted.length <= 1
        ? (formatDateDDMMYYYY(degreesSorted[0]?.completionDate) || '')
        : degreesSorted
          .map((d) => {
            const title = (d?.title || '').trim() || 'Degree';
            const date = formatDateDDMMYYYY(d?.completionDate) || '-';
            return `${title}: ${date}`;
          })
          .join(';');
      const graduationDateLines = degreesSorted.length <= 1
        ? [graduationDateDisplay].filter(Boolean)
        : graduationDateDisplay.split(';').map((line) => line.trim()).filter(Boolean);

      // Top certification = most recently completed.
      const certsSorted = [...(p.certifications || [])].sort((a, b) => {
        const at = a.completionDate ? new Date(a.completionDate).getTime() : 0;
        const bt = b.completionDate ? new Date(b.completionDate).getTime() : 0;
        return bt - at;
      });
      const topCertification = certsSorted[0]?.title || '';
      const certifications = certsSorted
        .map((c) => c?.title || '')
        .filter(Boolean);

      return {
        _id: p._id,
        firstName: p.firstName,
        lastName: p.lastName,
        linkedInUrl: p.linkedInUrl || '',
        programs,
        graduationDateDisplay,
        graduationDateLines,
        latestJobTitle: latestEmployment?.jobTitle || '',
        latestCompany: latestEmployment?.company || '',
        latestIndustry: latestEmployment?.industry || '',
        certifications,
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
// Aggregations are derived from profile fields captured by the EJS profile UI.
const getChartData = async (req, res, next) => {
  try {
    const filter = buildProfileFilter(req.query);
    const profiles = await Profile.find(filter).select(
      'certifications courses employment currentCountry'
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
    const certTrendByYear = {};
    const industryMap = {};
    const geoLabels = [
      'London',
      'South East',
      'North West',
      'Scotland',
      'Midlands',
      'South West',
      'Europe',
      'North America',
      'Asia',
      'Middle East',
    ];
    const geoCounts = Object.fromEntries(geoLabels.map((label) => [label, 0]));
    const geoLabelByLower = Object.fromEntries(geoLabels.map((label) => [label.toLowerCase(), label]));

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
        if (e?.industry) industryMap[e.industry] = (industryMap[e.industry] || 0) + 1;
      });

      (p.courses || []).forEach((c) => {
        if (c?.provider) courseProviders[c.provider] = (courseProviders[c.provider] || 0) + 1;
      });

      if (p?.currentCountry) {
        const normalized = String(p.currentCountry).trim().toLowerCase();
        const canonical = geoLabelByLower[normalized];
        if (canonical) geoCounts[canonical] += 1;
      }
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
      employmentByIndustry: byMapTop(industryMap, 10),
      commonJobTitles: byMapTop(jobTitles, 10),
      topEmployers: byMapTop(employers, 10),
      topCourseProviders: byMapTop(courseProviders, 10),
      geographicDistribution: geoLabels.map((label) => ({ label, value: geoCounts[label] || 0 })),
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
