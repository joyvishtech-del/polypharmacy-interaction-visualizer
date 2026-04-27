import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshResponse {
  access_token: string;
  token_type?: string;
}

// In dev VITE_API_URL is set to the absolute backend origin; in production
// the SPA is served from the same host as the API (via the nginx /api proxy)
// so an empty string yields relative `/api/v1/...` requests.
const baseURL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

/**
 * In-memory access token. Kept off ``localStorage`` so an XSS payload cannot
 * read it from disk; the browser still sends the (HttpOnly) refresh cookie
 * automatically because the axios instance below is configured with
 * ``withCredentials: true``.
 */
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

const api: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      try {
        // Refresh cookie travels automatically thanks to withCredentials.
        const { data } = await axios.post<RefreshResponse>(
          `${baseURL}/auth/refresh`,
          undefined,
          { withCredentials: true }
        );
        setAccessToken(data.access_token);
        if (original.headers) {
          original.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return api(original);
      } catch (refreshError) {
        setAccessToken(null);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
