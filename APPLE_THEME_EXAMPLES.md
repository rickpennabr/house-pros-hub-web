# Apple Theme - Component Examples

Here are examples of how to apply the Apple theme to your existing components.

## Example 1: Apply to PageHeader

**Before:**
```tsx
<header className="w-full h-[60px] border-b border-black p-2 md:p-4 flex items-center justify-between">
```

**After (with Apple theme):**
```tsx
<header className="w-full h-[60px] apple-header p-2 md:p-4 flex items-center justify-between">
```

## Example 2: Apply to ProCard

**Before:**
```tsx
<div className="border-2 border-black rounded-lg bg-white overflow-hidden">
```

**After (with Apple theme):**
```tsx
<div className="apple-card apple-shadow-md overflow-hidden">
```

## Example 3: Apply to PageContainer

**Before:**
```tsx
<div className="w-full max-w-[1280px] min-h-screen mx-auto border border-black">
```

**After (with Apple theme):**
```tsx
<div className="w-full max-w-[1280px] min-h-screen mx-auto apple-container apple-border">
```

## Example 4: Buttons with Apple Style

**Before:**
```tsx
<button className="border border-black px-4 py-2 rounded">
  Click Me
</button>
```

**After (with Apple theme):**
```tsx
<button className="apple-button apple-transition apple-hover-scale">
  Click Me
</button>
```

## Example 5: Input Fields

**Before:**
```tsx
<input type="text" className="border border-black rounded px-4 py-2" />
```

**After (with Apple theme):**
```tsx
<input type="text" className="apple-input" />
```

## Example 6: Cards with Hover Effects

**Before:**
```tsx
<div className="border border-black rounded-lg p-4">
  Card content
</div>
```

**After (with Apple theme):**
```tsx
<div className="apple-card apple-shadow-md apple-transition apple-hover-lift p-4">
  Card content
</div>
```

## Quick Reference

### Most Common Combinations

1. **Glass Card with Shadow and Hover:**
   ```tsx
   className="apple-card apple-shadow-md apple-transition apple-hover-lift"
   ```

2. **Glass Header:**
   ```tsx
   className="apple-header apple-shadow-sm"
   ```

3. **Glass Container:**
   ```tsx
   className="apple-container apple-rounded-lg apple-shadow-lg"
   ```

4. **Interactive Button:**
   ```tsx
   className="apple-button apple-transition apple-hover-scale"
   ```

5. **Glass Surface:**
   ```tsx
   className="apple-glass apple-rounded-lg apple-shadow-md"
   ```

## Tips

- Combine multiple classes for richer effects
- Use `apple-transition` for smooth animations
- Add `apple-hover-lift` or `apple-hover-scale` for interactive elements
- Use appropriate shadow sizes (`apple-shadow-sm` to `apple-shadow-xl`)
- The theme automatically adapts to dark mode

