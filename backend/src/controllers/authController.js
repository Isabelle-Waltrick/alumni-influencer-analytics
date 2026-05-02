const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuthLoginLog = require('../models/AuthLoginLog');
const { generateToken, inHours } = require('../services/tokenService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateToken();
    const verificationTokenExpiry = inHours(24);

    // only allow valid roles — default to alumnus if not provided or invalid
    const assignedRole = role === 'developer' ? 'developer' : 'alumnus';

    await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      verificationToken,
      verificationTokenExpiry,
    });

    await sendVerificationEmail(email.toLowerCase(), verificationToken);

    res.status(201).json({
      message: 'Registration successful. Check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/verify-email/:token
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Verification link is invalid or has expired' });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    // same message for wrong email or wrong password — avoids user enumeration
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Email not verified. Please check your inbox for the verification link.',
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    // login usage audit for CW2 requirement (timestamps + client metadata)
    await AuthLoginLog.create({
      userId: user._id,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    res.json({ message: 'Logged in successfully', user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // always return the same response — don't confirm whether account exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && user.isVerified) {
      const resetToken = generateToken();
      user.resetToken = resetToken;
      user.resetTokenExpiry = inHours(1);
      await user.save();
      await sendPasswordResetEmail(user.email, resetToken);
    }

    res.json({
      message: 'If that email is registered, a password reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired' });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const me = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    const user = await User.findById(req.session.userId).select('email role isVerified createdAt');
    if (!user) {
      return res.status(401).json({ message: 'Session is no longer valid' });
    }

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, verifyEmail, login, logout, forgotPassword, resetPassword, me };
