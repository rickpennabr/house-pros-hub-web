-- ============================================
-- Migration 052: Allow 'realtor' in user_roles
-- ============================================
-- Extends role CHECK to include realtor for realtor signup and business flow.
-- ============================================

-- Drop existing CHECK constraint (created in 002); name is PostgreSQL default for inline CHECK.
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Re-add CHECK including 'realtor'.
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('customer', 'contractor', 'realtor'));
