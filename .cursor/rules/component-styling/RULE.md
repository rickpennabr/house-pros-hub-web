---
description: "Tailwind CSS styling conventions and component patterns"
globs: ["**/components/**/*.tsx"]
alwaysApply: false
---

# Component Styling Standards

## Tailwind CSS
- Use Tailwind utility classes for all styling
- Prefer composition over custom CSS
- Use `className` prop for styling, not inline styles
- Group related classes logically: layout → spacing → colors → typography → effects
- Use responsive prefixes (`sm:`, `md:`, `lg:`) when needed
- Follow existing color scheme: black/white/gray palette

## UI Component Patterns
- Use the `Button` component from `components/ui/Button.tsx` for all buttons
- Follow existing variant patterns:
  - `primary`: black background, white text
  - `secondary`: white background, black border
  - `outline`: transparent background, black border
- Use size variants consistently: `sm`, `md`, `lg`
- Extend base classes via `className` prop rather than overriding completely
- Use `FormField` component for all form inputs with labels

## Component Structure
- Define interfaces for props above the component
- Use default parameter values for optional props
- Compose className strings using template literals
- Keep base classes separate from variant/size classes for clarity
- Make sure all buttons are cursor pointer

## Accessibility
- Include proper ARIA labels where needed
- Ensure keyboard navigation works (tab order, Enter/Space for buttons)
- Maintain proper focus states (visible outlines)
- Use semantic HTML elements (`button`, `form`, `label`, etc.)
- Associate labels with inputs properly

## Example Component Pattern
```typescript
interface MyComponentProps {
  variant?: 'primary' | 'secondary';
  className?: string;
  children: ReactNode;
}

export function MyComponent({ 
  variant = 'primary', 
  className = '', 
  children 
}: MyComponentProps) {
  const baseClasses = 'base-styles';
  const variantClasses = {
    primary: 'primary-styles',
    secondary: 'secondary-styles',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
```
