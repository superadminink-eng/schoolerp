import { useState, useEffect } from "react";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/v1/roles");
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (data && data.success) {
          setRoles(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRoles();
  }, []);

  return { roles, loading };
}
