import api from './api';
import type { User } from '../types';

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  full_name: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

/**
 * Server-issued access-token response. The refresh token is delivered as an
 * HttpOnly cookie and never appears in this body.
 */
export interface AccessTokenResponse {
  access_token: string;
  token_type: 'bearer';
}

/**
 * Typed wrappers around the /auth/* endpoints.
 *
 * The shared axios instance in ``services/api.ts`` injects the bearer access
 * token from memory and transparently handles 401 + refresh (the refresh
 * cookie is sent automatically because the instance is configured with
 * ``withCredentials: true``).
 */
export const authService = {
  register: async (payload: RegisterPayload): Promise<User> => {
    const { data } = await api.post<User>('/auth/register', payload);
    return data;
  },

  login: async (payload: LoginPayload): Promise<AccessTokenResponse> => {
    const { data } = await api.post<AccessTokenResponse>('/auth/login', payload);
    return data;
  },

  refresh: async (): Promise<AccessTokenResponse> => {
    const { data } = await api.post<AccessTokenResponse>('/auth/refresh');
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  updateMe: async (payload: UpdateProfilePayload): Promise<User> => {
    const { data } = await api.put<User>('/auth/me', payload);
    return data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload): Promise<void> => {
    await api.post('/auth/forgot-password', payload);
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<void> => {
    await api.post('/auth/reset-password', payload);
  },
};
