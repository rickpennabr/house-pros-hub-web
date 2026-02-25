'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isValidEmail, isValidPassword, isNotEmpty } from '@/lib/validation';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types/supabase';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referral?: string;
  referralOther?: string;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  addressNote?: string;
  businessId?: string;
  companyName?: string;
  companyRole?: string;
  companyRoleOther?: string;
  userPicture?: string;
  preferredLocale?: string;
}

export type UserRole = 'customer' | 'contractor';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  roles: UserRole[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referral?: string;
  referralOther?: string;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  addressNote?: string;
  companyName?: string;
  companyRole?: string;
  userPicture?: string;
  userType?: 'customer' | 'contractor' | 'both';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Map Supabase user and profile to our User interface
 */
function mapSupabaseUserToUser(supabaseUser: SupabaseUser, profile: Profile | null, companyName?: string | null): User {
  // Get basic info from user metadata (set during signup)
  const metadata = supabaseUser.user_metadata || {};
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    firstName: profile?.first_name || metadata.firstName || '',
    lastName: profile?.last_name || metadata.lastName || '',
    phone: profile?.phone || metadata.phone,
    referral: profile?.referral || metadata.referral,
    referralOther: profile?.referral_other || metadata.referralOther,
    streetAddress: profile?.street_address || metadata.streetAddress,
    apartment: profile?.apartment || metadata.apartment,
    city: profile?.city || metadata.city,
    state: profile?.state || metadata.state,
    zipCode: profile?.zip_code || metadata.zipCode,
    gateCode: profile?.gate_code || metadata.gateCode,
    addressNote: profile?.address_note || metadata.addressNote,
    businessId: profile?.business_id || metadata.businessId || undefined,
    companyName: companyName || metadata.companyName || undefined,
    companyRole: profile?.company_role || metadata.companyRole,
    companyRoleOther: profile?.company_role_other || metadata.companyRoleOther,
    userPicture: profile?.user_picture || metadata.userPicture,
    preferredLocale: profile?.preferred_locale || metadata.preferredLocale,
  };
}

/**
 * Get user-friendly error message from Supabase error
 */
function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred';
  
  // Handle Supabase Auth errors
  const messageText =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string')
          ? (error as { message: string }).message
          : null;

  if (messageText) {
    const message = messageText.toLowerCase();
    
    if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
      return 'Invalid email or password';
    }
    if (message.includes('email already registered') || message.includes('user already registered')) {
      return 'User with this email already exists';
    }
    if (message.includes('password')) {
      return 'Password does not meet requirements';
    }
    if (message.includes('email')) {
      return 'Invalid email format';
    }
    
    return messageText;
  }
  
  return 'An unexpected error occurred';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  /**
   * Load user data from Supabase session
   */
  const loadUserFromSession = useCallback(async (session: Session | null) => {
    try {
      if (!session?.user) {
        setUser(null);
        setIsAdmin(false);
        setRoles([]);
        setIsLoading(false);
        return;
      }

      // Fetch profile from database
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 is "not found" - profile might not exist yet, which is okay
        console.error('Error fetching profile:', profileError);
      }

      // Fetch business name if business_id exists
      let companyName: string | null = null;
      if (profile?.business_id) {
        const { data: business } = await supabase
          .from('businesses')
          .select('business_name')
          .eq('id', profile.business_id)
          .single();
        companyName = business?.business_name || null;
      }

      // Map Supabase user and profile to our User interface
      const mappedUser = mapSupabaseUserToUser(session.user, profile, companyName);
      setUser(mappedUser);
      // Fetch admin status and roles from server (ADMIN_EMAIL not exposed to client)
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const { isAdmin: admin, roles: userRoles } = await res.json();
          setIsAdmin(!!admin);
          setRoles(Array.isArray(userRoles) ? userRoles : []);
        } else {
          setIsAdmin(false);
          setRoles([]);
        }
      } catch {
        setIsAdmin(false);
        setRoles([]);
      }
    } catch (error) {
      console.error('Error loading user from session:', error);
      setUser(null);
      setIsAdmin(false);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      // Try client-side session first (faster for normal cases)
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!error && session) {
          await loadUserFromSession(session);
          return;
        }
      } catch (clientError) {
        // If client-side fails, fall through to API check
        console.warn('Client-side session check failed, trying API:', clientError);
      }

      // Fallback: Use API endpoint for OAuth cases where cookies might not be immediately available
      // This is more reliable after OAuth redirects
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const { user: apiUser, isAdmin: apiIsAdmin, roles: userRoles } = await response.json();
          if (apiUser) {
            // Map API user response to our User interface
            setUser({
              id: apiUser.id,
              email: apiUser.email,
              firstName: apiUser.firstName || '',
              lastName: apiUser.lastName || '',
              phone: apiUser.phone,
              referral: apiUser.referral,
              referralOther: apiUser.referralOther,
              streetAddress: apiUser.streetAddress,
              apartment: apiUser.apartment,
              city: apiUser.city,
              state: apiUser.state,
              zipCode: apiUser.zipCode,
              gateCode: apiUser.gateCode,
              addressNote: apiUser.addressNote,
              businessId: apiUser.businessId,
              companyName: apiUser.companyName,
              companyRole: apiUser.companyRole,
              companyRoleOther: apiUser.companyRoleOther,
              userPicture: apiUser.userPicture,
              preferredLocale: apiUser.preferredLocale,
            });
            setIsAdmin(!!apiIsAdmin);
            setRoles(Array.isArray(userRoles) ? userRoles : []);
            setIsLoading(false);
            return;
          }
        }
      } catch (apiError) {
        console.warn('API auth check failed:', apiError);
      }

      // If both methods fail, user is not authenticated
      setUser(null);
      setIsAdmin(false);
      setRoles([]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
      setIsAdmin(false);
      setRoles([]);
      setIsLoading(false);
    }
  }, [supabase, loadUserFromSession]);

  // Initialize auth state from Supabase session on mount
  useEffect(() => {
    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserFromSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setRoles([]);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth, loadUserFromSession, supabase]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate input
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    if (!isValidPassword(password)) {
      throw new Error('Password must be at least 6 characters');
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    if (!data.session) {
      throw new Error('Failed to create session');
    }

    // Load user data from session
    await loadUserFromSession(data.session);
  }, [supabase, loadUserFromSession]);

  const signup = useCallback(async (userData: SignupData): Promise<User> => {
    // Validate input
    if (!isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    if (!isValidPassword(userData.password)) {
      throw new Error('Password must be at least 6 characters');
    }

    if (!isNotEmpty(userData.firstName)) {
      throw new Error('First name is required');
    }

    if (!isNotEmpty(userData.lastName)) {
      throw new Error('Last name is required');
    }

    // Normalize email
    const normalizedEmail = userData.email.trim().toLowerCase();

    // Sign up with Supabase
    // Store basic info in user_metadata (firstName, lastName, email)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: userData.password,
      options: {
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: normalizedEmail,
        },
      },
    });

    if (authError) {
      throw new Error(getErrorMessage(authError));
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Note: If email confirmation is required, there might not be a session yet,
    // so RLS policies may block profile operations. The database trigger should
    // create a basic profile automatically with SECURITY DEFINER (bypasses RLS).
    // We'll try to update it, but if it fails due to RLS, that's okay - the user
    // can complete their profile after email confirmation.

    // Create or update profile in database
    // Note: Database trigger should create a basic profile, so we'll update it with full data
    const profileData = {
      id: authData.user.id,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone || null,
      referral: userData.referral || null,
      referral_other: userData.referralOther || null,
      street_address: userData.streetAddress || null,
      apartment: userData.apartment || null,
      city: userData.city || null,
      state: userData.state || null,
      zip_code: userData.zipCode || null,
      gate_code: userData.gateCode || null,
      address_note: userData.addressNote || null,
      company_name: userData.companyName || null,
      company_role: userData.companyRole || null,
      user_picture: userData.userPicture || null,
    };

    // Try to update profile (trigger should have created it)
    // Use upsert which will insert if doesn't exist, update if it does
    // Note: This may fail due to RLS if email confirmation is required and session isn't set yet
    // That's okay - the trigger creates a basic profile, and user can update after email confirmation
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
      })
      .select();

    // Only log if there's a meaningful error with actual error information
    // Skip empty error objects (which shouldn't happen but sometimes do)
    if (profileError && (profileError.message || profileError.code || profileError.details || profileError.hint)) {
      // Check if it's an RLS/permissions error
      const isRLSError = profileError.code === '42501' || 
                         profileError.message?.includes('permission') ||
                         profileError.message?.includes('policy') ||
                         profileError.hint?.includes('RLS');

      if (!isRLSError) {
        // Real error that's not just RLS blocking
        console.error('Error creating/updating profile:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });
      }
      // Otherwise silently skip - RLS errors or empty error objects are not logged
      // The trigger already created a basic profile, user can update later if needed
    }

    // Assign role(s) based on userType
    if (userData.userType) {
      const roles = userData.userType === 'both' 
        ? ['customer', 'contractor'] 
        : [userData.userType];
      
      for (const role of roles) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: role as 'customer' | 'contractor',
            is_active: true,
            activated_at: new Date().toISOString(),
          });

        // Only log if there's a meaningful error with actual error information
        // Skip empty error objects (which shouldn't happen but sometimes do)
        if (roleError && (roleError.message || roleError.code || roleError.details || roleError.hint)) {
          // Check if it's an RLS/permissions error
          const isRLSError = roleError.code === '42501' || 
                             roleError.message?.includes('permission') ||
                             roleError.message?.includes('policy') ||
                             roleError.hint?.includes('RLS');

          if (!isRLSError) {
            // Real error that's not just RLS blocking
            console.error(`Error assigning ${role} role:`, {
              message: roleError.message,
              details: roleError.details,
              hint: roleError.hint,
              code: roleError.code,
            });
          }
          // Otherwise silently skip - RLS errors or empty error objects are not logged
          // Role can be assigned later if needed
        }
      }
    }

    // Load user data from session
    let mappedUser: User;
    
    if (authData.session) {
      await loadUserFromSession(authData.session);
      // Get the user from state after loading
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        // Fetch business name if business_id exists
        let companyName: string | null = null;
        if (profile?.business_id) {
          const { data: business } = await supabase
            .from('businesses')
            .select('business_name')
            .eq('id', profile.business_id)
            .single();
          companyName = business?.business_name || null;
        }
        
        mappedUser = mapSupabaseUserToUser(session.user, profile, companyName);
      } else {
        throw new Error('Failed to get session after signup');
      }
    } else {
      // If no session (email confirmation required), create user object from auth data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      // Fetch business name if business_id exists
      let companyName: string | null = null;
      if (profile?.business_id) {
        const { data: business } = await supabase
          .from('businesses')
          .select('business_name')
          .eq('id', profile.business_id)
          .single();
        companyName = business?.business_name || null;
      }

      mappedUser = mapSupabaseUserToUser(authData.user, profile, companyName);
      setUser(mappedUser);
    }

    return mappedUser;
  }, [supabase, loadUserFromSession]);

  const logout = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      // Still clear user state even if signOut fails
    }
    
    setUser(null);
    setIsAdmin(false);
    setRoles([]);
  }, [supabase]);

  const updateUser = useCallback(async (updates: Partial<User>): Promise<void> => {
    if (!user) {
      throw new Error('No user is currently authenticated');
    }

    // Skip session check to prevent hanging - the API will validate authentication
    // This makes the form more responsive and prevents timeouts from blocking updates

    // Get CSRF token for API request (with timeout)
    let csrfToken = '';
    try {
      const csrfController = new AbortController();
      const csrfTimeout = setTimeout(() => csrfController.abort(), 5000);
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
        signal: csrfController.signal,
      });
      clearTimeout(csrfTimeout);
      if (csrfResponse.ok) {
        const csrfData = await csrfResponse.json();
        csrfToken = csrfData.csrfToken;
      }
    } catch (error) {
      console.warn('Failed to get CSRF token, continuing anyway:', error);
    }

    // Call profile update API endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let response: Response;
    try {
      response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        credentials: 'include',
        body: JSON.stringify(updates),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const result = await response.json().catch(() => {
      // If JSON parsing fails, still update local state with what we have
      return { profile: null };
    });
    const updatedProfile = result.profile;

    // Update local state immediately with the updated profile data
    // This ensures the UI updates right away and the form submission completes quickly
    // Use updatedProfile data if available, otherwise use the updates we sent
    setUser({
      ...user,
      ...updates,
      email: updatedProfile?.email || updates.email || user.email,
      firstName: updatedProfile?.firstName || updates.firstName || user.firstName,
      lastName: updatedProfile?.lastName || updates.lastName || user.lastName,
      phone: updatedProfile?.phone ?? updates.phone ?? user.phone,
      referral: updatedProfile?.referral ?? updates.referral ?? user.referral,
      referralOther: updatedProfile?.referralOther ?? updates.referralOther ?? user.referralOther,
      businessId: updatedProfile?.businessId ?? updates.businessId ?? user.businessId,
      companyName: updatedProfile?.companyName ?? updates.companyName ?? user.companyName,
      companyRole: updatedProfile?.companyRole ?? updates.companyRole ?? user.companyRole,
      companyRoleOther: updatedProfile?.companyRoleOther ?? updates.companyRoleOther ?? user.companyRoleOther,
      userPicture: updatedProfile?.userPicture || updates.userPicture || user.userPicture,
      preferredLocale: updatedProfile?.preferredLocale ?? updates.preferredLocale ?? user.preferredLocale,
    });

    // Try to refresh session in the background (completely non-blocking)
    // Don't await this - let it run in the background without blocking the form submission
    supabase.auth.refreshSession()
      .then(({ data: { session: newSession }, error: refreshError }) => {
        if (refreshError) {
          // Only log non-timeout errors
          if (!refreshError.message?.includes('timed out') && 
              !refreshError.message?.includes('Refresh Token Not Found') &&
              !refreshError.message?.includes('refresh_token_not_found')) {
            console.warn('Error refreshing session (non-blocking):', refreshError.message);
          }
          return;
        }
        
        if (newSession) {
          // Load user from session in the background
          loadUserFromSession(newSession).catch((error) => {
            console.warn('Error loading user from session (non-blocking):', error);
          });
        }
      })
      .catch((error) => {
        // Ignore errors - session refresh is optional
        console.warn('Session refresh failed (non-blocking):', error);
      });
  }, [user, supabase, loadUserFromSession]);

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate input
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Extract locale from current pathname (format: /en/... or /es/...)
    const pathname = window.location.pathname;
    const localeMatch = pathname.match(/^\/(en|es)(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : 'en';

    // Call API endpoint
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-locale': locale,
      },
      credentials: 'include',
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to request password reset' }));
      throw new Error(errorData.error || 'Failed to request password reset');
    }
  }, []);

  const resetPassword = useCallback(async (newPassword: string): Promise<void> => {
    // Validate input
    if (!isValidPassword(newPassword)) {
      throw new Error('Password must be at least 8 characters and contain uppercase, lowercase, and number');
    }

    // Call API endpoint
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password: newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to reset password' }));
      throw new Error(errorData.error || 'Failed to reset password');
    }

    // Get user data from response
    const result = await response.json();
    
    // Refresh session to get updated user data
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // Try to load user from the response
      if (result.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', result.user.id)
          .single();
        
        // Fetch business name if business_id exists
        let companyName: string | null = null;
        if (profile?.business_id) {
          const { data: business } = await supabase
            .from('businesses')
            .select('business_name')
            .eq('id', profile.business_id)
            .single();
          companyName = business?.business_name || null;
        }
        
        const mappedUser = mapSupabaseUserToUser(
          { 
            id: result.user.id, 
            email: result.user.email || '', 
            user_metadata: {} 
          } as SupabaseUser,
          profile,
          companyName
        );
        setUser(mappedUser);
      }
      return;
    }

    // Load user data from session
    await loadUserFromSession(session);
  }, [supabase, loadUserFromSession]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin,
    roles,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
    updateUser,
    requestPasswordReset,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
