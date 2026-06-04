"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
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
}

interface FeeRow {
  id?: string;
  name: string;
  amount: number | string;
}

interface ClassData {
  id: string;
  name: string;
  numericGrade: number;
  branchId: string;
  academicYearId: string;
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
  }>;
  feeStructures: Array<{
    id: string;
    amount: number | string;
    frequency: string;
    feeCategory: { name: string };
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
    initialData?.academicYearId ?? ""
  );

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
  function addFee() {
    setFees((prev) => [...prev, { name: "", amount: "" }]);
  }

  function removeFee(index: number) {
    setFees((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFee(index: number, field: keyof FeeRow, value: string) {
    setFees((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  }

  const annualTotal = fees.reduce((sum, f) => {
    const amt = typeof f.amount === "string" ? parseFloat(f.amount) : f.amount;
    if (isNaN(amt) || amt <= 0) return sum;
    return sum + amt;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "create") {
      const formFields = {
        name,
        numericGrade: numericGrade !== "" ? parseInt(numericGrade, 10) : undefined,
        branchId,
        academicYearId,
        subjectMasterIds: selectedSubjectMasterIds,
        sections: sections.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name,
          classTeacherId: s.classTeacherId || null,
          subjectTeachers: s.subjectTeachers.filter((st) => st.staffId),
        })),
        fees: fees.map((f) => ({
          ...(f.id ? { id: f.id } : {}),
          name: f.name,
          amount:
            typeof f.amount === "string" ? parseFloat(f.amount) : f.amount,
        })),
      };

      const result = createClassSchema.safeParse(formFields);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/v1/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();
        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create class", "error");
          return;
        }
        snackbar.show("Class created successfully", "success");
        router.push("/classes");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      // Build subjects array for update
      const subjectsPayload: Array<{ id: string } | { subjectMasterId: string }> = [];
      for (const subj of selectedSubjects) {
        if (subj.existingId) {
          subjectsPayload.push({ id: subj.existingId });
        } else if (subj.masterId) {
          subjectsPayload.push({ subjectMasterId: subj.masterId });
        }
      }

      const formFields = {
        name,
        numericGrade: numericGrade !== "" ? parseInt(numericGrade, 10) : undefined,
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
          amount:
            typeof f.amount === "string" ? parseFloat(f.amount) : f.amount,
        })),
      };

      const result = updateClassSchema.safeParse(formFields);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/v1/classes/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();
        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update class", "error");
          return;
        }
        snackbar.show("Class updated successfully", "success");
        router.push("/classes");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      <Card variant="outlined">
        <CardContent className="p-6">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="divisions">Divisions</TabsTrigger>
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
                  fullWidth
                />
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${isSuperAdmin ? "sm:grid-cols-2" : ""}`}
              >
                {isSuperAdmin && (
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant px-1">
                      Branch *
                    </label>
                    <Select
                      value={branchId}
                      onValueChange={setBranchId}
                      disabled={mode === "edit"}
                    >
                      <SelectTrigger fullWidth>
                        <SelectValue
                          placeholder={
                            branchesLoading ? "Loading..." : "Select branch"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.branchId && (
                      <p className="px-4 text-[12px] leading-4 text-error">
                        {errors.branchId}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Academic Year *
                  </label>
                  <Select
                    value={academicYearId}
                    onValueChange={setAcademicYearId}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger fullWidth>
                      <SelectValue
                        placeholder={
                          academicYearsLoading
                            ? "Loading..."
                            : "Select academic year"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                          {y.isCurrent ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.academicYearId && (
                    <p className="px-4 text-[12px] leading-4 text-error">
                      {errors.academicYearId}
                    </p>
                  )}
                </div>
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
                  fullWidth
                />
              </div>

              <Divider />

              {/* Fee Structure */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-label-lg font-medium text-on-surface">
                    Fee Structure
                  </p>
                  <Button
                    type="button"
                    variant="text"
                    icon="add"
                    onClick={addFee}
                  >
                    Add Fee
                  </Button>
                </div>
                <div className="space-y-3">
                  {fees.map((fee, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <TextField
                          label=""
                          placeholder="Fee name (e.g. Tuition)"
                          value={fee.name}
                          onChange={(e) =>
                            updateFee(index, "name", e.target.value)
                          }
                          error={errors[`fees.${index}.name`]}
                          fullWidth
                        />
                      </div>
                      <div className="w-40">
                        <TextField
                          label=""
                          type="number"
                          placeholder="Amount (Annual)"
                          value={fee.amount.toString()}
                          onChange={(e) =>
                            updateFee(index, "amount", e.target.value)
                          }
                          error={errors[`fees.${index}.amount`]}
                          fullWidth
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFee(index)}
                        className="rounded-full p-2 hover:bg-surface-container-high text-on-surface-variant mt-1"
                      >
                        <Icon name="close" size={20} />
                      </button>
                    </div>
                  ))}
                  {fees.length === 0 && (
                    <p className="text-body-sm text-on-surface-variant">
                      No fees added. Click &ldquo;Add Fee&rdquo; to define the
                      fee structure.
                    </p>
                  )}
                </div>
                {fees.length > 0 && (
                  <div className="mt-4 text-right">
                    <p className="text-label-lg text-on-surface">
                      Total:{" "}
                      <span className="font-semibold">
                        ₹{annualTotal.toLocaleString("en-IN")}
                      </span>
                    </p>
                  </div>
                )}
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
                          onClick={() => removeSection(sectionIndex)}
                          className="rounded-full p-1 hover:bg-surface-container-high text-on-surface-variant"
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
        <Button type="submit" variant="filled" loading={loading} icon="save">
          {mode === "create" ? "Create Class" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
