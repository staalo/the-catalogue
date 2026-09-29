import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, register } from '@/api/auth';
import { clearStoredSessionUser } from '@/hooks/useCurrentUser';
import type { LoginRequest, RegisterRequest } from '@/types';

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: LoginRequest) => login(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterRequest) => register(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      clearStoredSessionUser();
      await queryClient.invalidateQueries();
    },
  });
}
