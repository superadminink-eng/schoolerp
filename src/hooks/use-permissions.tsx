"use client";

import { useSession } from "next-auth/react";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface PermissionsContextType {
  permissions: Set<string>;
  can: (module: string, action: string) => boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

// Safe helper to read from sessionStorage
const getCachedPermissions = (userId: string): string[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(`school-erp:permissions:${userId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error("Error reading permissions from sessionStorage:", e);
    return null;
  }
};

// Safe helper to write to sessionStorage
const setCachedPermissions = (userId: string, permissions: string[]) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`school-erp:permissions:${userId}`, JSON.stringify(permissions));
  } catch (e) {
    console.error("Error writing permissions to sessionStorage:", e);
  }
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "loading") return;

    if (!userId) {
      setPermissions(new Set());
      setIsLoading(false);
      return;
    }

    // 1. Try to load from cache immediately to prevent page blocking
    const cached = getCachedPermissions(userId);
    if (cached) {
      setPermissions(new Set(cached));
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    // 2. Fetch in background (Stale-While-Revalidate)
    fetch("/api/v1/me/permissions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const fetchedPermissions = data.data.permissions;
          
          // Only trigger a re-render/update if the permissions have actually changed
          const hasChanged = 
            fetchedPermissions.length !== permissions.size || 
            !fetchedPermissions.every((p: string) => permissions.has(p));

          if (hasChanged || !cached) {
            setPermissions(new Set(fetchedPermissions));
            setCachedPermissions(userId, fetchedPermissions);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [userId, status]); // Run effect only if userId or status changes, NOT on every route change

  const can = useCallback((module: string, action: string): boolean => {
    if (session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN") {
      return true;
    }
    return permissions.has(`${module}:${action}`);
  }, [session?.user?.roleName, permissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, can, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

