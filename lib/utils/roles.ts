import { createClient } from '@/lib/supabase/server';

/**
 * User role types
 */
export type UserRole = 'customer' | 'contractor';

/**
 * Get all active roles for a user
 * @param userId - The user ID
 * @returns Array of active role names
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const supabase = await createClient();
    
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }

    return (roles || []).map((r) => r.role as UserRole);
  } catch (error) {
    console.error('Error in getUserRoles:', error);
    return [];
  }
}

/**
 * Check if user has a specific role
 * @param userId - The user ID
 * @param role - The role to check for
 * @returns True if user has the role, false otherwise
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', role)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected
      console.error('Error checking user role:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasRole:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified roles
 * @param userId - The user ID
 * @param roles - Array of roles to check for
 * @returns True if user has at least one of the roles, false otherwise
 */
export async function hasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
  if (roles.length === 0) {
    return false;
  }

  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .in('role', roles)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user roles:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasAnyRole:', error);
    return false;
  }
}

/**
 * Check if user can create a business (has contractor role)
 * @param userId - The user ID
 * @returns True if user has contractor role, false otherwise
 */
export async function canCreateBusiness(userId: string): Promise<boolean> {
  return hasRole(userId, 'contractor');
}

/**
 * Add a role to a user
 * @param userId - The user ID
 * @param role - The role to add
 * @returns True if successful, false otherwise
 */
export async function addRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle();

    if (existingRole) {
      // Role exists - reactivate if deactivated
      if (!existingRole.is_active) {
        const { error } = await supabase
          .from('user_roles')
          .update({
            is_active: true,
            activated_at: new Date().toISOString(),
            deactivated_at: null,
          })
          .eq('id', existingRole.id);

        if (error) {
          console.error('Error reactivating role:', error);
          return false;
        }
      }
      return true;
    }

    // Role doesn't exist - create it
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role,
        is_active: true,
        activated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error adding role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in addRole:', error);
    return false;
  }
}

/**
 * Remove a role from a user (deactivate, don't delete)
 * @param userId - The user ID
 * @param role - The role to remove
 * @returns True if successful, false otherwise
 */
export async function removeRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('user_roles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      console.error('Error removing role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in removeRole:', error);
    return false;
  }
}

