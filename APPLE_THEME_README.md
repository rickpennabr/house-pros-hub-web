# Apple Theme - Usage Guide

This project includes a separate Apple-style theme with glassmorphism effects, soft shadows, and smooth transitions. The theme is available as utility classes that can be applied to any component.

## Features

- **Glassmorphism**: Frosted glass effects with backdrop blur
- **Soft Shadows**: Apple-style depth and elevation
- **Smooth Transitions**: Cubic-bezier animations
- **Dark Mode Support**: Automatic dark mode variants
- **Responsive**: Works across all screen sizes

## How to Use

Simply add the Apple theme classes to your components. The theme is already imported in `app/layout.tsx`.

### Example: Apply Apple Card Style

```tsx
<div className="apple-card">
  {/* Your content */}
</div>
```

### Example: Apply Apple Glass Effect

```tsx
<div className="apple-glass apple-rounded-lg">
  {/* Your content */}
</div>
```

### Example: Apply Apple Header

```tsx
<header className="apple-header">
  {/* Your header content */}
</header>
```

## Available Classes

### Glass Effects
- `apple-glass` - Standard glass effect (light mode)
- `apple-glass-dark` - Glass effect for dark mode
- `apple-blur` - Standard blur (20px)
- `apple-blur-sm` - Small blur (10px)
- `apple-blur-lg` - Large blur (40px)

### Cards
- `apple-card` - Apple-style card with glass effect
- `apple-card-dark` - Dark mode card variant
- `apple-container` - Container with glass effect
- `apple-container-dark` - Dark mode container

### Surfaces
- `apple-surface` - Light surface background
- `apple-surface-dark` - Dark surface background
- `apple-header` - Header with glass effect
- `apple-header-dark` - Dark mode header

### Buttons
- `apple-button` - Apple-style button with glass effect

### Borders
- `apple-border` - Light border style
- `apple-border-dark` - Dark border style

### Shadows
- `apple-shadow-sm` - Small shadow
- `apple-shadow-md` - Medium shadow
- `apple-shadow-lg` - Large shadow
- `apple-shadow-xl` - Extra large shadow

### Rounded Corners
- `apple-rounded` - 12px border radius
- `apple-rounded-lg` - 20px border radius
- `apple-rounded-xl` - 24px border radius
- `apple-rounded-full` - Full circle

### Transitions
- `apple-transition` - Standard transition (0.3s)
- `apple-transition-fast` - Fast transition (0.15s)
- `apple-transition-slow` - Slow transition (0.5s)

### Hover Effects
- `apple-hover-lift` - Lifts on hover
- `apple-hover-scale` - Scales on hover

### Inputs
- `apple-input` - Apple-style input field

### Gradients
- `apple-gradient-light` - Light gradient background
- `apple-gradient-dark` - Dark gradient background

## Examples

### Card Component
```tsx
<div className="apple-card apple-shadow-md apple-transition apple-hover-lift">
  <h2>Card Title</h2>
  <p>Card content</p>
</div>
```

### Header Component
```tsx
<header className="apple-header apple-shadow-sm">
  <nav>Navigation items</nav>
</header>
```

### Button Component
```tsx
<button className="apple-button apple-transition">
  Click Me
</button>
```

### Container with Glass Effect
```tsx
<div className="apple-container apple-rounded-lg apple-shadow-lg">
  <div className="p-6">
    Content with glass effect
  </div>
</div>
```

## Dark Mode

The theme automatically adapts to dark mode using `@media (prefers-color-scheme: dark)`. You can also use explicit dark variants:
- `apple-glass-dark`
- `apple-card-dark`
- `apple-header-dark`
- `apple-container-dark`
- `apple-surface-dark`
- `apple-border-dark`

## Combining Classes

You can combine multiple Apple theme classes for more complex effects:

```tsx
<div className="apple-card apple-shadow-lg apple-rounded-xl apple-transition apple-hover-lift">
  {/* Enhanced card with multiple effects */}
</div>
```

## Notes

- All glass effects use `backdrop-filter` which requires modern browsers
- The theme works best with semi-transparent backgrounds
- Shadows and blur effects may impact performance on lower-end devices
- The theme is designed to work alongside Tailwind CSS classes

