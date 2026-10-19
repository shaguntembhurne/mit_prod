import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { tokenStorage } from './utils/tokenStorage';
import { createApiClient, extractTokensFromResponse } from './api/client';
import LoginFlow from './components/LoginFlow';
import ChatInterface from './components/ChatInterface';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => tokenStorage.getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [authNotice, setAuthNotice] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSessionExpired = useCallback((message) => {
    tokenStorage.clearSession();
    setUser(null);
    setIsAuthenticated(false);
    if (message) setAuthNotice(message);
  }, []);

  const apiClient = useMemo(
    () => createApiClient(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8002', handleSessionExpired),
    [handleSessionExpired]
  );

  // Restore authenticated session on page refresh if tokens are valid
  useEffect(() => {
    let isMounted = true;

    async function verifyExistingSession() {
      const existingAccess = tokenStorage.getAccessToken();
      const existingRefresh = tokenStorage.getRefreshToken();

      if (!existingAccess && !existingRefresh) {
        if (isMounted) setIsRestoring(false);
        return;
      }

      try {
        const profile = await apiClient.getCurrentUser();
        if (isMounted) {
          setUser(profile);
          tokenStorage.setStoredUser(profile);
          setIsAuthenticated(true);
        }
      } catch {
        if (isMounted) {
          tokenStorage.clearSession();
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    }

    verifyExistingSession();
    return () => {
      isMounted = false;
    };
  }, [apiClient]);

  const handleLoginSuccess = async (verifyResponseData, fallbackEmail) => {
    const { access, refresh } = extractTokensFromResponse(verifyResponseData);

    if (!access) {
      throw new Error('Authentication succeeded, but the backend response did not include an access token.');
    }

    tokenStorage.setTokens(access, refresh);

    // Fetch current user profile from GET /api/auth/me/
    try {
      const profile = await apiClient.getCurrentUser();
      const normalizedUser = profile && typeof profile === 'object' ? profile : { email: fallbackEmail };
      setUser(normalizedUser);
      tokenStorage.setStoredUser(normalizedUser);
    } catch {
      const fallbackUser = (verifyResponseData && verifyResponseData.user) || { email: fallbackEmail };
      setUser(fallbackUser);
      tokenStorage.setStoredUser(fallbackUser);
    }

    setAuthNotice('');
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthNotice('');
  };

  if (isRestoring) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
        <p className="text-xs font-medium">Restoring university session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginFlow
        apiClient={apiClient}
        onLoginSuccess={handleLoginSuccess}
        initialNotice={authNotice}
      />
    );
  }

  return (
    <ChatInterface
      user={user}
      apiClient={apiClient}
      onLogout={handleLogout}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
    />
  );
}
