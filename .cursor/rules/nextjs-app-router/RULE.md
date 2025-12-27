---
description: "Standards for Next.js App Router, API routes, and React Server Components"
alwaysApply: true
---

# Next.js App Router Standards

## File Structure
- Use App Router conventions (`app/` directory)
- API routes go in `app/api/[route]/route.ts`
- Page components go in `app/[route]/page.tsx`
- Layout components go in `app/[route]/layout.tsx`
- Group related routes using route groups: `(auth)`, `(main)`, etc.

## Client vs Server Components
- Default to Server Components (no 'use client')
- Add 'use client' only when needed:
  - Using React hooks (useState, useEffect, etc.)
  - Event handlers (onClick, onChange, etc.)
  - Browser APIs (localStorage, window, etc.)
  - Context providers
- Keep Server Components at the top of the component tree when possible
- Mark client components with `'use client'` directive at the top

## API Routes
- Use `NextRequest` and `NextResponse` from 'next/server'
- Always validate input using Zod schemas from `lib/schemas/`
- Return consistent error format: `{ error: string }` with appropriate status codes
- Include JSDoc comments explaining the endpoint, request body, and response
- Use try-catch blocks for error handling
- Log errors with `console.error` for debugging
- Handle Zod validation errors separately with 400 status

## Component Structure
- Place components in `components/` directory
- Group related components in subdirectories (e.g., `components/auth/`, `components/ui/`)
- Export components as named exports
- Define prop interfaces above the component
- Use TypeScript for all components

## Route Groups
- Use route groups `(auth)`, `(main)` for layout organization
- Each route group can have its own `layout.tsx`
- Route groups don't affect URL structure
