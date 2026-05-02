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
  query('certification').optional().trim().isLength({ max: 120 }).withMessage('certification text too long'),
  query('company').optional().trim().isLength({ max: 120 }).withMessage('company text too long'),
  query('jobTitle').optional().trim().isLength({ max: 120 }).withMessage('jobTitle text too long'),
  query('certYearFrom').optional().isInt({ min: 1900, max: 2100 }).withMessage('certYearFrom must be a 4-digit year'),
  query('certYearTo').optional().isInt({ min: 1900, max: 2100 }).withMessage('certYearTo must be a 4-digit year'),
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
