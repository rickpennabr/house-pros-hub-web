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

const REQUIRED_ENV_VARS: EnvVar[] = [
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
  // ADMIN_EMAIL is required in production but has a development fallback
  {
    name: 'ADMIN_EMAIL',
    required: process.env.NODE_ENV === 'production',
    description: 'Admin email address for authorization (required in production)',
  },
];

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

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
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
 */
export function validateEnvVarsOrThrow(): void {
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

