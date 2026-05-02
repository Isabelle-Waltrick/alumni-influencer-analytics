const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const requireAuth = require('../middleware/requireAuth');
const requireAlumnus = require('../middleware/requireAlumnus');
const validate = require('../middleware/validate');
const {
  getWindow,
  placeBid,
  updateBid,
  cancelBid,
  getBidStatus,
  getBidHistory,
  getMonthlyLimit,
} = require('../controllers/biddingController');

// bidding is for alumni only — developers use the public API instead
router.use(requireAuth);
router.use(requireAlumnus);

/**
 * @swagger
 * tags:
 *   name: Bidding
 *   description: Blind bidding system for alumni featured slots
 */

// ─── /status, /history, /monthly-limit MUST be defined before /:id ───────────
// Express matches routes top-to-bottom. If /:id came first, GET /status
// would be treated as id="status" and hit the wrong handler.

/**
 * @swagger
 * /api/bids/status:
 *   get:
 *     summary: Check if you are currently winning in the open window
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Returns a boolean `isWinning` flag. The actual bid amounts are never
 *       exposed — this is by design to keep bidding blind and fair.
 *     responses:
 *       200:
 *         description: Bid status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasActiveBid:
 *                   type: boolean
 *                 isWinning:
 *                   type: boolean
 *                 featuredDate:
 *                   type: string
 *                   format: date
 *                   example: "2026-03-20"
 *       401:
 *         description: Not logged in
 */
router.get('/status', getBidStatus);

/**
 * @swagger
 * /api/bids/history:
 *   get:
 *     summary: View your own bid history across all windows
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: Returns your own bids with amounts and win/loss outcome.
 *     responses:
 *       200:
 *         description: Array of your bids
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   isWinner:
 *                     type: boolean
 *                   isActive:
 *                     type: boolean
 *                   bidWindowId:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       status:
 *                         type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Not logged in
 */
router.get('/history', getBidHistory);

/**
 * @swagger
 * /api/bids/monthly-limit:
 *   get:
 *     summary: Check how many featured slots you have used this month
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Monthly limit breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 used:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 3
 *                 remaining:
 *                   type: integer
 *                   example: 2
 *                 hasEventBonus:
 *                   type: boolean
 *                   example: false
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Profile not found
 */
router.get('/monthly-limit', getMonthlyLimit);

// ─── Window & bid placement ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/bids/window:
 *   get:
 *     summary: Get the current open bidding window
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Returns metadata about the active window. Bid amounts and the current
 *       highest bid are never included — only the total bid count.
 *     responses:
 *       200:
 *         description: Current open window info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 windowId:
 *                   type: string
 *                 biddingDate:
 *                   type: string
 *                   format: date
 *                   example: "2026-03-19"
 *                 featuredDate:
 *                   type: string
 *                   format: date
 *                   example: "2026-03-20"
 *                 status:
 *                   type: string
 *                   example: open
 *                 totalActiveBids:
 *                   type: integer
 *                   example: 4
 *       404:
 *         description: No open window right now (bidding has closed for the day)
 *       401:
 *         description: Not logged in
 */
router.get('/window', getWindow);

/**
 * @swagger
 * /api/bids:
 *   post:
 *     summary: Place a bid in the current open window
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       You can only have one active bid per window. If you have previously
 *       cancelled your bid, placing again re-activates it. Monthly win limits
 *       are enforced (max 3 per month, or 4 with event bonus).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 example: 250
 *     responses:
 *       201:
 *         description: Bid placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 message:
 *                   type: string
 *                 featuredDate:
 *                   type: string
 *                   format: date
 *       403:
 *         description: Monthly limit reached or profile not complete
 *       404:
 *         description: No open window
 *       409:
 *         description: You already have an active bid in this window
 *       400:
 *         description: Validation errors
 *       401:
 *         description: Not logged in
 */
router.post(
  '/',
  [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Bid amount must be a positive number (minimum £1)')
      .toFloat(),
  ],
  validate,
  placeBid
);

/**
 * @swagger
 * /api/bids/{id}:
 *   patch:
 *     summary: Increase your existing bid amount
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Bids can only be increased, never decreased. The window must still be open.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The bid ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 350
 *     responses:
 *       200:
 *         description: Bid updated
 *       400:
 *         description: New amount not higher than current, or window closed
 *       404:
 *         description: Bid not found
 *       401:
 *         description: Not logged in
 */
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid bid ID'),
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Amount must be a positive number')
      .toFloat(),
  ],
  validate,
  updateBid
);

/**
 * @swagger
 * /api/bids/{id}:
 *   delete:
 *     summary: Cancel your bid (soft delete)
 *     tags: [Bidding]
 *     security:
 *       - sessionAuth: []
 *     description: >
 *       Sets the bid as inactive. The record is kept in the database.
 *       Cancellation is only allowed while the window is still open.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bid cancelled
 *       400:
 *         description: Window already closed
 *       404:
 *         description: Active bid not found
 *       401:
 *         description: Not logged in
 */
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid bid ID')],
  validate,
  cancelBid
);

module.exports = router;
