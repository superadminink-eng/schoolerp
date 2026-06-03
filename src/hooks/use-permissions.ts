"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface UsePermissionsReturn {
  can: (module: string, action: string) => boolean;
  permissions: Set<string>;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setPermissions(new Set());
      setIsLoading(false);
      return;
    }

    // Fetch permissions from API
    fetch("/api/v1/me/permissions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPermissions(new Set(data.data.permissions));
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [session, status]);

  const can = (module: string, action: string): boolean => {
    if (session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN") return true;
    return permissions.has(`${module}:${action}`);
  };

  return { can, permissions, isLoading };
}
