"use client";

import { useEffect, useState } from "react";

export interface Teacher {
  id: string;
  name: string;
}

interface UseTeachersReturn {
  teachers: Teacher[];
  isLoading: boolean;
}

export function useTeachers(branchId: string): UseTeachersReturn {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!branchId) {
      setTeachers([]);
      return;
    }

    setIsLoading(true);
    const params = new URLSearchParams({
      staffType: "TEACHING",
      status: "ACTIVE",
      branchId,
      limit: "100",
    });

    fetch(`/api/v1/staff?${params}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setTeachers(
            data.data.map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            }))
          );
        }
      })
      .catch((err) => {
        console.error("Error fetching teachers:", err);
      })
      .finally(() => setIsLoading(false));
  }, [branchId]);

  return { teachers, isLoading };
}
