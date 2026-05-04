# Frontend — University Analytics Dashboard (CW2)

A React + Vite + TypeScript single-page app that consumes the [backend](../backend/README.md) REST API to deliver the **CW2 University Analytics Dashboard**. Built for university-side users (analysts / curriculum planners / administrators) to derive intelligence from live alumni data.

The app is organized into a conventional React folder structure — `App.tsx` is the slim composition root (routing + global state), with everything else split into `pages/`, `components/`, `hooks/`, `lib/`, and `types/`.

---

## Table of contents

- [What this client does](#what-this-client-does)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Application architecture](#application-architecture)
- [Routing & guards](#routing--guards)
- [Authentication flow](#authentication-flow)
- [Pages](#pages)
- [The `useAnalytics` hook](#the-useanalytics-hook)
- [API key sidebar input](#api-key-sidebar-input)
- [Filters (and how they map to backend)](#filters-and-how-they-map-to-backend)
- [Charts](#charts)
- [Exports](#exports)
- [Filter presets](#filter-presets)
- [Styling notes](#styling-notes)
- [Environment variables](#environment-variables)
- [Setup, run & build](#setup-run--build)
- [Dependencies](#dependencies)
- [Design decisions worth defending in viva](#design-decisions-worth-defending-in-viva)
- [Troubleshooting](#troubleshooting)
- [CW2 rubric mapping](#cw2-rubric-mapping)

---

## What this client does

In plain language:

> A scoped, role-gated dashboard that lets a university developer/analyst log in, paste a CW1-issued API key, and see live KPIs, 6 chart visualisations, an alumni explorer, and exportable reports — all powered by the alumni profile data flowing in from the CW1 API.

Concretely, it provides:

1. **Auth surface** — login / forgot password / reset password on the React app. Registration is intentionally disabled on port 5173 and must be done on the CW1 EJS site at `http://localhost:3000/register`. Email verification is also handled on the backend domain (`http://localhost:3000/api/auth/verify-email/:token`).
2. **Session-aware shell** — a fixed sidebar with navigation, current user email, logout, and an API-key textarea.
3. **Dashboard page** — three KPI cards (Total Alumni / Employment Rate / Avg Certifications) computed live by the backend.
4. **Alumni Explorer** — a filterable table of alumni with derived program(s), graduation-date display, latest company/industry, and certifications list.
5. **Charts page** — 6 charts (Bar, Line, Pie, Doughnut, Horizontal Bar, and Radar for geography).
6. **Reports page** — CSV export, multi-page detailed PDF report, filter presets persisted to `localStorage`, downloadable composite chart image, and report sections that include count-plus-percentage breakdowns for job titles and industry.
7. **Defense-in-depth role guard** — alumni accounts cannot access the dashboard; if their session leaks in (e.g. they were also logged in on the EJS site at port 3000), the React app logs them out at three checkpoints.

---

## Tech stack

| Concern | Library | Version |
|---|---|---|
| Framework | React | ^19.2.5 |
| Language | TypeScript | ~6.0.2 |
| Build tool | Vite | ^8.0.10 |
| Routing | react-router-dom | ^7.14.2 |
| HTTP | axios | ^1.15.2 |
| Charts | chart.js + react-chartjs-2 | ^4.5.1 / ^5.3.1 |
| Styling | Tailwind CSS v4 | ^4.2.4 (via `@tailwindcss/vite`) |
| CSV export | papaparse | ^5.5.3 |
| PDF export | jsPDF | ^4.2.1 |
| Composite chart image | manual `canvas.drawImage(...)` (no html2canvas) | — |

> **Why no html2canvas?** Tailwind v4 emits modern `oklch()` colors. `html2canvas@1.4` cannot parse them and silently throws inside its async pipeline. Instead, the chart-image export iterates every `<canvas>` inside `#charts-grid` and paints them onto a master canvas — no CSS parsing, no compatibility surprises.

---

## Project structure

```
frontend/
├── index.html                       ← Vite HTML entrypoint, links to /src/main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts                   ← @vitejs/plugin-react + @tailwindcss/vite
├── README.md                        ← (this file)
├── public/                          ← static assets served at /
└── src/
    ├── main.tsx                     ← ReactDOM.createRoot + <BrowserRouter><App /></BrowserRouter>
    ├── App.tsx                      ← composition root — routing, global session/apiKey/toast state
    ├── index.css                    ← @import "tailwindcss"; + button cursor rules
    │
    ├── types/
    │   └── index.ts                 ← Filters, Summary, SessionUser, ToastState, ChartItem,
    │                                  SkillsItem, ChartsResponse, AlumniRow
    ├── lib/
    │   ├── api.ts                   ← apiBase, getApiErrorMessage, getCsrfHeaders, encodeFilters
    │   ├── constants.ts             ← navLinks, emptyFilters
    │   └── chartjs.ts               ← side-effect: registers Chart.js components used app-wide
    ├── hooks/
    │   └── useAnalytics.ts          ← parallel-fetches summary/charts/alumni with loading + error
    ├── components/
    │   ├── AppShell.tsx             ← sidebar + main layout (used by all dashboard pages)
    │   ├── AuthLayout.tsx           ← centered card layout for auth pages
    │   ├── FiltersBar.tsx           ← filter card with Program / Graduation date / Industry sector + per-page action button
    │   ├── Toast.tsx                ← top-right error toast
    │   └── Protected.tsx            ← role guard — redirects non-developer sessions to /login
    ├── pages/
    │   ├── DashboardPage.tsx        ← KPI cards (Total Alumni / Employment Rate / Avg Certs)
    │   ├── AlumniPage.tsx           ← filterable alumni table
    │   ├── ChartsPage.tsx           ← 6 chart visuals + downloadChartImage
    │   ├── ReportsPage.tsx          ← exports (CSV / PDF) + filter presets + status block
    │   ├── AuthPage.tsx             ← login / forgot-password (+ registration redirect note)
    │   └── ResetWithTokenPage.tsx   ← password reset using ?token from email link
    │
    └── (legacy starter files counter.ts / main.ts / style.css unused — safe to delete)
```

The `dist/` directory is created by `npm run build` and is gitignored.

---

## Application architecture

The app is one rendering tree:

```
<BrowserRouter>
  <App>
    [global state: sessionUser, apiKey, toast]
    [global effect: GET /api/auth/me on mount; logout if alumnus]
    [Routes]
      /                    -> Navigate to /dashboard or /login
      /login               -> AuthPage mode=login
      /register            -> redirect to /login (registration not available in React app)
      /forgot-password     -> AuthPage mode=forgot
      /reset-password/:t   -> ResetWithTokenPage
      /dashboard           -> Protected → DashboardPage
      /alumni              -> Protected → AlumniPage
      /charts              -> Protected → ChartsPage
      /reports             -> Protected → ReportsPage
      *                    -> Navigate to /
```

Inside each `Protected`, an `AppShell` renders:

```
┌────────────────────────────────────────────────────┐
│ AppShell                                           │
│ ┌──────────────┐ ┌─────────────────────────────┐ │
│ │  Sidebar     │ │  <main>                     │ │
│ │  - heading   │ │    page content             │ │
│ │  - email     │ │                             │ │
│ │  - nav links │ │                             │ │
│ │  - logout    │ │                             │ │
│ │  - API key   │ │                             │ │
│ └──────────────┘ └─────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

Toasts are rendered as a top-right fixed div on top of everything when an error message is set in app-level state.

---

## Routing & guards

### `Protected` wrapper

```ts
const Protected = ({ children }) =>
  sessionUser && sessionUser.role !== 'alumnus'
    ? <AppShell ...>{children}</AppShell>
    : <Navigate to="/login" replace />
```

Three layers of alumnus-blocking ensure an alumni session can never view the dashboard:

1. **Login handler** ([pages/AuthPage.tsx](src/pages/AuthPage.tsx)) — after a successful login + `/api/auth/me`, if `role === 'alumnus'` → `POST /api/auth/logout` + throw an error toast.
2. **Mount-time session check** ([App.tsx](src/App.tsx)) — when the app boots and `/api/auth/me` returns an alumni session, immediately log them out and treat as unauthenticated.
3. **`Protected` route component** ([components/Protected.tsx](src/components/Protected.tsx)) — defense in depth; redirects any alumni session back to `/login`.

### Why this matters

The CW1 EJS site and the CW2 React app share the same `User` collection and the same session cookie domain (both run on `localhost`). Without these guards, an alumnus logged into `/profile` at port 3000 could navigate to port 5173 and see the dashboard chrome (the *data* is still gated by API-key scope, but the UI shouldn't render at all).

---

## Authentication flow

All auth endpoints are on the backend's `/api/auth/*`. The React app calls them with `withCredentials: true` so the session cookie is sent.

### Registration policy

Frontend registration is disabled.

- `http://localhost:5173/register` redirects to `/login`
- The login page explicitly points users to `http://localhost:3000/register`
- New accounts (alumnus/developer) must be created from the backend EJS registration page

### Login

```
POST /api/auth/login { email, password }   ← sets session cookie
GET  /api/auth/me                           ← read role
if role === 'alumnus' -> logout + error
else -> setSessionUser + navigate('/dashboard')
```

### Forgot / reset

Forgot password sends an email containing `${CLIENT_ORIGIN}/reset-password/<token>`. The React app's `ResetWithTokenPage` reads the token from the URL and POSTs the new password. Reset emails are issued for any existing account (verified or unverified).

### Verify email

Verification is not handled by the React app. Verification emails link directly to the backend endpoint at `${BASE_URL}/api/auth/verify-email/<token>`.

### CSRF

When the backend has `ENABLE_CSRF=true`, every mutating request needs an `x-csrf-token` header. The helper:

```ts
const getCsrfHeaders = async () => {
  const resp = await axios.get(`${apiBase}/api/csrf-token`, { withCredentials: true })
  if (!resp.data?.csrfEnabled || !resp.data?.csrfToken) return {}
  return { 'x-csrf-token': resp.data.csrfToken }
}
```

is awaited before login / forgot / reset / logout. When CSRF is off the helper returns an empty object.

---

## Pages

### `/dashboard` — Summary KPIs

- Filters card (Program, Graduation date, Industry sector) with inline "Apply Filters" button
- 3 KPI cards: Total Alumni / Employment Rate / Avg Certifications
- Loading + error states inline

KPI shape:

```ts
type Summary = { totalAlumniTracked: number; employmentRate: number; avgCertificationsPerAlumnus: number }
```

### `/alumni` — Alumni Explorer

- Same filters card
- Inline "Apply Filters" button
- Table columns: **Name · Program · Graduation Date · Latest company · Certifications · Industry**
- Program and Certifications render as stacked lines when multiple values exist
- Graduation Date shows either a single `dd/mm/yyyy` value or stacked `Degree title: dd/mm/yyyy` lines when multiple degrees exist
- The derivation/formatting is done **server-side** in `analyticsController.listAlumni` so the React table stays simple

### `/charts` — Trends, Charts and Graphs

- Filters card
- Inline "Apply Filters" button
- "Download Chart Image" button → composes all canvases into one PNG ([pages/ChartsPage.tsx — `downloadChartImage`](src/pages/ChartsPage.tsx))
- 6 chart cards in a 2-column grid, with the geographic radar spanning both columns:

| # | Title | Type | Source field |
|---|---|---|---|
| 1 | Skills Gap Analysis | Bar | `cert.title` (% of alumni), reusing the trend-line color palette by certification label |
| 2 | Certification Trend | Line | Dynamic multi-line series from `certificationTrendSeries` (certification + year) |
| 3 | Employment by Industry Sector | Pie | `employment.industry` |
| 4 | Most Common Job Titles | Doughnut | `employment.jobTitle` |
| 5 | Top Employers | Horizontal Bar | `employment.company` |
| 6 | Geographic Distribution | Radar | `currentCountry` (Location dropdown values) |

Certification Trend implementation details:

- Years are built dynamically from distinct years in `certificationTrendSeries`.
- One dataset is generated per distinct certification name.
- Missing year values per certification are filled with `0`.
- If `alumniTotalsByYear` has totals for all plotted years, y-values are rendered as percentages; otherwise raw counts are rendered.
- Legend is shown at the top and includes every certification line.

### `/reports` — Reports & Exports

- Filters card
- Inline "Apply Filters" button (text changes to "Loading…")
- **Status panel** that shows: loading state, error, or success with row counts (Alumni rows / Skills-gap items / Top employers)
- Export CSV (Papa) — disabled until data loaded
- Export PDF (multi-page jsPDF report — see [Exports](#exports))
- **Filter presets** sub-section:
  - Save current filter values under a name (stored in `localStorage` as `preset:<name>`)
  - Load a preset back into the filter inputs
  - Saved-presets list with Load + Delete buttons
  - Inline confirmation messages for save/load/delete

---

## The `useAnalytics` hook

[hooks/useAnalytics.ts — `useAnalytics(apiKey, filters, onErrorToast?)`](src/hooks/useAnalytics.ts).

A custom hook that owns three pieces of state plus a `fetchAll` action. Every page uses an instance of it.

```ts
const { summary, charts, alumni, loading, error, fetchAll } = useAnalytics(apiKey, filters, onErrorToast)
```

`fetchAll` runs three requests in parallel:

```ts
await Promise.all([
  axios.get('/api/analytics/summary?<filters>',  { headers: { Authorization: `Bearer ${apiKey}` } }),
  axios.get('/api/analytics/charts?<filters>',   { headers: { Authorization: `Bearer ${apiKey}` } }),
  axios.get('/api/analytics/alumni?<filters>',   { headers: { Authorization: `Bearer ${apiKey}` } }),
])
```

If the API key is empty, sets a friendly error and short-circuits. On error, calls `getApiErrorMessage(err)` to extract a clean message from axios's response shape, sets `error`, and toasts it.

---

## API key sidebar input

[components/AppShell.tsx](src/components/AppShell.tsx) sidebar contains a `<textarea>` bound to top-level `apiKey` state. The user pastes their analytics-scoped key once; every page reads it from props.

The key is persisted in `sessionStorage`, so it survives page navigation and refreshes inside the same browser tab but is cleared when the tab is closed. This keeps the auto-loading dashboard flow working without storing the key long-term.

The textarea's placeholder reads: *"Paste key with read:analytics scope"* — this is intentional UX nudge.

---

## Filters (and how they map to backend)

Filters are three inputs aligned with profile fields the EJS form captures:

| Frontend input | Query param | Backend treatment |
|---|---|---|
| Program | `program` | `degrees.$elemMatch.title` regex (degree title, case-insensitive partial) |
| Graduation date | `graduationDate` | `degrees.$elemMatch.completionDate` date-equality match (same UTC day) |
| Industry sector | `industrySector` | `employment.$elemMatch.industry` regex (case-insensitive partial) |

Empty inputs are dropped by `encodeFilters(f)` so they never appear in the URL. Server-side validators reject malformed dates.

---

## Charts

Each chart card in `ChartsPage` directly binds the `ChartsResponse` data to a Chart.js component:

```tsx
<Bar data={{
  labels: charts.skillsGap.map(x => x.label),
  datasets: [{
    label: '% Alumni',
    data: charts.skillsGap.map(x => x.percentage),
    backgroundColor: charts.skillsGap.map((x, i) => skillColors(i, x.severity))
  }]
}} />
```

### Skills Gap color mapping

Bar colors are determined by the certification's percentage of the total alumni pool (e.g. 7 of 10 students = 70%):

```ts
skillGapColor(value: number):
  >= 70%  → '#EF4444'  red     (CRITICAL GAP)
  >= 50%  → '#F97316'  orange  (SIGNIFICANT GAP)
  >= 20%  → '#EAB308'  yellow  (EMERGING GAP)
  < 20%   → '#6B7280'  gray    (MONITOR)
```

The same thresholds are applied in the backend (`analyticsController.js`) when computing the `severity` field, and in the frontend tooltip callback. The backend calculates percentage as `Math.round((certCount / totalAlumni) * 100)`.

All charts use custom tooltip callbacks where needed so hover text can show counts, percentages, severity labels, and the basis for each percentage. The line chart footer notes whether values are percentages or absolute counts.

### Why Geographic Distribution spans both columns

The geographic radar chart has noticeably larger label and ring footprint than the smaller cards. Giving it `md:col-span-2` keeps labels readable and avoids clipping.

---

## Exports

### CSV ([pages/ReportsPage.tsx — `exportCsv`](src/pages/ReportsPage.tsx))

The CSV export contains:

- an `Alumni` section aligned with the Alumni Explorer columns: Name, Program, Graduation Date, Latest Company, Certifications, Industry
- a `Top Employers` section with Alumni Count, Percentage, and Basis
- a `Most Common Job Titles` section with Alumni Count, Percentage, and Basis
- an `Employment by Industry Sector` section with Alumni Count, Percentage, and Basis
- a `Geographic Distribution` section with Alumni Count, Percentage, and Basis
- a `Certification Trend by Year and Certification` section with Year, Certification, Count, Percentage (as % of certifications earned that year), and Basis

The CSV string is built with `Papa.unparse(...)`, converted into a blob, and downloaded as `alumni-report.csv`.

### PDF ([pages/ReportsPage.tsx — `exportPdf`](src/pages/ReportsPage.tsx))

A manually composed multi-page jsPDF report with:

- Title + generation timestamp + active filters
- Summary KPIs
- Alumni table (name / program / graduation date / company / industry) with wrapped cells and row dividers for readability
- Skills Gap (cert title + % + severity)
- Top Employers with count and percentage share
- Most Common Job Titles with count and percentage share
- Employment by Industry Sector with count and percentage share
- Geographic Distribution with count and percentage share
- Certification Trend with year totals and percentage share of that year's certifications
- Page numbers (`Page X of Y`) on every page

Pagination is automatic — sections page-break cleanly via a `newPageIfNeeded()` helper. Sections with empty data are skipped entirely.

### Chart image ([pages/ChartsPage.tsx — `downloadChartImage`](src/pages/ChartsPage.tsx))

```
querySelectorAll('#charts-grid canvas')
  → composite onto a 2-column master canvas
  → for each: paint title text, then drawImage(chartCanvas)
  → master.toDataURL('image/png') → download as charts-dashboard.png
```

This deliberately avoids html2canvas because of the Tailwind v4 oklch incompatibility documented above. Each Chart.js chart is *already* a `<canvas>`, so we get high-fidelity export with zero CSS interpretation.

---

## Filter presets

Stored in `localStorage` under keys of the form `preset:<name>`. The value is `JSON.stringify(filters)`. The Reports page exposes:

- **Save**: `localStorage.setItem('preset:<name>', JSON.stringify(filters))` — refuses empty name
- **Load**: reads back, merges with `emptyFilters` (so older presets without newer keys still work)
- **Delete**: removes the key
- **List**: scans every `localStorage.key(i)` starting with `preset:` and renders them as a list with Load + Delete buttons

`localStorage` is per-origin — presets saved on `localhost:5173` survive refresh and are isolated from any other site.

---

## Styling notes

### Tailwind v4 with `@tailwindcss/vite`

`vite.config.ts` includes `@tailwindcss/vite()`. The single-line `@import "tailwindcss";` in [`src/index.css`](src/index.css) pulls in the v4 preflight + utilities.


## Environment variables

Optional `.env` in `frontend/`:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE` | Backend base URL — set if the backend isn't on `localhost:3000` | `http://localhost:3000` |

Vite only exposes `VITE_*` variables to client code. Anything else (DB URLs, server secrets) cannot leak into the bundle.

---

## Setup, run & build

### Install

```bash
cd frontend
npm install
```

### Develop

```bash
npm run dev
```

Vite serves the app on [http://localhost:5173](http://localhost:5173) with HMR. Make sure the backend is running on the URL referenced by `VITE_API_BASE` (or its default of `http://localhost:3000`), and that `CLIENT_ORIGIN` on the backend matches `http://localhost:5173`.

### Type-check + build

```bash
npm run build
```

Pipeline: `tsc && vite build`. Output goes to `dist/`. Strict TypeScript — unused imports / variables fail the build.

### Preview production build

```bash
npm run preview
```

Serves the `dist/` bundle locally (defaults to port 4173) for sanity-checking the production build before deployment.

### Deploy

`dist/` is a fully static SPA — drop it onto any static host (Netlify, Vercel, Cloudflare Pages, S3, Nginx). Make sure the host rewrites all unknown routes to `/index.html` so client-side routing works.

---

## Dependencies

Listed verbatim from [`package.json`](package.json):

### Runtime

| Package | Why |
|---|---|
| `react` | UI library |
| `react-dom` | DOM bindings |
| `react-router-dom` | Routing + `Navigate` + URL params |
| `axios` | HTTP — better default ergonomics than `fetch` for credentials + JSON |
| `chart.js` | Chart engine |
| `react-chartjs-2` | React wrapper for Chart.js |
| `papaparse` | CSV stringification |
| `jspdf` | PDF generation |
| `html2canvas` | (legacy — kept in dependencies but no longer imported in code; safe to remove on next prune) |

### Dev

| Package | Why |
|---|---|
| `@vitejs/plugin-react` | Vite React HMR + JSX |
| `vite` | Dev server + build |
| `typescript` | Type system |
| `@types/react`, `@types/react-dom`, `@types/papaparse` | Type definitions |
| `tailwindcss`, `@tailwindcss/vite` | Tailwind v4 build pipeline |

---

## Design decisions worth defending in viva

| Decision | Justification |
|---|---|
| Folder split (App.tsx + pages/ + components/ + hooks/ + lib/ + types/) | Standard React layout — one concern per file. `App.tsx` stays thin (routing + global state); each page, component, hook, and helper lives in its own file with explicit imports. |
| Hardcoded `role: 'developer'` on register | The React app is for developer/analyst users; alumni register on the EJS site. Cross-role registration would confuse the audit story. |
| Three layers of alumni blocking | "Defense in depth" — even if the backend session check returns an alumni user (e.g. shared cookie with the EJS site), the dashboard still bounces them at three points. |
| Filters aligned to sub-array fields, with geography from captured root field | The dashboard filters are anchored to high-signal sub-arrays (certifications, courses, employment). `currentCountry` is now captured as a fixed Location dropdown and is used for Geographic Distribution. |
| Manual canvas composition for chart image | Tailwind v4 emits `oklch()` colors that `html2canvas@1.4` can't parse. Painting `<canvas>` elements directly bypasses CSS interpretation entirely and works with any Tailwind version. |
| `localStorage` only for presets, not API key | Demo safety — paste key, use, close tab, gone. No persistent token to risk leaking. |
| Manual jsPDF layout (no jspdf-autotable) | One fewer dependency. The report is structured but uses simple positioned text — easy to read in code review. |
| 6 charts (Bar / Line / Pie / Doughnut / HBar / Radar) | Meets the rubric's 6–8 chart-types requirement. Each chart binds to a different aggregation, no two charts show the same data twice. |
| Reports page status panel | Without it, "Load Report Data" looks like a no-op when 0 rows match. The status panel makes success / failure / empty all visible. |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Insufficient API key scope for this endpoint` toast | Pasted key has only `read:alumni_of_day` (default if generated via legacy EJS UI) | Generate a key via the **Analytics Dashboard** preset on `/developer`, or with `scopes: ["read:alumni","read:analytics"]` in Swagger |
| Logged in but immediately bounced to `/login` | Session is for an alumni account | Log in with a developer account |
| Reports page button does nothing | Old build cached by Vite | Hard reload (Ctrl+Shift+R) |
| Charts page shows empty pies/polar/radars | Source sub-array fields aren't filled in for any alumnus | On EJS `/profile`, ensure certifications have `issuingBody`, courses have `provider`, degrees have `institution`, certs have `completionDate` |
| `Download Chart Image` does nothing | Old build with html2canvas | Hard reload — current code uses canvas composition |
| Cookies not sent — `Not logged in` despite logged in | `CLIENT_ORIGIN` on backend doesn't match React's URL | Set backend `.env`: `CLIENT_ORIGIN=http://localhost:5173` and restart |
| Type errors in `npm run build` about unused imports | Strict TS rules | Remove the unused import |
| `EBADCSRFTOKEN` on login | Backend has `ENABLE_CSRF=true` and the React app didn't fetch the token | The app does fetch it via `getCsrfHeaders()` — if it's still failing, check the network tab to see if `/api/csrf-token` returned `csrfEnabled: true` |
| Cert filter "AWS" shows 100% in skills gap | Filter pre-selects only AWS-cert-holders → tautology | Clear the certification filter to see the real distribution across the cohort |

---

## Performance & User Experience Notes

### Parallel Data Fetching

The `useAnalytics` hook fires three HTTP requests in parallel:

```ts
await Promise.all([
  axios.get('/api/analytics/summary?<filters>'),
  axios.get('/api/analytics/charts?<filters>'),
  axios.get('/api/analytics/alumni?<filters>'),
])
```

Benefit: If each request takes ~200ms, parallel execution loads dashboard in ~200ms total (not 600ms sequential). Users perceive the analytics dashboard as responsive even on slower networks.

### Responsive Chart Sizing

- Charts auto-detect viewport width via `window.matchMedia('(max-width: 767px)')`
- Tablet/mobile: compact legend, smaller font, rotated x-axis labels (18°)
- Desktop: legend on right, full-size fonts, horizontal labels
- Each chart has an **Expand** button that opens a modal with extra padding for dense legends (Certification Trend has 20+ lines)

### Server-Side Derivations Reduce Frontend Logic

The backend's `analyticsController.listAlumni()` returns pre-computed fields:
- `programs[]` — all degree titles from the alumnus's profile
- `graduationDateDisplay` — formatted `dd/mm/yyyy` or `null`
- `latestCompany` / `latestIndustry` — sorted by most recent employment
- `certifications[]` — all cert titles (flattened)

This lets the React **Alumni Explorer** render a simple table without date sorting, deduplication, or array manipulation logic.

### Export Consistency

**CSV, PDF, and chart tooltips all use the same `formatShare()` function**. If a chart shows "AWS: 35 alumni (23.3%)", the PDF export shows the same percentage, not a slightly different value. This consistency is critical for stakeholder trust in the data.

### Why localStorage for Filter Presets

- Presets stored under `localStorage.setItem('preset:<name>', JSON.stringify(filters))`
- Survives page refresh (user can close and reopen the dashboard with same filters)
- Cleared when the browser tab is closed (no persistent cross-session state)
- Per-origin isolation (presets saved on `localhost:5173` don't leak to other sites)
- Zero backend load — no database writes for preset management

### Bundle Size & Vite Advantage

- **Vite** offers faster dev-server startup than Create React App (HMR kicks in ~100ms vs. 1000ms CRA)
- **chart.js** is small (~40 KB) vs. recharts or visx
- **papaparse** for CSV is minimal (~10 KB) — jsPDF is ~200 KB but only loaded on Reports page
- Production bundle optimized by Vite's built-in tree-shaking and minification

---

## CW2 rubric mapping

See [the root README](../README.md#cw2-rubric-mapping) for the rubric line-item → implementation table.
