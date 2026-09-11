import { apiGet, apiPost, ApiError } from '@/lib/api';
import type {
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
} from '@/types';

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

export function login(body: LoginRequest): Promise<Pick<CurrentUser, 'email'>> {
  return apiPost<Pick<CurrentUser, 'email'>>('/userlogin', body);
}

export function register(body: RegisterRequest): Promise<RegisterResponse> {
  return apiPost<RegisterResponse>('/register', body);
}

export function logout(): Promise<Record<string, never>> {
  return apiPost<Record<string, never>>('/logout');
}
