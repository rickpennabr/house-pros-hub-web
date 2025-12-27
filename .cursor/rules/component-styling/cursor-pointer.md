# Cursor Pointer Rule

## Rule
**All interactive elements (buttons, links, clickable elements) MUST have `cursor-pointer` on hover.**

## Why
- Improves user experience by clearly indicating clickable elements
- Follows standard web UX conventions
- Makes the interface more intuitive and accessible

## What Needs Cursor Pointer
- All `<button>` elements
- All `<a>` (link) elements
- Any element with `onClick` handlers
- Clickable divs, spans, or other elements that perform actions
- Interactive form elements that trigger actions (not just input fields)

## Implementation
Always include `cursor-pointer` in the className for interactive elements:

```tsx
// ✅ Good
<button className="px-4 py-2 bg-black text-white cursor-pointer hover:bg-gray-800">
  Click Me
</button>

// ✅ Good - with disabled state
<button 
  className="px-4 py-2 bg-black text-white cursor-pointer hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
  disabled={isLoading}
>
  Submit
</button>

// ✅ Good - Links
<a href="/page" className="text-blue-600 hover:underline cursor-pointer">
  Go to Page
</a>

// ❌ Bad - Missing cursor-pointer
<button className="px-4 py-2 bg-black text-white hover:bg-gray-800">
  Click Me
</button>
```

## Exceptions
- Form input fields (text, email, password, etc.) - these use default text cursor
- Disabled buttons should use `disabled:cursor-not-allowed` instead
- Non-interactive elements should not have cursor-pointer

## Checklist
When creating or editing components:
- [ ] All buttons have `cursor-pointer`
- [ ] All links have `cursor-pointer`
- [ ] All clickable divs/spans have `cursor-pointer`
- [ ] Disabled buttons have `disabled:cursor-not-allowed`
- [ ] Non-interactive elements do NOT have `cursor-pointer`

