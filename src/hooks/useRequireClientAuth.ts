"use client";

import { useRequireAuth } from "@/components/auth/AuthProvider";

/** Customer pages — uses shared AuthProvider (no per-page /api/auth/me loops). */
export function useRequireClientAuth() {
  return useRequireAuth(["client"], "/login");
}

export { useRequireAuth, useAuth } from "@/components/auth/AuthProvider";
