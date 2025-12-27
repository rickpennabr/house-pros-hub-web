# Architecture & API Conventions

This document describes the backend conventions used in this repo (Next.js App Router + Supabase).

## Architecture Overview

- **UI**: `app/[locale]/**` pages/components
- **API**: `app/api/**` route handlers (JSON + multipart)
- **Middleware**:
  - Auth + CSRF for JSON state changes: `lib/middleware/auth.ts` (`requireAuth`)
  - Role checks: `lib/middleware/requireRole.ts` (`requireRole`)
  - Rate limiting: `lib/middleware/rateLimit.ts`
- **Data**:
  - Supabase Postgres (RLS): `profiles`, `user_roles`, `addresses`, `businesses`, `licenses`, `csrf_tokens`
  - Supabase Storage buckets:
    - `profile-pictures`
    - `business-logos`
    - `business-backgrounds`

## Supabase Clients (important)

- **User-scoped server client**: `createClient()` from `lib/supabase/server.ts`
  - Uses the user’s cookie session.
  - **RLS enforced**.
- **Service role server client**: `createServiceRoleClient()` from `lib/supabase/server.ts`
  - **Bypasses RLS**.
  - Must be used **server-side only**.

## API Route Types

### JSON routes (default)

- Use `Content-Type: application/json`.
- Wrap state-changing routes with `requireAuth` or `requireRole`.
- Handlers should read the parsed body from `request._body` when present (middleware caches body).

Examples:
- `PUT /api/profile`
- `POST /api/profile/roles`
- `POST /api/addresses`
- `POST /api/business/create`

### Multipart (file upload) routes

- Use `request.formData()` in the handler.
- Do **not** use `requireAuth` (it reads JSON body). Instead, authenticate inside the route via `supabase.auth.getUser()`.
- Validate:
  - **file size** (early)
  - **magic bytes** (content validation)
  - ownership checks for business assets

Examples:
- `POST /api/storage/upload-profile-picture`
- `POST /api/storage/upload-business-logo`
- `POST /api/storage/upload-business-background`

## CSRF

JSON state-changing operations are protected by CSRF:
- Client fetches token from `GET /api/csrf-token`.
- Client includes token in header `X-CSRF-Token`.
- Middleware validates token in `lib/middleware/csrf.ts`.

Upload routes currently do not use CSRF (multipart); keep them protected by auth + ownership checks.

## Error Contract

Prefer returning errors via `lib/utils/errorHandler.ts` (`handleError`, `withErrorHandler`) and structured `logger`.

Common patterns:
- **401**: `{ error: 'Authentication required' }`
- **403**: `{ error: 'Insufficient permissions', message?: string }`
- **400 validation**: `{ error: 'Validation failed', details?: unknown }`
- **500**: consistent `handleError` output

## RBAC

Roles are stored in `user_roles` (`customer`, `contractor`).

- Use `requireRole(['contractor'], ...)` for contractor-only routes.
- Signup assigns roles server-side in `POST /api/auth/signup`.
- Roles can be managed via `/api/profile/roles`.

## Image Storage & Replacement (safe flow)

**Safe swap lifecycle**:
1. Upload new image to storage (upload endpoints return `url`)
2. Update the owning record in Postgres to point at the new URL
3. Best-effort delete the old image URL from storage

Where deletion happens:
- Profile images: `PUT /api/profile` deletes old image after DB update succeeds
- Business images: `PUT /api/businesses/[id]` deletes old image after DB update succeeds

## Addresses: Source of Truth

The `addresses` table is the source of truth for addresses.

Endpoints:
- `GET /api/addresses?type=personal|business`
- `POST /api/addresses`
- `PUT /api/addresses/[id]`
- `DELETE /api/addresses/[id]`

Backfill migration:
- `supabase/migrations/006_backfill_personal_addresses_from_profiles.sql`

Legacy profile address fields may exist for backwards compatibility, but new writes should go through the `addresses` API.


