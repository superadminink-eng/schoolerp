import { useState, useEffect } from "react";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  type: "STAFF" | "STUDENT" | "PARENT";
  isSystem: boolean;
}

export function useRoles(options?: { type?: "STAFF" | "STUDENT" | "PARENT" }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const filterType = options?.type;

  useEffect(() => {
    async function fetchRoles() {
      try {
        const url = filterType ? `/api/v1/roles?type=${filterType}` : "/api/v1/roles";
        const res = await fetch(url);
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
  }, [filterType]);

  return { roles, loading };
}
