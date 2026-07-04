"use client";

import { useEffect, useState, useCallback } from "react";

export interface DesignationOption {
  id: string;
  name: string;
  code: string;
}

interface UseDesignationsReturn {
  designations: DesignationOption[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useDesignations(): UseDesignationsReturn {
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDesignations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/designations?active=true");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.success) {
        setDesignations(
          data.data.map((d: DesignationOption) => ({
            id: d.id,
            name: d.name,
            code: d.code,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching designations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  return { designations, isLoading, refetch: fetchDesignations };
}
