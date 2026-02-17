import { useState, useEffect } from 'react';

const BACKEND_URL = '';

export function useAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/token`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.token.token);
        setUser(data.user);
        console.log('🎉 Google OAuth Success!');
        console.log('Access Token:', data.token.token);
        console.log('User Data:', data.user);
      } else {
        setAccessToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${BACKEND_URL}/auth/google/callback`;
  };

  const logout = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/google/signout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setAccessToken(null);
        setUser(null);
        console.log('Successfully signed out');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return {
    accessToken,
    user,
    isLoading,
    isAuthenticated: !!accessToken,
    login,
    logout
  };
}