# Project Notes

## Architecture

React 19 frontend + Express/TypeScript backend (`server/`) + Supabase (PostgreSQL, Auth, Storage).
Routing: React Router v6 with HashRouter. Hosted on Vercel (frontend) and Render (backend).

Auth (signIn, signOut, password reset) stays on the **frontend** via the Supabase SDK. All data operations (CRUD on profiles, checklist, submissions, documents, file storage) go through the **Express backend**.

## Server (`server/`)

- Express app on port 3001, uses Supabase **service role key** (bypasses RLS; authorization enforced in middleware)
- Entry: `server/src/index.ts`
- Config: `server/src/config.ts` (creates the `supabaseAdmin` client; the old `pg` Pool was removed)
- Middleware: `auth.ts` (requireAuth, optionalAuth — JWT verify via `supabaseAdmin.auth.getUser()`, both with try-catch), `adminOnly.ts` (checks `profile.role === 'admin'`), `investorOnly.ts` (checks investor role + active subscription, with try-catch), `errorHandler.ts` (handles multer 413, JSON parse 400, generic 500), `asyncHandler.ts` (wraps async route handlers to forward errors to Express error handler)
- Routes:
  - `/api/profile` — GET own, GET /:id (admin)
  - `/api/checklist` — GET own, PUT upsert, GET /:userId (admin)
  - `/api/submissions` — GET (own or all if admin), POST (optional auth), PATCH /:id (admin)
  - `/api/documents` — GET own, POST /upload (multer 10MB), DELETE /:id, GET /:id/download, GET /user/:userId (admin), PATCH /:id (admin)
  - `/api/admin` — GET /stats, /clients, /clients/:id (clients + investors; admins 404), /documents, /properties (CRUD incl. GET /properties/:id for the edit form), /properties/csv-upload, /investors, /csv-uploads
  - `/api/investor` — GET /properties (search/filter/paginate), /properties/:id, /stats, /subscription
  - `/api/stripe` — POST /create-checkout, /webhook (raw body), /portal
- Dependencies: express, cors, helmet, multer, @supabase/supabase-js, dotenv, stripe, csv-parse, express-rate-limit
- Dev: tsx (watch mode), typescript
- Stripe webhook: `app.use('/api/stripe/webhook', express.raw(...))` in `index.ts` BEFORE `express.json()` — a router-level `express.raw()` alone does NOT work (json parses first, raw skips, signature check fails). Verified with a signed test event 2026-09-24
- Stripe client created lazily via `getStripe()` so a missing `STRIPE_SECRET_KEY` only breaks Stripe routes, not server startup
- Rate limiting (`express-rate-limit`): global 200 req/15min (skips the Stripe webhook) + submission limiter in `submissions.ts`. `app.set('trust proxy', 1)` so `req.ip` is the real client behind Render's proxy — **verify on Render that req.ip differs per client** (adjust the hop count if all requests share one IP)
- `auth.ts` caches roles for 30s; call `invalidateRoleCache(userId)` after any `profiles.role` change (the Stripe webhook does). Failed profile lookups are not cached
- Security: `helmet()` for security headers, CORS restricted to `FRONTEND_URL`, `express.json({ limit: '1mb' })` body size limit
- All route handlers wrapped with `asyncHandler` for consistent error forwarding
- Error responses sanitized — no raw DB/Supabase error messages sent to clients (logged server-side via `console.error`)
- Document uploads: MIME type whitelist (PDF, images, Word, Excel, CSV, plain text) + filename sanitization
- Property routes: field whitelist on create/update (no `req.body` spreading), sort column whitelist, pagination bounds-checking
- Investor routes: sort column whitelist, `isNaN` guard on equity filter parseFloat, pagination bounds-checking
- Submissions: input validation (string length limits, basic email format, phone length)
- Checklist: type validation (numbers/boolean) + bounds checking on index values
- Stripe webhook: DB operations wrapped in try-catch (still returns 200 to Stripe), `as any` replaced with `SubscriptionWithPeriod` interface, logs missing `userId` in metadata
- SSL config: `rejectUnauthorized: true` in production, `false` in dev (based on `NODE_ENV`)

## Frontend API Layer

- `src/lib/api.ts` — centralized fetch wrapper: `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `apiUpload`
- Auto-attaches `Authorization: Bearer <token>` from Supabase session
- Base URL from `VITE_API_URL` env var (defaults to `/api` for dev proxy)
- Vite dev proxy in `vite.config.ts`: `/api` → `http://localhost:3001`

## Database

- Supabase project: `gfeeiyjhjapysiqxwiqi.supabase.co`
- Direct DB host (`db.gfeeiyjhjapysiqxwiqi.supabase.co`) is IPv6-only; use the Supabase connection pooler (`aws-1-us-east-1.pooler.supabase.com:5432`) for environments without IPv6
- `DATABASE_URL` is no longer used by the code (pg Pool removed); removed from `server/.env` 2026-09-24 — still needs deleting from Render's env vars (user's step)
- Tables: `profiles`, `contact_submissions`, `documents`, `checklist_progress`, `distressed_properties`, `investor_subscriptions`, `csv_uploads`
- Storage bucket: `client-documents`
- DB trigger `handle_new_user` auto-creates profiles on signup (role defaults to 'client'; admins must be promoted manually via DB update)
- Types defined in `src/lib/supabase.ts` (frontend) and `server/src/types.ts` (backend)
- Migration: `server/migrations/001_investor_portal.sql` (run in Supabase SQL Editor)
- Profile roles: `'client' | 'admin' | 'investor'`

## Investor Portal

- Subscription-gated portal for paid investors to search distressed property data
- Data types: foreclosure NOD, foreclosure NOT, probate, tax lien, tax sale
- Counties: Los Angeles, Orange, Riverside, San Bernardino, San Diego, Ventura
- Admin uploads data via CSV or manual entry
- Stripe handles subscriptions (checkout, webhook, billing portal)
- Webhook auto-promotes user role to 'investor' on successful checkout, reverts to 'client' on cancellation

## Migrated Files (use API instead of direct Supabase)

- Hooks: `useChecklist.ts`, `useSubmissions.ts`, `useDocuments.ts`, `useProperties.ts`, `useSubscription.ts`
- Admin components: `AdminDashboard.tsx`, `ClientList.tsx`, `ClientDetail.tsx`, `DocumentsReview.tsx`, `SubmissionsList.tsx`, `PropertyManager.tsx`, `PropertyForm.tsx`, `CsvUpload.tsx`, `InvestorList.tsx`
- Investor components: `InvestorDashboard.tsx`, `PropertySearch.tsx`, `PropertyDetail.tsx`, `PropertyFilters.tsx`, `PropertyTable.tsx`, `SubscriptionStatus.tsx`
- `AuthContext.tsx`: `fetchProfile` uses `apiGet('/profile')`, signUp removed manual `profiles.insert()` (relies on DB trigger)
- Portal: `DocumentUpload.tsx` updated for new `getDownloadUrl(filePath, documentId)` signature

## Files that still use Supabase SDK directly (intentionally)

- `src/contexts/AuthContext.tsx` — auth methods (signIn, signOut, signUp, resetPassword, updatePassword)
- `src/lib/api.ts` — reads session token via `supabase.auth.getSession()`
- `src/lib/supabase.ts` — creates the frontend Supabase client + exports type definitions

## Key Frontend Files

- `src/App.tsx` — routes (/, /login, /signup, /forgot-password, /reset-password, /portal/*, /admin/*, /investor/subscribe, /investor/*)
- `src/main.tsx` — HashRouter + AuthProvider
- `src/contexts/AuthContext.tsx` — auth state, profile, session, isAdmin, isInvestor flags
- `src/hooks/useAuth.ts` — re-exports `useAuth` from AuthContext
- `src/lib/constants.ts` — checklistData (5 categories), faqData, optionsData, situationOptions, resourcesData
- `src/components/layout/ProtectedRoute.tsx` — auth guard with optional `requireAdmin` and `requireInvestor` props
- `src/pages/InvestorPage.tsx` — investor portal container (Dashboard, Search, Property Detail, Subscription)
- `src/pages/InvestorSubscribePage.tsx` — subscription checkout page

## Running Locally

1. Create `server/.env` from `server/.env.example` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `FRONTEND_URL`
2. Run SQL migration: `server/migrations/001_investor_portal.sql` in Supabase SQL Editor
3. `cd server && npm install && npm run dev` (Express on port 3001)
4. `npm run dev` (Vite frontend with proxy)

## Environment Files

- `.env.local` — frontend Supabase URL + anon key (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `server/.env` — backend Supabase URL + service role key + PORT + Stripe keys (gitignored)

## Deployment

- **Frontend**: Vercel — auto-deploys from `master` branch, repo `HighviewOne/sonderbe`
  - Env vars: `VITE_API_URL` = `https://sonderbe.onrender.com/api`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Note: `VITE_` env vars are baked in at build time — must redeploy after changing them
  - Vercel project was recreated (old one was connected to wrong repo); domain `sonderbe.vercel.app` reassigned
- **Backend**: Render Web Service — `https://sonderbe.onrender.com`
  - Repo: `HighviewOne/sonderbe`, root directory: `server`
  - Build: `npm install --include=dev && npm run build` (must include dev deps for TypeScript/@types), Start: `npm start`
  - Env vars: `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `FRONTEND_URL=https://sonderbe.vercel.app`
  - CORS configured via `FRONTEND_URL` env var
  - Render uses port from `PORT` env var (auto-assigned, currently 10000)
- **Stripe webhook**: `https://sonderbe.onrender.com/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Signing secret stored as `STRIPE_WEBHOOK_SECRET` in Render env vars

## Status (assessed 2026-06-12, updated 2026-09-24)

- **Supabase project `gfeeiyjhjapysiqxwiqi` is gone** — DNS returns NXDOMAIN (free-tier project paused/removed after ~4.5 months of inactivity since Jan 30, 2026). This is why "the database stopped working." Full rebuild is possible: base schema in `supabase/schema.sql` (profiles, contact_submissions, checklist_progress, documents, storage bucket, RLS, triggers incl. `handle_new_user`) + `server/migrations/001_investor_portal.sql` (investor tables). After creating a new project, update Supabase URL/keys in `.env.local`, `server/.env`, Render env vars, and Vercel env vars (then redeploy frontend — VITE_ vars are build-time).
- **Stripe checkout bug found and fixed in `server/.env`**: `STRIPE_PRICE_ID` was set to a product ID (`prod_Tsu6EoAt319qUL`) instead of a price ID — Stripe checkout rejects product IDs, so every checkout failed. Corrected to `price_1Sv8I9Hdn9u1Gfdher0BRAId` ($0/month test price on that product). The same wrong value is likely still in Render's `STRIPE_PRICE_ID` env var — fix there too.
- Render backend (`sonderbe.onrender.com`) and Vercel frontend both still deployed and responding (Render free tier cold-starts ~20s).
- Frontend typecheck and server build both pass.
- **Branch `hardening-and-review-fixes` (2026-09-24, local, not pushed/merged)** holds all post-January work: `95e56a1` security/robustness hardening (in-memory token store via `src/lib/tokenStore.ts`, role caching, rate limiting, field whitelists, hash-router reset-password redirect) + review fixes; `ea03997` CI, lint cleanup, dependency updates. `master` (last commit Jan 30) is what's deployed — merging auto-deploys both Vercel and Render, so merge after the Supabase rebuild and test together.
- **Code review 2026-09-24** of that batch found 10 issues; 8 fixed (committed on the branch above): Stripe webhook raw-body regression, rate limiters keyed on Render proxy IP, stale role cache after checkout, AuthContext 5s timeout rendering user-without-profile during Render cold starts, eager Stripe init crashing server, admin client detail 404 for investors, PropertyForm edit loading blank (UUID sent as `search`) and able to overwrite data, signOut not clearing state on error.
  - Still open: (7) reset-password redirect `/#/reset-password` may collide with Supabase's implicit-flow `#access_token` fragment — test with a real reset email once Supabase is rebuilt; (10) `investor.ts` /stats only checks the total count's error, per-type count failures silently show 0.
- **CI** (`.github/workflows/ci.yml`, added 2026-09-24): on PRs and pushes to master runs `npm run lint` (root ESLint config covers `src/` and `server/src/`), frontend build (`tsc -b && vite build`), server build. Lint was cleaned to zero errors.
  - ESLint uses `eslint-plugin-react-hooks` v7 compiler rules: `set-state-in-effect` flags synchronous setState in effects, including inside `async` functions/useCallbacks called from an effect. Pattern used: effects call a non-async fetch that sets state only in `.then/.finally`; initial `loading` is `true`; separate `reload`/`retry` functions do the `setLoading(true)`.
- **Dependencies** (2026-09-24): `npm audit fix` in both packages + `csv-parse` 6→7 (server has 0 vulns). Remaining frontend moderates need majors, deliberately deferred: `react-router-dom` 6→7 (open-redirect advisory) and `vite` 8 (esbuild dev-server advisory, dev-only).
- The `pg` Pool and package are removed (2026-09-24).
- `supabase/config.toml` exists from `supabase init` (local dev was being set up); supabase CLI is not installed, Docker is available.
- **Fixed**: `supabase.auth.getSession()` deadlocks in Supabase v2 when used alongside `onAuthStateChange`. Two fixes applied:
  - `AuthContext.tsx`: replaced `getSession()` + `onAuthStateChange` with `onAuthStateChange`-only initialization (Supabase v2 fires `INITIAL_SESSION` event automatically). The handler clears the 5s fallback timeout as soon as any auth event fires, so `loading` stays true until the profile fetch finishes (don't let route guards see a user with a null profile during Render cold starts)
  - `api.ts`: replaced `getAuthHeaders()` calling `supabase.auth.getSession()` — now superseded: auth headers come from the in-memory `src/lib/tokenStore.ts`, which `AuthContext` fills from `onAuthStateChange`. No longer imports `supabase` client.
- **Deployment verified**: Frontend (Vercel) + Backend (Render) fully working end-to-end — auth, portal dashboard, API calls all functional
- **Next steps (2026-09-24):** (1) user rebuilds Supabase project + runs `supabase/schema.sql` and `server/migrations/001_investor_portal.sql`, then update keys in `.env.local`, `server/.env`, Render, Vercel; fix Render `STRIPE_PRICE_ID`; (2) merge the branch, verify on Render (per-client `req.ip`, checkout → investor promotion, property edit, investor client detail); (3) open items 7 and 10; (4) prevent another free-tier pause/deletion (paid plan or a keep-alive ping from cron/hamptonserver).
- Untracked in repo root: three June 2026 foreclosure research/timeline docs (`2026-06-1*-*.md/.html`) and `supabase/config.toml` + `.gitignore` — the user hasn't decided where they belong.
