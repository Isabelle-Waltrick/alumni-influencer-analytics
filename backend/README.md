# Backend — Alumni Influencers API + EJS UI

Node.js / Express / MongoDB server for **CW1 (Alumni Influencers Web API)** and the API surface that **CW2 (University Analytics Dashboard)** consumes.

The same Node process serves three things:

1. **REST API** under `/api/*` — auth, profile, bidding, developer keys, analytics, public AR endpoint
2. **EJS web pages** under `/` — alumnus profile + bidding UI, developer key-management UI, public alumni-of-the-day page
3. **Swagger UI** at `/api-docs` — auto-generated from JSDoc on every route

It is the entire CW1 deliverable plus the data-and-key backbone of CW2.

---

## Table of contents

- [What this server does](#what-this-server-does)
- [Tech stack & dependencies](#tech-stack--dependencies)
- [Project structure](#project-structure)
- [Application bootstrap](#application-bootstrap)
- [Middleware stack (in order)](#middleware-stack-in-order)
- [Models (every field)](#models-every-field)
- [Routes & endpoints (full reference)](#routes--endpoints-full-reference)
- [Authentication & authorization layers](#authentication--authorization-layers)
- [API keys, scopes & usage tracking](#api-keys-scopes--usage-tracking)
- [Bidding system internals](#bidding-system-internals)
- [Cron jobs (UTC-pinned)](#cron-jobs-utc-pinned)
- [Email service](#email-service)
- [EJS pages](#ejs-pages)
- [Configuration files](#configuration-files)
- [Environment variables](#environment-variables)
- [Setup & run](#setup--run)
- [API key generation walkthroughs](#api-key-generation-walkthroughs)
- [Security checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)
- [CW1/CW2 rubric mapping](#cw1cw2-rubric-mapping)

---

## What this server does

Alumni register, verify their email, build a multi-section profile (degrees, certifications, licences, courses, employment), and place blind daily bids to be featured as **Alumni of the Day**. Each day at 18:00 UTC the current bidding window closes and a new one opens; at 00:00 UTC the previous window's highest bidder is selected, their profile is marked active, and a permanent winner record is written. External clients (an AR app for students; the CW2 analytics dashboard for the university) consume scoped Bearer-token APIs to read this data.

In one sentence: **the source of truth for the entire alumni-bidding platform**.

---

## Tech stack & dependencies

Listed verbatim from [`package.json`](package.json):

| Package | Version pin | Why it's here |
|---|---|---|
| `express` | ^5.2.1 | HTTP server + routing |
| `mongoose` | ^9.3.1 | MongoDB ODM with schema validation |
| `bcryptjs` | ^3.0.3 | Password hashing (cost factor 12) |
| `express-session` | ^1.19.0 | Session store for cookie-based auth on web UI |
| `express-validator` | ^7.3.1 | Body / query / param validation chains |
| `helmet` | ^8.1.0 | Secure HTTP response headers (CSP, X-Frame-Options, etc.) |
| `cors` | ^2.8.6 | Cross-origin allowance for the React dev server |
| `csurf` | ^1.11.0 | CSRF token generation + verification (gated by `ENABLE_CSRF`) |
| `express-rate-limit` | ^8.3.1 | Brute-force protection on auth + per-key rate limit on public API |
| `nodemailer` | ^8.0.3 | SMTP transport for verification + password-reset + bid-result emails |
| `node-cron` | ^4.2.1 | Daily 18:00 UTC and 00:00 UTC schedulers |
| `swagger-jsdoc` | ^6.2.8 | Compiles JSDoc on routes into an OpenAPI 3 spec |
| `swagger-ui-express` | ^5.0.1 | Serves the Swagger UI at `/api-docs` |
| `multer` | ^2.1.1 | Multipart parsing for profile image uploads |
| `dotenv` | ^17.3.1 | Loads `.env` into `process.env` at boot |
| `ejs` | ^3.1.10 | Server-side templating for the alumnus / developer / public web pages |

There are no devDependencies — this is a server, not a build target.

---

## Project structure

```
backend/
├── server.js                     ← entry — boots Express, MongoDB, cron
├── package.json
├── .env                          ← (not committed) runtime config
├── .env.example                  ← template
├── README.md                     ← (this file)
├── uploads/                      ← profile images saved here at runtime
│
├── views/                        ← EJS templates (Bootstrap 5 via CDN)
│   ├── partials/
│   │   ├── head.ejs              ← <head>, Bootstrap CSS, shared `api` fetch helper, CSRF-aware
│   │   ├── navbar.ejs            ← role-aware nav (alumnus / developer)
│   │   └── foot.ejs              ← Bootstrap JS, `toast()` helper
│   ├── auth/
│   │   ├── register.ejs          ← email + password + role dropdown (alumnus / developer)
│   │   ├── login.ejs             ← email + password
│   │   ├── forgot-password.ejs   ← email entry → emails reset link
│   │   └── reset-password.ejs    ← new password form using token from email
│   ├── profile/
│   │   └── index.ejs             ← personal info, image upload, 5 tab sub-forms with completion bar
│   ├── bidding/
│   │   └── index.ejs             ← place / increase / cancel bid, status, history, monthly limit
│   ├── developer/
│   │   └── index.ejs             ← key generation form (with quick presets + scope checkboxes), keys table, usage stats
│   └── public/
│       └── alumni-of-the-day.ejs ← public page (no auth) — calls `/api/public/alumni-of-the-day/public`
│
└── src/
    ├── app.js                    ← Express app — middleware order, route mounting
    │
    ├── config/
    │   ├── db.js                 ← Mongoose connect with retry-on-fail
    │   ├── email.js              ← Nodemailer transporter (singleton)
    │   ├── multer.js             ← file upload — 5 MB cap, image MIME whitelist
    │   └── swagger.js            ← OpenAPI 3.0 spec config + paths to scan
    │
    ├── models/
    │   ├── User.js               ← email, passwordHash, role, isVerified, verify/reset tokens
    │   ├── Profile.js            ← name, bio, LinkedIn, image, programme, graduation, industry, country, isActiveToday, monthlyWins, lastWinMonth, hasEventBonus, 5 sub-arrays
    │   ├── BidWindow.js          ← date (yyyy-mm-dd), status (open/closed/resolved), winnerProfileId, winnerBidAmount, resolvedAt
    │   ├── Bid.js                ← userId, profileId, bidWindowId, amount, isWinner, isActive — unique on (userId, bidWindowId)
    │   ├── FeaturedAlumni.js     ← profileId, bidWindowId, date, winningBidAmount — permanent winner log
    │   ├── ApiKey.js             ← userId, keyPrefix, keyHash (SHA-256), label, scopes[], clientName, isRevoked, lastUsedAt
    │   ├── ApiUsageLog.js        ← apiKeyId, endpoint, method, ipAddress, statusCode, timestamp
    │   └── AuthLoginLog.js       ← userId, email, ipAddress, userAgent, timestamp — for /api/developer/login-stats
    │
    ├── controllers/
    │   ├── authController.js     ← register, verifyEmail, login, logout, forgotPassword, resetPassword, me
    │   ├── profileController.js  ← getMyProfile, updateMyProfile, uploadImage, getCompletionStatus, +5 sub-doc handler factories
    │   ├── biddingController.js  ← getWindow, placeBid, updateBid, cancelBid, getBidStatus, getBidHistory, getMonthlyLimit
    │   ├── developerController.js← generateKey, listKeys, revokeKey, getStats, getLoginStats
    │   ├── analyticsController.js← listAlumni, getSummary, getChartData, getDonationsSummary
    │   └── publicController.js   ← getAlumniOfTheDay
    │
    ├── routes/
    │   ├── auth.js               ← /api/auth/* with rate limit + (optional) CSRF
    │   ├── profile.js            ← /api/profile/* — alumnus only
    │   ├── bidding.js            ← /api/bids/* — alumnus only
    │   ├── developer.js          ← /api/developer/* — developer only, session auth
    │   ├── analytics.js          ← /api/analytics/* — Bearer + scope
    │   ├── public.js             ← /api/public/alumni-of-the-day (Bearer) and /public (no auth)
    │   └── pages.js              ← / EJS routes with session + role redirects
    │
    ├── middleware/
    │   ├── requireAuth.js        ← 401 if no session
    │   ├── requireAlumnus.js     ← 403 if session role !== 'alumnus'
    │   ├── requireDeveloper.js   ← 403 if session role !== 'developer'
    │   ├── requireApiKey.js      ← Bearer + SHA-256 lookup, attaches req.apiKey, logs usage on res finish
    │   ├── requireApiScope.js    ← variadic — requireApiScope('read:alumni', 'read:analytics')
    │   ├── apiKeyRateLimiter.js  ← per-key `API_KEY_RATE_LIMIT` requests/min
    │   └── validate.js           ← formats express-validator errors into JSON 400
    │
    ├── services/
    │   ├── emailService.js       ← sendVerificationEmail, sendPasswordResetEmail, sendBidResultEmail (HTML templates inline)
    │   └── tokenService.js       ← generateToken (32 bytes hex), inHours(n) for expiry math
    │
    └── jobs/
        └── biddingJob.js         ← runMidnightSelection, run6pmWindowRollover, ensureOpenWindow, startBiddingJob
```

---

## Application bootstrap

[`server.js`](server.js):

1. `dotenv.config()` — load `.env` into `process.env`.
2. `connectDB()` — Mongoose `connect(process.env.MONGO_URI)`.
3. `app.listen(PORT)`.
4. `ensureOpenWindow()` — guarantee there's a `BidWindow` for today's date so bids placed before the first 18:00 cron run have somewhere to go.
5. `startBiddingJob()` — register the two cron jobs (`0 0 * * *` and `0 18 * * *`, both pinned to UTC).

[`src/app.js`](src/app.js): the Express app itself. The order of middleware below is intentional — see the next section.

---

## Middleware stack (in order)

```js
app.use(helmet({ contentSecurityPolicy: { ...allow Bootstrap CDN... } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ ...httpOnly, secure in prod, 24h maxAge... }));

const authLimiter = rateLimit({ windowMs: AUTH_RATE_LIMIT_WINDOW_MS, max: AUTH_RATE_LIMIT_MAX });
const csrfIfEnabled = ...;     // gated by ENABLE_CSRF env
```

Then static and routes:

```js
app.use('/uploads', express.static('uploads'));            // profile images
app.get('/api/csrf-token', csrfIfEnabled, ...);            // hands the CSRF token to JS clients

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth',      csrfIfEnabled,             authRoutes);
app.use('/api/profile',   csrfIfEnabled,                profileRoutes);
app.use('/api/bids',      csrfIfEnabled,                biddingRoutes);
app.use('/api/developer', csrfIfEnabled,                developerRoutes);
app.use('/api/public',                                   publicRoutes);     // Bearer-only, no CSRF
app.use('/api/analytics',                                analyticsRoutes);  // Bearer-only, no CSRF

app.use('/api-docs',  swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/',          pageRoutes);                                           // EJS pages last
app.use((err, req, res, next) => { /* JSON error formatter */ });
```

### Why this order

- **Helmet first** so every response carries security headers including 5xx errors.
- **CORS before any JSON parsing** — preflight `OPTIONS` requests don't have a body to parse.
- **Session before routes** — every route past this line can read `req.session`.
- **CSRF gated by env var** — production turns it on; one-off Swagger / Postman testing turns it off without code changes.
- **Bearer-only routes (`/api/public`, `/api/analytics`) skip CSRF** — they're meant for non-browser clients that don't have a session cookie to forge with.
- **EJS routes last** — so `/` doesn't shadow API paths.
- **Error handler last** — Express requires (err, req, res, next) signature to be the final middleware.

---

## Models (every field)

All schemas use `{ timestamps: true }` so `createdAt` and `updatedAt` are present unless noted.

### `User` — [`src/models/User.js`](src/models/User.js)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `email` | String | unique, lowercase, trim, regex-validated | Used as login identifier |
| `passwordHash` | String | required | bcrypt cost 12 |
| `role` | enum | `'alumnus' \| 'developer'`, default `'alumnus'` | Drives EJS routing + middleware guards |
| `isVerified` | Boolean | default false | Login refuses unverified |
| `verificationToken` | String | nullable | 64 hex chars, set at register, cleared on verify |
| `verificationTokenExpiry` | Date | nullable | 24h after register |
| `resetToken` | String | nullable | 64 hex chars, set at forgot-password |
| `resetTokenExpiry` | Date | nullable | 1h after forgot-password |

**`toJSON` override** strips `passwordHash` and all token fields so user objects can be returned safely from any endpoint.

### `Profile` — [`src/models/Profile.js`](src/models/Profile.js)

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId, unique, ref User, required | One profile per user |
| `firstName` / `lastName` | String, trim | |
| `bio` | String, max 1000 chars | |
| `linkedInUrl` | String | Validator: must be HTTPS + contain `linkedin.com` |
| `profileImagePath` | String, nullable | `/uploads/<filename>` |
| `programme` | String, default `''` | Reserved — not currently exposed in EJS form |
| `graduationDate` | Date, nullable | Reserved — not currently in EJS form |
| `industrySector` | String, default `''` | Reserved — not currently in EJS form |
| `currentCountry` | String, default `''` | Captured in EJS as Location dropdown (10 fixed regions) |
| `isActiveToday` | Boolean, default false | Set by midnight cron when this profile wins |
| `monthlyWins` | Number, default 0 | Resets implicitly at start of each month |
| `lastWinMonth` | Number 1–12, nullable | Used to detect month rollover |
| `hasEventBonus` | Boolean, default false | When true, alumnus may bid 4× per month instead of 3× |
| `degrees[]` | sub-doc array | `{ title, institution, url, completionDate }` |
| `certifications[]` | sub-doc array | `{ title, issuingBody, url, completionDate }` |
| `licences[]` | sub-doc array | `{ title, awardingBody, url, completionDate }` |
| `courses[]` | sub-doc array | `{ title, provider, url, completionDate }` |
| `employment[]` | sub-doc array | `{ jobTitle, company, industry, startDate, endDate? }` |

**Methods**:

- `canBidThisMonth()` — returns boolean. Checks `lastWinMonth` against current month, treats `monthlyWins` as 0 if month rolled over, applies `hasEventBonus ? 4 : 3` cap.
- `recordWin()` — increments `monthlyWins`; if month rolled over, resets to 1 and updates `lastWinMonth`.

### `BidWindow` — daily bidding session

| Field | Type | Notes |
|---|---|---|
| `date` | String `yyyy-mm-dd`, unique | One window per UTC day |
| `status` | enum `'open' \| 'closed' \| 'resolved'` | open until 18:00 UTC, closed until midnight, resolved after winner picked |
| `winnerProfileId` | ObjectId, nullable | Set at midnight cron |
| `winnerBidAmount` | Number, nullable | Set at midnight cron |
| `resolvedAt` | Date, nullable | Audit timestamp |

### `Bid` — individual bid

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId, ref User, required | |
| `profileId` | ObjectId, ref Profile, required | |
| `bidWindowId` | ObjectId, ref BidWindow, required | |
| `amount` | Number, min 1 | |
| `isWinner` | Boolean, default false | Set on the winning bid by midnight cron |
| `isActive` | Boolean, default true | Soft-cancel — cancelled bids excluded from winner selection |

**Indexes**: `{ userId: 1, bidWindowId: 1 }` unique — DB-level guarantee that a user has at most one active bid per window. Duplicate inserts surface as `E11000` and are caught by the controller and rewritten as 409.

### `FeaturedAlumni` — permanent winner log

| Field | Type | Notes |
|---|---|---|
| `profileId` | ObjectId, ref Profile | |
| `bidWindowId` | ObjectId, ref BidWindow | |
| `date` | String `yyyy-mm-dd` | The date this alumnus is *featured* (i.e. window date + 1 day) |
| `winningBidAmount` | Number | |

Read by `GET /api/public/alumni-of-the-day` and the public EJS page.

### `ApiKey` — developer API key

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId, ref User, required | |
| `keyPrefix` | String, required | First 12 chars of the raw key + `…` — for UI display |
| `keyHash` | String, required | SHA-256 of the raw key — *the only persisted form* |
| `label` | String, default `'My API Key'` | Friendly name |
| `scopes[]` | enum array | `'read:alumni'`, `'read:analytics'`, `'read:donations'`, `'read:alumni_of_day'`. Default `['read:alumni_of_day']` |
| `clientName` | String, default `'custom-client'` | Identifies the consuming app — analytics-dashboard / mobile-ar / etc. |
| `isRevoked` | Boolean, default false | |
| `lastUsedAt` | Date, nullable | Updated by `requireApiKey` on every authenticated request |

**The plain key is never persisted.** On generation, the controller returns the raw `ak_...` string in the HTTP response *once* and then forgets it. Recovery is impossible — generate a new key.

### `ApiUsageLog` — per-request audit

| Field | Type | Notes |
|---|---|---|
| `apiKeyId` | ObjectId, ref ApiKey | |
| `endpoint` | String | e.g. `/api/analytics/charts?certification=AWS` |
| `method` | String | `GET`, `POST`, etc. |
| `ipAddress` | String | from `req.ip` |
| `statusCode` | Number | captured *after* response finishes |
| `timestamp` | Date | default `Date.now` |

### `AuthLoginLog` — login audit (for CW2 usage stats requirement)

| Field | Type |
|---|---|
| `userId` | ObjectId, ref User |
| `email` | String |
| `ipAddress` | String |
| `userAgent` | String |
| `timestamp` | Date, default Date.now |

---

## Routes & endpoints (full reference)

Base URL: `http://localhost:3000` (port from `PORT` env).

All endpoints documented in Swagger at [`/api-docs`](http://localhost:3000/api-docs). Below is the canonical list with auth + scope requirements.

### Auth — `/api/auth/*`

CSRF: enforced when `ENABLE_CSRF=true`. Rate limit: 20 requests / 15 min per IP.

| Method | Path | Auth | Body / params | Notes |
|---|---|---|---|---|
| `POST` | `/register` | — | `{ email, password, role? }` | Creates user, sends verification email. `role` defaults to `'alumnus'`; `'developer'` accepted. Password rules: 8+ chars, one uppercase, one number, one special. |
| `GET` | `/verify-email/:token` | — | path token | Marks `isVerified=true`, clears token. 400 if expired. |
| `POST` | `/login` | — | `{ email, password }` | Sets session. 401 invalid creds, 403 not verified. Logs to `AuthLoginLog`. |
| `POST` | `/logout` | session | — | Destroys session, clears `connect.sid`. |
| `POST` | `/forgot-password` | — | `{ email }` | Always 200 with same message regardless of whether user exists (prevents enumeration). |
| `POST` | `/reset-password/:token` | — | `{ password }` | Validates new password strength. 400 if token expired. |
| `GET` | `/me` | session | — | Returns the logged-in user (id, email, role, isVerified). Used by the React app's session check. |

### Profile — `/api/profile/*` (alumnus only, session-required)

| Method | Path | Body / params | Notes |
|---|---|---|---|
| `GET` | `/me` | — | Auto-creates an empty profile on first access. |
| `PUT` | `/me` | `{ firstName?, lastName?, bio?, linkedInUrl?, programme?, graduationDate?, industrySector?, currentCountry? }` | Validators on every field. |
| `POST` | `/image` | multipart `image` | Multer 5MB cap, `image/*` only. Replaces existing image and deletes old file. |
| `GET` | `/completion` | — | `{ percentage, breakdown }` — weights: personalInfo 25, profileImage 10, degrees 15, certs 15, licences 10, courses 10, employment 15. |
| `POST` | `/degrees` | `{ title, institution, url?, completionDate? }` | Duplicate detection on `(title, institution)` case-insensitive — returns 409. |
| `PUT` | `/degrees/:itemId` | partial sub-doc body | Positional `$set`. |
| `DELETE` | `/degrees/:itemId` | — | `$pull`. |
| `POST/PUT/DELETE` | `/certifications/:itemId?` | `{ title, issuingBody?, url?, completionDate? }` | Duplicate on `(title)`. |
| `POST/PUT/DELETE` | `/licences/:itemId?` | `{ title, awardingBody?, url?, completionDate? }` | Duplicate on `(title)`. |
| `POST/PUT/DELETE` | `/courses/:itemId?` | `{ title, provider?, url?, completionDate? }` | Duplicate on `(title)`. |
| `POST/PUT/DELETE` | `/employment/:itemId?` | `{ jobTitle, company, industry, startDate, endDate? }` | Duplicate on `(jobTitle, company)`. |

### Bidding — `/api/bids/*` (alumnus only, session-required)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/window` | Today's open BidWindow (no amounts). 200 even if no window exists yet. |
| `POST` | `/` | Place a bid. Body `{ amount }`. Refuses if `canBidThisMonth() === false`, if window is closed, or if user already has an active bid (409). |
| `PATCH` | `/:id` | Increase only — body `{ amount }` must be strictly higher than current. Atomic `findOneAndUpdate` with `amount: { $lt: newAmount }`. |
| `DELETE` | `/:id` | Soft-delete — sets `isActive=false`. |
| `GET` | `/status` | Returns `{ isWinning: boolean }` — does **not** reveal amounts (blind bidding). |
| `GET` | `/history` | Caller's bid history with window dates. |
| `GET` | `/monthly-limit` | `{ used, limit, remaining, hasEventBonus }`. |

### Developer — `/api/developer/*` (developer role, session-required)

| Method | Path | Body / params | Notes |
|---|---|---|---|
| `POST` | `/keys` | `{ label?, clientName?, scopes? }` | Generates raw `ak_<64hex>`, returns it once. Persists SHA-256 hash + 12-char prefix. |
| `GET` | `/keys` | — | Lists caller's keys (prefix only — never the raw value). |
| `DELETE` | `/keys/:id` | — | Sets `isRevoked=true`. Audit logs preserved. |
| `GET` | `/stats` | — | Returns `{ keys: [{keyId, keyPrefix, label, isRevoked, totalRequests, firstAccessed, lastAccessed}], endpointBreakdown: [{endpoint, method, count, lastHit}] }`. |
| `GET` | `/login-stats` | — | Recent `AuthLoginLog` entries — for CW2 usage-stats requirement. |

### Analytics — `/api/analytics/*` (Bearer + scope)

| Method | Path | Required scope | Query filters | Notes |
|---|---|---|---|---|
| `GET` | `/alumni` | `read:alumni` OR `read:analytics` | certification, company, jobTitle, certYearFrom, certYearTo | Returns `{ count, items[] }`. Each item is a derived row with latestJobTitle, latestCompany, topCertification, certificationsCount, etc. |
| `GET` | `/summary` | `read:analytics` | same | `{ totalAlumniTracked, employmentRate, avgCertificationsPerAlumnus }` |
| `GET` | `/charts` | `read:analytics` | same | `{ skillsGap, certificationTrend, employmentByIndustry, commonJobTitles, topEmployers, topCourseProviders, geographicDistribution }` |
| `GET` | `/donations-summary` | `read:donations` | same | `{ featuredWins, totalSponsoredAmount, averageSponsoredAmount }` — built from `FeaturedAlumni.winningBidAmount` |

### Public — `/api/public/*`

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/alumni-of-the-day` | Bearer + `read:alumni_of_day` + per-key rate limit | Returns `{ featuredDate, profile }`. 404 with `{ message, date }` if no winner yet. |
| `GET` | `/alumni-of-the-day/public` | — | Same data, no auth. Used by the EJS public page so students can browse without an account. |

### EJS pages — `/`

| Path | Guard | Renders |
|---|---|---|
| `/` | session+role redirect | dev → `/developer`, alumnus → `/profile`, anonymous → `/alumni-of-the-day` |
| `/alumni-of-the-day` | none | public/alumni-of-the-day.ejs |
| `/register` | none | auth/register.ejs |
| `/login` | none | auth/login.ejs |
| `/forgot-password` | none | auth/forgot-password.ejs |
| `/reset-password/:token` | none | auth/reset-password.ejs |
| `/profile` | session + alumnus | profile/index.ejs (developers redirected to `/developer`) |
| `/bidding` | session + alumnus | bidding/index.ejs |
| `/developer` | session + developer | developer/index.ejs (alumni redirected to `/profile`) |

### Documentation

| Path | Notes |
|---|---|
| `GET /api-docs` | Full Swagger UI — interactive try-it-out on every endpoint |
| `GET /api/csrf-token` | Returns `{ csrfEnabled: false }` or `{ csrfEnabled: true, csrfToken }`. JS clients fetch this once and attach `x-csrf-token` to mutating requests |

---

## Authentication & authorization layers

Three independent auth surfaces, each gating different routes:

### 1. Session cookie (`connect.sid`)

- Set on `POST /api/auth/login` after bcrypt comparison
- `httpOnly`, `sameSite` default (`lax`), `secure: NODE_ENV==='production'`
- 24-hour `maxAge`
- Stores `{ userId, role }`
- Destroyed on `POST /api/auth/logout`
- Required by all `/api/profile`, `/api/bids`, `/api/developer` routes via `requireAuth`
- Required by all EJS pages except register/login/forgot/reset/alumni-of-the-day

### 2. Bearer API key

- `Authorization: Bearer ak_<64-hex>` header
- Middleware: `requireApiKey` → SHA-256 hash → `ApiKey.findOne({ keyHash, isRevoked: false })`
- Updates `lastUsedAt` before responding
- Logs to `ApiUsageLog` *after* response finish (`res.on('finish', ...)`) so the log captures the actual `statusCode`
- 401 on missing / invalid / revoked
- Required by all `/api/public/*` and `/api/analytics/*` routes

### 3. CSRF token (optional)

- Library: `csurf`
- Gated by `ENABLE_CSRF` env. When `false`, the middleware is a no-op; when `true`, it's mounted on session-bearing routes (`/api/auth`, `/api/profile`, `/api/bids`, `/api/developer`).
- JS clients (EJS pages and React app) fetch the token via `GET /api/csrf-token` and attach it as `x-csrf-token` on every mutating request.
- Bearer-only routes (`/api/public`, `/api/analytics`) deliberately skip CSRF — they're for non-browser clients.

### Role guards

| Middleware | Behaviour |
|---|---|
| `requireAuth` | 401 if no session |
| `requireAlumnus` | 403 if `req.session.role !== 'alumnus'` |
| `requireDeveloper` | 403 if `req.session.role !== 'developer'` |
| `requireApiKey` | 401 if missing / invalid Bearer |
| `requireApiScope(...scopes)` | 403 if none of the required scopes are present on the key |

---

## API keys, scopes & usage tracking

### Generation flow

```
POST /api/developer/keys
   │ session = developer
   │
   ▼
controller:
   raw = 'ak_' + crypto.randomBytes(32).toString('hex')      // 64 hex chars
   prefix = raw.substring(0, 12) + '...'
   hash = sha256(raw)
   ApiKey.create({ userId, keyHash: hash, keyPrefix: prefix, label, clientName, scopes })
   ▼
response:
   { message, key: raw, keyId, keyPrefix, label, clientName, scopes }
```

The raw key is shown to the developer **once**. It is never logged, never persisted in plain form, never recoverable.

### Verification flow

```
incoming request: Authorization: Bearer ak_xxx...
   │
   ▼
requireApiKey:
   hash = sha256(rawKey)
   apiKey = ApiKey.findOne({ keyHash: hash, isRevoked: false })
   if !apiKey -> 401
   req.apiKey = apiKey
   apiKey.lastUsedAt = Date.now(); save()
   res.on('finish', () => ApiUsageLog.create({ apiKeyId, endpoint, method, ip, statusCode }))
   ▼
requireApiScope(...required):
   if not (any of required is in req.apiKey.scopes) -> 403
   ▼
controller
```

### Why SHA-256 not bcrypt?

API keys are themselves 256 bits of entropy from `crypto.randomBytes(32)`. Brute-forcing them is infeasible regardless of hash algorithm. We don't need bcrypt's slow KDF — we need a fast O(1) lookup at every request. SHA-256 with deterministic hashing lets `ApiKey.findOne({ keyHash })` use an index.

---

## Bidding system internals

### State machine of a `BidWindow`

```
   create at 00:00 UTC (or at server start via ensureOpenWindow)
              │
              ▼
         status: open
              │ 18:00 UTC ← run6pmWindowRollover sets status=closed
              ▼
         status: closed
              │ 00:00 UTC next day ← runMidnightSelection
              │   ─ pick highest active bid (ties → earliest createdAt)
              │   ─ Bid.isWinner = true
              │   ─ window.winnerProfileId, winnerBidAmount, resolvedAt set
              │   ─ Profile.isActiveToday flipped (others unflipped first)
              │   ─ FeaturedAlumni record created with date = today
              │   ─ all bidders emailed
              ▼
         status: resolved
```

### Idempotency

Both cron jobs are safe to re-run:
- `run6pmWindowRollover` uses `findOneAndUpdate({ status: 'open' }, { status: 'closed' })` — no-op if already closed.
- `runMidnightSelection` checks `if window.status === 'resolved' return;` before doing anything.
- `BidWindow.create({ date: tomorrow })` is wrapped in an existence check.

### Concurrency safety

- Unique index `{ userId, bidWindowId }` on `Bid` — a duplicate insert returns `E11000` which the controller catches and translates to `409`.
- `updateBid` uses atomic `findOneAndUpdate({ _id, amount: { $lt: newAmount } })` — if two raises race, only one wins; the loser sees `null` and gets `400 must be strictly higher`.
- Window status is checked *immediately* before insert, but the unique index is the real guarantee.

---

## Cron jobs (UTC-pinned)

[`src/jobs/biddingJob.js`](src/jobs/biddingJob.js):

```js
cron.schedule('0 0 * * *', runMidnightSelection,    { timezone: 'UTC' });
cron.schedule('0 18 * * *', run6pmWindowRollover,   { timezone: 'UTC' });
```

Plus `ensureOpenWindow()` at server startup.

> **Why UTC?** Cron expressions like `'0 0 * * *'` are evaluated in the host's local time unless `timezone` is given. Without pinning, a server hosted in `Asia/Kolkata` would fire midnight at 18:30 UTC the previous day — wrong window picked, wrong winner. UTC pinning + `TZ=UTC` env makes deployments reproducible.

### Manual invocation (debugging)

From a Node REPL with the same `.env`:

```js
require('dotenv').config();
require('./src/config/db')().then(async () => {
  const { runMidnightSelection } = require('./src/jobs/biddingJob');
  await runMidnightSelection();
  process.exit();
});
```

---

## Email service

[`src/services/emailService.js`](src/services/emailService.js) exports:

- `sendVerificationEmail(email, token)` — link points to `${CLIENT_ORIGIN}/verify-email/${token}` so the React app handles verification (CW2-friendly). The EJS site doesn't need a verify route because the API endpoint responds with a JSON message that the React `VerifyEmailPage` component renders.
- `sendPasswordResetEmail(email, token)` — link points to `${CLIENT_ORIGIN}/reset-password/${token}`.
- `sendBidResultEmail(email, won, dateString)` — sent by midnight cron to every bidder.

All emails are HTML, inline-styled, and use the `EMAIL_FROM` envelope.

For development, **Mailtrap sandbox** captures every email without delivering. Free tier is enough for the entire coursework.

---

## EJS pages

The EJS layer is the **alumnus + developer web UI** for CW1. The React app at `frontend/` is the CW2 analytics UI — separate concern.

### Shared partials

- **`head.ejs`**: Bootstrap 5 CSS via jsDelivr CDN, shared `<style>`, and the global `api` JS helper. The helper:
  - Auto-fetches `/api/csrf-token` on first mutating call and caches the result
  - Adds `x-csrf-token` header to POST/PUT/PATCH/DELETE/postForm calls when CSRF is on
  - Includes `credentials: 'include'` so the session cookie is sent
- **`navbar.ejs`**: Role-aware — different links for alumnus vs developer
- **`foot.ejs`**: Bootstrap JS, `toast(message, type)` helper

### Developer page (`developer/index.ejs`)

The most fully-featured EJS page. Includes:

- **Quick presets**: clicking *"Analytics Dashboard"* fills label+clientName+scope checkboxes for `read:alumni`+`read:analytics`. *"Mobile AR App"* fills for `read:alumni_of_day`.
- **Manual mode**: type your own label and client name, tick any combination of the 4 scope checkboxes.
- **Refusal to submit if no scope is ticked** (avoids the old default-fallback bug where keys silently became AR-scoped).
- **Reveal panel** shows the raw key once, plus a meta line: `Client: ... — Scopes: ...`.
- **Keys table** with Prefix, Label, Client, Scopes (rendered as `<code>` chips), Status, Last used, Created, Revoke action.
- **Usage stats** with per-key totals + endpoint breakdown.

### Profile page (`profile/index.ejs`)

- Completion bar with badge breakdown
- Personal info: firstName, lastName, bio, linkedInUrl
- Image upload (multipart via `api.postForm`)
- 5 tabs: degrees / certifications / licences / courses / employment, each with add-form + list with Remove button
- Duplicate-detection from the server is surfaced as a Bootstrap toast

### Bidding page (`bidding/index.ejs`)

- Today's window status
- Place / increase / cancel bid
- Status block: "You are currently winning" / "You are losing"
- Bid history list
- Monthly limit indicator

### Public page (`public/alumni-of-the-day.ejs`)

- No login required
- Calls `GET /api/public/alumni-of-the-day/public` (the no-auth variant)
- Renders the winner with image, bio, LinkedIn, all sub-arrays
- 404 message when no winner has been resolved yet

---

## Configuration files

### [`src/config/db.js`](src/config/db.js)

Connects Mongoose with the `MONGO_URI`. Exits the process on connection failure (preferable to half-running with no DB).

### [`src/config/email.js`](src/config/email.js)

Singleton `nodemailer.createTransport(...)` configured from `EMAIL_*` env vars.

### [`src/config/multer.js`](src/config/multer.js)

- Disk storage in `uploads/`
- Filename: `<userId>-<timestamp>.<ext>`
- Limits: `fileSize: 5 * 1024 * 1024` (5 MB)
- File filter: only `image/jpeg`, `image/png`, `image/webp`

### [`src/config/swagger.js`](src/config/swagger.js)

OpenAPI 3.0 spec config. Scans `src/routes/**/*.js` for JSDoc `@swagger` blocks and assembles them. Server URL set from `BASE_URL`.

---

## Environment variables

See the table in [`README.md`](../README.md#environment-variables-backend) at the repo root for the full list.

---

## Setup & run

```bash
cd backend

# 1. Install
npm install

# 2. Configure
cp .env.example .env
# edit MONGO_URI, SESSION_SECRET, EMAIL_*, CLIENT_ORIGIN

# 3. Make uploads directory if missing
mkdir -p uploads

# 4. Run
node server.js
```

Server boots, prints `Server running on port 3000`, registers cron jobs, ensures today's window exists.

For development with auto-restart on file change: `npx nodemon server.js`. (nodemon is not in `package.json` to keep dependencies lean — install globally if you want it.)

---

## API key generation walkthroughs

### Generate an Analytics Dashboard key

1. Register/log in as developer at [http://localhost:3000](http://localhost:3000).
2. Go to `/developer`.
3. Click **Analytics Dashboard** preset → form fills in.
4. Click **Generate key**.
5. Copy the `ak_...` from the green panel.
6. Paste into the React sidebar at [http://localhost:5173](http://localhost:5173) → Load Charts.

### Generate a Mobile AR App key

1. Same `/developer` page.
2. Click **Mobile AR App** preset.
3. Click **Generate key**.
4. Use it with curl / Postman:

```bash
curl -H "Authorization: Bearer ak_xxx" \
     http://localhost:3000/api/public/alumni-of-the-day
```

### Generate a custom-scope key (Swagger)

1. Open [http://localhost:3000/api-docs](http://localhost:3000/api-docs).
2. Find `POST /api/developer/keys` → "Try it out".
3. Body:
   ```json
   { "label": "Custom", "clientName": "my-app", "scopes": ["read:alumni"] }
   ```
4. Execute. Copy `key`.

> If `ENABLE_CSRF=true`, Swagger will return `EBADCSRFTOKEN`. Set `ENABLE_CSRF=false` for the call, then back to `true`.

---

## Security checklist

- [x] Passwords hashed with bcrypt cost 12 ([authController.js:17](src/controllers/authController.js))
- [x] Strong password rules at register/reset (min 8 / upper / number / special)
- [x] Email verification required before login ([authController.js:79](src/controllers/authController.js))
- [x] User enumeration prevented on login (same 401 message for wrong email vs wrong password) and on forgot-password (same 200 message regardless of existence)
- [x] Verification + reset tokens are 64-hex (32 bytes), single-use, time-limited (24h / 1h)
- [x] Sessions: `httpOnly`, `secure` in production, `sameSite=lax` (default)
- [x] `helmet()` with custom CSP that allows the Bootstrap CDN
- [x] CORS limited to `CLIENT_ORIGIN`, `credentials: true`
- [x] CSRF available (`ENABLE_CSRF=true` recommended in production)
- [x] Rate limit on sensitive auth write routes (`/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`) with env tuning (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`) and per-key on `/api/public/*` (configurable)
- [x] `express-validator` on every request body / query / param that takes user input
- [x] Mongoose schema-level validation as a second layer
- [x] User input never interpolated into queries — Mongoose object-builders escape
- [x] Free-text regex filters in analytics use `escapeRegex(value)` before construction
- [x] API keys hashed with SHA-256, raw value never persisted, prefix-only listing
- [x] API key scope enforced at route level — no implicit "all access" key
- [x] Per-key revocation — atomic `isRevoked: true` flip
- [x] Per-key usage logging — endpoint, method, IP, statusCode, timestamp
- [x] Audit on logins (`AuthLoginLog`)
- [x] No secrets in repo — `.env` is gitignored, `.env.example` has placeholders only
- [x] Profile image upload restricted by MIME and 5 MB cap
- [x] Old profile images deleted from disk when replaced
- [x] EJS templates auto-escape interpolations (`<%= %>`); the `<%- %>` raw form is used only for trusted partials
- [x] React app blocks alumni at three points (login flow, mount-time session check, `Protected` wrapper)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `MongooseServerSelectionError` | Mongo not running or wrong URI | Start MongoDB; verify `MONGO_URI` |
| `EBADCSRFTOKEN` | CSRF on but client missed `x-csrf-token` | Verify the client called `GET /api/csrf-token` first; or temporarily set `ENABLE_CSRF=false` |
| Cron jobs fire at wrong times | Host TZ leaking through | Set `TZ=UTC` in `.env` |
| Verification email never arrives | Wrong SMTP creds, or sending to a non-existent inbox | Check `EMAIL_*` vars; use Mailtrap sandbox; check Mailtrap inbox not real inbox |
| `403 Insufficient API key scope` | Generated key lacks needed scope | Use the right `/developer` preset, or send `scopes: [...]` explicitly |
| `409 An account with this email already exists` | The email is already registered | Use a different email, or reset the existing account's password |
| Bid placement returns 409 with `An active bid already exists` | The unique index caught a duplicate | Cancel the existing bid first, or use `PATCH /api/bids/:id` to increase |
| EJS page tab shows perpetual loading spinner | Bootstrap CDN blocked / slow (e.g. via Tor) | Use a normal browser, or add `defer` to the `<script src="cdn.jsdelivr.net/...">` tag, or self-host Bootstrap |

---

## CW1/CW2 rubric mapping

See [the root README](../README.md#cw1-rubric-mapping) for the full table mapping every rubric line to its source location in this codebase.
