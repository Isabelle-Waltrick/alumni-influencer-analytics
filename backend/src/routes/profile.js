const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const requireAuth = require('../middleware/requireAuth');
const requireAlumnus = require('../middleware/requireAlumnus');
const validate = require('../middleware/validate');
const upload = require('../config/multer');
const {
  getMyProfile,
  updateMyProfile,
  uploadImage,
  getCompletionStatus,
  degrees,
  certifications,
  licences,
  courses,
  employment,
} = require('../controllers/profileController');

// profile routes are for alumni only
router.use(requireAuth);
router.use(requireAlumnus);

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Alumni profile management
 */

// ─── Core profile ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     summary: Get the logged-in user's profile
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Profile object (auto-created if first access)
 *       401:
 *         description: Not logged in
 */
router.get('/me', getMyProfile);

/**
 * @swagger
 * /api/profile/me:
 *   put:
 *     summary: Update personal info, bio and LinkedIn URL
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Jane
 *               lastName:
 *                 type: string
 *                 example: Smith
 *               bio:
 *                 type: string
 *                 example: Software engineer with 5 years experience.
 *               linkedInUrl:
 *                 type: string
 *                 example: https://linkedin.com/in/janesmith
 *     responses:
 *       200:
 *         description: Updated profile
 *       400:
 *         description: Validation errors
 *       401:
 *         description: Not logged in
 */
router.put(
  '/me',
  [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be blank'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be blank'),
    body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Bio cannot exceed 1000 characters'),
    body('linkedInUrl')
      .optional()
      .trim()
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('LinkedIn URL must be a valid https URL')
      .custom((val) => {
        if (!val.includes('linkedin.com')) {
          throw new Error('Must be a LinkedIn URL (linkedin.com)');
        }
        return true;
      }),
    body('programme')
      .optional()
      .trim()
      .isLength({ min: 2, max: 120 })
      .withMessage('Programme must be between 2 and 120 characters'),
    body('graduationDate')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('Graduation date must be a valid date'),
    body('industrySector')
      .optional()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('Industry sector must be between 2 and 80 characters'),
    body('currentCountry')
      .optional()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('Country must be between 2 and 80 characters'),
  ],
  validate,
  updateMyProfile
);

/**
 * @swagger
 * /api/profile/image:
 *   post:
 *     summary: Upload or replace profile image
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded, returns new path
 *       400:
 *         description: No file uploaded or invalid file type
 *       401:
 *         description: Not logged in
 */
router.post('/image', upload.single('image'), uploadImage);

/**
 * @swagger
 * /api/profile/completion:
 *   get:
 *     summary: Get profile completion percentage and breakdown
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Percentage and per-section boolean breakdown
 *       401:
 *         description: Not logged in
 */
router.get('/completion', getCompletionStatus);

// ─── Degrees ──────────────────────────────────────────────────────────────────

const degreeValidation = [
  body('title').trim().notEmpty().withMessage('Degree title is required'),
  body('institution').trim().notEmpty().withMessage('Institution is required'),
  body('url')
    .optional()
    .trim()
    .isURL({ require_protocol: true })
    .withMessage('URL must be a valid link'),
  body('completionDate')
    .optional()
    .isISO8601()
    .withMessage('Completion date must be a valid date'),
];

/**
 * @swagger
 * /api/profile/degrees:
 *   post:
 *     summary: Add a degree
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - institution
 *             properties:
 *               title:
 *                 type: string
 *                 example: BSc Computer Science
 *               institution:
 *                 type: string
 *                 example: University of Westminster
 *               url:
 *                 type: string
 *                 example: https://westminster.ac.uk/courses/bsc-cs
 *               completionDate:
 *                 type: string
 *                 format: date
 *                 example: 2022-06-01
 *     responses:
 *       201:
 *         description: Degree added
 *       400:
 *         description: Validation errors
 */
router.post('/degrees', degreeValidation, validate, degrees.add);

/**
 * @swagger
 * /api/profile/degrees/{itemId}:
 *   put:
 *     summary: Update a degree entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               institution:
 *                 type: string
 *               url:
 *                 type: string
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated degree entry
 *       404:
 *         description: Entry not found
 */
router.put('/degrees/:itemId', degreeValidation, validate, degrees.update);

/**
 * @swagger
 * /api/profile/degrees/{itemId}:
 *   delete:
 *     summary: Remove a degree entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Entry not found
 */
router.delete('/degrees/:itemId', degrees.remove);

// ─── Certifications ───────────────────────────────────────────────────────────

const certValidation = [
  body('title').trim().notEmpty().withMessage('Certification title is required'),
  body('issuingBody').optional().trim(),
  body('url').optional().trim().isURL({ require_protocol: true }).withMessage('Must be a valid URL'),
  body('completionDate').optional().isISO8601().withMessage('Must be a valid date'),
];

/**
 * @swagger
 * /api/profile/certifications:
 *   post:
 *     summary: Add a certification
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: AWS Certified Developer
 *               issuingBody:
 *                 type: string
 *                 example: Amazon Web Services
 *               url:
 *                 type: string
 *                 example: https://aws.amazon.com/certification
 *               completionDate:
 *                 type: string
 *                 format: date
 *                 example: 2023-03-15
 *     responses:
 *       201:
 *         description: Certification added
 */
router.post('/certifications', certValidation, validate, certifications.add);

/**
 * @swagger
 * /api/profile/certifications/{itemId}:
 *   put:
 *     summary: Update a certification entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               issuingBody:
 *                 type: string
 *               url:
 *                 type: string
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated certification entry
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.put('/certifications/:itemId', certValidation, validate, certifications.update);

/**
 * @swagger
 * /api/profile/certifications/{itemId}:
 *   delete:
 *     summary: Remove a certification entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.delete('/certifications/:itemId', certifications.remove);

// ─── Licences ─────────────────────────────────────────────────────────────────

const licenceValidation = [
  body('title').trim().notEmpty().withMessage('Licence title is required'),
  body('awardingBody').optional().trim(),
  body('url').optional().trim().isURL({ require_protocol: true }).withMessage('Must be a valid URL'),
  body('completionDate').optional().isISO8601().withMessage('Must be a valid date'),
];

/**
 * @swagger
 * /api/profile/licences:
 *   post:
 *     summary: Add a professional licence
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: ACCA
 *               awardingBody:
 *                 type: string
 *                 example: Association of Chartered Certified Accountants
 *               url:
 *                 type: string
 *                 example: https://acca.global
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Licence added
 */
router.post('/licences', licenceValidation, validate, licences.add);

/**
 * @swagger
 * /api/profile/licences/{itemId}:
 *   put:
 *     summary: Update a licence entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               awardingBody:
 *                 type: string
 *               url:
 *                 type: string
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated licence entry
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.put('/licences/:itemId', licenceValidation, validate, licences.update);

/**
 * @swagger
 * /api/profile/licences/{itemId}:
 *   delete:
 *     summary: Remove a licence entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.delete('/licences/:itemId', licences.remove);

// ─── Courses ──────────────────────────────────────────────────────────────────

const courseValidation = [
  body('title').trim().notEmpty().withMessage('Course title is required'),
  body('provider').optional().trim(),
  body('url').optional().trim().isURL({ require_protocol: true }).withMessage('Must be a valid URL'),
  body('completionDate').optional().isISO8601().withMessage('Must be a valid date'),
];

/**
 * @swagger
 * /api/profile/courses:
 *   post:
 *     summary: Add a short professional course
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Docker & Kubernetes Fundamentals
 *               provider:
 *                 type: string
 *                 example: Udemy
 *               url:
 *                 type: string
 *                 example: https://udemy.com/course/docker-kubernetes
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Course added
 */
router.post('/courses', courseValidation, validate, courses.add);

/**
 * @swagger
 * /api/profile/courses/{itemId}:
 *   put:
 *     summary: Update a course entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               provider:
 *                 type: string
 *               url:
 *                 type: string
 *               completionDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated course entry
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.put('/courses/:itemId', courseValidation, validate, courses.update);

/**
 * @swagger
 * /api/profile/courses/{itemId}:
 *   delete:
 *     summary: Remove a course entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.delete('/courses/:itemId', courses.remove);

// ─── Employment ───────────────────────────────────────────────────────────────

const employmentValidation = [
  body('jobTitle').trim().notEmpty().withMessage('Job title is required'),
  body('company').trim().notEmpty().withMessage('Company name is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

/**
 * @swagger
 * /api/profile/employment:
 *   post:
 *     summary: Add an employment history entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobTitle
 *               - company
 *               - startDate
 *             properties:
 *               jobTitle:
 *                 type: string
 *                 example: Software Engineer
 *               company:
 *                 type: string
 *                 example: Google
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2022-01-01
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: null
 *     responses:
 *       201:
 *         description: Employment entry added
 */
router.post('/employment', employmentValidation, validate, employment.add);

/**
 * @swagger
 * /api/profile/employment/{itemId}:
 *   put:
 *     summary: Update an employment entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobTitle:
 *                 type: string
 *               company:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated employment entry
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.put('/employment/:itemId', employmentValidation, validate, employment.update);

/**
 * @swagger
 * /api/profile/employment/{itemId}:
 *   delete:
 *     summary: Remove an employment entry
 *     tags: [Profile]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Not logged in
 */
router.delete('/employment/:itemId', employment.remove);

module.exports = router;
