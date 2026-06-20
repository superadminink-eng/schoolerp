import { useState, useEffect } from "react";

export interface UnlinkedUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: {
    name: string;
  } | null;
}

export function useUnlinkedUsers() {
  const [users, setUsers] = useState<UnlinkedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/v1/users/unlinked");
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (data && data.success) {
          setUsers(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch unlinked users:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  return { users, loading };
}

