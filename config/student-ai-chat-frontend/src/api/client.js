import { tokenStorage } from '../utils/tokenStorage';

const DEFAULT_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8002';

// Single shared refresh promise to prevent concurrent refresh race conditions or infinite loops
let refreshPromise = null;

/**
 * Normalizes backend error responses into human-readable messages.
 * Never exposes raw stack traces to the student.
 */
export function extractErrorMessage(data, status) {
  if (!data) {
    if (status === 401) return 'Your session has expired or is unauthorized. Please sign in again.';
    if (status === 403) return 'Access denied. Only authorized university email addresses are permitted.';
    if (status === 404) return 'The requested API endpoint was not found on the backend server.';
    if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
    if (status >= 500) return 'The backend server or AI model encountered an internal error. Please try again.';
    return 'An unexpected error occurred while communicating with the server.';
  }

  if (typeof data === 'string') {
    // Avoid dumping raw HTML error pages from Django debug mode
    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
      return `Server error (HTTP ${status}). Please verify the Django server logs.`;
    }
    return data;
  }

  // Standard DRF / SimpleJWT / Custom backend error fields
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;

  // Field-level validation errors e.g. { email: ["Enter a valid university email."] }
  if (typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && typeof val[0] === 'string') {
        return val[0];
      }
      if (typeof val === 'string') {
        return val;
      }
    }
  }

  return 'Request could not be completed. Please check your input and try again.';
}

/**
 * Extracts access and refresh tokens flexibly from backend OTP verification or refresh responses.
 * Supports top-level { access, refresh }, { access_token, refresh_token }, or nested { tokens: { access, refresh } }.
 */
export function extractTokensFromResponse(data) {
  if (!data || typeof data !== 'object') return { access: null, refresh: null };
  const tokenSource = data.tokens && typeof data.tokens === 'object' ? data.tokens : data;
  const access = tokenSource.access || tokenSource.access_token || data.access || null;
  const refresh = tokenSource.refresh || tokenSource.refresh_token || data.refresh || null;
  return { access, refresh };
}

/**
 * Extracts assistant message text and optional MCP tools_used list from POST /api/chat/ response.
 */
export function normalizeChatResponse(data) {
  if (!data) {
    return { text: 'Received an empty response from the server.', toolsUsed: [] };
  }
  if (typeof data === 'string') {
    return { text: data, toolsUsed: [] };
  }

  const text =
    data.response ??
    data.reply ??
    data.answer ??
    data.message ??
    data.content ??
    data.output ??
    (typeof data.data === 'string' ? data.data : null);

  const rawTools =
    data.tools_used ??
    data.tools ??
    data.tool_calls ??
    data.mcp_tools ??
    [];

  const toolsUsed = Array.isArray(rawTools) ? rawTools : [];

  return {
    text: typeof text === 'string' && text.trim().length > 0
      ? text
      : JSON.stringify(data, null, 2),
    toolsUsed,
  };
}

export function createApiClient(getBaseUrl = () => DEFAULT_BASE_URL, onSessionExpired = () => {}) {
  async function refreshAccessToken() {
    const refresh = tokenStorage.getRefreshToken();
    if (!refresh) {
      throw new Error('No refresh token available.');
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    const baseUrl = getBaseUrl().replace(/\/+$/, '');
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${baseUrl}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh }),
        });

        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await response.json();
        }

        if (!response.ok) {
          tokenStorage.clearSession();
          onSessionExpired('Your session has expired. Please sign in again.');
          throw new Error(extractErrorMessage(data, response.status));
        }

        const { access, refresh: newRefresh } = extractTokensFromResponse(data);
        if (!access) {
          tokenStorage.clearSession();
          onSessionExpired('Session refresh did not return a valid access token.');
          throw new Error('Invalid token refresh response.');
        }

        tokenStorage.setTokens(access, newRefresh || refresh);
        return access;
      } catch (err) {
        tokenStorage.clearSession();
        throw err;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function request(endpoint, { method = 'GET', body = null, requiresAuth = false, isRetry = false, timeoutMs = 90000 } = {}) {
    const baseUrl = getBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}${endpoint}`;

    const headers = {
      Accept: 'application/json',
    };

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    if (requiresAuth) {
      const accessToken = tokenStorage.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized on authenticated endpoints with a single automatic token refresh attempt
      if (
        response.status === 401 &&
        requiresAuth &&
        !isRetry &&
        endpoint !== '/api/auth/token/refresh/' &&
        endpoint !== '/api/auth/logout/'
      ) {
        try {
          await refreshAccessToken();
          return await request(endpoint, { method, body, requiresAuth, isRetry: true, timeoutMs });
        } catch {
          tokenStorage.clearSession();
          onSessionExpired('Your session has expired. Please log in again.');
          const authErr = new Error('Session expired. Please sign in again.');
          authErr.status = 401;
          throw authErr;
        }
      }

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => '');
        data = text || null;
      }

      if (!response.ok) {
        const err = new Error(extractErrorMessage(data, response.status));
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutErr = new Error(
          'The request timed out while waiting for the AI model or backend server. Please try again.'
        );
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }

      // Browser network failure or CORS block or Django server offline
      if (error instanceof TypeError || error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        const netErr = new Error(
          `Unable to reach the Django backend at ${baseUrl}. Please verify the backend server is running on port 8002 and CORS is configured.`
        );
        netErr.isNetworkError = true;
        throw netErr;
      }

      throw error;
    }
  }

  return {
    // A. Request OTP
    requestOtp(email) {
      return request('/api/auth/otp/request/', {
        method: 'POST',
        body: { email: email.trim() },
        requiresAuth: false,
        timeoutMs: 25000,
      });
    },

    // B. Verify OTP
    verifyOtp(email, otp) {
      return request('/api/auth/otp/verify/', {
        method: 'POST',
        body: { email: email.trim(), otp: otp.trim() },
        requiresAuth: false,
        timeoutMs: 25000,
      });
    },

    // C. Refresh Token
    refreshToken() {
      return refreshAccessToken();
    },

    // D. Logout
    async logout() {
      const refresh = tokenStorage.getRefreshToken();
      try {
        await request('/api/auth/logout/', {
          method: 'POST',
          body: refresh ? { refresh } : {},
          requiresAuth: true,
          timeoutMs: 10000,
        });
      } catch {
        // Even if the backend session already expired or server is unreachable, always clear local session
      } finally {
        tokenStorage.clearSession();
      }
    },

    // E. Get Current User
    getCurrentUser() {
      return request('/api/auth/me/', {
        method: 'GET',
        requiresAuth: true,
        timeoutMs: 15000,
      });
    },

    // F. Send Chat Message
    sendChatMessage(message) {
      return request('/api/chat/', {
        method: 'POST',
        body: { message: message.trim() },
        requiresAuth: true,
        timeoutMs: 120000, // Allow generous timeout for local llama.cpp + Gemma + MCP tool execution
      });
    },
  };
}
