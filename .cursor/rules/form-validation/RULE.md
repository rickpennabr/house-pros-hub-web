---
description: "Standards for form handling and validation using React Hook Form and Zod"
globs: ["**/signup/**", "**/components/**/*Form*.tsx", "**/hooks/use*Form*.ts"]
alwaysApply: false
---

# Form Validation Standards

## Validation Schemas
- Use Zod schemas from `lib/schemas/` for all validation
- Define schemas in `lib/schemas/` directory (e.g., `auth.ts`, `business.ts`)
- Export TypeScript types from schemas using `z.infer<typeof schema>`
- Use descriptive error messages in schema validations
- Use `.refine()` for complex validation logic (e.g., password confirmation)

## Form Components
- Use React Hook Form for form state management
- Use `@hookform/resolvers/zod` for Zod integration
- Use custom form components from `components/ui/`:
  - `FormField` for field wrapper with label and error display
  - `Input` for text inputs
  - `PasswordInput` for password fields
  - `Select` for dropdowns
  - `ErrorMessage` for validation errors (if needed separately)
  - `SuccessMessage` for success feedback
- Extract form logic into custom hooks in `hooks/` directory (e.g., `useSignupForm.ts`)

## Form Patterns
- Use `useForm` hook with resolver: `useForm({ resolver: zodResolver(schema) })`
- Handle form submission with `handleSubmit` from React Hook Form
- Display field errors using `errors` object from form state
- Use `FormField` component which automatically shows errors in the label
- Mark required fields with `required` prop on `FormField`

## Error Handling
- Display field-level errors using `FormField` component (errors shown in label)
- Show success messages using `SuccessMessage` component
- Handle API errors gracefully with user-friendly messages
- Validate on submit, not on blur (unless specific UX requirement)

## Example Form Hook Pattern
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupSchema } from '@/lib/schemas/auth';

export function useSignupForm() {
  const form = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: { /* ... */ }
  });

  const onSubmit = async (data: SignupSchema) => {
    // Handle submission
  };

  return { form, onSubmit: form.handleSubmit(onSubmit) };
}
```
