# Project Notes

## Architecture

React 19 frontend + Express/TypeScript backend (`server/`) + Supabase (PostgreSQL, Auth, Storage).
Routing: React Router v6 with HashRouter. Hosted on Vercel (frontend).

Auth (signIn, signOut, password reset) stays on the **frontend** via the Supabase SDK. All data operations (CRUD on profiles, checklist, submissions, documents, file storage) go through the **Express backend**.

## Server (`server/`)

- Express app on port 3001, uses Supabase **service role key** (bypasses RLS; authorization enforced in middleware)
- Entry: `server/src/index.ts`
- Config: `server/src/config.ts` (creates `supabaseAdmin` client)
- Middleware: `auth.ts` (requireAuth, optionalAuth — JWT verify via `supabaseAdmin.auth.getUser()`), `adminOnly.ts` (checks `profile.role === 'admin'`), `errorHandler.ts`
- Routes:
  - `/api/profile` — GET own, GET /:id (admin)
  - `/api/checklist` — GET own, PUT upsert, GET /:userId (admin)
  - `/api/submissions` — GET (own or all if admin), POST (optional auth), PATCH /:id (admin)
  - `/api/documents` — GET own, POST /upload (multer 10MB), DELETE /:id, GET /:id/download, GET /user/:userId (admin), PATCH /:id (admin)
  - `/api/admin` — GET /stats, /clients, /clients/:id, /documents
- Dependencies: express, cors, multer, @supabase/supabase-js, dotenv
- Dev: tsx (watch mode), typescript
- All endpoints tested and verified working (auth, client CRUD, admin CRUD, file upload/download/delete)

## Frontend API Layer

- `src/lib/api.ts` — centralized fetch wrapper: `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `apiUpload`
- Auto-attaches `Authorization: Bearer <token>` from Supabase session
- Base URL from `VITE_API_URL` env var (defaults to `/api` for dev proxy)
- Vite dev proxy in `vite.config.ts`: `/api` → `http://localhost:3001`

## Database

- Supabase project: `gfeeiyjhjapysiqxwiqi.supabase.co`
- Tables: `profiles`, `contact_submissions`, `documents`, `checklist_progress`
- Storage bucket: `client-documents`
- DB trigger `handle_new_user` auto-creates profiles on signup (role defaults to 'client'; admins must be promoted manually via DB update)
- Types defined in `src/lib/supabase.ts` (frontend) and `server/src/types.ts` (backend)

## Migrated Files (use API instead of direct Supabase)

- Hooks: `useChecklist.ts`, `useSubmissions.ts`, `useDocuments.ts`
- Admin components: `AdminDashboard.tsx`, `ClientList.tsx`, `ClientDetail.tsx`, `DocumentsReview.tsx`, `SubmissionsList.tsx`
- `AuthContext.tsx`: `fetchProfile` uses `apiGet('/profile')`, signUp removed manual `profiles.insert()` (relies on DB trigger)
- Portal: `DocumentUpload.tsx` updated for new `getDownloadUrl(filePath, documentId)` signature

## Files that still use Supabase SDK directly (intentionally)

- `src/contexts/AuthContext.tsx` — auth methods (signIn, signOut, signUp, resetPassword, updatePassword)
- `src/lib/api.ts` — reads session token via `supabase.auth.getSession()`
- `src/lib/supabase.ts` — creates the frontend Supabase client + exports type definitions

## Key Frontend Files

- `src/App.tsx` — routes (/, /login, /signup, /forgot-password, /reset-password, /portal/*, /admin/*)
- `src/main.tsx` — HashRouter + AuthProvider
- `src/contexts/AuthContext.tsx` — auth state, profile, session, isAdmin flag
- `src/hooks/useAuth.ts` — re-exports `useAuth` from AuthContext
- `src/lib/constants.ts` — checklistData (5 categories), faqData, optionsData, situationOptions, resourcesData
- `src/components/layout/ProtectedRoute.tsx` — auth guard with optional `requireAdmin` prop

## Running Locally

1. Create `server/.env` from `server/.env.example` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. `cd server && npm install && npm run dev` (Express on port 3001)
3. `npm run dev` (Vite frontend with proxy)

## Environment Files

- `.env.local` — frontend Supabase URL + anon key (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `server/.env` — backend Supabase URL + service role key + PORT (gitignored)
