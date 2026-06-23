import { useState, useEffect } from "react";

export interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

export function useAllPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const res = await fetch("/api/v1/permissions", { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
          setPermissions(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch permissions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  return { permissions, loading };
}
