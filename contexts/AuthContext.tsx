'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isValidEmail, isValidPassword, isNotEmpty } from '@/lib/validation';
import { authStorage } from '@/lib/storage/authStorage';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  companyRole?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  companyRole?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default user account
const DEFAULT_USER: User = {
  id: 'default_user_rick',
  email: 'rick.maickcompanies@gmail.com',
  firstName: 'Rick',
  lastName: 'Maick',
  companyName: 'Maick Companies',
  companyRole: 'Admin',
};

const DEFAULT_PASSWORD = 'Admin123!';

// Mock delay to simulate API calls
const mockDelay = (ms: number = 400) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a mock JWT token
 */
const generateMockToken = (): string => {
  return `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Authenticate the default user
 */
const authenticateDefaultUser = (email: string, password: string): boolean => {
  if (email.toLowerCase() === DEFAULT_USER.email.toLowerCase() && password === DEFAULT_PASSWORD) {
    const mockToken = generateMockToken();
    authStorage.setUser(DEFAULT_USER);
    authStorage.setToken(mockToken);
    return true;
  }
  return false;
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

      if (storedUser && storedToken) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      authStorage.clear();
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

    // Try to authenticate default user first
    if (authenticateDefaultUser(email, password)) {
      setUser(DEFAULT_USER);
      return;
    }

    // Try to authenticate stored user
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

  const signup = async (userData: SignupData): Promise<void> => {
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
      companyName: userData.companyName,
      companyRole: userData.companyRole,
    };

    const mockToken = generateMockToken();

    // Store in localStorage
    authStorage.setUser(newUser);
    authStorage.setToken(mockToken);
    authStorage.setPassword(userData.email, userData.password);

    setUser(newUser);
  };

  const logout = () => {
    authStorage.clear();
    // Note: We keep passwords stored for future logins (handled by authStorage.clear())
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
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

