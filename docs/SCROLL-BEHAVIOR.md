# Scroll behavior standard

## Comparison: ProBot vs Business list

| Aspect | `/en/probot` | `/en/businesslist` |
|--------|----------------|---------------------|
| **Layout** | Own layout (`app/[locale]/probot/layout.tsx`) | Shared `(main)` layout (`app/[locale]/(main)/layout.tsx`) |
| **Outer container** | `fixed inset-0 … overflow-hidden` (no page scroll) | Centered wrapper; scroll is inside `PageContainer` or window |
| **Scroll region** | Only internal (e.g. chat message list has `overflow-y-auto`) | **PageContainer**: `overflow-y-auto` on all breakpoints; scroll only inside the white card |
| **Result** | Page does not scroll; chat area scrolls inside fixed viewport | Window does not scroll; content scrolls inside the white card when it overflows |

## Standard

1. **Main app pages** (under `(main)`): Use the shared main layout. Scrolling is handled by `PageContainer`:
   - **Small screens**: `h-[calc(100vh-1rem)] overflow-y-auto` — the white card is the scroll container.
   - **Desktop (md+)**: `md:h-[calc(100vh-1rem)]` — same as small; scroll only inside the white card; window never scrolls.

2. **Full-screen app pages** (e.g. ProBot): Use a dedicated layout with a fixed viewport. The **main content area** (below the header) must be scrollable when content overflows:
   - Use `flex-1 min-h-0 overflow-y-auto` (or equivalent) on the content wrapper so the page scrolls when the content is taller than the viewport.
   - Internal regions (e.g. chat message list) can still have their own `overflow-y-auto` for nested scroll where needed.

3. **Rule of thumb**: Any route that can have more content than the viewport should have exactly one primary scroll region (container or window) so the user can always reach all content. Avoid a fixed viewport with no scroll when content can overflow.
