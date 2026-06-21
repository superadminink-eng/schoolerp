"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { useSession } from "next-auth/react";

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface ClassRecord {
  id: string;
  name: string;
}

interface SectionRecord {
  id: string;
  name: string;
}

interface StudentInList {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  rollNo: string | null;
  invoices?: Array<{
    totalAmount: string;
    paidAmount: string;
  }>;
}

export default function BulkPromotionPage() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const branchId = session?.user?.branchId || "";

  // Wizard state
  const [step, setStep] = useState(1);

  // Metadata dropdown options
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [sourceClasses, setSourceClasses] = useState<ClassRecord[]>([]);
  const [targetClasses, setTargetClasses] = useState<ClassRecord[]>([]);
  
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState("");
  const [sourceSections, setSourceSections] = useState<SectionRecord[]>([]);

  const [targetClassId, setTargetClassId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [targetAcademicYearId, setTargetAcademicYearId] = useState("");
  const [targetSections, setTargetSections] = useState<SectionRecord[]>([]);

  const [discountPercent, setDiscountPercent] = useState(0);
  const [termType, setTermType] = useState<string>(""); // Empty string means Inherit Current

  // Students registry state
  const [students, setStudents] = useState<StudentInList[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    promotedCount: number;
    skippedCount: number;
    message: string;
  } | null>(null);

  // Fetch academic years (only on mount)
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const yearsRes = await fetch("/api/v1/academic-years");
        const yearsData = await yearsRes.json();
        if (yearsData.success) {
          setAcademicYears(yearsData.data);
          const current = yearsData.data.find((y: AcademicYear) => y.isCurrent);
          if (current) setSourceAcademicYearId(current.id);
        }
      } catch {
        snackbar.show("Failed to load academic years", "error");
      }
    };
    fetchYears();
  }, []);

  // Fetch source classes when sourceAcademicYearId or branchId changes
  useEffect(() => {
    if (!branchId || !sourceAcademicYearId) {
      setSourceClasses([]);
      return;
    }
    const fetchSourceClasses = async () => {
      try {
        const res = await fetch(`/api/v1/classes?branchId=${branchId}&academicYearId=${sourceAcademicYearId}`);
        const data = await res.json();
        if (data.success) {
          setSourceClasses(data.data);
        }
      } catch {
        snackbar.show("Failed to load source classes", "error");
      }
    };
    fetchSourceClasses();
  }, [branchId, sourceAcademicYearId]);

  // Fetch target classes when targetAcademicYearId or branchId changes
  useEffect(() => {
    if (!branchId || !targetAcademicYearId) {
      setTargetClasses([]);
      return;
    }
    const fetchTargetClasses = async () => {
      try {
        const res = await fetch(`/api/v1/classes?branchId=${branchId}&academicYearId=${targetAcademicYearId}`);
        const data = await res.json();
        if (data.success) {
          setTargetClasses(data.data);
        }
      } catch {
        snackbar.show("Failed to load target classes", "error");
      }
    };
    fetchTargetClasses();
  }, [branchId, targetAcademicYearId]);

  // Fetch source sections
  useEffect(() => {
    if (!sourceClassId) {
      setSourceSections([]);
      setSourceSectionId("");
      return;
    }
    const fetchSections = async () => {
      try {
        const res = await fetch(`/api/v1/classes/${sourceClassId}/sections`);
        const data = await res.json();
        if (data.success) {
          setSourceSections(data.data);
          if (data.data.length > 0) setSourceSectionId(data.data[0].id);
        }
      } catch {
        snackbar.show("Failed to load source sections", "error");
      }
    };
    fetchSections();
  }, [sourceClassId]);

  // Fetch target sections
  useEffect(() => {
    if (!targetClassId) {
      setTargetSections([]);
      setTargetSectionId("");
      return;
    }
    const fetchSections = async () => {
      try {
        const res = await fetch(`/api/v1/classes/${targetClassId}/sections`);
        const data = await res.json();
        if (data.success) {
          setTargetSections(data.data);
          if (data.data.length > 0) setTargetSectionId(data.data[0].id);
        }
      } catch {
        snackbar.show("Failed to load target sections", "error");
      }
    };
    fetchSections();
  }, [targetClassId]);

  // Reset page when source section changes
  useEffect(() => {
    setStudentPage(1);
    setHasLoadedStudents(false);
  }, [sourceSectionId]);

  // Fetch students for Step 3
  const fetchStudentsPage = useCallback(async (pageNum: number, isInitialLoad: boolean) => {
    if (!sourceSectionId || !sourceAcademicYearId) {
      if (isInitialLoad) {
        snackbar.show("Please select source class, section and academic year", "warning");
      }
      return;
    }
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      params.set("sectionId", sourceSectionId);
      params.set("limit", "100");
      params.set("page", String(pageNum));
      const res = await fetch(`/api/v1/students?${params}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.data);
        setStudentTotal(data.meta?.total ?? 0);
        if (isInitialLoad) {
          // Pre-select all students by default on initial load
          setSelectedStudentIds(data.data.map((s: StudentInList) => s.id));
          setHasLoadedStudents(true);
          setStep(3);
        }
      } else {
        snackbar.show(data.error?.message ?? "Failed to load students", "error");
      }
    } catch {
      snackbar.show("Failed to query source students list", "error");
    } finally {
      setLoadingStudents(false);
    }
  }, [sourceSectionId, sourceAcademicYearId, snackbar]);

  const fetchSourceStudents = () => {
    setStudentPage(1);
    fetchStudentsPage(1, true);
  };

  // Re-fetch on page change (after initial load)
  useEffect(() => {
    if (hasLoadedStudents && studentPage > 1) {
      fetchStudentsPage(studentPage, false);
    }
  }, [studentPage, hasLoadedStudents, fetchStudentsPage]);

  const calculateDues = (student: StudentInList) => {
    if (!student.invoices) return 0;
    return student.invoices.reduce((sum, inv) => {
      const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
      return sum + (balance > 0 ? balance : 0);
    }, 0);
  };

  const handlePromoteSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      snackbar.show("Please select at least one student to promote", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/students/promote-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          targetSectionId,
          targetAcademicYearId,
          discountPercent,
          ...(termType ? { termType } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        snackbar.show("Bulk promotion process completed", "success");
        setStep(5);
      } else {
        snackbar.show(data.error?.message ?? "Bulk promotion failed", "error");
      }
    } catch {
      snackbar.show("An error occurred during promotion request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-1 md:p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/students">Students</BreadcrumbItem>
        <BreadcrumbItem>Bulk Promotion Wizard</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-black text-on-surface">Bulk Promotion Wizard</h1>
          <p className="text-body-sm text-on-surface-variant font-medium mt-1">
            Promote students to the next academic year.
          </p>
        </div>
      </div>

      {/* Stepper Indicators */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 md:p-6 flex justify-between items-center gap-2 max-w-[800px] mx-auto shadow-sm">
        {[
          { num: 1, label: "Source Class" },
          { num: 2, label: "Target Class" },
          { num: 3, label: "Select Students" },
          { num: 4, label: "Confirm Billing" },
          { num: 5, label: "Process Done" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-1.5 md:gap-3 flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all ${
              step === s.num
                ? "bg-primary border-primary text-white shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                : step > s.num
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "bg-white border-slate-300 text-slate-400"
            }`}>
              {step > s.num ? <Icon name="done" size={16} /> : s.num}
            </div>
            <span className={`text-[10px] md:text-xs font-bold hidden sm:inline ${step === s.num ? "text-primary font-black" : "text-slate-500"}`}>
              {s.label}
            </span>
            {s.num < 5 && <div className={`h-[2px] flex-1 bg-slate-200 hidden sm:block ${step > s.num ? "bg-emerald-500" : ""}`} />}
          </div>
        ))}
      </div>

      {/* Wizard Content Layout */}
      <div className="max-w-[800px] mx-auto">
        <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-8 rounded-3xl shadow-sm">
          <CardContent className="p-0 space-y-6">

            {/* STEP 1: SELECT SOURCE CLASS */}
            {step === 1 && (
              <div className="space-y-5">
                <h3 className="text-title-md font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                  <Icon name="logout" className="text-slate-400 rotate-180" size={18} />
                  Step 1: Select Source Class
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Academic Year</label>
                    <select
                      value={sourceAcademicYearId}
                      onChange={(e) => setSourceAcademicYearId(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? "(Current)" : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Class</label>
                    <select
                      value={sourceClassId}
                      onChange={(e) => setSourceClassId(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    >
                      <option value="">Select Class</option>
                      {sourceClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Section</label>
                    <select
                      value={sourceSectionId}
                      onChange={(e) => setSourceSectionId(e.target.value)}
                      disabled={sourceSections.length === 0}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white disabled:bg-slate-50 transition-colors"
                    >
                      <option value="">Select Section</option>
                      {sourceSections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="filled"
                    onClick={() => setStep(2)}
                    disabled={!sourceSectionId || !sourceAcademicYearId}
                    icon="arrow_forward"
                    className="bg-primary text-white"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: SELECT TARGET CLASS */}
            {step === 2 && (
              <div className="space-y-5">
                <h3 className="text-title-md font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                  <Icon name="login" className="text-slate-400" size={18} />
                  Step 2: Select Target Destination
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Academic Year</label>
                    <select
                      value={targetAcademicYearId}
                      onChange={(e) => setTargetAcademicYearId(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Class</label>
                    <select
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    >
                      <option value="">Select Class</option>
                      {targetClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Section</label>
                    <select
                      value={targetSectionId}
                      onChange={(e) => setTargetSectionId(e.target.value)}
                      disabled={targetSections.length === 0}
                      className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white disabled:bg-slate-50 transition-colors"
                    >
                      <option value="">Select Section</option>
                      {targetSections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outlined"
                    onClick={() => setStep(1)}
                    icon="arrow_back"
                    className="bg-white text-slate-700 border-slate-200"
                  >
                    Back
                  </Button>
                  <Button
                    variant="filled"
                    onClick={fetchSourceStudents}
                    disabled={!targetSectionId || !targetAcademicYearId}
                    loading={loadingStudents}
                    icon="arrow_forward"
                    className="bg-primary text-white"
                  >
                    Load Students
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: SELECT STUDENTS & DETECT DUES */}
            {step === 3 && (
              <div className="space-y-5">
                <h3 className="text-title-md font-bold text-slate-800 flex items-center justify-between border-b pb-2">
                  <span className="flex items-center gap-2">
                    <Icon name="person_search" className="text-slate-400" size={18} />
                    Step 3: Select Students
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    Total: {students.length}
                  </span>
                </h3>

                {students.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 border border-dashed rounded-2xl text-on-surface-variant text-sm font-medium">
                    No students found in the selected source class for promotion.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Toggle Selector */}
                    <div className="flex justify-between items-center text-xs px-1 font-bold text-primary">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
                        className="hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds([])}
                        className="hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>

                    {/* Students Checklist */}
                    <div className="border border-outline-variant/40 rounded-2xl max-h-[300px] overflow-y-auto divide-y bg-slate-50/20">
                      {students.map((student) => {
                        const dues = calculateDues(student);
                        const isChecked = selectedStudentIds.includes(student.id);

                        return (
                          <div key={student.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 transition-colors">
                            <label className="flex items-center gap-3 select-none cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds([...selectedStudentIds, student.id]);
                                  } else {
                                    setSelectedStudentIds(selectedStudentIds.filter((id) => id !== student.id));
                                  }
                                }}
                                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary focus:ring-offset-0"
                              />
                              <div>
                                <span className="font-bold text-sm text-on-surface">
                                  {student.firstName} {student.lastName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  Reg: {student.admissionNo} {student.rollNo ? `| Roll: ${student.rollNo}` : ""}
                                </span>
                              </div>
                            </label>
                            
                            {/* Outstanding Dues warning badge */}
                            {dues > 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200/50 flex items-center gap-1 shrink-0 animate-pulse">
                                <Icon name="warning" size={12} />
                                Outstanding Dues: ₹{dues.toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Pagination page={studentPage} limit={100} total={studentTotal} onPageChange={setStudentPage} />
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outlined"
                    onClick={() => setStep(2)}
                    icon="arrow_back"
                    className="bg-white text-slate-700 border-slate-200"
                  >
                    Back
                  </Button>
                  <Button
                    variant="filled"
                    onClick={() => setStep(4)}
                    disabled={selectedStudentIds.length === 0}
                    icon="arrow_forward"
                    className="bg-primary text-white"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM BILLING DETAILS */}
            {step === 4 && (
              <div className="space-y-5">
                <h3 className="text-title-md font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                  <Icon name="rate_review" className="text-slate-400" size={18} />
                  Step 4: Review & Billing Setup
                </h3>

                <div className="p-4 bg-slate-50 border border-outline-variant/30 rounded-2xl grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Source Class</span>
                    <strong className="text-slate-800 text-sm">
                      {sourceClasses.find((c) => c.id === sourceClassId)?.name} (Section {sourceSections.find((s) => s.id === sourceSectionId)?.name})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Target Class</span>
                    <strong className="text-slate-800 text-sm">
                      {targetClasses.find((c) => c.id === targetClassId)?.name} (Section {targetSections.find((s) => s.id === targetSectionId)?.name})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Total Promoted Students</span>
                    <strong className="text-primary text-sm font-black">{selectedStudentIds.length}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Academic Session</span>
                    <strong className="text-slate-800 text-sm">
                      {academicYears.find((y) => y.id === targetAcademicYearId)?.name}
                    </strong>
                  </div>
                </div>

                {/* Auto Invoice generation configurations */}
                <div className="space-y-4 pt-2">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-500 pl-0.5 font-sans">Next-Year Billing Configurations</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fee Concession on All Promoted Students (%)</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full h-[40px] rounded-xl border border-outline px-3 pr-8 text-body-md outline-none focus:border-primary bg-white transition-colors font-mono"
                        />
                        <span className="absolute right-3.5 font-bold text-slate-400 text-sm">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal pl-0.5">
                        This concession will be applied to the auto-generated bills of students when they are admitted in the new academic year.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Term Type</label>
                      <select
                        value={termType}
                        onChange={(e) => setTermType(e.target.value)}
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      >
                        <option value="">Inherit Current (Recommended)</option>
                        <option value="FULL_TERM">Full Term</option>
                        <option value="HALF_TERM">Half Term</option>
                        <option value="SHORT_TERM">Short Term</option>
                      </select>
                      <p className="text-[10px] text-slate-400 leading-normal pl-0.5">
                        Choose whether to inherit each student's current term type, or override it to a specific term type for the new academic year.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outlined"
                    onClick={() => setStep(3)}
                    icon="arrow_back"
                    className="bg-white text-slate-700 border-slate-200"
                  >
                    Back
                  </Button>
                  <Button
                    variant="filled"
                    onClick={handlePromoteSubmit}
                    loading={submitting}
                    icon="bolt"
                    className="bg-primary text-white"
                  >
                    Promote Class
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: PROMOTION PROCESS SUCCESS */}
            {step === 5 && results && (
              <div className="space-y-6 text-center max-w-md mx-auto py-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Icon name="done_all" size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-headline-sm font-black text-slate-800">Class Promotion Completed Successfully!</h3>
                  <p className="text-body-sm text-slate-400 font-medium">
                    {results.message}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border text-xs grid grid-cols-2 divide-x">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block uppercase font-bold tracking-wider">Promoted</span>
                    <strong className="text-emerald-600 text-base font-black">{results.promotedCount}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block uppercase font-bold tracking-wider">Skipped / Already Done</span>
                    <strong className="text-slate-500 text-base font-black">{results.skippedCount}</strong>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-4 border-t">
                  <Button
                    variant="outlined"
                    onClick={() => router.push("/students")}
                    icon="school"
                    className="bg-white text-slate-700 border-slate-200"
                  >
                    Go to Directory
                  </Button>
                  <Button
                    variant="filled"
                    onClick={() => {
                      setSelectedStudentIds([]);
                      setStep(1);
                      setResults(null);
                    }}
                    icon="refresh"
                    className="bg-primary text-white"
                  >
                    Promote Another Batch
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

    </div>
  );
}
