import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = '@attendance_auth_session';
export const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour = 3,600,000 ms

/**
 * Storage service for managing auth tokens and sessions with 1-hour expiration
 */
export const storage = {
  /**
   * Save auth token and user data with 1-hour expiration
   * @param {string} token - JWT authentication token
   * @param {object} user - User information object
   * @param {number} durationMs - Session validity in milliseconds (default: 1 hour)
   */
  saveAuthSession: async (token, user, durationMs = ONE_HOUR_MS) => {
    try {
      const now = Date.now();
      const expiresAt = now + durationMs;
      const sessionData = {
        token,
        user,
        savedAt: now,
        expiresAt,
      };
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
      return sessionData;
    } catch (error) {
      console.error('Storage error saving auth session:', error);
      return null;
    }
  },

  /**
   * Retrieve active auth session if within the 1-hour window
   * Automatically clears and returns null if expired
   * @returns {Promise<{token: string, user: object, expiresAt: number} | null>}
   */
  getAuthSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);
      const now = Date.now();

      // Check if session has expired (> 1 hour)
      if (!session.expiresAt || now >= session.expiresAt) {
        console.log('Auth session expired (1 hour limit reached). Clearing storage.');
        await AsyncStorage.removeItem(AUTH_SESSION_KEY);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Storage error reading auth session:', error);
      return null;
    }
  },

  /**
   * Get the stored JWT token if session is valid
   * @returns {Promise<string | null>}
   */
  getStoredToken: async () => {
    const session = await storage.getAuthSession();
    return session ? session.token : null;
  },

  /**
   * Get remaining session validity in milliseconds
   * @returns {Promise<number>}
   */
  getRemainingSessionTime: async () => {
    try {
      const session = await storage.getAuthSession();
      if (!session || !session.expiresAt) return 0;
      return Math.max(0, session.expiresAt - Date.now());
    } catch {
      return 0;
    }
  },

  /**
   * Clear auth session from storage (logout or expired)
   */
  clearAuthSession: async () => {
    try {
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    } catch (error) {
      console.error('Storage error clearing auth session:', error);
    }
  },
};

export default storage;

