---
description: "Template and standards for Next.js API route handlers"
globs: ["**/api/**/route.ts"]
alwaysApply: false
---

# API Route Template

When creating new API routes, follow this structure:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { yourSchema } from '@/lib/schemas/yourSchema';

/**
 * POST /api/your-route
 * Description of what this endpoint does
 * 
 * Request body: { field1: string, field2: number }
 * Response: { success: boolean, data?: YourType, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input with Zod
    const validatedData = yourSchema.parse(body);
    
    // Your business logic here
    
    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    // Log and handle other errors
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Standards
- Always validate input with Zod schemas from `lib/schemas/`
- Return consistent error format: `{ error: string }` or `{ error: string, details?: any }`
- Include JSDoc comments describing endpoint, request, and response
- Handle Zod validation errors separately with 400 status
- Log errors with `console.error` for debugging
- Use appropriate HTTP status codes:
  - 200: Success
  - 400: Bad Request (validation errors)
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 500: Internal Server Error

## Request Validation
- Always validate request body with Zod schemas
- Check for required fields before validation
- Return clear error messages for validation failures
- Use schemas from `lib/schemas/` directory

## Response Format
- Success: `{ success: true, data: ... }` or `{ user: ... }` (follow existing patterns)
- Error: `{ error: string }` or `{ error: string, details?: any }`
- Be consistent with existing API routes in the project
