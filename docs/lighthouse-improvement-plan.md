# Lighthouse Improvement Plan — `/en/businesslist`

This plan is based on the previous Lighthouse report and current codebase review. Re-run Lighthouse after implementing each phase to validate.

---

## Completed (previous session)

- **JS bundle size**
  - Replaced `react-icons/gi` (GiGate) with Lucide `Fence` in `lib/constants/categories.ts`.
  - Replaced `react-icons/md` (MdGroups2) with Lucide `Users` in `components/pageslayout/PagesMenu.tsx`.
  - Enabled `experimental.optimizePackageImports` for `react-icons/*` in `next.config.ts` to improve tree-shaking for remaining usage (si, tb, gr, lu, bs, hi).

## Completed (accessibility + preload)

- **Main landmark:** `PageContent.tsx` — outer element changed from `<div>` to `<main id="main-content">`.
- **aria-hidden + focusable:** `BotFloatingButton.tsx` — sr-only `<Link>` given `tabIndex={-1}` so it is not in tab order.
- **Button accessible names:** `ProReactions.tsx` — reaction buttons now use `aria-label={\`${label}, ${count}\`}` so visible text matches the accessible name.
- **aria-hidden audit:** ProBotWelcomeOverlay and BotChatDrawer use `aria-hidden` only on decorative elements (no focusable descendants); no change needed.
- **Preload:** Removed `pro-bot-solo.gif` preload from root `app/layout.tsx` so businesslist LCP is not competing with the floating bot image.

---

## 1. Performance

### 1.1 Image / GIF optimization (high impact)

**Issue:** Large GIFs add significant byte weight and can hurt LCP (e.g. `pro-bot-solo.gif`, `hph-pro-bot-waiving.gif`, `hph-hub-agent-welcome.gif`, `hph-hub-agent-welcome-japa.gif`, `pro-bot-typing-creating-account.gif`, `dance.gif`, `dance-1.gif`).

**Actions:**

| Priority | Action | Where |
|----------|--------|--------|
| High | Convert hero/above-the-fold GIFs to **video** (WebM + MP4) and use `<video autoplay muted loop playsInline>`. Reduces size and decoding cost. | `lib/constants/probot.ts` (asset paths), `BotFloatingButton`, `ProBotWelcomeOverlay`, `app/[locale]/probot/layout.tsx`, `ProBotChatArea`, signin/loading pages |
| High | Use **responsive images**: `srcSet`/`sizes` for bot avatars so mobile doesn’t load full-res. | Same components that render `<img>` for bot assets |
| Medium | Add **`fetchpriority="high"`** only for the **LCP image** on businesslist (e.g. first visible pro card image or hero). Do not use on the floating bot GIF. | Business list / pro card components |
| Medium | **Preload only critical LCP resource.** Root layout currently preloads `pro-bot-solo.gif`; that helps the floating button but is not the businesslist LCP. Consider moving preload to a layout or component that only wraps pages where the bot image is LCP, or remove if LCP is elsewhere. | `app/layout.tsx` (line 42) |

**Files to touch:**

- `app/layout.tsx` — preload
- `lib/constants/probot.ts` — optional second set of video URLs
- `components/pageslayout/BotFloatingButton.tsx` — img → video or responsive img
- `components/pageslayout/ProBotWelcomeOverlay.tsx` — same
- `app/[locale]/(main)/loading.tsx` — dance GIFs (video or keep as-is if low priority)
- `app/[locale]/(auth)/signin/page.tsx` — dance GIFs
- `app/[locale]/probot/layout.tsx` — header avatar
- `components/probot/ProBotChatArea.tsx` — welcome/typing avatars

### 1.2 JavaScript / rendering

- **Forced reflows:** Minimize DOM reads/writes in loops; batch style reads then writes (see Lighthouse “Avoid large layout shifts” / performance trace).
- **Legacy JS:** If the report still flags “legacy JavaScript,” consider excluding modern-only code from legacy bundles or dropping non-critical polyfills for the businesslist route.

### 1.3 Caching

- If Supabase-served images are flagged for short cache lifetime, set longer `Cache-Control` (e.g. `public, max-age=31536000, immutable`) for static image URLs in Supabase storage or via a proxy.

---

## 2. Accessibility

### 2.1 Main landmark (high)

**Issue:** “Document does not have a main landmark.”

**Fix:** Wrap the primary content in a `<main>` element so assistive tech can jump to main content.

- **Option A:** In `components/pageslayout/PageContent.tsx`, change the outer `<div>` to `<main>` and add an `id="main-content"` for skip-link targets if needed.
- **Option B:** In `app/[locale]/(main)/layout.tsx`, wrap `<PageContent>{children}</PageContent>` in `<main>` and keep `PageContent` as an inner div.

**Recommendation:** Option A — use `<main>` in `PageContent.tsx` so all main-layout pages get the landmark. Ensure no duplicate `<main>` in nested layouts (e.g. CRM/Admin already use `<main>` in their own layouts).

### 2.2 `aria-hidden` and focusable elements (high)

**Issue:** “Elements with `[aria-hidden="true"]` contain focusable descendants.”

**Locations:**

- **BotFloatingButton:** The prefetch `<Link>` has `className="sr-only"` and `aria-hidden` but is still focusable. Fix: add `tabIndex={-1}` so it’s not in the tab order while still prefetching.
- **ProBotWelcomeOverlay, BotChatDrawer, ChatSignupForm, etc.:** Any wrapper with `aria-hidden` that contains buttons/links/inputs must either (a) remove `aria-hidden` from the wrapper, or (b) ensure no focusable descendants, or (c) move `aria-hidden` to decorative children only.

**Action:** Audit all `aria-hidden` usages (see grep results in `ProBotSidebar`, `ProBotChatArea`, `BotChatDrawer`, `ProBotNevadaMountains`, etc.). For decorative containers, avoid putting focusable elements inside them; for the sr-only Link, use `tabIndex={-1}`.

### 2.3 Button / link accessible names

- **label-content-name-mismatch:** If the report flags buttons whose visible text doesn’t match `aria-label`, align them: either use the same string for visible text and `aria-label`, or make the visible text the primary label and use `aria-label` only when necessary for extra context.
- Ensure every icon-only button has a concise `aria-label` (already done in several places; verify any remaining icon buttons).

---

## 3. SEO

- **Meta description:** Already set in `app/[locale]/(main)/businesslist/layout.tsx` — no change needed.
- **Canonical / hreflang:** If the report or product requirements ask for it, add `rel="canonical"` and locale `hreflang` in layout or `generateMetadata` (see `app/[locale]/layout.tsx`).
- **Structured data:** `BusinessListClient` already injects JSON-LD; keep and validate with Google’s Rich Results Test if needed.

---

## 4. Validation

1. Run Lighthouse (DevTools or CLI) on `http://localhost:3000/en/businesslist` with a clean load (e.g. incognito, no extensions).
2. After each change set, re-run and compare Performance, Accessibility, and Best Practices scores.
3. If you have a new Lighthouse JSON report, share it to refine this plan (e.g. exact audit IDs and suggested fixes).

---

## 5. Suggested implementation order

1. **Accessibility (quick wins):** Add `<main>` in `PageContent`, fix BotFloatingButton sr-only Link `tabIndex={-1}`.
2. **Accessibility (audit):** Review all `aria-hidden` + focusable combinations; fix or document exceptions.
3. **Performance (images):** Preload/LCP and responsive images first; then GIF → video where it gives the most benefit (e.g. floating button and welcome overlay).
4. **Performance (caching):** Adjust Supabase/image cache headers if the report still flags them.
5. **SEO:** Add canonical/hreflang only if required.

---

## 6. Remaining `react-icons` usage (reference)

These still use `react-icons`; `optimizePackageImports` should reduce bundle impact. If the report still shows large unused JS from a specific set (e.g. `si`), consider replacing those with Lucide or inline SVGs:

- `react-icons/si`: BusinessLinksTab, BusinessStep4, ContractorStepLinks, business edit page, ProLinks
- `react-icons/tb`: CustomerInfoAccordion, estimate page
- `react-icons/gr`: ChatSignupForm, RoleSelectionScreen
- `react-icons/lu`: ViewToggle, SuppliersList
- `react-icons/bs`: AdminSidebar, CRMSidebar
- `react-icons/hi`: TipModal

No change required unless Lighthouse still flags these bundles after the current optimizations.
