const express = require('express');
const router = express.Router();

// redirect to login if no session
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// redirect developers away from alumni-only pages
const requireAlumnusPage = (req, res, next) => {
  if (req.session.role === 'developer') {
    return res.redirect('/developer');
  }
  next();
};

// redirect alumni away from developer-only pages
const requireDeveloperPage = (req, res, next) => {
  if (req.session.role !== 'developer') {
    return res.redirect('/profile');
  }
  next();
};

// ─── Public pages ─────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return req.session.role === 'developer'
      ? res.redirect('/developer')
      : res.redirect('/profile');
  }
  res.redirect('/alumni-of-the-day');
});

router.get('/alumni-of-the-day', (req, res) => res.render('public/alumni-of-the-day'));
router.get('/register', (req, res) => res.render('auth/register'));
router.get('/login', (req, res) => res.render('auth/login'));
router.get('/forgot-password', (req, res) => res.render('auth/forgot-password'));
router.get('/reset-password/:token', (req, res) => {
  res.render('auth/reset-password', { token: req.params.token });
});

// ─── Protected pages ──────────────────────────────────────────────────────────

router.get('/profile', requireSession, requireAlumnusPage, (req, res) => {
  res.render('profile/index', { role: req.session.role });
});

router.get('/bidding', requireSession, requireAlumnusPage, (req, res) => {
  res.render('bidding/index', { role: req.session.role });
});

router.get('/developer', requireSession, requireDeveloperPage, (req, res) => {
  res.render('developer/index', { role: req.session.role });
});

module.exports = router;
