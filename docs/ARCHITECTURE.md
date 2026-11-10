# Architecture & API Conventions

Next.js App Router app with Supabase. Postgres is the source of truth for businesses, CRM records, bookings, and files. The browser keeps only the active account id (`hph-active-account`), plus device-local reaction counts, saved-business ids, and partner links that do not have a server table yet.

## Layout

- **UI**: `app/[locale]/**` for the public site, CRM, booking, and ProBot. `app/admin/**` is the operator console.
- **API**: `app/api/**` route handlers (JSON and multipart).
- **Auth and CSRF**: `lib/middleware/auth.ts` (`requireAuth`) reads the JSON body and checks the session plus `X-CSRF-Token`. `lib/middleware/requireRole.ts` checks `user_roles`. `lib/middleware/rateLimit.ts` covers public and auth routes.
- **Clients**:
  - `createClient()` in `lib/supabase/server.ts` uses the cookie session and **enforces RLS**.
  - `createServiceRoleClient()` bypasses RLS and stays on the server.

## Account roles vs CRM contact roles

`user_roles.role` is the account: `customer`, `contractor`, `realtor`, or `installer`. The installer account is the person who applies to ProJobs and keeps a ProResume. It is separate from CRM contact roles.

CRM contact roles live in `pro_crm_roles` and are labels on a pro's customers (customer, subcontractor, and any custom roles). Migration 104 removes the builtin contact slug `installer`. Until that migration is on the database, the customer UI still skips `slug !== 'installer'`. A contact who installs work is a subcontractor.

## Businesses

`businesses` plus `addresses` are the business record. Reads and writes go through `/api/businesses`, `/api/business/create`, and `/api/me/businesses/list`. Do not mirror a business into `localStorage`. A failed profile load shows an error, not a cached card.

Image replacement stays upload, then update the row, then best-effort delete the old object. Buckets include `profile-pictures`, `business-logos`, and `business-backgrounds`.

## Two product catalogs

These are different databases and stay separate:

- **Public paver catalog** (`lib/products`): brands, variants, and specs shown on Pro Products. Admin edits go through `/api/admin/products`.
- **Pro sellable catalog** (`lib/crm/catalog-db.ts`): the services and products a contractor puts on estimates and invoices. Routes live under `/api/crm/services`, `/api/crm/products`, and `/api/crm/items`.

## CRM

Contractor CRM is `/[locale]/crm/**` and `/api/crm/**`. Lists for projects, expenses, and invoices share `hooks/useCrmListQuery.ts` (page, sort, debounced search). Customers and estimates keep their own screens because of the map and the document form.

Invoice create and edit share `components/invoices/InvoiceEditor.tsx`. Each page still loads and saves on its own: create POSTs `/api/crm/invoices`, edit PATCHes `/api/crm/invoices/[id]`.

## Booking

Public booking is `/book/[slug]` and `/api/booking`. Customers manage a visit at `/appointments/[token]`. Pros manage the same visits from the CRM calendar and `/api/crm/bookings`. Slot rules live in `lib/booking`.

## ProDrive and billing

ProDrive files and folders are `/api/prodrive/**` with quota checks in `lib/drive`. Stripe subscriptions and drive overage are `/api/billing/**` and `/api/stripe/webhook`. Usage reporting is the cron route `/api/cron/report-prodrive-usage`.

## API security (by door)

- **Public**: `GET /api/businesses`, `GET /api/businesses/[id]`, `GET /api/health`, auth login/signup/callback/password routes, `POST /api/estimate`, and agent discovery (`/llms.txt`, `/api/openapi.json`, `/.well-known/mcp/server-card.json`, `/.well-known/api-catalog`). Rate-limit these.
- **Agent** (Bearer key, no CSRF cookie): `/api/agent/v1/pros`, `/api/agent/v1/categories`, `/api/agent/v1/estimates`, `POST /api/mcp`. Keys live in `agent_apps`. Estimates from this door set `source = agent`.
- **Session + CSRF** for JSON mutations: profile, addresses, business create/update/delete, and the same pattern on newer JSON routes that call `requireAuth`.
- **Uploads**: authenticate inside the handler. Do not wrap them in `requireAuth`, because that middleware reads a JSON body. Check file size, magic bytes, and ownership.
- **Admin** (`ADMIN_EMAIL`): `/api/admin/**`.
- **Webhooks**: `POST /api/webhooks/email` and `POST /api/stripe/webhook` verify a signature or API key.

## Errors and types

Prefer `lib/utils/errorHandler.ts` (`handleError`, `withErrorHandler`) and `lib/utils/logger.ts` on the server. Route `error.tsx` files and `components/ErrorBoundary.tsx` report exceptions through `lib/monitoring/sentry.ts`.

`lib/types/supabase.ts` is the database type the app compiles against. It is still maintained by hand. Generating it from the linked production project (`pnwsavbxhbwhwyefccih`) succeeds, but that schema is behind this repo: the generated `pro_estimate_bookings` row has no `visit_street`, and `businesses` has no `images`. Swapping the file in fails `tsc` across CRM and booking. Regenerate only after those migrations are on the linked project, then keep the row aliases at the bottom of the file (`Profile`, `Business`, `ProCrmInvoice`, and the rest).

```bash
npx supabase gen types --lang typescript --schema public --remote=<project-id>
```
