"use client";

import { useEffect, useState, useCallback } from "react";

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface UseDepartmentsReturn {
  departments: DepartmentOption[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useDepartments(): UseDepartmentsReturn {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/departments?active=true");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.success) {
        setDepartments(
          data.data.map((d: DepartmentOption) => ({
            id: d.id,
            name: d.name,
            code: d.code,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching departments:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return { departments, isLoading, refetch: fetchDepartments };
}
