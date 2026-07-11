"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/ui/select-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/use-branches";
import { usePermissions } from "@/hooks/use-permissions";
import { useTeachers } from "@/hooks/use-teachers";
import { useSubjectMasters } from "@/hooks/use-subject-masters";
import { useInstallmentMasters } from "@/hooks/use-installment-masters";
import {
  createClassSchema,
  updateClassSchema,
} from "@/lib/validations/class";

const CLASS_LEVEL_OPTIONS = [
  { value: "-3", label: "Playgroup (Level -3)" },
  { value: "-2", label: "Nursery (Level -2)" },
  { value: "-1", label: "LKG / Junior KG (Level -1)" },
  { value: "0", label: "UKG / Senior KG (Level 0)" },
  { value: "1", label: "Class 1 (Level 1)" },
  { value: "2", label: "Class 2 (Level 2)" },
  { value: "3", label: "Class 3 (Level 3)" },
  { value: "4", label: "Class 4 (Level 4)" },
  { value: "5", label: "Class 5 (Level 5)" },
  { value: "6", label: "Class 6 (Level 6)" },
  { value: "7", label: "Class 7 (Level 7)" },
  { value: "8", label: "Class 8 (Level 8)" },
  { value: "9", label: "Class 9 (Level 9)" },
  { value: "10", label: "Class 10 (Level 10)" },
  { value: "11", label: "Class 11 / FYJC (Level 11)" },
  { value: "12", label: "Class 12 / SYJC (Level 12)" },
  { value: "13", label: "First Year Degree (Level 13)" },
  { value: "14", label: "Second Year Degree (Level 14)" },
  { value: "15", label: "Third Year Degree (Level 15)" },
];

interface AcademicYearOption {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SubjectTeacherRow {
  subjectIndex: number;
  staffId: string;
}

interface SectionRow {
  id?: string;
  name: string;
  classTeacherId?: string | null;
  subjectTeachers: SubjectTeacherRow[];
  studentCount?: number;
}

interface FeeRow {
  id?: string;
  feeCategoryId: string;
  amount: string | number;
  termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
}

interface InstallmentRow {
  id?: string;
  installmentMasterId?: string | null;
  name: string;
  amount: number | string;
  dueDate: string;
  termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
  lateFeeActive: boolean;
  lateFeeType: "DAILY" | "LUMP_SUM" | "PERCENTAGE";
  lateFeeValue: number | string;
  lateFeePerDay: number | string;
  lateFeeGrace: number | string;
}

interface ClassData {
  id: string;
  name: string;
  numericGrade: number;
  status: "DRAFT" | "ACTIVE";
  branchId: string;
  academicYearId: string;
  hasInvoices?: boolean;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    subjectMasterId?: string | null;
  }>;
  sections: Array<{
    id: string;
    name: string;
    classTeacher?: { id: string; name: string } | null;
    classTeacherId?: string | null;
    sectionSubjectTeachers: Array<{
      subject: { id: string; name: string; code: string };
      staff: { id: string; name: string };
    }>;
    _count?: { studentEnrollments: number };
  }>;
  feeStructures: Array<{
    id: string;
    amount: number | string;
    frequency: string;
    feeCategory: { id: string; name: string };
    termType?: string;
  }>;
  feeInstallmentTemplates?: Array<{
    id: string;
    installmentMasterId?: string | null;
    name: string;
    amount: number | string;
    dueDate: string | Date;
    termType?: string;
    lateFeeActive: boolean;
    lateFeeType?: string;
    lateFeeValue?: number | string;
    lateFeePerDay: number | string;
    lateFeeGrace: number | string;
  }>;
  branch: { id: string; name: string };
  academicYear: { id: string; name: string };
}

interface ClassFormProps {
  mode: "create" | "edit";
  initialData?: ClassData;
}

export function ClassForm({ mode, initialData }: ClassFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches, isLoading: branchesLoading } = useBranches();
  const { subjectMasters, isLoading: subjectMastersLoading } = useSubjectMasters();
  const { installmentMasters } = useInstallmentMasters();

  const [name, setName] = useState(initialData?.name ?? "");
  const [numericGrade, setNumericGrade] = useState<string>(
    initialData?.numericGrade?.toString() ?? ""
  );
  const [branchId, setBranchId] = useState(initialData?.branchId ?? "");
  const [academicYearId, setAcademicYearId] = useState(
    initialData?.academicYearId || ""
  );
  const [activeTermTab, setActiveTermTab] = useState<"FULL_TERM" | "HALF_TERM" | "SHORT_TERM">("FULL_TERM");
  const [activeMainTab, setActiveMainTab] = useState<string>("details");

  const [classId, setClassId] = useState<string | null>(initialData?.id ?? null);
  const [formMode, setFormMode] = useState<"create" | "edit">(mode);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(initialData?.status ?? "DRAFT");
  const [submitError, setSubmitError] = useState<{message: string, details?: string} | null>(null);

  const hasEnrolledStudents = useMemo(() => {
    if (!initialData) return false;
    return initialData.sections.some((s: any) => (s._count?.studentEnrollments ?? 0) > 0);
  }, [initialData]);

  const hasInvoices = useMemo(() => {
    return initialData?.hasInvoices ?? false;
  }, [initialData]);

  // Selected subject master IDs — initialized from initialData so cleanup effect
  // doesn't strip teachers on the first render
  const [selectedSubjectMasterIds, setSelectedSubjectMasterIds] = useState<string[]>(
    () =>
      initialData?.subjects
        ?.map((s) => s.subjectMasterId)
        .filter((id): id is string => !!id) ?? []
  );

  const [sections, setSections] = useState<SectionRow[]>(() => {
    if (mode === "edit" && initialData && initialData.sections.length > 0) {
      return initialData.sections.map((sec) => {
        const subjectTeachers: SubjectTeacherRow[] = [];
        for (const sst of sec.sectionSubjectTeachers) {
          const subjectIndex = initialData.subjects.findIndex(
            (s) => s.id === sst.subject.id
          );
          if (subjectIndex >= 0) {
            subjectTeachers.push({
              subjectIndex,
              staffId: sst.staff.id,
            });
          }
        }
        return {
          id: sec.id,
          name: sec.name,
          classTeacherId: sec.classTeacher?.id ?? null,
          subjectTeachers,
          studentCount: sec._count?.studentEnrollments ?? 0,
        };
      });
    }
    return [{ name: "A", subjectTeachers: [] }];
  });

  const [fees, setFees] = useState<FeeRow[]>(() =>
    initialData?.feeStructures?.map((f) => ({
      id: f.id,
      feeCategoryId: f.feeCategory?.id || "",
      amount: Number(f.amount),
      termType: (f.termType || "FULL_TERM") as any,
    })) ?? []
  );

  const [feeCategories, setFeeCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchFeeCategories = async () => {
      try {
        const res = await fetch("/api/v1/fee-categories");
        const json = await res.json();
        if (json.success) {
          setFeeCategories(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch fee categories", err);
      }
    };
    fetchFeeCategories();
  }, []);

  const [installments, setInstallments] = useState<InstallmentRow[]>(() =>
    initialData?.feeInstallmentTemplates?.map((t) => ({
      id: t.id,
      installmentMasterId: t.installmentMasterId || null,
      name: t.name,
      amount: Number(t.amount),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
      termType: (t.termType || "FULL_TERM") as any,
      lateFeeActive: t.lateFeeActive,
      lateFeeType: (t.lateFeeType || "DAILY") as any,
      lateFeeValue: t.lateFeeValue !== undefined ? Number(t.lateFeeValue) : Number(t.lateFeePerDay),
      lateFeePerDay: Number(t.lateFeePerDay),
      lateFeeGrace: Number(t.lateFeeGrace),
    })) ?? []
  );

  const [expandedLateFeeIndex, setExpandedLateFeeIndex] = useState<number | null>(null);

  const { teachers, isLoading: teachersLoading } = useTeachers(branchId);

  // Auto-assign branch for non-SUPER_ADMIN users
  useEffect(() => {
    if (!isSuperAdmin && session?.user?.branchId && !branchId) {
      setBranchId(session.user.branchId);
    }
  }, [isSuperAdmin, session?.user?.branchId, branchId]);

  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [academicYearsLoading, setAcademicYearsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Fetch academic years on mount
  useEffect(() => {
    fetch("/api/v1/academic-years")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAcademicYears(data.data);
          if (mode === "create" && !academicYearId) {
            const current = data.data.find(
              (y: AcademicYearOption) => y.isCurrent
            );
            if (current) setAcademicYearId(current.id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setAcademicYearsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the ordered list of subjects for display in division cards
  const selectedSubjects = useMemo(() => {
    if (mode === "edit" && initialData) {
      // In edit mode, merge existing (kept) + newly added
      const result: Array<{
        key: string;
        name: string;
        code: string;
        existingId?: string;
        masterId?: string;
      }> = [];

      // Keep existing subjects whose master is still selected, plus those without a master
      for (const subj of initialData.subjects) {
        if (subj.subjectMasterId) {
          if (selectedSubjectMasterIds.includes(subj.subjectMasterId)) {
            result.push({
              key: subj.id,
              name: subj.name,
              code: subj.code,
              existingId: subj.id,
              masterId: subj.subjectMasterId,
            });
          }
        } else {
          // Subject without master — always keep
          result.push({
            key: subj.id,
            name: subj.name,
            code: subj.code,
            existingId: subj.id,
          });
        }
      }

      // Add newly selected masters not already present
      const existingMasterIds = initialData.subjects
        .map((s) => s.subjectMasterId)
        .filter(Boolean);
      for (const mId of selectedSubjectMasterIds) {
        if (!existingMasterIds.includes(mId)) {
          const master = subjectMasters.find((sm) => sm.id === mId);
          if (master) {
            result.push({
              key: `new-${mId}`,
              name: master.name,
              code: master.code,
              masterId: mId,
            });
          }
        }
      }

      return result;
    }

    // Create mode — map from subject master IDs
    return selectedSubjectMasterIds.map((mId) => {
      const master = subjectMasters.find((sm) => sm.id === mId);
      return {
        key: mId,
        name: master?.name ?? "",
        code: master?.code ?? "",
        existingId: undefined as string | undefined,
        masterId: mId,
      };
    });
  }, [mode, initialData, selectedSubjectMasterIds, subjectMasters]);

  // When subjects change (user action), clean up section teacher assignments and classTeacherId
  // Skip the initial mount to avoid wiping data that was just initialized
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSections((prev) =>
      prev.map((sec) => {
        const validTeachers = sec.subjectTeachers.filter(
          (st) => st.subjectIndex >= 0 && st.subjectIndex < selectedSubjects.length
        );
        const classTeacherStillValid = validTeachers.some(
          (st) => st.staffId === sec.classTeacherId
        );
        return {
          ...sec,
          subjectTeachers: validTeachers,
          classTeacherId: classTeacherStillValid ? sec.classTeacherId : null,
        };
      })
    );
  }, [selectedSubjects.length]);

  // Division helpers
  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        name: "",
        classTeacherId: null,
        subjectTeachers: [],
      },
    ]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSectionName(index: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, name: value } : s))
    );
  }

  function updateSectionTeacher(
    sectionIndex: number,
    subjectIndex: number,
    staffId: string
  ) {
    setSections((prev) =>
      prev.map((sec, si) => {
        if (si !== sectionIndex) return sec;

        const existing = sec.subjectTeachers.find(
          (st) => st.subjectIndex === subjectIndex
        );

        let newTeachers: SubjectTeacherRow[];
        if (!staffId) {
          // Clear teacher for this subject
          newTeachers = sec.subjectTeachers.filter(
            (st) => st.subjectIndex !== subjectIndex
          );
        } else if (existing) {
          newTeachers = sec.subjectTeachers.map((st) =>
            st.subjectIndex === subjectIndex ? { ...st, staffId } : st
          );
        } else {
          newTeachers = [...sec.subjectTeachers, { subjectIndex, staffId }];
        }

        // If we changed the teacher on the class-teacher row, update classTeacherId
        let classTeacherId = sec.classTeacherId;
        if (existing?.staffId === sec.classTeacherId) {
          classTeacherId = staffId || null;
        }

        return { ...sec, subjectTeachers: newTeachers, classTeacherId };
      })
    );
  }

  function updateClassTeacher(sectionIndex: number, staffId: string | null) {
    setSections((prev) =>
      prev.map((sec, si) =>
        si === sectionIndex ? { ...sec, classTeacherId: staffId } : sec
      )
    );
  }

  // Fee helpers
  function addFee(termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM" = "FULL_TERM") {
    setFees((prev) => [...prev, { feeCategoryId: "", amount: "", termType }]);
  }

  function removeFee(index: number) {
    setFees((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFee(index: number, field: keyof FeeRow, value: any) {
    setFees((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  }

  // Installment helpers
  function addInstallment(termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM" = "FULL_TERM") {
    setInstallments((prev) => [
      ...prev,
      {
        name: "",
        amount: "",
        dueDate: "",
        termType,
        lateFeeActive: false,
        lateFeeType: "DAILY",
        lateFeeValue: 0,
        lateFeePerDay: 0,
        lateFeeGrace: 0,
      },
    ]);
  }

  function validateInstallmentDates(list: InstallmentRow[]): Record<string, string> {
    const newErrors: Record<string, string> = {};
    const termTypesList = ["FULL_TERM", "HALF_TERM", "SHORT_TERM"] as const;
    
    for (const t of termTypesList) {
      const termInstallments = list
        .map((inst, index) => ({ inst, index }))
        .filter(({ inst }) => inst.termType === t);

      for (let i = 1; i < termInstallments.length; i++) {
        const prev = termInstallments[i - 1];
        const curr = termInstallments[i];
        
        if (prev.inst.dueDate && curr.inst.dueDate) {
          const prevD = new Date(prev.inst.dueDate);
          const currD = new Date(curr.inst.dueDate);
          
          if (!isNaN(prevD.getTime()) && !isNaN(currD.getTime())) {
            if (currD < prevD) {
              newErrors[`installments.${curr.index}.dueDate`] = `Must be on or after ${prev.inst.name || `Installment ${i}`} (${prev.inst.dueDate})`;
            }
          }
        }
      }
    }
    return newErrors;
  }

  function removeInstallment(index: number) {
    setInstallments((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const dateErrors = validateInstallmentDates(updated);
      setErrors((prevErrors) => {
        const cleaned = { ...prevErrors };
        for (const key in cleaned) {
          if (key.startsWith("installments.") && key.endsWith(".dueDate")) {
            delete cleaned[key];
          }
        }
        return { ...cleaned, ...dateErrors };
      });
      return updated;
    });
  }

  function updateInstallment(index: number, field: keyof InstallmentRow, value: any) {
    setInstallments((prev) => {
      const updated = prev.map((inst, i) => (i === index ? { ...inst, [field]: value } : inst));
      const dateErrors = validateInstallmentDates(updated);
      setErrors((prevErrors) => {
        const cleaned = { ...prevErrors };
        for (const key in cleaned) {
          if (key.startsWith("installments.") && key.endsWith(".dueDate")) {
            delete cleaned[key];
          }
        }
        return { ...cleaned, ...dateErrors };
      });
      return updated;
    });
  }

  const installmentsTotal = installments.reduce((sum, inst) => {
    const amt = typeof inst.amount === "string" ? parseFloat(inst.amount) : inst.amount;
    if (isNaN(amt) || amt <= 0) return sum;
    return sum + amt;
  }, 0);

  const fullTermInstallmentsTotal = installments
    .filter((inst) => inst.termType === "FULL_TERM")
    .reduce((sum, inst) => {
      const amt = typeof inst.amount === "string" ? parseFloat(inst.amount) : inst.amount;
      if (isNaN(amt) || amt <= 0) return sum;
      return sum + amt;
    }, 0);

  const annualTotal = fees.reduce((sum, f) => {
    const amt = typeof f.amount === "string" ? parseFloat(f.amount) : f.amount;
    if (isNaN(amt) || amt <= 0) return sum;
    return sum + amt;
  }, 0);

  async function saveStep(targetTab: string) {
    setErrors({});
    
    // 1. Validation based on current activeMainTab
    if (activeMainTab === "details") {
      if (!name.trim()) {
        setErrors(prev => ({ ...prev, name: "Name is required" }));
        return;
      }
      if (numericGrade === "") {
        setErrors(prev => ({ ...prev, numericGrade: "Grade is required" }));
        return;
      }
      if (!branchId) {
        setErrors(prev => ({ ...prev, branchId: "Branch is required" }));
        return;
      }
      if (!academicYearId) {
        setErrors(prev => ({ ...prev, academicYearId: "Academic year is required" }));
        return;
      }
    } else if (activeMainTab === "divisions") {
      const divisionErrors: Record<string, string> = {};
      let hasError = false;
      sections.forEach((sec, idx) => {
        if (!sec.name.trim()) {
          divisionErrors[`sections.${idx}.name`] = "Division name is required";
          hasError = true;
        }
      });
      if (hasError) {
        setErrors(divisionErrors);
        snackbar.show("Please correct the errors in the Divisions tab.", "error");
        return;
      }
    }

    const parseNumOrUndef = (val: any) => {
      const n = typeof val === "string" ? parseFloat(val) : val;
      return !isNaN(n) ? n : undefined;
    };
    const parseIntOrUndef = (val: any) => {
      const n = typeof val === "string" ? parseInt(val, 10) : val;
      return !isNaN(n) ? n : undefined;
    };

    // 2. Prepare payload
    const formattedInstallments = installments.map((inst) => ({
      ...(inst.id ? { id: inst.id } : {}),
      name: inst.name,
      amount: parseNumOrUndef(inst.amount),
      dueDate: inst.dueDate || undefined,
      termType: inst.termType,
      lateFeeActive: inst.lateFeeActive,
      lateFeeType: inst.lateFeeType,
      lateFeeValue: parseNumOrUndef(inst.lateFeeValue),
      lateFeePerDay: parseNumOrUndef(inst.lateFeePerDay),
      lateFeeGrace: parseIntOrUndef(inst.lateFeeGrace),
    }));

    const subjectsPayload: Array<{ id: string } | { subjectMasterId: string }> = [];
    for (const subj of selectedSubjects) {
      if (subj.existingId) {
        subjectsPayload.push({ id: subj.existingId });
      } else if (subj.masterId) {
        subjectsPayload.push({ subjectMasterId: subj.masterId });
      }
    }

    const isNew = formMode === "create";
    const endpoint = isNew ? "/api/v1/classes" : `/api/v1/classes/${classId}`;
    const method = isNew ? "POST" : "PATCH";

    const nextStatus = (status === "ACTIVE" || targetTab === "finish") ? "ACTIVE" : "DRAFT";

    const payload = isNew 
      ? {
          name,
          numericGrade: parseInt(numericGrade, 10),
          branchId,
          academicYearId,
          subjectMasterIds: selectedSubjectMasterIds,
          sections: sections.map((s) => ({
            name: s.name,
            classTeacherId: s.classTeacherId || null,
            subjectTeachers: s.subjectTeachers.filter((st) => st.staffId),
          })),
          fees: fees.map((f) => ({
            feeCategoryId: f.feeCategoryId,
            amount: parseNumOrUndef(f.amount),
            termType: f.termType,
          })),
          installments: formattedInstallments,
          status: nextStatus,
        }
      : {
          name,
          numericGrade: parseInt(numericGrade, 10),
          subjects: subjectsPayload,
          sections: sections.map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            name: s.name,
            classTeacherId: s.classTeacherId || null,
            subjectTeachers: s.subjectTeachers.filter((st) => st.staffId),
          })),
          fees: fees.map((f) => ({
            ...(f.id ? { id: f.id } : {}),
            feeCategoryId: f.feeCategoryId,
            amount: parseNumOrUndef(f.amount),
            termType: f.termType,
          })),
          installments: formattedInstallments,
          status: nextStatus,
        };

    // Chronological date verification
    const dateSequenceErrors = validateInstallmentDates(installments);
    if (Object.keys(dateSequenceErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...dateSequenceErrors }));
      snackbar.show("Installment due dates must be in chronological order.", "error");
      return;
    }

    // Pre-flight validation and Sum verification on final submit
    if (targetTab === "finish") {
      let hasError = false;
      const newErrors: Record<string, string> = {};

      fees.forEach((f, idx) => {
        if (!f.feeCategoryId) { newErrors[`fees.${idx}.feeCategoryId`] = "Required"; hasError = true; }
        if (!f.amount || isNaN(parseFloat(f.amount as string))) { newErrors[`fees.${idx}.amount`] = "Required"; hasError = true; }
      });

      installments.forEach((inst, idx) => {
        if (!inst.name.trim()) { newErrors[`installments.${idx}.name`] = "Required"; hasError = true; }
        if (!inst.amount || isNaN(parseFloat(inst.amount as string))) { newErrors[`installments.${idx}.amount`] = "Required"; hasError = true; }
        if (!inst.dueDate) { newErrors[`installments.${idx}.dueDate`] = "Required"; hasError = true; }
      });

      if (hasError) {
        setErrors(prev => ({ ...prev, ...newErrors }));
        snackbar.show("Please complete all required fields in Fees & Installments.", "error");
        return;
      }

      const termTypesList = ["FULL_TERM", "HALF_TERM", "SHORT_TERM"] as const;
      for (const t of termTypesList) {
        const termFees = fees.filter(f => f.termType === t);
        const termInstallments = installments.filter(inst => inst.termType === t);

        if (termFees.length > 0 || termInstallments.length > 0) {
          const totalTermFees = termFees.reduce((sum, f) => {
            const amt = typeof f.amount === "string" ? parseFloat(f.amount) : f.amount;
            return sum + (isNaN(amt) ? 0 : amt);
          }, 0);

          const totalTermInstallments = termInstallments.reduce((sum, inst) => {
            const amt = typeof inst.amount === "string" ? parseFloat(inst.amount) : inst.amount;
            return sum + (isNaN(amt) ? 0 : amt);
          }, 0);

          if (Math.abs(totalTermFees - totalTermInstallments) > 0.01) {
            const termLabel = t === "FULL_TERM" ? "Full Term" : t === "HALF_TERM" ? "Half Term" : "Short Term";
            snackbar.show(
              `The sum of ${termLabel} installments (₹${totalTermInstallments.toLocaleString("en-IN")}) must equal the total ${termLabel} fee amount (₹${totalTermFees.toLocaleString("en-IN")}).`,
              "error"
            );
            return;
          }
        }
      }
    }

    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error?.code === "VALIDATION_ERROR" && Array.isArray(data.error.details)) {
          const apiErrors: Record<string, string> = {};
          data.error.details.forEach((err: { field: string; message: string }) => {
            apiErrors[err.field] = err.message;
          });
          setErrors((prev) => ({ ...prev, ...apiErrors }));
          snackbar.show("Please correct the highlighted errors.", "error");
        } else {
          setSubmitError({
            message: data.error?.message ?? "Operation failed",
            details: typeof data.error?.details === "string" ? data.error.details : JSON.stringify(data.error?.details)
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      if (isNew) {
        setClassId(data.data.id);
        setFormMode("edit");
      }
      
      // Update local state with generated IDs from backend to prevent duplicate creation on next PATCH
      if (data.data) {
        if (data.data.sections) {
          setSections(data.data.sections.map((sec: any) => {
            const subjectTeachers = sec.sectionSubjectTeachers?.map((sst: any) => {
              const subjectIndex = data.data.subjects?.findIndex((s: any) => s.id === sst.subject.id);
              return { subjectIndex: subjectIndex >= 0 ? subjectIndex : 0, staffId: sst.staff.id };
            }) || [];
            return {
              id: sec.id,
              name: sec.name,
              classTeacherId: sec.classTeacher?.id ?? null,
              subjectTeachers,
              studentCount: sec._count?.studentEnrollments ?? 0,
            };
          }));
        }

        if (data.data.feeStructures) {
          setFees(data.data.feeStructures.map((f: any) => ({
            id: f.id,
            name: f.feeCategory?.name || "",
            amount: Number(f.amount),
            termType: f.termType as any,
          })));
        }

        if (data.data.feeInstallmentTemplates) {
          setInstallments(data.data.feeInstallmentTemplates.map((t: any) => ({
            id: t.id,
            name: t.name,
            amount: Number(t.amount),
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
            termType: t.termType as any,
            lateFeeActive: t.lateFeeActive,
            lateFeeType: t.lateFeeType as any,
            lateFeeValue: t.lateFeeValue !== undefined ? Number(t.lateFeeValue) : Number(t.lateFeePerDay),
            lateFeePerDay: Number(t.lateFeePerDay),
            lateFeeGrace: Number(t.lateFeeGrace),
          })));
        }
      }
      
      setStatus(nextStatus);

      if (targetTab === "finish") {
        snackbar.show(isNew ? "Class created and activated successfully" : "Class updated and activated successfully", "success");
        router.push("/classes");
        router.refresh();
      } else {
        snackbar.show("Draft changes saved", "success");
        setActiveMainTab(targetTab);
      }
    } catch (err) {
      console.error("Save step error:", err);
      setSubmitError({
        message: "An unexpected error occurred",
        details: err instanceof Error ? err.message : String(err)
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }

  if (mode === "create" && !academicYearsLoading && academicYears.length === 0) {
    return (
      <Card variant="outlined" className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-sm shadow-red-500/10">
            <Icon name="warning" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm font-black text-on-surface">Academic Year Configuration Required</h2>
            <p className="text-body-md text-on-surface-variant/80 max-w-md">
              To define classes, standards, and divisions, you must first configure at least one active Academic Year.
            </p>
          </div>
          <Button
            variant="tonal"
            icon="date_range"
            onClick={() => router.push("/academic-years")}
            className="hover:scale-[1.02] transition-all duration-200"
          >
            Configure Academic Year
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "create" && !branchesLoading && branches.length === 0) {
    return (
      <Card variant="outlined" className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-sm shadow-red-500/10">
            <Icon name="warning" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm font-black text-on-surface">Campus Branch Configuration Required</h2>
            <p className="text-body-md text-on-surface-variant/80 max-w-md">
              To define classes and schedule courses, you must first configure at least one physical Campus Branch.
            </p>
          </div>
          <Button
            variant="tonal"
            icon="domain"
            onClick={() => router.push("/branches")}
            className="hover:scale-[1.02] transition-all duration-200"
          >
            Configure Branches
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "create" && branchId && !teachersLoading && teachers.length === 0) {
    return (
      <Card variant="outlined" className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-sm shadow-red-500/10">
            <Icon name="warning" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm font-black text-on-surface">Faculty & Staff Setup Required</h2>
            <p className="text-body-md text-on-surface-variant/80 max-w-md">
              To configure class divisions, you must first register teachers and faculty members who will be assigned to them.
            </p>
          </div>
          <Button
            variant="tonal"
            icon="group"
            onClick={() => router.push("/staff")}
            className="hover:scale-[1.02] transition-all duration-200"
          >
            Register Faculty & Staff
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveStep("finish");
      }}
      className={cn(
        "mx-auto transition-all duration-300 ease-in-out",
        activeMainTab === "fees-and-installments" ? "max-w-5xl" : "max-w-2xl"
      )}
    >
      {submitError && (
        <div className="mb-6 rounded-2xl border border-error/20 bg-error/5 p-5 shadow-sm animate-in fade-in slide-in-from-top-4 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon name="error" size={24} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 mt-0.5">
            <h3 className="text-sm font-bold text-error tracking-tight">{submitError.message}</h3>
            {submitError.details && submitError.details !== "undefined" && (
              <p className="text-xs font-semibold text-error/80 font-mono whitespace-pre-wrap bg-error/5 p-2 rounded-lg border border-error/10">
                {submitError.details}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-error/60 hover:bg-error/10 hover:text-error transition-colors shrink-0"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {hasEnrolledStudents && (
        <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface to-surface-container-lowest border border-outline/10 shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all hover:shadow-md">
          {/* Premium Glow Effect */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          
          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Icon Container with Inner Shadow */}
            <div className="flex items-center justify-center h-16 w-16 shrink-0 rounded-2xl bg-surface border border-outline-variant/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]">
              <Icon name="lock" size={28} className="text-primary" />
            </div>
            
            {/* Content */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className="text-lg font-bold text-on-surface tracking-tight">Security Lock Engaged</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black tracking-widest uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Students
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant/80 max-w-2xl leading-relaxed">
                  {hasInvoices 
                    ? "Financial & structural integrity protected. Invoices are generated and students are enrolled."
                    : "Structural integrity protected. Students are actively enrolled in this class."}
                </p>
              </div>

              {/* Actionable Status Badges (Accurate Matrix) */}
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-700 dark:text-red-400">
                  <Icon name="lock" size={14} />
                  <span className="opacity-90">Locked:</span> 
                  {hasInvoices ? "Grade level, fees & installments" : "Grade level"}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Icon name="edit" size={14} />
                  <span className="opacity-90">Editable:</span> 
                  {hasInvoices ? "Class name, teachers, divisions & dates" : "Fees, class name, teachers & divisions"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for Installment Masters (Creatable Combobox Fallback) */}
      <datalist id="master-installments">
        {installmentMasters.map((master) => (
          <option key={master.id} value={master.name} />
        ))}
      </datalist>

      <Card variant="outlined">
        <CardContent className="p-6">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="divisions" disabled={!classId}>Divisions</TabsTrigger>
              <TabsTrigger value="fees-and-installments" disabled={!classId}>Fees & Installments</TabsTrigger>
            </TabsList>

            {/* ── Details Tab ── */}
            <TabsContent value="details" className="mt-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Class name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                  placeholder="e.g. Class 1"
                  required
                  disabled={false}
                  fullWidth
                />
                <SelectField
                  label="Class Level (Sequence)"
                  value={numericGrade}
                  onValueChange={setNumericGrade}
                  options={CLASS_LEVEL_OPTIONS}
                  error={errors.numericGrade}
                  placeholder="Select level"
                  required
                  disabled={hasEnrolledStudents}
                  fullWidth
                  helperText="Used to arrange classes logically and automate promotions."
                />
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${isSuperAdmin ? "sm:grid-cols-2" : ""}`}
              >
                {isSuperAdmin && (
                  <SelectField
                    label="Branch"
                    value={branchId}
                    onValueChange={setBranchId}
                    disabled={hasEnrolledStudents || formMode === "edit"}
                    required
                    fullWidth
                    error={errors.branchId}
                    placeholder={branchesLoading ? "Loading..." : "Select branch"}
                    options={branches.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                )}
                <SelectField
                  label="Academic Year"
                  value={academicYearId}
                  onValueChange={setAcademicYearId}
                  disabled={hasEnrolledStudents || formMode === "edit"}
                  required
                  fullWidth
                  error={errors.academicYearId}
                  placeholder={academicYearsLoading ? "Loading..." : "Select academic year"}
                  options={academicYears.map((y) => ({
                    value: y.id,
                    label: `${y.name}${y.isCurrent ? " (Current)" : ""}`,
                  }))}
                />
              </div>

              <Divider />

              {/* Subjects */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-label-lg font-medium text-on-surface">
                    Subjects
                  </p>
                  <Link
                    href="/subject-masters"
                    className="text-label-md text-primary hover:underline"
                  >
                    Manage Subject Catalog
                  </Link>
                </div>
                <MultiSelect
                  options={subjectMasters.map((sm) => ({
                    value: sm.id,
                    label: `${sm.name} (${sm.code})`,
                  }))}
                  value={selectedSubjectMasterIds}
                  onChange={setSelectedSubjectMasterIds}
                  placeholder={
                    subjectMastersLoading
                      ? "Loading..."
                      : "Select subjects from catalog"
                  }
                  searchPlaceholder="Search subjects..."
                  labelFormatter={(n) =>
                    `${n} subject${n !== 1 ? "s" : ""} selected`
                  }
                  disabled={hasEnrolledStudents}
                  fullWidth
                />
              </div>
            </TabsContent>

            {/* ── Divisions Tab ── */}
            <TabsContent value="divisions" className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-label-lg font-medium text-on-surface">
                  Divisions
                </p>
                <Button
                  type="button"
                  variant="text"
                  icon="add"
                  onClick={addSection}
                >
                  Add Division
                </Button>
              </div>
              {errors.sections && (
                <p className="px-4 text-[12px] leading-4 text-error">
                  {errors.sections}
                </p>
              )}
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => (
                  <div
                    key={sectionIndex}
                    className="rounded-md border border-outline-variant p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-label-lg font-medium text-on-surface">
                        Division{section.name ? ` ${section.name}` : ""}
                      </p>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          disabled={(section.studentCount ?? 0) > 0}
                          onClick={() => removeSection(sectionIndex)}
                          className="rounded-full p-1 hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Icon name="close" size={20} />
                        </button>
                      )}
                    </div>

                    <TextField
                      label="Division name"
                      placeholder="e.g. A"
                      value={section.name}
                      onChange={(e) =>
                        updateSectionName(sectionIndex, e.target.value)
                      }
                      error={errors[`sections.${sectionIndex}.name`]}
                      disabled={(section.studentCount ?? 0) > 0}
                      fullWidth
                    />

                    {/* Subject-teacher grid */}
                    {selectedSubjects.length > 0 ? (
                      <div className="mt-2">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 gap-y-2 items-center">
                          <p className="text-label-sm text-on-surface-variant font-medium">
                            Subject
                          </p>
                          <p className="text-label-sm text-on-surface-variant font-medium">
                            Teacher
                          </p>
                          <p className="text-label-sm text-on-surface-variant font-medium text-center w-8">
                            CT
                          </p>

                          {selectedSubjects.map((subj, subjectIndex) => {
                            const teacherEntry = section.subjectTeachers.find(
                              (st) => st.subjectIndex === subjectIndex
                            );
                            const currentStaffId = teacherEntry?.staffId ?? "";
                            const isClassTeacher =
                              currentStaffId &&
                              section.classTeacherId === currentStaffId;

                            return (
                              <div key={subj.key} className="contents">
                                <p className="text-body-md text-on-surface truncate">
                                  {subj.name}
                                </p>
                                <Select
                                  value={currentStaffId || "__none__"}
                                  onValueChange={(val) =>
                                    updateSectionTeacher(
                                      sectionIndex,
                                      subjectIndex,
                                      val === "__none__" ? "" : val
                                    )
                                  }
                                  disabled={!branchId}
                                >
                                  <SelectTrigger fullWidth>
                                    <SelectValue
                                      placeholder={
                                        teachersLoading
                                          ? "Loading..."
                                          : "Select teacher"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      None
                                    </SelectItem>
                                    {teachers.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex justify-center w-8">
                                  <input
                                    type="radio"
                                    name={`classTeacher-${sectionIndex}`}
                                    checked={!!isClassTeacher}
                                    disabled={!currentStaffId}
                                    onChange={() =>
                                      updateClassTeacher(
                                        sectionIndex,
                                        currentStaffId || null
                                      )
                                    }
                                    className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-38"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-body-sm text-on-surface-variant">
                        Add subjects in the Details tab to configure teacher
                        assignments
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── Fees & Installments Tab ── */}
            <TabsContent value="fees-and-installments" className="mt-5 space-y-6">
              <div>
                <p className="text-label-lg font-medium text-on-surface">
                  Fees & Installment Plans
                </p>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Configure the annual fee structure and payment installments for each term plan.
                </p>
              </div>

              {/* Nested Sub-Tabs for Term Selection */}
              <div className="flex border-b border-outline-variant/60">
                {[
                  { value: "FULL_TERM", label: "Full Term" },
                  { value: "HALF_TERM", label: "Half Term" },
                  { value: "SHORT_TERM", label: "Short Term" },
                ].map((tab) => {
                  const isActive = activeTermTab === tab.value;
                  const termFees = fees.filter(f => f.termType === tab.value);
                  const hasFees = termFees.length > 0;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTermTab(tab.value as any)}
                      className={`px-5 py-3 text-label-md font-bold transition-all relative -mb-[2px] cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? "text-primary border-b-2 border-primary font-black"
                          : "text-on-surface-variant border-b-2 border-transparent hover:text-on-surface"
                      }`}
                    >
                      {tab.label}
                      {hasFees && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sub-Tab Content based on activeTermTab */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Column (Inputs) */}
                <div className="lg:col-span-2 space-y-6">
                
                {/* A. FEE STRUCTURE SECTION */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm border-t-4 border-t-blue-500 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 px-5 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Icon name="receipt_long" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Fee Structure
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Define categories and annual fees for this term.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="space-y-3">
                    {fees
                      .map((fee, index) => ({ fee, index }))
                      .filter(({ fee }) => fee.termType === activeTermTab)
                      .map(({ fee, index }) => (
                        <div key={index} className="flex items-start gap-2 animate-fadeIn">
                          <div className="flex-1">
                            <Select
                              value={fee.feeCategoryId || ""}
                              onValueChange={(val) => updateFee(index, "feeCategoryId", val)}
                              disabled={hasInvoices}
                            >
                              <SelectTrigger className={errors[`fees.${index}.feeCategoryId`] ? "border-red-500" : ""}>
                                <SelectValue placeholder="Select Fee Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {feeCategories.map((cat) => {
                                  if (!cat.isActive && cat.id !== fee.feeCategoryId) return null;
                                  
                                  const isSelectedElsewhere = fees.some(
                                    (f, i) => i !== index && f.feeCategoryId === cat.id && f.termType === activeTermTab
                                  );

                                  return (
                                    <SelectItem 
                                      key={cat.id} 
                                      value={cat.id}
                                      disabled={isSelectedElsewhere}
                                    >
                                      {cat.name} 
                                      {!cat.isActive && " (Inactive)"}
                                      {isSelectedElsewhere && " (Already Added)"}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {errors[`fees.${index}.feeCategoryId`] && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors[`fees.${index}.feeCategoryId`]}
                              </p>
                            )}
                          </div>
                          <div className="w-40">
                            <CurrencyInput
                              label=""
                              placeholder="Amount (₹)"
                              value={fee.amount.toString()}
                              onChange={(e) =>
                                updateFee(index, "amount", e.target.value)
                              }
                              error={errors[`fees.${index}.amount`]}
                              disabled={hasInvoices}
                              fullWidth
                            />
                          </div>
                          {!hasInvoices && (
                            <button
                              type="button"
                              onClick={() => removeFee(index)}
                              className="rounded-full p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-all duration-200 cursor-pointer mt-1 flex items-center justify-center"
                            >
                              <Icon name="close" size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {fees.filter((f) => f.termType === activeTermTab).length > 0 && (
                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 px-1 select-none">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Total Fees</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80 shadow-sm font-mono">
                          ₹{fees
                            .filter((f) => f.termType === activeTermTab)
                            .reduce((sum, f) => {
                              const amt = parseFloat(f.amount.toString()) || 0;
                              return sum + amt;
                            }, 0)
                            .toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}

                    {fees.filter(f => f.termType === activeTermTab).length === 0 && (
                      <p className="text-body-sm text-on-surface-variant text-center py-4 bg-slate-50/30 rounded-xl border border-dashed border-outline-variant/30">
                        No fees added for this term yet. Click &ldquo;Add Fee Item&rdquo; to begin.
                      </p>
                    )}

                    {!hasInvoices && (
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          variant="outlined"
                          icon="add"
                          onClick={() => addFee(activeTermTab)}
                          className="hover:scale-[1.02] transition-all duration-200"
                        >
                          Add Fee Item
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* B. INSTALLMENTS SECTION */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm border-t-4 border-t-primary overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 px-5 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 text-primary dark:bg-primary/20 rounded-xl">
                        <Icon name="event" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Installment Plan
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Divide the total fee of this term into installments.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Timeline Container */}
                    <div className="relative space-y-6">
                      {/* Timeline Vertical Connector Line */}
                      {installments.filter(i => i.termType === activeTermTab).length > 1 && (
                        <div className="absolute left-[13px] top-[14px] bottom-[14px] w-0.5 bg-slate-200 dark:bg-slate-800 pointer-events-none" />
                      )}

                      {installments
                        .map((inst, index) => ({ inst, index }))
                        .filter(({ inst }) => inst.termType === activeTermTab)
                        .map(({ inst, index }, mappedIdx) => {
                          const isExpanded = expandedLateFeeIndex === index;
                          const hasError = errors[`installments.${index}.name`] || errors[`installments.${index}.amount`] || errors[`installments.${index}.dueDate`];

                          const termInstallments = installments.filter(i => i.termType === activeTermTab);
                          const prevInst = mappedIdx > 0 ? termInstallments[mappedIdx - 1] : null;
                          const minDate = prevInst && prevInst.dueDate ? prevInst.dueDate : undefined;

                          return (
                            <div key={index} className="relative pl-10 group animate-fadeIn">
                              {/* Timeline Bullet Badge */}
                              <div className={cn(
                                "absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shadow-sm transition-all duration-300 border-2 select-none z-10",
                                hasError
                                  ? "bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-450"
                                  : "bg-white border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 group-hover:border-primary group-hover:text-primary"
                              )}>
                                {mappedIdx + 1}
                              </div>

                              {/* Installment Form Inputs Row */}
                              <div className="space-y-3">
                                <div className="flex flex-col md:flex-row md:items-end gap-4">
                                  {/* Name Input */}
                                  <div className="flex-1 min-w-[200px]">
                                    <TextField
                                      variant="compact"
                                      label="Installment Name"
                                      placeholder="e.g. Admission / Term 1"
                                      value={inst.name}
                                      list="master-installments"
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const master = installmentMasters.find(
                                          m => m.name.toLowerCase() === val.trim().toLowerCase()
                                        );
                                        updateInstallment(index, "name", val);
                                        updateInstallment(index, "installmentMasterId", master ? master.id : null);
                                      }}
                                      error={errors[`installments.${index}.name`]}
                                      disabled={hasInvoices}
                                      required
                                      fullWidth
                                    />
                                  </div>

                                  {/* Due Date Input */}
                                  <div className="w-full md:w-48">
                                    <TextField
                                      variant="compact"
                                      label="Due Date"
                                      type="date"
                                      value={inst.dueDate}
                                      onChange={(e) =>
                                        updateInstallment(index, "dueDate", e.target.value)
                                      }
                                      min={minDate}
                                      error={errors[`installments.${index}.dueDate`]}
                                      disabled={false}
                                      required
                                      fullWidth
                                    />
                                  </div>

                                  {/* Amount Input */}
                                  <div className="w-full md:w-48">
                                    <CurrencyInput
                                      variant="compact"
                                      label="Amount"
                                      placeholder="e.g. 15,000"
                                      value={inst.amount.toString()}
                                      onChange={(e) =>
                                        updateInstallment(index, "amount", e.target.value)
                                      }
                                      error={errors[`installments.${index}.amount`]}
                                      disabled={hasInvoices}
                                      required
                                      fullWidth
                                    />
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1.5 h-10 self-end">
                                    {!hasInvoices && (
                                      <button
                                        type="button"
                                        onClick={() => removeInstallment(index)}
                                        className="rounded-lg p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:text-slate-500 dark:hover:text-rose-450 dark:hover:bg-rose-950/20 transition-all duration-200 cursor-pointer flex items-center justify-center border border-transparent hover:border-rose-100 dark:hover:border-rose-950/50"
                                        title="Delete Installment"
                                      >
                                        <Icon name="delete" size={18} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Late Fee Summary & Toggle Tray */}
                                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                                  {inst.lateFeeActive ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-900/40 shadow-sm animate-fadeIn">
                                      <Icon name="schedule" size={14} className="text-emerald-500" />
                                      <span>
                                        Late Fee: {inst.lateFeeType === "DAILY" && `₹${inst.lateFeeValue}/day`}
                                        {inst.lateFeeType === "LUMP_SUM" && `₹${inst.lateFeeValue} One-time`}
                                        {inst.lateFeeType === "PERCENTAGE" && `${inst.lateFeeValue}%`}
                                        {Number(inst.lateFeeGrace) > 0 ? ` (Grace: ${inst.lateFeeGrace}d)` : " (No grace)"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedLateFeeIndex(isExpanded ? null : index)}
                                        className="ml-1 p-0.5 rounded text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:text-emerald-250 dark:hover:bg-emerald-900/50 cursor-pointer flex items-center justify-center transition-all duration-150"
                                        title="Edit Late Fee settings"
                                      >
                                        <Icon name="edit" size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateInstallment(index, "lateFeeActive", false);
                                          if (isExpanded) setExpandedLateFeeIndex(null);
                                        }}
                                        className="p-0.5 rounded text-emerald-450 hover:text-rose-600 hover:bg-rose-50 dark:text-emerald-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer flex items-center justify-center transition-all duration-150"
                                        title="Remove Late Fee policy"
                                      >
                                        <Icon name="close" size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateInstallment(index, "lateFeeActive", true);
                                        setExpandedLateFeeIndex(index);
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-primary bg-slate-50 hover:bg-slate-100 border border-slate-200/80 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-primary dark:hover:bg-slate-800 dark:border-slate-800 transition-all duration-150 cursor-pointer"
                                    >
                                      <Icon name="add" size={13} />
                                      <span>Apply Late Fee</span>
                                    </button>
                                  )}
                                </div>

                                {/* Collapsible Late Fee Form Panel */}
                                {isExpanded && inst.lateFeeActive && (
                                  <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-slideDown mt-2">
                                    <SelectField
                                      variant="compact"
                                      label="Late Fee Type"
                                      value={inst.lateFeeType || "DAILY"}
                                      onValueChange={(val) => {
                                        updateInstallment(index, "lateFeeType", val as any);
                                        updateInstallment(index, "lateFeeValue", 0);
                                        updateInstallment(index, "lateFeePerDay", 0);
                                      }}
                                      options={[
                                        { value: "DAILY", label: "Daily Rate" },
                                        { value: "LUMP_SUM", label: "One-time Lump-sum" },
                                        { value: "PERCENTAGE", label: "Percentage of Installment" },
                                      ]}
                                      fullWidth
                                    />

                                    <TextField
                                      variant="compact"
                                      label={
                                        inst.lateFeeType === "LUMP_SUM"
                                          ? "Fixed Penalty (₹)"
                                          : inst.lateFeeType === "PERCENTAGE"
                                            ? "Penalty Rate (%)"
                                            : "Penalty Rate (₹/day)"
                                      }
                                      type="number"
                                      placeholder={
                                        inst.lateFeeType === "PERCENTAGE" ? "e.g. 5" : "e.g. 50"
                                      }
                                      value={(inst.lateFeeValue ?? 0).toString()}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updateInstallment(index, "lateFeeValue", val);
                                        if ((inst.lateFeeType || "DAILY") === "DAILY") {
                                          updateInstallment(index, "lateFeePerDay", val);
                                        }
                                      }}
                                      error={errors[`installments.${index}.lateFeeValue`]}
                                      required
                                      fullWidth
                                    />

                                    <TextField
                                      variant="compact"
                                      label="Grace Days"
                                      type="number"
                                      placeholder="e.g. 2"
                                      value={inst.lateFeeGrace.toString()}
                                      onChange={(e) =>
                                        updateInstallment(index, "lateFeeGrace", parseInt(e.target.value) || 0)
                                      }
                                      error={errors[`installments.${index}.lateFeeGrace`]}
                                      required
                                      fullWidth
                                    />
                                    
                                    <div className="col-span-1 md:col-span-3 flex justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedLateFeeIndex(null)}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-150 cursor-pointer"
                                      >
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {installments.filter(i => i.termType === activeTermTab).length === 0 && (
                      <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50/20 border-outline-variant/30">
                        <p className="text-body-md text-on-surface-variant font-medium">
                          No installments configured
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click &ldquo;Add Installment&rdquo; to define a payment schedule.
                        </p>
                      </div>
                    )}

                    {!hasInvoices && (
                      <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60">
                        <Button
                          type="button"
                          variant="outlined"
                          icon="add"
                          onClick={() => {
                            addInstallment(activeTermTab);
                            // Set newly added installment to open late fee settings if they want
                          }}
                          className="hover:scale-[1.02] transition-all duration-200"
                        >
                          Add Installment
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Right Column (Sticky Summary) */}
                <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-4">
                  {/* C. TERM TOTAL SUMMARY AND VERIFICATION CARD */}
                {(() => {
                  const termFees = fees.filter(f => f.termType === activeTermTab);
                  const termInstallments = installments.filter(i => i.termType === activeTermTab);

                  const totalFees = termFees.reduce((sum, f) => {
                    const amt = typeof f.amount === "string" ? parseFloat(f.amount) : f.amount;
                    return sum + (isNaN(amt) ? 0 : amt);
                  }, 0);

                  const totalInstallments = termInstallments.reduce((sum, i) => {
                    const amt = typeof i.amount === "string" ? parseFloat(i.amount) : i.amount;
                    return sum + (isNaN(amt) ? 0 : amt);
                  }, 0);

                  const isMismatch = Math.abs(totalFees - totalInstallments) > 0.01;
                  const termLabel = activeTermTab === "FULL_TERM" ? "Full Term" : activeTermTab === "HALF_TERM" ? "Half Term" : "Short Term";

                  if (totalFees === 0 && totalInstallments === 0) {
                    return (
                      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 text-slate-450 dark:text-slate-500 text-center shadow-sm select-none">
                        <Icon name="account_balance_wallet" size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-350">Allocation Summary</h5>
                        <p className="text-[11px] leading-relaxed mt-1">Configure your fee components and installment timeline to verify allocation status.</p>
                      </div>
                    );
                  }

                  const pct = totalFees > 0 ? Math.min(100, Math.round((totalInstallments / totalFees) * 100)) : 0;

                  return (
                    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                      {/* Widget Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {termLabel} Allocation
                        </span>
                        <div className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase",
                          isMismatch
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", isMismatch ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
                          {isMismatch ? "Mismatch" : "Balanced"}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-450">
                          <span>Allocation Progress</span>
                          <span className={cn(isMismatch ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200/30 dark:border-slate-900">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500 ease-out",
                              isMismatch
                                ? totalInstallments > totalFees
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Fee Components Breakdown */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Fee Components
                        </span>
                        <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin select-none">
                          {termFees.map((fee, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-100 dark:border-slate-800/40">
                              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[130px]" title={feeCategories.find(c => c.id === fee.feeCategoryId)?.name || "Untitled Item"}>
                                {feeCategories.find(c => c.id === fee.feeCategoryId)?.name || "Untitled Item"}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                ₹{(parseFloat(fee.amount.toString()) || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                          {termFees.length === 0 && (
                            <p className="text-[11px] text-slate-400 italic text-center py-2">No fees configured</p>
                          )}
                        </div>
                      </div>

                      {/* Installment Milestones Breakdown */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Installment Milestones
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin select-none">
                          {termInstallments.map((inst, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-100 dark:border-slate-800/40">
                              <div className="flex flex-col truncate max-w-[130px]">
                                <span className="text-slate-600 dark:text-slate-400 truncate font-semibold">
                                  {inst.name || `Installment ${idx + 1}`}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  Due: {inst.dueDate || "Not set"}
                                </span>
                              </div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                ₹{(parseFloat(inst.amount.toString()) || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                          {termInstallments.length === 0 && (
                            <p className="text-[11px] text-slate-400 italic text-center py-2">No installments configured</p>
                          )}
                        </div>
                      </div>

                      {/* Total Summaries & Alerts */}
                      <div className="pt-3 border-t border-slate-150 dark:border-slate-800/80 space-y-2.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-550 dark:text-slate-450">
                          <span>Total Term Fees</span>
                          <span className="text-sm font-black text-slate-850 dark:text-slate-100 font-mono">
                            ₹{totalFees.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-550 dark:text-slate-450">
                          <span>Allocated Installments</span>
                          <span className="text-sm font-black text-slate-850 dark:text-slate-100 font-mono">
                            ₹{totalInstallments.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {isMismatch ? (
                          <div className={cn(
                            "mt-2 p-3 rounded-xl border text-xs leading-relaxed font-bold",
                            totalInstallments > totalFees
                              ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-800 dark:text-amber-300"
                              : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 text-rose-800 dark:text-rose-350"
                          )}>
                            <div className="flex gap-2">
                              <Icon name="info" size={16} className="shrink-0 mt-0.5" />
                              <span>
                                {totalInstallments > totalFees
                                  ? `Over-allocated by ₹${(totalInstallments - totalFees).toLocaleString("en-IN")}. Adjust amounts to match.`
                                  : `Under-allocated by ₹${(totalFees - totalInstallments).toLocaleString("en-IN")}. Increase installments to cover.`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 p-3 rounded-xl border bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-350 text-xs leading-relaxed font-bold flex gap-2">
                            <Icon name="check_circle" size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                            <span>Allocation balanced! Installment milestones match the total fees perfectly.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/classes")}
        >
          Cancel
        </Button>
        
        {/* Render buttons dynamically based on wizard tab */}
        {activeMainTab === "details" && (
          <>
            {status === "ACTIVE" && (
              <Button
                type="button"
                variant="filled"
                loading={loading}
                icon="check"
                onClick={() => saveStep("finish")}
              >
                Save Changes
              </Button>
            )}
            <Button
              type="button"
              variant="filled"
              loading={loading}
              icon="arrow_forward"
              onClick={() => saveStep("divisions")}
            >
              Save & Continue
            </Button>
          </>
        )}

        {activeMainTab === "divisions" && (
          <>
            <Button
              type="button"
              variant="outlined"
              icon="arrow_back"
              onClick={() => setActiveMainTab("details")}
            >
              Back
            </Button>
            {status === "ACTIVE" && (
              <Button
                type="button"
                variant="filled"
                loading={loading}
                icon="check"
                onClick={() => saveStep("finish")}
              >
                Save Changes
              </Button>
            )}
            <Button
              type="button"
              variant="filled"
              loading={loading}
              icon="arrow_forward"
              onClick={() => saveStep("fees-and-installments")}
            >
              Save & Continue
            </Button>
          </>
        )}

        {activeMainTab === "fees-and-installments" && (
          <>
            <Button
              type="button"
              variant="outlined"
              icon="arrow_back"
              onClick={() => setActiveMainTab("divisions")}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="filled"
              loading={loading}
              icon="check"
              onClick={() => saveStep("finish")}
            >
              {status === "ACTIVE" ? "Save Changes" : "Finish & Activate"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
