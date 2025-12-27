---
description: "Authentication and authorization patterns for the app"
globs: ["**/auth/**", "**/api/auth/**", "**/contexts/AuthContext.tsx", "**/hooks/useAuth*.ts"]
alwaysApply: false
---

# Authentication Patterns

## Auth Context
- Use `AuthContext` from `contexts/AuthContext.tsx` for global auth state
- Wrap app with `AuthProviderWrapper` from `components/providers/AuthProviderWrapper.tsx`
- Use `useAuthRedirect` hook from `hooks/useAuthRedirect.ts` for protected routes
- Use `useProtectedAction` hook from `hooks/useProtectedAction.ts` for protected actions

## API Authentication
- Auth endpoints live in `app/api/auth/` directory:
  - `login/route.ts` - User login
  - `logout/route.ts` - User logout
  - `signup/route.ts` - User registration
  - `me/route.ts` - Get current user
- Use `lib/storage/authStorage.ts` for token management
- Validate credentials using schemas from `lib/schemas/auth.ts`
- Return user data without sensitive information (no passwords)
- Use consistent user object structure across endpoints

## Protected Routes
- Use layout-level protection for route groups
- Redirect unauthenticated users to signin page
- Show loading states during auth checks
- Use `useAuthRedirect` hook for client-side redirects
- Check auth status before rendering protected content

## Storage Patterns
- Use `lib/storage/authStorage.ts` for auth token storage
- Use `lib/storage/businessStorage.ts` for business data storage
- Follow existing storage patterns in the codebase
- Handle storage errors gracefully

## Auth Flow
1. User submits credentials via form
2. Validate with Zod schema
3. Call API endpoint (`/api/auth/login` or `/api/auth/signup`)
4. Store token using `authStorage`
5. Update AuthContext with user data
6. Redirect to appropriate page

## Error Handling
- Display user-friendly error messages
- Handle network errors gracefully
- Show validation errors inline with forms
- Log auth errors for debugging but don't expose to users
