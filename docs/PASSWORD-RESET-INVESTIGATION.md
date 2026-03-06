# Password Reset Investigation Checklist

Use this checklist when the reset-password page shows "Invalid or expired reset token" after clicking the email link.

---

## Flow summary

1. **Forgot password** → User enters email → `POST /api/auth/forgot-password` → Supabase sends email with link. A **PKCE code_verifier** is stored in a cookie in the **same browser**.
2. **Email link** → User clicks link → goes to Supabase `/auth/v1/verify?token=...&redirect_to=...` → Supabase redirects to `{SITE_URL}/api/auth/callback?type=recovery&next=/{locale}/reset-password&code=...`.
3. **Callback** → `GET /api/auth/callback` exchanges `code` for session (requires the **same browser** so the code_verifier cookie is sent), sets session cookies, redirects to `/{locale}/reset-password`.
4. **Reset page** → Reads session from cookies (or from URL hash if present), shows form or "invalid token".

**Important:** The reset link must be opened in the **same browser** (and ideally same device) where the user requested the reset. Otherwise the code exchange fails (e.g. "code verifier should be non-empty").

---

## Checklist (in order)

### 1. Supabase Dashboard – Redirect URLs

- [ ] Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
- [ ] Under **Redirect URLs**, ensure these are listed (no trailing slash):
  - Dev: `http://localhost:3000/api/auth/callback`
  - Prod: `https://yourdomain.com/api/auth/callback`
- [ ] If the callback URL is missing, add it and save. Supabase will not append `code` to unknown URLs.

### 2. Environment – Site URL

- [ ] In `.env.local`, confirm `NEXT_PUBLIC_SITE_URL` matches where you open the app (e.g. `http://localhost:3000` for dev).
- [ ] The link in the email is built from this. Wrong URL → link goes to wrong host/path → callback never gets `code`.

### 3. Email link (what the user actually clicks)

- [ ] Request a reset, then open the email and **inspect the link** (right‑click → Copy link, or view source).
- [ ] Expected pattern: `{NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=recovery&next=/en/reset-password` and Supabase adds `&code=...` (or similar).
- [ ] If the link goes to `/reset-password` directly (no `/api/auth/callback`), the redirect URL passed to Supabase is wrong (see step 1–2).
- [ ] If the link has no `code=` (and no hash with tokens), the redirect URL may not be allowlisted or the flow is misconfigured in Supabase.

### 4. Server logs – Callback hit and code exchange

- [ ] Request a new reset, click the link, then check the **terminal where `next dev` is running**.
- [ ] Look for:
  - `[Auth Callback] GET ...` – confirms the request reached the callback.
  - `[Auth Callback] code present: true` – Supabase sent a code.
  - `[Auth Callback] exchangeCodeForSession: ok` – session created and cookies set.
  - `[Auth Callback] redirecting to ...` – where the user is sent (should be `/en/reset-password` or your locale).
- [ ] If you see `code present: false` → link in email is wrong or Supabase didn’t add `code` (check redirect URLs and flow type).
- [ ] If you see `exchangeCodeForSession: error` → note the message (e.g. expired, already used). Request a **new** reset link and try again within the validity window.

### 5. Browser – Reset page load

- [ ] After clicking the link, open **DevTools → Console** on the reset-password page.
- [ ] Look for:
  - `[ResetPassword] page load` – full URL (path + search + whether hash exists). Confirms what the page received.
  - `[ResetPassword] checkSession: hash params` – if no hash, session must come from cookies set by callback.
  - `[ResetPassword] getSession attempt` – if `hasSession: false` for all attempts, cookies weren’t set or aren’t sent (see step 6).
- [ ] If there is an `error` in the URL (e.g. `?error=...`), the page should show that message (from the callback). Check that it’s visible.

### 6. Cookies after redirect

- [ ] On the reset-password page, open **DevTools → Application** (Chrome) or **Storage** (Firefox) → **Cookies** → `http://localhost:3000` (or your origin).
- [ ] Check for Supabase auth cookies (e.g. `sb-<project-ref>-auth-token` or similar). If they’re missing after clicking the link, the callback either didn’t run or didn’t set cookies (same-site, secure, path).
- [ ] If you use a different domain for frontend vs API, cookies may not be sent; same origin for callback and app is recommended.

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
| `[Forgot Password API]` | Server (terminal) | Redirect URL sent to Supabase |
| `[Auth Callback]`    | Server (terminal) | Callback hit, code present, exchange result, redirect |
| `[ResetPassword]`    | Browser console | Page URL, hash, session checks, form submit |
| `[ResetPassword] error from URL hash (Supabase redirect):` | Browser console | Hash contained `error` / `error_code` / `error_description`; page showed that error and stopped validating. |
| `[Reset Password API]` | Server (terminal) | Reset request, getUser, updateUser result |

---

## Common causes

| Symptom | Likely cause |
|--------|----------------|
| Link has no `code=` | Redirect URL not in Supabase allowlist or wrong `NEXT_PUBLIC_SITE_URL` |
| Callback logs "code present: false" | Same as above, or link opened from another client that altered the URL |
| Callback logs "exchangeCodeForSession: error" | Code expired, already used, or invalid (request new link) |
| Reset page: no session, no hash | Callback didn’t set cookies or cookies not sent (same-site/domain/path) |
| Reset page: URL has `?error=...` | Callback intentionally redirected with error; message should be shown on page |
| Reset page: URL has `#error=...` | Page now reads hash and shows `error_description` (or friendly message); "Request new link" UI is shown. If tokens still not in hash, ensure Redirect URLs allowlisted (Step 1). |
| Callback log: "code verifier" / "verifier" in error | User opened the link in a different browser or device; request reset again and open link in the **same** browser |

After making changes (e.g. redirect URLs, env), request a **new** password reset and test with the new link. Always open the email link in the **same browser** where you requested the reset.

---

## Brazalink reference (Step 4)

For comparison with a working reset flow in the same ecosystem:

- **redirectTo**: Brazalink uses **direct** redirect to the reset page: `${siteUrl}/reset-password` (no locale in path; Brazalink does not use `/en/` or `/es/` in auth routes). Same hash-based flow as House Pros Hub: Supabase redirects to `redirect_to` with tokens (or error) in the URL hash.
- **Supabase Redirect URLs (Brazalink)**: Allowlist includes `http://localhost:3000/reset-password`, `http://localhost:3000/**`, and production equivalents (`https://brazalink.com/auth/callback`, `https://*.brazalink.com/reset-password`, etc.). House Pros Hub uses locale-prefixed paths (`/en/reset-password`, `/es/reset-password`); ensure those exact paths (or `http://localhost:3000/**`) are allowlisted in the House Pros Hub Supabase project.
- **Auth callback**: Brazalink’s `app/auth/callback/route.ts` handles **query** params when Supabase sends `?code=...` (e.g. from a link that goes to callback). It reads `error` / `error_code` / `error_description` from **query** and redirects to `/reset-password?error=...`. When Supabase redirects with **hash** (direct to reset page), the reset page must read the hash; House Pros Hub reset page now reads **hash** for `error`, `error_code`, `error_description` and shows that message plus "Request new link" (see Step 2 in the fix plan).
- **Flow pattern**: Both use `admin.generateLink({ type: 'recovery', options: { redirectTo } })` and send a custom email with `action_link`. No callback in the email link; link goes to Supabase verify → redirect to `redirect_to` with hash. Reuse the same allowlist and flow pattern; only the path shape differs (HPH: `/{locale}/reset-password`, Brazalink: `/reset-password`).
