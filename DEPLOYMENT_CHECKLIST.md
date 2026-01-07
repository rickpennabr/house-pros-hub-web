# Production Deployment Checklist

Use this checklist before deploying to production to ensure all critical security fixes and configurations are in place.

## Pre-Deployment Security Checks

### Critical Security Fixes
- [x] Admin email hardcoded fallback removed
- [x] File upload endpoints use session userId (not client-provided)
- [x] All console.log statements replaced with structured logger
- [x] Supabase types regenerated, all @ts-ignore comments removed
- [x] Environment variables validated on startup

### Authentication & Authorization
- [ ] Admin login works correctly
- [ ] Regular user login works correctly
- [ ] User signup works correctly
- [ ] Password reset works correctly
- [ ] CSRF protection is working (test a POST request)
- [ ] Role-based access control works (if applicable)

### File Upload Security
- [ ] Profile picture upload works
- [ ] Business logo upload works
- [ ] Business background upload works
- [ ] File size limits are enforced
- [ ] File type validation works (magic bytes)
- [ ] Users can only upload to their own resources

### API Endpoints
- [ ] All GET endpoints respond correctly
- [ ] All POST endpoints require authentication where needed
- [ ] All PUT/PATCH endpoints verify ownership
- [ ] All DELETE endpoints verify ownership
- [ ] Rate limiting is working (test by making many requests)
- [ ] Error responses don't leak sensitive information

### Database Security
- [ ] Row Level Security (RLS) policies are active
- [ ] Users can only access their own data
- [ ] Business owners can only modify their own businesses
- [ ] Admin routes are properly protected

## Production Readiness

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (server-side only)
- [ ] `ADMIN_EMAIL` is set (no hardcoded fallback)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` is set (optional but recommended)
- [ ] All environment variables validated on startup

### Monitoring & Logging
- [ ] Sentry error tracking is configured
- [ ] Sentry is receiving errors (test by triggering an error)
- [ ] No console.log statements in production code
- [ ] Structured logging is working
- [ ] Sensitive data is not logged

### Performance
- [ ] Images are optimized before upload
- [ ] Database queries are using indexes
- [ ] Pagination is working correctly
- [ ] Rate limiting is configured appropriately

### Error Handling
- [ ] Error boundaries are in place
- [ ] User-friendly error messages are displayed
- [ ] Technical errors are logged but not exposed to users
- [ ] 404 pages work correctly
- [ ] 500 error pages work correctly

## Post-Deployment Verification

### Immediate Checks (First 5 minutes)
- [ ] Application loads without errors
- [ ] No console errors in browser
- [ ] No errors in server logs
- [ ] Sentry is receiving events
- [ ] Health check endpoint responds (if created)

### Functional Testing (First 30 minutes)
- [ ] User can sign up
- [ ] User can sign in
- [ ] User can create a business
- [ ] User can edit their business
- [ ] User can upload images
- [ ] Admin can access admin routes
- [ ] Public business listings work
- [ ] Search functionality works

### Security Testing
- [ ] Cannot access admin routes without admin email
- [ ] Cannot modify other users' businesses
- [ ] Cannot upload files to other users' accounts
- [ ] CSRF tokens are required for state-changing operations
- [ ] Rate limiting prevents abuse

### Monitoring (First 24 hours)
- [ ] Monitor Sentry for new errors
- [ ] Check application performance
- [ ] Monitor database query performance
- [ ] Check for any security alerts
- [ ] Review error logs for patterns

## Rollback Plan

If critical issues are discovered:

1. **Immediate Rollback:**
   - Revert to previous deployment version
   - Document the issue
   - Fix in development environment

2. **Partial Rollback:**
   - Disable affected features via feature flags
   - Fix and redeploy specific components

3. **Communication:**
   - Notify users if service is affected
   - Update status page if available
   - Document incident in post-mortem

## Notes

- Test all critical paths before deployment
- Have rollback plan ready
- Monitor closely for first 24 hours
- Keep previous deployment version available
- Document any issues encountered

## Sign-off

- [ ] All critical security checks passed
- [ ] All functional tests passed
- [ ] Monitoring is configured and working
- [ ] Rollback plan is ready
- [ ] Team is notified of deployment

**Deployed by:** _________________  
**Date:** _________________  
**Time:** _________________  
**Version/Commit:** _________________

