import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/api/auth';
import type { CurrentUser } from '@/types';

const STORAGE_KEY = 'catalogue-session-user';

function readStoredUser(): CurrentUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CurrentUser>;
    const email = typeof parsed.email === 'string' ? parsed.email : '';
    const userName = typeof parsed.userName === 'string' ? parsed.userName : '';
    if (!email && !userName) {
      return null;
    }

    return { email, userName };
  } catch {
    return null;
  }
}

function writeStoredUser(user: CurrentUser | null): void {
  try {
    if (!user?.email && !user?.userName) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: user.email, userName: user.userName }),
    );
  } catch {
    // Ignore quota and privacy-mode failures.
  }
}

export function clearStoredSessionUser(): void {
  writeStoredUser(null);
}

export function useCurrentUser() {
  const [rememberedUser] = useState(readStoredUser);
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (query.isPending) {
      return;
    }

    writeStoredUser(query.data ?? null);
  }, [query.isPending, query.data]);

  const displayUser = query.isPending ? rememberedUser ?? undefined : query.data ?? undefined;

  return {
    ...query,
    displayUser,
    authPending: query.isPending && !displayUser,
  };
}
