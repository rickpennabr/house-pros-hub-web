# Pickers (dropdowns)

Two standards. Pick by **what the list holds**, not by how it looks.

## 1. People, places and things → `PickerSelect`

`components/ui/PickerSelect.tsx`

Use it for any list that comes from data and can grow: customers, suppliers, contacts, properties,
projects, estimates, invoices, maintenance plans/houses, vehicles, crew members, managers, tools,
products.

Why:
- These lists get long. With 7+ options it shows the standard search bar (`TypingSearchInput`) so an
  old customer is found by typing, not by scrolling.
- Each row can carry a second line (`detail`: address, email, amount) and long text wraps.
- It is the Hub's own list: our border, `rounded-lg`, ✓ on the picked row. It always stays inside the
  screen (the browser's native list runs off the side with long addresses).

```tsx
<PickerSelect
  value={projectId}
  onChange={setProjectId}
  noneLabel="No project"            // optional first row that clears the pick (value '')
  placeholder="Select project"      // shown when nothing is picked and there is no noneLabel
  options={projects.map((p) => ({ value: p.id, label: p.name, detail: p.customerName }))}
/>
```

Properties of a customer use `ContactPropertySelect` (same list, loads the customer's houses).

## 2. Short fixed choices → `Select`

`components/ui/Select.tsx`

Use it for a small, fixed set of words that never comes from the database: unit (sq ft, LF), status,
payment terms, days, hours, frequency, plan, link type.

Why: a handful of known words gains nothing from search; the phone's own picker (iOS wheel, Android
sheet) is fast with a thumb and fully accessible.

## Never

- A bare `<select>` element. Use `Select` (it carries the 48px phone height, border and arrow).
- A `Select` over a data list (`customers.map`, `projects.map`, `vehicles.map`…). Use `PickerSelect`.
- Nesting a picker inside another popover that clips overflow (the list opens below the box).
