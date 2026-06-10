"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SelectField } from "@/components/ui/select-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBranches } from "@/hooks/use-branches";
import { useTeachers } from "@/hooks/use-teachers";
import { useSubjectMasters } from "@/hooks/use-subject-masters";
import {
  createClassSchema,
  updateClassSchema,
} from "@/lib/validations/class";

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
  name: string;
  amount: number | string;
  termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
}

interface InstallmentRow {
  id?: string;
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
    feeCategory: { name: string };
    termType?: string;
  }>;
  feeInstallmentTemplates?: Array<{
    id: string;
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
      name: f.feeCategory.name,
      amount: Number(f.amount),
      termType: (f.termType || "FULL_TERM") as any,
    })) ?? []
  );

  const [installments, setInstallments] = useState<InstallmentRow[]>(() =>
    initialData?.feeInstallmentTemplates?.map((t) => ({
      id: t.id,
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
    setFees((prev) => [...prev, { name: "", amount: "", termType }]);
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

  function removeInstallment(index: number) {
    setInstallments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateInstallment(index: number, field: keyof InstallmentRow, value: any) {
    setInstallments((prev) =>
      prev.map((inst, i) => (i === index ? { ...inst, [field]: value } : inst))
    );
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

    // 2. Prepare payload
    const formattedInstallments = installments.map((inst) => ({
      ...(inst.id ? { id: inst.id } : {}),
      name: inst.name,
      amount: typeof inst.amount === "string" ? parseFloat(inst.amount) : inst.amount,
      dueDate: inst.dueDate,
      termType: inst.termType,
      lateFeeActive: inst.lateFeeActive,
      lateFeeType: inst.lateFeeType,
      lateFeeValue: typeof inst.lateFeeValue === "string" ? parseFloat(inst.lateFeeValue) : (inst.lateFeeValue ?? 0),
      lateFeePerDay: typeof inst.lateFeePerDay === "string" ? parseFloat(inst.lateFeePerDay) : inst.lateFeePerDay,
      lateFeeGrace: typeof inst.lateFeeGrace === "string" ? parseInt(inst.lateFeeGrace, 10) : inst.lateFeeGrace,
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
            name: f.name,
            amount: typeof f.amount === "string" ? parseFloat(f.amount) : f.amount,
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
            name: f.name,
            amount: typeof f.amount === "string" ? parseFloat(f.amount) : f.amount,
            termType: f.termType,
          })),
          installments: formattedInstallments,
          status: nextStatus,
        };

    // Sum verification on final submit
    if (targetTab === "finish") {
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
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        snackbar.show(data.error?.message ?? "Operation failed", "error");
        return;
      }

      if (isNew) {
        setClassId(data.data.id);
        setFormMode("edit");
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
      snackbar.show("An error occurred", "error");
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
    <form onSubmit={(e) => { e.preventDefault(); saveStep("finish"); }} className="mx-auto max-w-2xl">
      {hasEnrolledStudents && (
        <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/30 p-5 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3.5 shadow-sm backdrop-blur-sm animate-fadeIn">
          <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
            <Icon name="security" size={22} className="animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                Granular Lifecycle Lock (स्मार्ट सुरक्षा लॉक)
              </strong>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 hidden sm:inline-block" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Active Enrolled Students
              </span>
            </div>
            <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-1">
              {hasInvoices ? (
                <>
                  <span className="block font-medium">
                    🇮🇳 फी आणि हप्ते लॉक केले आहेत कारण फीचे इनव्हॉइस (Invoices) आधीच तयार झाले आहेत. वर्ग नाव, शिक्षक, आणि हप्त्यांच्या तारखा बदलता येतील.
                  </span>
                  <span className="block font-medium opacity-90 border-t border-amber-200/40 dark:border-amber-900/20 pt-1">
                    🇬🇧 Fee structures and installment amounts are locked because invoices have already been generated. Class name, teachers, and installment due dates remain editable.
                  </span>
                </>
              ) : (
                <>
                  <span className="block font-medium">
                    🇮🇳 वर्गात विद्यार्थी असल्याने फक्त श्रेणी (Grade Level) बदलणे प्रतिबंधित आहे. नवीन तुकडी जोडणे, रिकाम्या तुकड्या डिलीट करणे आणि फी बदलणे पूर्णपणे उपलब्ध आहे.
                  </span>
                  <span className="block font-medium opacity-90 border-t border-amber-200/40 dark:border-amber-900/20 pt-1">
                    🇬🇧 Since students are enrolled, only the grade level is locked. Adding new divisions, deleting empty divisions, and updating fee amounts are fully permitted.
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
                <TextField
                  label="Numeric grade"
                  type="number"
                  value={numericGrade}
                  onChange={(e) => setNumericGrade(e.target.value)}
                  error={errors.numericGrade}
                  placeholder="e.g. 1"
                  required
                  disabled={hasEnrolledStudents}
                  fullWidth
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
              <div className="space-y-6">
                
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
                            <TextField
                              label=""
                              placeholder="Fee name (e.g. Tuition)"
                              value={fee.name}
                              onChange={(e) =>
                                updateFee(index, "name", e.target.value)
                              }
                              error={errors[`fees.${index}.name`]}
                              disabled={hasInvoices}
                              fullWidth
                            />
                          </div>
                          <div className="w-40">
                            <TextField
                              label=""
                              type="number"
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

                    {fees.filter(f => f.termType === activeTermTab).length === 0 && (
                      <p className="text-body-sm text-on-surface-variant text-center py-4 bg-slate-50/30 rounded-xl border border-dashed border-outline-variant/30">
                        No fees added for this term yet. Click &ldquo;Add Fee Row&rdquo; to begin.
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
                          Add Fee Row
                        </Button>
                      </div>
                    )}
                  </div>
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

                  <div className="p-5 space-y-6">
                    <div className="space-y-6">
                    {installments
                      .map((inst, index) => ({ inst, index }))
                      .filter(({ inst }) => inst.termType === activeTermTab)
                      .map(({ inst, index }, mappedIdx) => (
                        <div
                          key={index}
                          className="relative p-6 space-y-6 bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 animate-fadeIn"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-1.5 rounded-full bg-primary" />
                              <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                                Installment #{mappedIdx + 1}
                              </p>
                            </div>
                            {!hasInvoices && (
                              <button
                                type="button"
                                onClick={() => removeInstallment(index)}
                                className="rounded-full p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-all duration-200 cursor-pointer flex items-center justify-center"
                              >
                                <Icon name="close" size={18} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <TextField
                              variant="compact"
                              label="Installment Name"
                              placeholder="e.g. Admission / Term 1"
                              value={inst.name}
                              onChange={(e) =>
                                updateInstallment(index, "name", e.target.value)
                              }
                              error={errors[`installments.${index}.name`]}
                              disabled={hasInvoices}
                              required
                              fullWidth
                            />
                            <TextField
                              variant="compact"
                              label="Amount (₹)"
                              type="number"
                              placeholder="e.g. 15000"
                              value={inst.amount.toString()}
                              onChange={(e) =>
                                updateInstallment(index, "amount", e.target.value)
                              }
                              error={errors[`installments.${index}.amount`]}
                              disabled={hasInvoices}
                              required
                              fullWidth
                            />
                            <TextField
                              variant="compact"
                              label="Due Date"
                              type="date"
                              value={inst.dueDate}
                              onChange={(e) =>
                                updateInstallment(index, "dueDate", e.target.value)
                              }
                              error={errors[`installments.${index}.dueDate`]}
                              disabled={false}
                              required
                              fullWidth
                            />
                          </div>

                          {/* Late fee subform */}
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 space-y-4">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                id={`late-fee-active-${index}`}
                                checked={inst.lateFeeActive}
                                onChange={(e) =>
                                  updateInstallment(index, "lateFeeActive", e.target.checked)
                                }
                                disabled={false}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40 cursor-pointer"
                              />
                              <label
                                htmlFor={`late-fee-active-${index}`}
                                className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                              >
                                Apply Late Fees
                              </label>
                            </div>

                            {inst.lateFeeActive && (
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5 animate-fadeIn">
                                <SelectField
                                  variant="compact"
                                  label="Late Fee Type"
                                  value={inst.lateFeeType || "DAILY"}
                                  onValueChange={(val) => {
                                    updateInstallment(index, "lateFeeType", val as any);
                                    updateInstallment(index, "lateFeeValue", 0);
                                    updateInstallment(index, "lateFeePerDay", 0);
                                  }}
                                  disabled={false}
                                  required
                                  fullWidth
                                  options={[
                                    { value: "DAILY", label: "Daily Rate" },
                                    { value: "LUMP_SUM", label: "One-time Lump-sum" },
                                    { value: "PERCENTAGE", label: "Percentage of Installment" },
                                  ]}
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
                                    const val = e.target.value;
                                    updateInstallment(index, "lateFeeValue", val);
                                    if ((inst.lateFeeType || "DAILY") === "DAILY") {
                                      updateInstallment(index, "lateFeePerDay", val);
                                    }
                                  }}
                                  error={errors[`installments.${index}.lateFeeValue`]}
                                  disabled={false}
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
                                    updateInstallment(index, "lateFeeGrace", e.target.value)
                                  }
                                  error={errors[`installments.${index}.lateFeeGrace`]}
                                  disabled={false}
                                  required
                                  fullWidth
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

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
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          variant="outlined"
                          icon="add"
                          onClick={() => addInstallment(activeTermTab)}
                          className="hover:scale-[1.02] transition-all duration-200"
                        >
                          Add Installment
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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

                  if (totalFees === 0 && totalInstallments === 0) return null;

                  return (
                    <div className={`p-4 rounded-2xl border text-sm transition-colors ${
                      isMismatch
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}>
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          <Icon name={isMismatch ? "warning" : "check_circle"} size={20} />
                        </div>
                        <div className="space-y-1">
                          <strong className="font-bold block text-sm">
                            {termLabel} Fee Summary
                          </strong>
                          <div className="text-xs space-y-0.5 font-medium opacity-90">
                            <div>Total Fees: ₹{totalFees.toLocaleString("en-IN")}</div>
                            <div>Total Installments Sum: ₹{totalInstallments.toLocaleString("en-IN")}</div>
                          </div>
                          {isMismatch && (
                            <p className="text-xs font-semibold mt-1.5 text-rose-700">
                              ⚠️ The sum of installments must equal the total fee amount (Difference: ₹{Math.abs(totalFees - totalInstallments).toLocaleString("en-IN")}).
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                icon="save"
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
                icon="save"
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
