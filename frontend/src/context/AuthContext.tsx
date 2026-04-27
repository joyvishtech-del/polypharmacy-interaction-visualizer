import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import { authService, type UpdateProfilePayload } from '../services/authService';
import { getAccessToken, setAccessToken } from '../services/api';

// Legacy keys from the localStorage-based flow; cleaned up once on mount so
// a stale dev session doesn't leak tokens to disk after upgrade.
const LEGACY_ACCESS_TOKEN_KEY = 'access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'refresh_token';

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfilePayload) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - manages authentication state for the app.
 *
 * Tokens are no longer persisted in localStorage. The access token lives in
 * a module-level variable inside ``services/api.ts`` (memory only) and the
 * refresh token is an HttpOnly cookie set by the server. On mount we attempt
 * a silent ``/auth/refresh`` call — if the cookie is present and valid the
 * server returns a new access token and we hydrate ``/auth/me``.
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyAccessToken = useCallback((token: string | null): void => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const clearSession = useCallback((): void => {
    setAccessToken(null);
    setAccessTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const me = await authService.me();
      setUser(me);
    } catch {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    // One-shot migration: drop any tokens left over from the previous
    // localStorage-based flow so an XSS payload can't read them.
    try {
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    } catch {
      // Ignore: localStorage may be unavailable in some sandboxes.
    }

    const bootstrap = async (): Promise<void> => {
      try {
        const tokens = await authService.refresh();
        if (cancelled) return;
        applyAccessToken(tokens.access_token);
        const me = await authService.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyAccessToken, clearSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const tokens = await authService.login({ email, password });
      applyAccessToken(tokens.access_token);
      const me = await authService.me();
      setUser(me);
    },
    [applyAccessToken]
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string): Promise<void> => {
      await authService.register({
        email,
        password,
        full_name: fullName,
      });
      // Server does NOT auto-login on register; complete by calling /login.
      const tokens = await authService.login({ email, password });
      applyAccessToken(tokens.access_token);
      const me = await authService.me();
      setUser(me);
    },
    [applyAccessToken]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch {
      // Best-effort: even if logout fails server-side, clear local state.
    }
    clearSession();
  }, [clearSession]);

  const updateProfile = useCallback(
    async (data: UpdateProfilePayload): Promise<void> => {
      const updated = await authService.updateMe(data);
      setUser(updated);
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: user !== null && accessToken !== null,
      login,
      register,
      logout,
      updateProfile,
      refreshUser,
    }),
    [
      user,
      accessToken,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
