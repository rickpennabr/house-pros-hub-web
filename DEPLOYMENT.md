# Production Deployment Guide

This guide covers the steps to deploy the House Pros Hub application to production.

## Pre-Deployment Checklist

Before deploying, ensure you have completed all items in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md).

## Environment Variables Setup

### Required Variables

All required environment variables must be set before deployment:

1. **Supabase Configuration**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe for client)
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only, never expose)

2. **Admin Configuration**
   - `ADMIN_EMAIL` - Email address for admin authorization (must be set, no fallback)

### Optional but Recommended

- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN for error tracking
- `NEXT_PUBLIC_APP_VERSION` - Application version for release tracking
- `NODE_ENV` - Set to `production` (usually set automatically by platform)

### Setting Environment Variables

#### Vercel
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable for Production, Preview, and Development environments
4. Redeploy after adding variables

#### Other Platforms
- Set environment variables in your platform's configuration
- Ensure variables are available at build time
- Restart the application after setting variables

## Deployment Steps

### 1. Pre-Deployment Verification

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Build the application locally to catch errors
npm run build
```

### 2. Environment Variable Validation

The application will automatically validate environment variables on startup. If any required variables are missing, the application will fail to start with a clear error message.

### 3. Deploy to Production

#### Using Vercel

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
vercel --prod
```

#### Using Other Platforms

Follow your platform's deployment instructions. Ensure:
- Environment variables are set
- Build command: `npm run build`
- Start command: `npm start`
- Node version: 20.x or later

### 4. Post-Deployment Verification

1. **Immediate Checks (First 5 minutes)**
   - Application loads without errors
   - No console errors in browser
   - Check server logs for errors
   - Verify Sentry is receiving events

2. **Functional Testing (First 30 minutes)**
   - Test user signup/login
   - Test business creation
   - Test file uploads
   - Test admin access
   - Test public pages

3. **Security Verification**
   - Verify admin routes are protected
   - Test CSRF protection
   - Verify rate limiting
   - Check that sensitive data is not exposed

## Monitoring

### Sentry Error Tracking

1. **Verify Configuration**
   - Check that `NEXT_PUBLIC_SENTRY_DSN` is set
   - Verify errors are being sent to Sentry
   - Test by triggering a test error

2. **Set Up Alerts**
   - Configure alerts for critical errors
   - Set up notifications for new issues
   - Monitor error rates

3. **Release Tracking**
   - Sentry automatically tracks releases if `NEXT_PUBLIC_APP_VERSION` or `VERCEL_GIT_COMMIT_SHA` is set
   - Review releases in Sentry dashboard

### Application Logs

- Monitor application logs for errors
- Check for any security warnings
- Review performance metrics

## Rollback Procedure

If critical issues are discovered after deployment:

### Immediate Rollback (Vercel)

1. Go to Vercel dashboard
2. Navigate to your project
3. Go to "Deployments" tab
4. Find the previous working deployment
5. Click "..." menu → "Promote to Production"

### Manual Rollback

1. Revert to previous git commit
2. Redeploy with previous code
3. Verify application is working
4. Document the issue
5. Fix in development environment

### Partial Rollback

If only specific features are affected:
1. Use feature flags to disable affected features
2. Fix issues in development
3. Deploy fixes incrementally

## Health Check Endpoint

Consider creating a health check endpoint for monitoring:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
}
```

## Troubleshooting

### Application Won't Start

1. **Check Environment Variables**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure no extra spaces or quotes

2. **Check Logs**
   - Review application logs for error messages
   - Check build logs for compilation errors
   - Verify database connection

### Errors in Production

1. **Check Sentry**
   - Review error reports in Sentry dashboard
   - Check error frequency and patterns
   - Review stack traces

2. **Check Application Logs**
   - Review server logs
   - Check for database connection issues
   - Verify external service connections

### Performance Issues

1. **Database Performance**
   - Check query performance
   - Verify indexes are being used
   - Review slow query logs

2. **Application Performance**
   - Check response times
   - Review memory usage
   - Check for memory leaks

## Security Considerations

### After Deployment

1. **Verify Security Headers**
   - Check that security headers are set correctly
   - Verify CSP policy is working
   - Test XSS protection

2. **Verify Authentication**
   - Test that unauthorized users cannot access protected routes
   - Verify CSRF protection is working
   - Check that rate limiting is active

3. **Verify Data Access**
   - Test that users can only access their own data
   - Verify RLS policies are working
   - Check that admin routes are protected

## Maintenance

### Regular Tasks

- Monitor error rates weekly
- Review security logs monthly
- Update dependencies regularly
- Review and update environment variables as needed
- Test backup and restore procedures

### Updates

When updating the application:
1. Test changes in development/staging
2. Review [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
3. Deploy during low-traffic periods if possible
4. Monitor closely after deployment
5. Have rollback plan ready

## Support

For issues or questions:
1. Check application logs
2. Review Sentry error reports
3. Check this documentation
4. Contact the development team

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Sentry Next.js Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

