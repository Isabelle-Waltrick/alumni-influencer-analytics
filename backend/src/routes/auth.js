const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  register,
  verifyEmail,
  login,
  logout,
  forgotPassword,
  resetPassword,
  me,
} = require('../controllers/authController');

// reusable password strength chain
const passwordStrength = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password must include at least one uppercase letter')
  .matches(/[0-9]/).withMessage('Password must include at least one number')
  .matches(/[^a-zA-Z0-9]/).withMessage('Password must include at least one special character');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login, email verification and password reset
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: xyz@westminster.ac.um
 *               password:
 *                 type: string
 *                 example: SecurePass1!
 *     responses:
 *       201:
 *         description: Account created, verification email sent
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Validation errors
 */
router.post(
  '/register',
  [
    body('email')
      .isEmail().withMessage('Enter a valid email address')
      .normalizeEmail()
      .custom((value) => {
        // CW1: "Email-based registration (university domain required)".
        // Domain is overridable via env so tests / staging can use a different one.
        const allowed = (process.env.ALLOWED_EMAIL_DOMAIN || 'westminster.ac.uk').toLowerCase();
        if (!value.toLowerCase().endsWith('@' + allowed)) {
          throw new Error(
            `Only University of Westminster email addresses are allowed. ` +
            `Please register with your @${allowed} email.`
          );
        }
        return true;
      }),
    passwordStrength,
    body('role')
      .optional()
      .isIn(['alumnus', 'developer'])
      .withMessage('Role must be either alumnus or developer'),
  ],
  validate,
  register
);

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address using the token from the verification email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token sent to the user's email
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Token is invalid or has expired
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: xyz@westminster.ac.um
 *               password:
 *                 type: string
 *                 example: SecurePass1!
 *     responses:
 *       200:
 *         description: Logged in, session created
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 *       400:
 *         description: Validation errors
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out and destroy session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);
router.get('/me', requireAuth, me);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: xyz@westminster.ac.um
 *     responses:
 *       200:
 *         description: Reset email sent if account exists (always returns same message)
 *       400:
 *         description: Validation errors
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail()],
  validate,
  forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using the token from the reset email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The reset token sent to the user's email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: NewSecurePass1!
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Token invalid/expired or weak password
 */
router.post(
  '/reset-password/:token',
  [passwordStrength],
  validate,
  resetPassword
);

module.exports = router;
