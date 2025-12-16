'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isValidEmail, isValidPassword, isNotEmpty } from '@/lib/validation';
import { authStorage } from '@/lib/storage/authStorage';

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
  companyName?: string;
  companyRole?: string;
  userPicture?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<User>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock delay to simulate API calls
const mockDelay = (ms: number = 400) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a mock JWT token
 */
const generateMockToken = (): string => {
  return `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Authenticate a stored user from localStorage
 */
const authenticateStoredUser = (email: string, password: string): boolean => {
  const storedUser = authStorage.getUser();
  
  if (!storedUser || storedUser.email.toLowerCase() !== email.toLowerCase()) {
    return false;
  }

  const storedPassword = authStorage.getPassword(email);
  
  if (storedPassword) {
    // Password is stored, validate it
    if (storedPassword === password) {
      const mockToken = generateMockToken();
      authStorage.setToken(mockToken);
      return true;
    }
    return false;
  } else {
    // Legacy user without stored password - accept any password >= 6 chars for backward compatibility
    if (password.length >= 6) {
      const mockToken = generateMockToken();
      authStorage.setToken(mockToken);
      return true;
    }
    return false;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const storedUser = authStorage.getUser();
      const storedToken = authStorage.getToken();

      console.log('🔵 [checkAuth] Checking auth state:', {
        hasStoredUser: !!storedUser,
        hasStoredToken: !!storedToken,
        storedUserId: storedUser?.id,
      });

      if (storedUser && storedToken) {
        console.log('✅ [checkAuth] User and token found, setting user in context');
        setUser(storedUser);
      } else if (storedUser && !storedToken) {
        console.warn('⚠️ [checkAuth] User found but no token. User will remain in localStorage but not in context.');
        // Don't clear - user exists, just missing token (might be a valid state)
        // Still set user in context so it's available
        setUser(storedUser);
      } else {
        console.log('ℹ️ [checkAuth] No user or token found in localStorage');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ [checkAuth] Error checking auth:', error);
      // Only clear if there's an actual error, not just missing data   
      // Don't clear on missing user/token - that's a valid state (not logged in)                                                                       
      if (error instanceof Error && (error.message.includes('parse') || error.message.includes('JSON'))) {
        console.error('❌ [checkAuth] Storage corruption detected, clearing...');
        authStorage.clear();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    await mockDelay();

    // Validate input
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!isValidPassword(password)) {
      throw new Error('Password must be at least 6 characters');
    }

    // Authenticate stored user
    if (authenticateStoredUser(email, password)) {
      const storedUser = authStorage.getUser();
      if (storedUser) {
        setUser(storedUser);
        return;
      }
    }

    // Authentication failed
    throw new Error('Invalid email or password');
  };

  const signup = async (userData: SignupData): Promise<User> => {
    await mockDelay();

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

    // Check if user already exists
    if (authStorage.userExists(userData.email)) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      referral: userData.referral,
      referralOther: userData.referralOther,
      streetAddress: userData.streetAddress,
      apartment: userData.apartment,
      city: userData.city,
      state: userData.state,
      zipCode: userData.zipCode,
      gateCode: userData.gateCode,
      addressNote: userData.addressNote,
      companyName: userData.companyName,
      companyRole: userData.companyRole,
      userPicture: userData.userPicture,
    };

    const mockToken = generateMockToken();

    // Store in localStorage (synchronous, immediately available)
    authStorage.setUser(newUser);
    authStorage.setToken(mockToken);
    authStorage.setPassword(userData.email, userData.password);

    // Update React context state (asynchronous, may not be immediately available)
    setUser(newUser);

    // Return user for immediate synchronous access
    return newUser;
  };

  const logout = () => {
    authStorage.clear();
    // Note: We keep passwords stored for future logins (handled by authStorage.clear())
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>): Promise<void> => {
    await mockDelay();
    
    if (!user) {
      throw new Error('No user is currently authenticated');
    }

    // Create updated user object
    const updatedUser: User = {
      ...user,
      ...updates,
    };

    // Validate required fields
    if (!isNotEmpty(updatedUser.firstName)) {
      throw new Error('First name is required');
    }

    if (!isNotEmpty(updatedUser.lastName)) {
      throw new Error('Last name is required');
    }

    if (!isValidEmail(updatedUser.email)) {
      throw new Error('Invalid email format');
    }

    // If email changed, update password mapping
    if (user.email !== updatedUser.email) {
      const oldPassword = authStorage.getPassword(user.email);
      if (oldPassword) {
        authStorage.setPassword(updatedUser.email, oldPassword);
      }
    }

    // Update in localStorage
    authStorage.setUser(updatedUser);
    setUser(updatedUser);
    
    console.log('Profile updated successfully:', updatedUser);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
    updateUser,
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

