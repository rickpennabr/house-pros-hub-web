# API reference

Summary of `app/api` routes and how they are protected.

## Auth model

| Protection | Description |
|------------|-------------|
| **Public** | No session; rate-limited. |
| **Authenticated** | Session required; state-changing requests require CSRF token. |
| **Admin** | Session + email must match `ADMIN_EMAIL`. |
| **Webhook** | Valid `x-resend-signature` or `Authorization: Bearer` / `x-api-key`. |

## Routes by protection

### Public

- `GET /api/businesses` – list active businesses (rate-limited).
- `GET /api/businesses/[id]` – get one business by id or slug.
- `GET /api/health` – health check.
- `POST /api/auth/login`, `POST /api/auth/signup`, `GET /api/auth/callback`.
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- `POST /api/estimate` – submit estimate form (rate-limited).

### Authenticated (CSRF for state changes)

- `GET /api/csrf-token` – get CSRF token (session required).
- `GET /api/auth/me`, `GET /api/auth/is-admin`.
- `PUT /api/profile`, `DELETE /api/profile/delete`.
- `GET /api/profile/roles`, `POST /api/profile/roles`, `DELETE /api/profile/roles`.
- `GET /api/addresses`, `POST /api/addresses`.
- `GET /api/addresses/[id]`, `PUT /api/addresses/[id]`, `DELETE /api/addresses/[id]`.
- `POST /api/business/create`, `GET /api/business/check-slug`.
- `PUT /api/businesses/[id]`, `DELETE /api/businesses/[id]`.

### Upload (auth inside route)

- `POST /api/storage/upload-profile-picture`
- `POST /api/storage/upload-business-logo`
- `POST /api/storage/upload-business-background`
- `POST /api/storage/upload-estimate-image`

### Admin only

- `GET /api/admin/customers`, `POST /api/admin/customers`, `GET /api/admin/customers/[id]`, `PUT /api/admin/customers/[id]`, `DELETE /api/admin/customers/[id]`.
- `GET /api/storage/list`, `DELETE /api/storage/delete` (bucket/path allowlisted).

### Webhook

- `POST /api/webhooks/email` – Resend webhook or API key.

## CSRF

For `PUT`/`POST`/`DELETE` JSON requests that use `requireAuth`, the client must:

1. Call `GET /api/csrf-token` (with session).
2. Send the token in the `X-CSRF-Token` header (or in body as `csrfToken` / `_csrf`).

See `lib/middleware/csrf.ts` and `lib/middleware/auth.ts`.
