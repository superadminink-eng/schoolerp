"use client";

import { useEffect, useState } from "react";

export interface InstallmentMasterOption {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface UseInstallmentMastersReturn {
  installmentMasters: InstallmentMasterOption[];
  isLoading: boolean;
}

export function useInstallmentMasters(): UseInstallmentMastersReturn {
  const [installmentMasters, setInstallmentMasters] = useState<InstallmentMasterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/installment-masters?active=true")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setInstallmentMasters(
            data.data.map((s: InstallmentMasterOption) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              description: s.description,
            }))
          );
        }
      })
      .catch((err) => {
        console.error("Error fetching installment masters:", err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { installmentMasters, isLoading };
}
