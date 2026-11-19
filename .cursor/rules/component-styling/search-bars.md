# Search Bar Rule

## Rule
**Every new search bar MUST use the standard search component — never a bare `<input>` or `Input` with its own icon.**

- Inside another `<form>` or as a plain filter: `TypingSearchInput` from `components/common/TypingSearchInput.tsx`
- A CRM list page search that submits on its own: `CRMSearchField` from `components/crm/CRMSearchField.tsx` (it renders its own `<form>`, so never nest it in another form)

## What the standard gives you
- Red search icon (`text-red-500`) on the left
- Black 2px border, rounded-lg, white background
- Placeholder that types itself out character by character, and replays when the field is cleared
- A clear (X) button while there is text

## Layout
- The search bar takes the full width of its row.
- A related action button (e.g. "Add contact") goes on the row **under** the search bar, aligned right (`flex justify-end`), using the `Button` component.
