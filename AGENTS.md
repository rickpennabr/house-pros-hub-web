<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Search bars

Every new search bar uses the standard component: `TypingSearchInput` (`components/common/TypingSearchInput.tsx`), or `CRMSearchField` for a standalone CRM list search (it renders its own `<form>`; never nest it). That gives the red search icon, black border, typing placeholder and clear button. Never build a search bar from a bare `<input>`/`Input`. Put a related action button (e.g. "Add contact") on the row under the search bar, aligned right. Full rule: `.cursor/rules/component-styling/search-bars.md`.

## Uploads

Every upload area takes drag and drop. A plain upload box uses `FileDropZone` (`components/ui/FileDropZone.tsx`): dashed border, drag highlight, click or Enter to browse, type and size checks. A tile that opens a file picker (logo, avatar, photo square, upload button) keeps its look and goes inside `FileDropTarget` (`components/ui/FileDropTarget.tsx`), with `inputRef` of its hidden input (or with the input inside it) so drops run the same onChange code. Never ship a bare `<input type="file">` or an "Add attachment" link without one of these. Full rule: `.cursor/rules/component-styling/uploads.md`.

## Shapes

No pills and no circles. Buttons, chips, badges, inputs, selects, icon buttons, step numbers and remove (X) badges are squares or rectangles with rounded corners: `rounded-lg`, or `rounded-md` for small ones (about 24px and under, `text-xs` chips). Never `rounded-full` on them. `rounded-full` is only for things that must be round: spinners, tiny status dots, toggle-switch tracks and knobs, progress-bar ends, notification counters.

## Mobile bottom bar

The mobile bottom menu is `BusinessListMobileBottomBar` (`components/pageslayout/BusinessListMobileBottomBar.tsx`): black, five even spots with labels, the raised house in the center, house icons from `HouseMark`. Its spots change for pros (business or personal profile), signed-in customers and guests. Never build another bottom bar. Full rule: `.cursor/rules/component-styling/bottom-bar.md`.

## Pickers

Lists of people, places or things (customers, suppliers, properties, projects, estimates, vehicles, crew, tools) use `PickerSelect` (`components/ui/PickerSelect.tsx`): the Hub's own list with a search bar when long, a second line per row, always inside the screen. A customer's properties use `ContactPropertySelect`. Short fixed choices (unit, status, terms, days) use `Select` (`components/ui/Select.tsx`). Never a bare `<select>`, and never `Select` over a data list. Full rule: `.cursor/rules/component-styling/pickers.md`.
