const express = require('express');
const router = express.Router();

const requireApiKey = require('../middleware/requireApiKey');
const requireApiScope = require('../middleware/requireApiScope');
const apiKeyRateLimiter = require('../middleware/apiKeyRateLimiter');
const { getAlumniOfTheDay } = require('../controllers/publicController');

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Public API endpoints — require a valid API key (Bearer token)
 */

/**
 * @swagger
 * /api/public/alumni-of-the-day:
 *   get:
 *     summary: Get today's featured alumni profile
 *     tags: [Public]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Returns the full profile of today's Alumni of the Day.
 *       Requires a valid API key passed as a Bearer token in the Authorization header.
 *       Every request is logged against the API key for usage statistics.
 *     responses:
 *       200:
 *         description: Today's featured alumni profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 featuredDate:
 *                   type: string
 *                   format: date
 *                   example: "2026-03-20"
 *                 profile:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     linkedInUrl:
 *                       type: string
 *                     profileImagePath:
 *                       type: string
 *                       nullable: true
 *                     degrees:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           institution:
 *                             type: string
 *                           url:
 *                             type: string
 *                           completionDate:
 *                             type: string
 *                             format: date
 *                     certifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                     licences:
 *                       type: array
 *                       items:
 *                         type: object
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     employment:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: No featured alumni for today yet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date
 *       401:
 *         description: Missing or invalid API key
 *       429:
 *         description: Rate limit exceeded (100 requests/min per API key)
 */
// developer API — requires Bearer token, usage logged
router.get(
  '/alumni-of-the-day',
  requireApiKey,
  requireApiScope('read:alumni_of_day'),
  apiKeyRateLimiter,
  getAlumniOfTheDay
);

/**
 * @swagger
 * /api/public/alumni-of-the-day/public:
 *   get:
 *     summary: Get today's featured alumni profile (no auth — for public web page)
 *     tags: [Public]
 *     description: >
 *       Same data as the Bearer-token endpoint but without authentication.
 *       Used by the public /alumni-of-the-day web page visible to all students.
 *     responses:
 *       200:
 *         description: Today's featured alumni profile
 *       404:
 *         description: No featured alumni for today yet
 */
// public web page endpoint — no auth required, used by the /alumni-of-the-day page
router.get('/alumni-of-the-day/public', getAlumniOfTheDay);

module.exports = router;
