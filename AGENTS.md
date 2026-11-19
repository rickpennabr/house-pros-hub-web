<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Search bars

Every new search bar uses the standard component: `TypingSearchInput` (`components/common/TypingSearchInput.tsx`), or `CRMSearchField` for a standalone CRM list search (it renders its own `<form>`; never nest it). That gives the red search icon, black border, typing placeholder and clear button. Never build a search bar from a bare `<input>`/`Input`. Put a related action button (e.g. "Add contact") on the row under the search bar, aligned right. Full rule: `.cursor/rules/component-styling/search-bars.md`.
