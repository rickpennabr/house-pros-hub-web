# Password Reset Investigation Checklist

Use this checklist when the reset-password page shows "Invalid or expired reset token" after clicking the email link.

---

## Flow summary (current implementation)

1. **Forgot password** → User enters email on `/[locale]/forgot-password` → **server action** `resetPassword(email)` runs: rate limit check, user lookup (auth.admin + profiles), `admin.generateLink({ type: 'recovery', options: { redirectTo } })`, **custom Resend email** with `action_link`. No Supabase default email. **No PKCE**; link points directly to the reset page URL.
2. **redirectTo** → `${NEXT_PUBLIC_SITE_URL}/${locale}/reset-password` (locale from `profiles.preferred_locale` or `en`). Supabase redirect URLs must allowlist these paths (see below).
3. **Email link** → User clicks link → goes to Supabase verify → Supabase redirects to `redirectTo` with **hash fragment**: `#access_token=...&refresh_token=...&type=recovery` (or `#error=...&error_description=...` if expired/invalid).
4. **Reset page** → `/[locale]/reset-password` reads hash (and query for errors from callback). If tokens in hash: `setSession()`, clear hash, show form. Else if `getSession()` has session (e.g. from callback): show form. Else: show invalid-token view with "Request new link".
5. **Submit** → Server action `updatePassword(newPassword)` (cookie-based session), then client `signOut()`, success state, redirect to `/[locale]/signin` after 3s.

**Primary flow is hash-based.** The link in the email does **not** go to `/api/auth/callback`; it goes to Supabase, which redirects to `/{locale}/reset-password` with tokens in the hash. The callback route is still used if Supabase ever sends `?code=...` (e.g. if redirect URL were set to callback); no PKCE is required for the hash flow.

---

## Checklist (in order)

### 1. Supabase Dashboard – Redirect URLs

- [ ] Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
- [ ] Under **Redirect URLs**, ensure the **direct reset page** URLs are allowlisted (no trailing slash):
  - Dev: `http://localhost:3000/en/reset-password`, `http://localhost:3000/es/reset-password` (or `http://localhost:3000/**`)
  - Prod: `https://yourdomain.com/en/reset-password`, `https://yourdomain.com/es/reset-password` (or `https://yourdomain.com/**`)
- [ ] The email link uses `redirectTo = ${NEXT_PUBLIC_SITE_URL}/${locale}/reset-password`, so Supabase will redirect to one of these URLs with tokens in the hash. If these paths are not allowlisted, the redirect may fail or land without tokens.
- [ ] Optionally keep `https://yourdomain.com/api/auth/callback` for flows that use `?code=...`; the primary flow does not require it.

### 2. Environment – Site URL

- [ ] In `.env.local`, confirm `NEXT_PUBLIC_SITE_URL` matches where you open the app (e.g. `http://localhost:3000` for dev).
- [ ] The link in the email is built from this. Wrong URL → link goes to wrong host/path → callback never gets `code`.

### 3. Email link (what the user actually clicks)

- [ ] Request a reset, then open the email and **inspect the link** (right‑click → Copy link, or view source).
- [ ] The link goes to Supabase; after verify, Supabase redirects to `{NEXT_PUBLIC_SITE_URL}/{locale}/reset-password` with **hash** `#access_token=...&refresh_token=...&type=recovery`.
- [ ] If the link goes somewhere else (e.g. callback with `?code=...`), the `redirectTo` in the server action may be wrong (check `NEXT_PUBLIC_SITE_URL` and locale).
- [ ] If you land on reset-password but with `#error=...` in the hash, the token is expired or invalid; the page shows that message and "Request new link".

### 4. Server logs – Request and callback (if used)

- [ ] When user submits forgot-password, server action `resetPassword` runs (see terminal for any logger output). No API route is called.
- [ ] If the user lands via **callback** (e.g. `?code=...`), look for `[Auth Callback] GET ...`, `exchangeCodeForSession`, and redirect to `/{locale}/reset-password`.
- [ ] For the **hash flow** (primary), there is no callback request; the browser lands directly on `/{locale}/reset-password#access_token=...`.

### 5. Browser – Reset page load

- [ ] After clicking the link, you should land on `/{locale}/reset-password` with either (a) hash containing `access_token`, `refresh_token`, `type=recovery`, or (b) query/cookie session if you came via callback.
- [ ] If the URL has `#error=...` or `?error=...`, the page shows that message and "Request new password reset link" and does not show the form.
- [ ] If the URL has tokens in the hash, the page runs `setSession()` and then shows the new-password form.

### 6. Cookies after redirect

- [ ] For **hash flow**: the reset page uses `setSession()` with tokens from the hash; session is in memory and stored in cookies by Supabase client. No callback is involved.
- [ ] For **callback flow**: after `exchangeCodeForSession`, the callback sets cookies and redirects to reset-password; the page then uses `getSession()`.
- [ ] If session is missing, ensure you’re on the same origin and that the hash (or callback) was processed correctly.

### 7. Token expiry

- [ ] Reset links typically expire (e.g. 1 hour). Request a **new** reset and click the new link within the expiry window.
- [ ] Don’t reuse a link that was already used; request another reset.

### 8. Quick test without email

- [ ] In Supabase Dashboard → **Authentication** → **Users** → pick a user → **Send password recovery**. Check the email and link as in step 3.
- [ ] Or trigger reset from your app and follow steps 3–6 with the new link.

---

## Verification (Fix plan Step 1 and Step 2)

- **Step 1 (Supabase configuration)**: In Supabase Dashboard → **Authentication** → **URL Configuration**, confirm Redirect URLs include `http://localhost:3000/en/reset-password` (or `http://localhost:3000/**`) and production equivalents. Request a **new** password reset and open the link in the same browser.
- **Step 2 (Hash error handling)**: If the link still lands with a hash error (`#error=...&error_code=otp_expired&error_description=...`), the reset page should now show that message (or the friendly invalid-token message) and "Request new password reset link" without showing "Validating token…". In the browser console you should see `[ResetPassword] error from URL hash (Supabase redirect):`.

---

## Console log reference

| Log prefix            | Location        | What it tells you |
|----------------------|-----------------|-------------------|
| Server action / logger | Server (terminal) | `resetPassword` rate limit, user lookup, link generation, email send |
| `[Auth Callback]`    | Server (terminal) | Only if user lands with `?code=...`; callback hit, exchange result, redirect |
| Reset page           | Browser         | Hash or query parsed; setSession or getSession; form submit, updatePassword |

---

## Common causes

| Symptom | Likely cause |
|--------|----------------|
| Link lands on wrong path or no hash | Redirect URLs in Supabase must include `{origin}/en/reset-password`, `{origin}/es/reset-password` (or `/**`). Wrong `NEXT_PUBLIC_SITE_URL` in server action. |
| Reset page: no session, no hash | User opened link after it expired; or redirect URL not allowlisted so Supabase didn’t redirect with tokens. Request a new reset. |
| Reset page: URL has `?error=...` or `#error=...` | Token expired or invalid. Page shows that message and "Request new link". |
| Rate limit error | Per-email limit (e.g. 3 per hour) in `password_reset_attempts`; wait or check `cleanup_expired_password_reset_attempts`. |

---

## Brazalink reference (Step 4)

For comparison with a working reset flow in the same ecosystem:

- **redirectTo**: Brazalink uses **direct** redirect to the reset page: `${siteUrl}/reset-password` (no locale in path; Brazalink does not use `/en/` or `/es/` in auth routes). Same hash-based flow as House Pros Hub: Supabase redirects to `redirect_to` with tokens (or error) in the URL hash.
- **Supabase Redirect URLs (Brazalink)**: Allowlist includes `http://localhost:3000/reset-password`, `http://localhost:3000/**`, and production equivalents (`https://brazalink.com/auth/callback`, `https://*.brazalink.com/reset-password`, etc.). House Pros Hub uses locale-prefixed paths (`/en/reset-password`, `/es/reset-password`); ensure those exact paths (or `http://localhost:3000/**`) are allowlisted in the House Pros Hub Supabase project.
- **Auth callback**: Brazalink’s `app/auth/callback/route.ts` handles **query** params when Supabase sends `?code=...` (e.g. from a link that goes to callback). It reads `error` / `error_code` / `error_description` from **query** and redirects to `/reset-password?error=...`. When Supabase redirects with **hash** (direct to reset page), the reset page must read the hash; House Pros Hub reset page now reads **hash** for `error`, `error_code`, `error_description` and shows that message plus "Request new link" (see Step 2 in the fix plan).
- **Flow pattern**: Both use `admin.generateLink({ type: 'recovery', options: { redirectTo } })` and send a custom email with `action_link`. No callback in the email link; link goes to Supabase verify → redirect to `redirect_to` with hash. Reuse the same allowlist and flow pattern; only the path shape differs (HPH: `/{locale}/reset-password`, Brazalink: `/reset-password`).
