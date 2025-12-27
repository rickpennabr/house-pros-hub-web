/**
 * Client-side utility to get CSRF token from API
 * 
 * @returns CSRF token string
 * @throws Error if token cannot be retrieved
 */
export async function getCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get CSRF token');
    }

    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

