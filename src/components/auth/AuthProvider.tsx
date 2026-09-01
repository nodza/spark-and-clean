"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/user";
import {
  AUTH_EVENT,
  fetchCurrentUser,
  type AuthUser,
} from "@/lib/authClient";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Module-level cache so concurrent callers share one /api/auth/me request */
let cachedUser: AuthUser | null | undefined;
let inflight: Promise<AuthUser | null> | null = null;

export function invalidateAuthCache() {
  cachedUser = undefined;
  inflight = null;
}

async function loadUser(force = false): Promise<AuthUser | null> {
  if (!force && cachedUser !== undefined) {
    return cachedUser;
  }
  if (!force && inflight) {
    return inflight;
  }

  inflight = fetchCurrentUser()
    .then((user) => {
      cachedUser = user;
      return user;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const booted = useRef(false);

  const refresh = useCallback(async (force = true) => {
    if (force) invalidateAuthCache();
    const next = await loadUser(force);
    setUser(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void refresh(false);

    const onAuth = () => {
      // Re-read session after login/register/logout elsewhere
      void refresh(true);
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    invalidateAuthCache();
    cachedUser = null;
    setUser(null);
    setReady(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      refresh: () => refresh(true),
      logout,
    }),
    [user, ready, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Optional: for components that may render outside provider during SSR edge cases */
export function useAuthOptional() {
  return useContext(AuthContext);
}

export function useRequireAuth(
  roles: UserRole[] = ["CUSTOMER"],
  loginPath = "/login",
  options?: { allowGuest?: boolean }
) {
  const allowGuest = options?.allowGuest ?? true;
  const rolesKey = roles.join("|");
  const allowed = useMemo(
    () => rolesKey.split("|") as UserRole[],
    [rolesKey]
  );

  const { user, ready, refresh } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const roleOk = !!user && allowed.includes(user.role);
    const guestOk = allowGuest || !user?.guest;
    const ok = roleOk && guestOk;

    if (!ok) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace(loginPath);
      }
      return;
    }
    redirected.current = false;
  }, [ready, user, allowed, allowGuest, loginPath, router]);

  const roleOk = ready && !!user && allowed.includes(user.role);
  const guestOk = allowGuest || !user?.guest;
  const ok = roleOk && guestOk;

  return {
    user: ok ? user : null,
    email: ok ? user?.email ?? null : null,
    ready: ok,
    refresh,
  };
}

