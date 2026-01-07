/**
 * Environment variable validation
 * Validates all required environment variables on app startup
 * Fails fast with clear error messages if critical variables are missing
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

/**
 * Check if we're currently in a build phase
 * During Next.js build/static generation, we skip validation to allow builds to complete
 * Validation should happen at runtime instead when the app serves actual requests
 */
function isBuildPhase(): boolean {
  // Next.js sets NEXT_PHASE during build phases
  // This is the most reliable way to detect if we're in a build context
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'
  ) {
    return true;
  }
  
  // On Vercel, during static page generation ("Collecting page data" phase),
  // NEXT_PHASE might not always be set when layout code executes.
  // We can detect this by checking if we're running in a build context:
  // - Check if we're running the build command (process.argv contains 'build' or 'next build')
  // - On Vercel, during CI builds, VERCEL=1 and CI env vars are set
  // 
  // We check process.argv to see if we're executing as part of a build command.
  // This is a fallback when NEXT_PHASE is not set.
  if (typeof process !== 'undefined' && process.argv) {
    const isBuildCommand = process.argv.some(arg => 
      arg.includes('build') || 
      arg.includes('next build') ||
      arg === 'build'
    );
    if (isBuildCommand) {
      return true;
    }
  }
  
  // During static generation on Vercel, the process might be executing build-related code
  // even if NEXT_PHASE is not explicitly set. As a last resort, if we're on Vercel
  // and the process doesn't look like it's handling a request, we might be building.
  // However, this is too risky - VERCEL=1 is present at both build and runtime.
  // So we don't use this as a check.
  
  return false;
}

/**
 * Get the list of required environment variables
 * ADMIN_EMAIL requirement is evaluated dynamically based on NODE_ENV
 */
function getRequiredEnvVars(): EnvVar[] {
  return [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      description: 'Supabase project URL',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      description: 'Supabase anonymous key for client-side operations',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      required: true,
      description: 'Supabase service role key for server-side operations (never expose to client)',
    },
    // ADMIN_EMAIL is required in production runtime but not during build
    {
      name: 'ADMIN_EMAIL',
      required: process.env.NODE_ENV === 'production' && !isBuildPhase(),
      description: 'Admin email address for authorization (required in production)',
    },
  ];
}

const OPTIONAL_ENV_VARS: EnvVar[] = [
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking (optional but recommended for production)',
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Node environment (development, production, etc.)',
  },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all environment variables
 * @returns Validation result with errors and warnings
 */
export function validateEnvVars(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get required variables (evaluated dynamically)
  const requiredEnvVars = getRequiredEnvVars();

  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      if (envVar.required) {
        errors.push(
          `Missing required environment variable: ${envVar.name}\n` +
          `  Description: ${envVar.description}\n` +
          `  Please set this variable in your environment or .env file.`
        );
      } else {
        // Optional in development but recommended
        warnings.push(
          `Environment variable not set: ${envVar.name}\n` +
          `  Description: ${envVar.description}\n` +
          `  This is required in production. Consider setting it now.`
        );
      }
    }
  }

  // Check optional but recommended variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      if (envVar.name === 'NEXT_PUBLIC_SENTRY_DSN' && process.env.NODE_ENV === 'production') {
        warnings.push(
          `Optional but recommended environment variable not set: ${envVar.name}\n` +
          `  Description: ${envVar.description}\n` +
          `  Consider setting this for production error tracking.`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment variables and throw error if critical ones are missing
 * Call this function at app startup (e.g., in a root layout or middleware)
 * 
 * Note: This function skips validation during build phase to allow builds
 * to complete. Environment variables should be validated at runtime instead.
 */
export function validateEnvVarsOrThrow(): void {
  // Skip validation during build phase - env vars are validated at runtime
  if (isBuildPhase()) {
    return;
  }

  const result = validateEnvVars();

  // Log warnings but don't fail
  if (result.warnings.length > 0) {
    console.warn('Environment variable warnings:');
    for (const warning of result.warnings) {
      console.warn(warning);
    }
  }

  // Throw error if critical variables are missing
  if (!result.isValid) {
    const errorMessage =
      'Environment variable validation failed:\n\n' +
      result.errors.join('\n\n') +
      '\n\nPlease set all required environment variables and restart the application.';
    
    throw new Error(errorMessage);
  }
}

/**
 * Get a validated environment variable value
 * Throws error if required variable is missing
 * @param name - Environment variable name
 * @param required - Whether the variable is required (default: true)
 * @returns The environment variable value
 */
export function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  
  if (required && (!value || value.trim() === '')) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  
  return value || '';
}

