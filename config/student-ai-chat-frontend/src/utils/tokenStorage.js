/**
 * Token Storage Strategy & Security Notes:
 * ----------------------------------------
 * If the Django backend returned HttpOnly cookies, the browser would manage tokens
 * automatically with credentials: 'include'. Because the current Django REST + SimpleJWT
 * backend returns JSON payloads containing { access, refresh } tokens in the response body
 * of POST /api/auth/otp/verify/ and expects "Authorization: Bearer <access>" headers,
 * we store tokens in sessionStorage (with in-memory caching) so tokens are scoped to the
 * browser session, Survive page refreshes (Requirement 2.8), and are cleared immediately
 * on logout or tab closure. Never log tokens or OTPs to the console.
 */

const ACCESS_TOKEN_KEY = 'uni_ai_access_token';
const REFRESH_TOKEN_KEY = 'uni_ai_refresh_token';
const USER_PROFILE_KEY = 'uni_ai_user_profile';

let memoryAccessToken = null;
let memoryRefreshToken = null;

export const tokenStorage = {
  getAccessToken() {
    if (memoryAccessToken) return memoryAccessToken;
    try {
      memoryAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
      return memoryAccessToken;
    } catch {
      return null;
    }
  },

  getRefreshToken() {
    if (memoryRefreshToken) return memoryRefreshToken;
    try {
      memoryRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      return memoryRefreshToken;
    } catch {
      return null;
    }
  },

  setTokens(access, refresh) {
    if (access) {
      memoryAccessToken = access;
      try {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
      } catch {
        // Fallback to memory-only if storage is restricted
      }
    }
    if (refresh) {
      memoryRefreshToken = refresh;
      try {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      } catch {
        // Fallback to memory-only
      }
    }
  },

  getStoredUser() {
    try {
      const raw = sessionStorage.getItem(USER_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setStoredUser(user) {
    try {
      if (user) {
        sessionStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(USER_PROFILE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  },

  clearSession() {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    try {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(USER_PROFILE_KEY);
    } catch {
      // Ignore storage errors
    }
  },
};
