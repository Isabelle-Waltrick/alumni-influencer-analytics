const express = require('express');
const { query } = require('express-validator');

const requireApiKey = require('../middleware/requireApiKey');
const requireApiScope = require('../middleware/requireApiScope');
const validate = require('../middleware/validate');
const {
  listAlumni,
  getSummary,
  getChartData,
  getDonationsSummary,
} = require('../controllers/analyticsController');

const router = express.Router();

const filterValidation = [
  query('program').optional().trim().isLength({ max: 160 }).withMessage('program text too long'),
  query('graduationDate').optional().isISO8601().withMessage('graduationDate must be a valid date'),
  query('industrySector').optional().trim().isLength({ max: 120 }).withMessage('industrySector text too long'),
];

// Dashboard and reporting datasets.
router.get(
  '/alumni',
  requireApiKey,
  requireApiScope('read:alumni', 'read:analytics'),
  filterValidation,
  validate,
  listAlumni
);

router.get(
  '/summary',
  requireApiKey,
  requireApiScope('read:analytics'),
  filterValidation,
  validate,
  getSummary
);

router.get(
  '/charts',
  requireApiKey,
  requireApiScope('read:analytics'),
  filterValidation,
  validate,
  getChartData
);

router.get(
  '/donations-summary',
  requireApiKey,
  requireApiScope('read:donations'),
  filterValidation,
  validate,
  getDonationsSummary
);

module.exports = router;
