"use client";

import { useEffect, useState } from "react";

export interface SubjectMasterOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface UseSubjectMastersReturn {
  subjectMasters: SubjectMasterOption[];
  isLoading: boolean;
}

export function useSubjectMasters(): UseSubjectMastersReturn {
  const [subjectMasters, setSubjectMasters] = useState<SubjectMasterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/subject-masters?active=true")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setSubjectMasters(
            data.data.map((s: SubjectMasterOption) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              type: s.type,
            }))
          );
        }
      })
      .catch((err) => {
        console.error("Error fetching subject masters:", err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { subjectMasters, isLoading };
}
