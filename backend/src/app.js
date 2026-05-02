const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const biddingRoutes = require('./routes/bidding');
const developerRoutes = require('./routes/developer');
const publicRoutes = require('./routes/public');
const analyticsRoutes = require('./routes/analytics');
const pageRoutes = require('./routes/pages');

const app = express();

// EJS for CW1 alumni profile / bidding web forms (CW2 React client is separate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// security headers — CSP allows Bootstrap CDN and inline scripts for EJS views
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'cdn.jsdelivr.net'],
    },
  },
}));

// CORS — adjust origin for production (React dev server + EJS same-origin)
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  },
}));

// rate limiting on auth endpoints to stop brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, please try again later' },
});

const csrfProtection = csrf();
const csrfEnabled = process.env.ENABLE_CSRF === 'true';
const csrfIfEnabled = (req, res, next) => {
  if (!csrfEnabled) return next();
  return csrfProtection(req, res, next);
};

// serve uploaded profile images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.get('/api/csrf-token', csrfIfEnabled, (req, res) => {
  if (!csrfEnabled) return res.json({ csrfEnabled: false });
  return res.json({ csrfEnabled: true, csrfToken: req.csrfToken() });
});

app.use('/api/auth', csrfIfEnabled, authLimiter, authRoutes);
app.use('/api/profile', csrfIfEnabled, profileRoutes);
app.use('/api/bids', csrfIfEnabled, biddingRoutes);
app.use('/api/developer', csrfIfEnabled, developerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/analytics', analyticsRoutes);

// swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// EJS web UI (CW1) — after API routes
app.use('/', pageRoutes);

// catch-all error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
