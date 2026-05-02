const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const requireAuth = require('../middleware/requireAuth');
const requireDeveloper = require('../middleware/requireDeveloper');
const validate = require('../middleware/validate');
const {
  generateKey,
  listKeys,
  revokeKey,
  getStats,
  getLoginStats,
} = require('../controllers/developerController');

// developer routes require a valid session AND the developer role
router.use(requireAuth);
router.use(requireDeveloper);

/**
 * @swagger
 * tags:
 *   name: Developer
 *   description: API key management and usage statistics
 */

/**
 * @swagger
 * /api/developer/keys:
 *   post:
 *     summary: Generate a new API key
 *     tags: [Developer]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Generates a new API key and returns it **once** in plain text.
 *       The key is stored as a SHA-256 hash — it cannot be retrieved again.
 *       Copy it immediately and store it securely.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 example: My AR Client Key
 *     responses:
 *       201:
 *         description: Key generated — plain key returned once only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 key:
 *                   type: string
 *                   example: ak_3f9a1b2c...
 *                 keyId:
 *                   type: string
 *                 keyPrefix:
 *                   type: string
 *                   example: ak_3f9a1b2c...
 *                 label:
 *                   type: string
 *       401:
 *         description: Not logged in
 */
router.post(
  '/keys',
  [
    body('label')
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage('Label must be 60 characters or fewer'),
    body('clientName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 40 })
      .withMessage('Client name must be between 2 and 40 characters'),
    body('scopes')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Scopes must be a non-empty array'),
    body('scopes.*')
      .optional()
      .isIn(['read:alumni', 'read:analytics', 'read:donations', 'read:alumni_of_day'])
      .withMessage('Invalid scope value'),
  ],
  validate,
  generateKey
);

/**
 * @swagger
 * /api/developer/keys:
 *   get:
 *     summary: List all your API keys
 *     tags: [Developer]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Returns all keys for the logged-in user. Only the key prefix is shown
 *       (e.g. `ak_3f9a1b2c...`) — the full key is never retrievable after creation.
 *     responses:
 *       200:
 *         description: Array of API key records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   keyPrefix:
 *                     type: string
 *                   label:
 *                     type: string
 *                   isRevoked:
 *                     type: boolean
 *                   lastUsedAt:
 *                     type: string
 *                     format: date-time
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Not logged in
 */
router.get('/keys', listKeys);

/**
 * @swagger
 * /api/developer/keys/{id}:
 *   delete:
 *     summary: Revoke an API key
 *     tags: [Developer]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Sets `isRevoked = true`. The key record is kept so usage logs remain intact.
 *       Any request using this key will immediately receive a 401.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The API key document ID (not the key itself)
 *     responses:
 *       200:
 *         description: Key revoked
 *       400:
 *         description: Key already revoked
 *       404:
 *         description: Key not found
 *       401:
 *         description: Not logged in
 */
router.delete(
  '/keys/:id',
  [param('id').isMongoId().withMessage('Invalid key ID')],
  validate,
  revokeKey
);

/**
 * @swagger
 * /api/developer/stats:
 *   get:
 *     summary: View usage statistics for all your API keys
 *     tags: [Developer]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Returns two sections:
 *       - `keys` — per-key totals (total requests, first/last access)
 *       - `endpointBreakdown` — how many times each endpoint was hit across all your keys
 *     responses:
 *       200:
 *         description: Usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       keyId:
 *                         type: string
 *                       keyPrefix:
 *                         type: string
 *                       label:
 *                         type: string
 *                       isRevoked:
 *                         type: boolean
 *                       totalRequests:
 *                         type: integer
 *                       firstAccessed:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       lastAccessed:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                 endpointBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       endpoint:
 *                         type: string
 *                         example: /api/public/alumni-of-the-day
 *                       method:
 *                         type: string
 *                         example: GET
 *                       count:
 *                         type: integer
 *                       lastHit:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Not logged in
 */
router.get('/stats', getStats);
router.get('/login-stats', getLoginStats);

module.exports = router;
