# Project Notes

## Architecture

React 19 frontend + Express/TypeScript backend (`server/`) + Supabase (PostgreSQL, Auth, Storage).
Routing: React Router v6 with HashRouter. Hosted on Vercel (frontend) and Render (backend).

Auth (signIn, signOut, password reset) stays on the **frontend** via the Supabase SDK. All data operations (CRUD on profiles, checklist, submissions, documents, file storage) go through the **Express backend**.

## Server (`server/`)

- Express app on port 3001, uses Supabase **service role key** (bypasses RLS; authorization enforced in middleware)
- Entry: `server/src/index.ts`
- Config: `server/src/config.ts` (creates `supabaseAdmin` client + `pg` Pool for direct PostgreSQL access)
- Middleware: `auth.ts` (requireAuth, optionalAuth — JWT verify via `supabaseAdmin.auth.getUser()`, both with try-catch), `adminOnly.ts` (checks `profile.role === 'admin'`), `investorOnly.ts` (checks investor role + active subscription, with try-catch), `errorHandler.ts` (handles multer 413, JSON parse 400, generic 500), `asyncHandler.ts` (wraps async route handlers to forward errors to Express error handler)
- Routes:
  - `/api/profile` — GET own, GET /:id (admin)
  - `/api/checklist` — GET own, PUT upsert, GET /:userId (admin)
  - `/api/submissions` — GET (own or all if admin), POST (optional auth), PATCH /:id (admin)
  - `/api/documents` — GET own, POST /upload (multer 10MB), DELETE /:id, GET /:id/download, GET /user/:userId (admin), PATCH /:id (admin)
  - `/api/admin` — GET /stats, /clients, /clients/:id, /documents, /properties (CRUD), /properties/csv-upload, /investors, /csv-uploads
  - `/api/investor` — GET /properties (search/filter/paginate), /properties/:id, /stats, /subscription
  - `/api/stripe` — POST /create-checkout, /webhook (raw body), /portal
- Dependencies: express, cors, helmet, multer, @supabase/supabase-js, dotenv, stripe, csv-parse, pg
- Dev: tsx (watch mode), typescript
- Stripe webhook registered BEFORE `express.json()` middleware for raw body access
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
- `DATABASE_URL` env var in `server/.env` for direct PostgreSQL access via `pg` Pool
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

1. Create `server/.env` from `server/.env.example` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `FRONTEND_URL`
2. Run SQL migration: `server/migrations/001_investor_portal.sql` in Supabase SQL Editor
3. `cd server && npm install && npm run dev` (Express on port 3001)
4. `npm run dev` (Vite frontend with proxy)

## Environment Files

- `.env.local` — frontend Supabase URL + anon key (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `server/.env` — backend Supabase URL + service role key + DATABASE_URL + PORT + Stripe keys (gitignored)

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

## In Progress

- Direct PostgreSQL connection via `pg` Pool added to `server/src/config.ts` — connection verified and working
- `pg` package added to `server/package.json`, Pool exported from config
- `DATABASE_URL` uses the session mode pooler (`aws-1-us-east-1.pooler.supabase.com:5432`)
- **Unknown**: the original purpose/task for adding direct `pg` access was lost due to a restart. The Pool is set up and connected but not yet used by any routes. The user does not recall the original intent. Next step: decide what to use it for or remove it if unnecessary.
