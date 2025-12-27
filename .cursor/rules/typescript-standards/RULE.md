---
description: "TypeScript coding standards and type safety practices"
alwaysApply: true
---

# TypeScript Standards

## Type Safety
- Always use TypeScript for new files (`.ts` or `.tsx`)
- Prefer explicit types over `any`
- Use `unknown` instead of `any` when type is truly unknown
- Use type assertions (`as`) sparingly and only when necessary
- Leverage TypeScript's type inference when types are obvious

## Component Props
- Use interfaces for component props (not types)
- Define interfaces above the component
- Use descriptive prop names
- Mark optional props with `?`
- Provide default values for optional props when appropriate

## Schema Types
- Export types from Zod schemas using `z.infer<typeof schema>`
- Place schemas in `lib/schemas/` directory
- Use consistent naming: `SchemaName` for schema, `SchemaNameType` or `SchemaName` for type
- Example: `signupSchema` → `SignupSchema` type

## Function Types
- Use explicit return types for exported functions
- Use type inference for internal helper functions
- Use `async`/`Promise<T>` for async functions
- Type event handlers properly (e.g., `React.ChangeEvent<HTMLInputElement>`)

## Import/Export
- Use named exports for components and utilities
- Use default exports sparingly (only for pages/layouts when required by Next.js)
- Group imports: external → internal → relative
- Use path aliases (`@/`) for internal imports

## Type Patterns
```typescript
// Component props interface
interface ComponentProps {
  required: string;
  optional?: number;
  children: ReactNode;
}

// Schema type export
export type UserSchema = z.infer<typeof userSchema>;

// Function with explicit return type
export function calculateTotal(items: Item[]): number {
  // ...
}

// Event handler types
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // ...
};
```
