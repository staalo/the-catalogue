import { apiGet, apiPost, ApiError } from '@/lib/api';
import type { CurrentUser, LoginRequest } from '@/types';

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await apiGet<CurrentUser>('/getcurrentuser');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function login(body: LoginRequest): Promise<CurrentUser> {
  return apiPost<CurrentUser>('/userlogin', body);
}

export function logout(): Promise<Record<string, never>> {
  return apiPost<Record<string, never>>('/logout');
}
