"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSnackbar } from "@/components/ui/snackbar";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";

interface Branch {
  id: string;
  name: string;
  code: string;
  hasEntranceTest: boolean;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

interface Document {
  id: string;
  documentType: string;
  fileName: string;
  filePath: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  remarks: string | null;
}

interface ExamResult {
  id: string;
  examDate: string;
  marksObtained: number | null;
  maxMarks: number;
  verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
  notes: string | null;
}

interface Application {
  id: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  status: "DRAFT" | "SUBMITTED" | "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED" | "ADMITTED" | "WITHDRAWN";
  class?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
  documents?: Document[] | null;
  examResult?: ExamResult | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  address: string;
  pincode: string;
  verificationNotes: string | null;
}

interface Inquiry {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  status: string;
  createdAt: string;
  classApplied?: { id: string; name: string } | null;
}

export default function AdmissionsPage() {
  const { data: session } = useSession();
  const snackbar = useSnackbar();

  // Scope flags
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";

  // Data states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string>("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // Filter and Layout states
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pipeline" | "inquiries">("pipeline");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list"); // List view is default for simplified real world usability!

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog open states
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Selected item states
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [classSections, setClassSections] = useState<Section[]>([]);

  // Form states
  const [inquiryForm, setInquiryForm] = useState({
    studentName: "",
    dateOfBirth: "",
    gender: "MALE",
    classAppliedId: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    source: "WALK_IN",
    notes: "",
  });

  const [appForm, setAppForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "MALE",
    bloodGroup: "",
    address: "",
    pincode: "",
    emergencyContact: "",
    fatherName: "",
    fatherPhone: "",
    fatherEmail: "",
    fatherOccupation: "",
    motherName: "",
    motherPhone: "",
    motherEmail: "",
    motherOccupation: "",
    classId: "",
  });

  const [verifyForm, setVerifyForm] = useState<{
    documents: { id: string; status: "PENDING" | "VERIFIED" | "REJECTED"; remarks: string; documentType: string }[];
    verificationNotes: string;
    nextStatus: "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  }>({
    documents: [],
    verificationNotes: "",
    nextStatus: "TEST_SCHEDULED",
  });

  const [examForm, setExamForm] = useState({
    examDate: "",
    maxMarks: 100,
    marksObtained: "",
    verdict: "PENDING" as "PENDING" | "PASS" | "FAIL" | "BORDERLINE",
    notes: "",
    applicationStatus: "TEST_SCHEDULED" as "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED",
  });

  const [promoteForm, setPromoteForm] = useState({
    sectionId: "",
    rollNo: "",
    admissionDate: new Date().toISOString().split("T")[0],
    discountPercent: 0,
    amountPaid: 0,
    paymentMethod: "CASH" as "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI",
    transactionId: "",
  });

  // Drag over state for columns
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // 1. Fetch initial branches and academic years
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [resBranches, resAY] = await Promise.all([
          fetch("/api/v1/branches"),
          fetch("/api/v1/academic-years"),
        ]);
        const dataBranches = await resBranches.json();
        const dataAY = await resAY.json();

        if (dataBranches.success) {
          setBranches(dataBranches.data);
          // Set default active branch
          const defaultBranch =
            dataBranches.data.find((b: Branch) => b.id === session?.user?.branchId) ||
            dataBranches.data[0];
          if (defaultBranch) {
            setBranchFilter(defaultBranch.id);
            setActiveBranch(defaultBranch);
          }
        }
        if (dataAY.success) {
          setAcademicYears(dataAY.data);
          const currentAY = dataAY.data.find((ay: any) => ay.isCurrent) || dataAY.data[0];
          if (currentAY) {
            setActiveAcademicYearId(currentAY.id);
          }
        }
      } catch (err) {
        console.error(err);
        snackbar.show("Failed to load initial configuration.", "error");
      }
    }
    if (session) {
      loadInitialData();
    }
  }, [session]);

  // 2. Fetch classes whenever branch changes
  useEffect(() => {
    if (!branchFilter) return;
    async function loadClasses() {
      try {
        const res = await fetch(`/api/v1/classes?branchId=${branchFilter}`);
        const data = await res.json();
        if (data.success) {
          setClasses(data.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadClasses();
    // Update active branch config
    const match = branches.find((b) => b.id === branchFilter);
    if (match) {
      setActiveBranch(match);
    }
  }, [branchFilter, branches]);

  // 3. Fetch applications and inquiries (flicker-free baseline query)
  const fetchDashboardData = useCallback(async () => {
    if (!branchFilter) return;
    setLoading(true);
    try {
      // Fetch full set for the branch, then filter locally for instant keystroke reactions
      const appUrl = `/api/v1/admissions/applications?branchId=${branchFilter}&limit=1000`;
      const inqUrl = `/api/v1/admissions/inquiries?branchId=${branchFilter}&limit=1000`;

      const [resApps, resInqs] = await Promise.all([fetch(appUrl), fetch(inqUrl)]);
      const dataApps = await resApps.json();
      const dataInqs = await resInqs.json();

      if (dataApps.success) {
        setApplications(dataApps.data);
      }
      if (dataInqs.success) {
        setInquiries(dataInqs.data);
      }
    } catch (err) {
      console.error(err);
      snackbar.show("Error loading admissions data.", "error");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, snackbar]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Client-side instant filter to resolve the "auto-loading infinite loop/keystroke spinner" issue
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Grade filter
      if (classFilter !== "ALL" && app.class?.id !== classFilter) return false;
      // Search text query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (app.firstName || "").toLowerCase().includes(q) ||
        (app.lastName || "").toLowerCase().includes(q) ||
        (app.applicationNo || "").toLowerCase().includes(q) ||
        (app.fatherName || "").toLowerCase().includes(q) ||
        (app.motherName || "").toLowerCase().includes(q)
      );
    });
  }, [applications, classFilter, searchQuery]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (inq.studentName || "").toLowerCase().includes(q) ||
        (inq.parentName || "").toLowerCase().includes(q) ||
        (inq.parentPhone || "").toLowerCase().includes(q) ||
        (inq.parentEmail || "").toLowerCase().includes(q)
      );
    });
  }, [inquiries, searchQuery]);

  // Direct status transition handler (Simple click selector fallback for simplified UI)
  const handleDirectStatusChange = async (app: Application, targetStatus: string) => {
    if (targetStatus === "DOCUMENT_VERIFICATION") {
      openVerifyModal(app);
    } else if (targetStatus === "TEST_SCHEDULED") {
      if (!activeBranch?.hasEntranceTest) {
        snackbar.show("This branch does not support entrance tests.", "warning");
        return;
      }
      openExamModal(app);
    } else if (targetStatus === "ADMITTED") {
      openPromoteModal(app);
    } else {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/v1/admissions/applications/${app.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationStatus: targetStatus }),
        });
        const data = await res.json();
        if (data.success) {
          snackbar.show(`Candidate moved to ${targetStatus}`, "success");
          fetchDashboardData();
        } else {
          snackbar.show(data.error?.message || "Failed to update status.", "error");
        }
      } catch {
        snackbar.show("Network error.", "error");
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, app: Application) => {
    e.dataTransfer.setData("applicationId", app.id);
    e.dataTransfer.setData("sourceStatus", app.status);
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(targetStatus);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const appId = e.dataTransfer.getData("applicationId");
    const sourceStatus = e.dataTransfer.getData("sourceStatus");

    if (!appId || sourceStatus === targetStatus) return;

    const matchedApp = applications.find((app) => app.id === appId);
    if (!matchedApp) return;

    handleDirectStatusChange(matchedApp, targetStatus);
  };

  // Open modals with initialized states
  const openVerifyModal = (app: Application) => {
    setSelectedApp(app);
    const docs = app.documents || [];
    setVerifyForm({
      documents: docs.map((d) => ({
        id: d.id,
        status: d.status,
        remarks: d.remarks || "",
        documentType: d.documentType,
      })),
      verificationNotes: app.verificationNotes || "",
      nextStatus: activeBranch?.hasEntranceTest ? "TEST_SCHEDULED" : "SHORTLISTED",
    });
    setVerifyModalOpen(true);
  };

  const openExamModal = (app: Application) => {
    setSelectedApp(app);
    setExamForm({
      examDate: app.examResult?.examDate
        ? new Date(app.examResult.examDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      maxMarks: app.examResult?.maxMarks ? Number(app.examResult.maxMarks) : 100,
      marksObtained: app.examResult?.marksObtained ? String(app.examResult.marksObtained) : "",
      verdict: app.examResult?.verdict || "PENDING",
      notes: app.examResult?.notes || "",
      applicationStatus: "SHORTLISTED",
    });
    setExamModalOpen(true);
  };

  const openPromoteModal = async (app: Application) => {
    setSelectedApp(app);
    setPromoteForm({
      sectionId: "",
      rollNo: "",
      admissionDate: new Date().toISOString().split("T")[0],
      discountPercent: 0,
      amountPaid: 0,
      paymentMethod: "CASH",
      transactionId: "",
    });
    setPromoteModalOpen(true);

    // Fetch class sections
    try {
      const res = await fetch(`/api/v1/classes/${app.class?.id}/sections`);
      const data = await res.json();
      if (data.success) {
        setClassSections(data.data);
        if (data.data.length > 0) {
          setPromoteForm((prev) => ({ ...prev, sectionId: data.data[0].id }));
        }
      }
    } catch {
      snackbar.show("Failed to load sections for promotion.", "error");
    }
  };

  // Submissions
  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFilter || !activeAcademicYearId) {
      snackbar.show("Branch and Academic Year must be active.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/admissions/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inquiryForm,
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Inquiry registered successfully.", "success");
        setInquiryModalOpen(false);
        setInquiryForm({
          studentName: "",
          dateOfBirth: "",
          gender: "MALE",
          classAppliedId: "",
          parentName: "",
          parentPhone: "",
          parentEmail: "",
          source: "WALK_IN",
          notes: "",
        });
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to submit inquiry.", "error");
      }
    } catch {
      snackbar.show("Network error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFilter || !activeAcademicYearId) {
      snackbar.show("Branch and Academic Year must be active.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/admissions/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...appForm,
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Application created successfully.", "success");
        setApplicationModalOpen(false);
        setAppForm({
          firstName: "",
          lastName: "",
          dateOfBirth: "",
          gender: "MALE",
          bloodGroup: "",
          address: "",
          pincode: "",
          emergencyContact: "",
          fatherName: "",
          fatherPhone: "",
          fatherEmail: "",
          fatherOccupation: "",
          motherName: "",
          motherPhone: "",
          motherEmail: "",
          motherOccupation: "",
          classId: "",
        });
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to submit application.", "error");
      }
    } catch {
      snackbar.show("Network error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: verifyForm.documents,
          verificationNotes: verifyForm.verificationNotes,
          applicationStatus: verifyForm.nextStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Document status updated.", "success");
        setVerifyModalOpen(false);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to save verification.", "error");
      }
    } catch {
      snackbar.show("Network error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const payload = {
        examDate: examForm.examDate,
        maxMarks: Number(examForm.maxMarks),
        marksObtained: examForm.marksObtained ? Number(examForm.marksObtained) : undefined,
        verdict: examForm.verdict,
        notes: examForm.notes,
        applicationStatus: examForm.verdict === "PASS" ? "SHORTLISTED" : examForm.applicationStatus,
      };
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/schedule-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Exam results logged.", "success");
        setExamModalOpen(false);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to save exam results.", "error");
      }
    } catch {
      snackbar.show("Network error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const payload = {
        sectionId: promoteForm.sectionId,
        rollNo: promoteForm.rollNo || undefined,
        admissionDate: promoteForm.admissionDate,
        discountPercent: Number(promoteForm.discountPercent) || undefined,
        amountPaid: Number(promoteForm.amountPaid) || undefined,
        paymentMethod: promoteForm.paymentMethod,
        transactionId: promoteForm.transactionId || undefined,
      };
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Candidate promoted to student successfully!", "success");
        setPromoteModalOpen(false);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to promote candidate.", "error");
      }
    } catch {
      snackbar.show("Network error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Status mapping descriptors for labels
  const statusLabels: Record<string, string> = {
    SUBMITTED: "Submitted",
    DOCUMENT_VERIFICATION: "Doc Verification",
    TEST_SCHEDULED: "Entrance Test",
    SHORTLISTED: "Shortlisted",
    ADMITTED: "Admitted",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  };

  // Columns layout configurations
  const pipelineColumns = [
    { key: "SUBMITTED", name: "Submitted", icon: "upload", color: "border-t-sky-500 text-sky-700 bg-sky-50/50" },
    { key: "DOCUMENT_VERIFICATION", name: "Doc Verification", icon: "check_circle", color: "border-t-amber-500 text-amber-700 bg-amber-50/50" },
    ...(activeBranch?.hasEntranceTest
      ? [{ key: "TEST_SCHEDULED", name: "Entrance Test", icon: "event", color: "border-t-purple-500 text-purple-700 bg-purple-50/50" }]
      : []),
    { key: "SHORTLISTED", name: "Shortlisted", icon: "star", color: "border-t-teal-500 text-teal-700 bg-teal-50/50" },
    { key: "ADMITTED", name: "Admitted", icon: "school", color: "border-t-emerald-500 text-emerald-700 bg-emerald-50/50" },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 overflow-hidden">
      {/* 1. Header Section */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 shrink-0">
        <div>
          <Breadcrumb>
            <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
            <BreadcrumbItem>Admissions</BreadcrumbItem>
          </Breadcrumb>
          <h1 className="text-headline-md font-semibold text-on-surface">
            Admission & Enrollment Control Center
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Manage inquiries, applicant document verification, entrance exams, and student promotions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            className={activeTab === "pipeline" ? "bg-primary text-white" : ""}
            variant={activeTab === "pipeline" ? "filled" : "outlined"}
            icon="app_registration"
            onClick={() => setActiveTab("pipeline")}
          >
            Admissions Pipeline
          </Button>
          <Button
            className={activeTab === "inquiries" ? "bg-primary text-white" : ""}
            variant={activeTab === "inquiries" ? "filled" : "outlined"}
            icon="group"
            onClick={() => setActiveTab("inquiries")}
          >
            Counselor Inquiries
          </Button>
        </div>
      </div>

      {/* 2. Filters & Actions Panel */}
      <div className="flex flex-col space-y-4 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-elevation-1 shrink-0 md:flex-row md:items-center md:space-y-0 md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Branch filter (locked for branch admins) */}
          <div className="w-52 shrink-0">
            <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Branch Scope</label>
            <Select value={branchFilter} onValueChange={setBranchFilter} disabled={!isSuperAdmin}>
              <SelectTrigger fullWidth>
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class filter (only in pipeline view) */}
          {activeTab === "pipeline" && (
            <div className="w-48 shrink-0">
              <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Grade / Class</label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Grades</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search bar */}
          <div className="flex-1 min-w-[240px] pt-5">
            <SearchBar
              placeholder="Search candidate name, app number, or parent details..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
        </div>

        {/* View Mode Toggle & Actions */}
        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          {activeTab === "pipeline" && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                  viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name="filter_list" size={14} />
                List View
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                  viewMode === "kanban" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name="dashboard" size={14} />
                Kanban
              </button>
            </div>
          )}

          <Button
            variant="tonal"
            icon="group_add"
            onClick={() => {
              if (classes.length === 0) {
                snackbar.show("Please create classes for this branch first.", "warning");
                return;
              }
              setInquiryForm((prev) => ({ ...prev, classAppliedId: classes[0].id }));
              setInquiryModalOpen(true);
            }}
          >
            New Inquiry
          </Button>
          <Button
            variant="filled"
            icon="add"
            className="bg-primary text-white"
            onClick={() => {
              if (classes.length === 0) {
                snackbar.show("Please create classes for this branch first.", "warning");
                return;
              }
              setAppForm((prev) => ({ ...prev, classId: classes[0].id }));
              setApplicationModalOpen(true);
            }}
          >
            New Application
          </Button>
        </div>
      </div>

      {/* Helper User Guide banner for clarity */}
      <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-3 shrink-0">
        <Icon name="sparkles" className="text-primary shrink-0" size={20} />
        <p className="text-xs text-on-surface-variant">
          <span className="font-bold text-primary">माहिती मार्गदर्शक:</span> नवीन प्रवेश प्रक्रियेत उमेदवाराला पुढे नेण्यासाठी तुम्ही **List View** मध्ये थेट कृती बटणे वापरू शकता किंवा **Kanban View** मध्ये ड्रॅग-अँड-ड्रॉप करू शकता. कागदपत्रे तपासल्यानंतर प्रवेश परीक्षा आणि शेवटी **Promote to Student** करून विद्यार्थ्याचे अधिकृत खाते तयार होते.
        </p>
      </div>

      {/* 3. Main Content Views */}
      <div className="flex-1 overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full space-x-2">
            <Icon name="history" size={24} className="animate-spin text-primary" />
            <span className="text-body-lg text-on-surface-variant font-medium">Loading records...</span>
          </div>
        ) : activeTab === "pipeline" ? (
          viewMode === "kanban" ? (
            /* 3A. Kanban Board View */
            <div className="grid grid-cols-1 md:grid-flow-col auto-cols-fr gap-4 h-full overflow-x-auto pb-4 items-stretch">
              {pipelineColumns.map((col) => {
                const colApps = filteredApplications.filter((app) => {
                  if (app.status === "TEST_SCHEDULED" && !activeBranch?.hasEntranceTest) {
                    return col.key === "SHORTLISTED";
                  }
                  return app.status === col.key;
                });

                const isTargeting = dragOverColumn === col.key;

                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                    className={`flex flex-col rounded-2xl border transition-all duration-300 min-w-[290px] h-full ${
                      isTargeting
                        ? "border-primary border-dashed bg-primary-container/20 scale-[1.01]"
                        : "border-outline-variant/60 bg-surface-container-low"
                    }`}
                  >
                    {/* Column Header */}
                    <div className={`p-4 rounded-t-2xl border-t-4 flex items-center justify-between font-semibold ${col.color} shrink-0`}>
                      <div className="flex items-center gap-2">
                        <Icon name={col.icon} size={18} />
                        <span>{col.name}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-label-sm bg-white border border-outline-variant/40 shadow-sm">
                        {colApps.length}
                      </span>
                    </div>

                    {/* Column Body Cards list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                      {colApps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant/40">
                          <Icon name="inbox" size={24} className="mb-1" />
                          <span className="text-label-md">No candidates</span>
                        </div>
                      ) : (
                        colApps.map((app) => {
                          const docs = app.documents || [];
                          const verifiedDocsCount = docs.filter((d) => d.status === "VERIFIED").length;
                          const totalDocs = docs.length;

                          return (
                            <div
                              key={app.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, app)}
                              onClick={() => {
                                setSelectedApp(app);
                                setDetailsModalOpen(true);
                              }}
                              className="p-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50 hover:shadow-elevation-2 transition-all duration-300 cursor-grab active:cursor-grabbing group relative space-y-2.5"
                            >
                              {/* Card Header info */}
                              <div className="flex justify-between items-start">
                                <span className="text-label-sm font-semibold tracking-wider text-primary">
                                  {app.applicationNo}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container text-on-primary-container">
                                  {app.class?.name || "N/A"}
                                </span>
                              </div>

                              {/* Candidate Name */}
                              <div>
                                <h4 className="text-body-md font-bold text-on-surface group-hover:text-primary transition-colors">
                                  {app.firstName} {app.lastName}
                                </h4>
                              </div>

                              <div className="space-y-1.5 text-body-sm text-on-surface-variant">
                                {app.fatherName && (
                                  <div className="flex items-center gap-1.5">
                                    <Icon name="person" size={14} className="text-slate-400" />
                                    <span>{app.fatherName}</span>
                                  </div>
                                )}
                                {(app.fatherPhone || app.motherPhone) && (
                                  <div className="flex items-center gap-1.5">
                                    <Icon name="phone" size={14} className="text-slate-400" />
                                    <span>{app.fatherPhone || app.motherPhone}</span>
                                  </div>
                                )}

                                {/* Docs count status */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <span className="text-[11px] font-medium flex items-center gap-1">
                                    <Icon
                                      name={verifiedDocsCount === totalDocs && totalDocs > 0 ? "verified" : "upload"}
                                      size={12}
                                      className={verifiedDocsCount === totalDocs && totalDocs > 0 ? "text-emerald-500" : "text-amber-500"}
                                    />
                                    {totalDocs > 0 ? `${verifiedDocsCount}/${totalDocs} Verified` : "No Docs"}
                                  </span>

                                  {app.examResult && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        app.examResult.verdict === "PASS"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : app.examResult.verdict === "FAIL"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-purple-100 text-purple-800"
                                      }`}
                                    >
                                      Test: {app.examResult.marksObtained !== null ? `${app.examResult.marksObtained}/${app.examResult.maxMarks}` : "Scheduled"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Simple Status Changer Selector (Dropdown Fallback for Simple Operating) */}
                              <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 gap-2">
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">Move To:</span>
                                <select
                                  value={app.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleDirectStatusChange(app, e.target.value);
                                  }}
                                  className="text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none cursor-pointer w-full max-w-[140px]"
                                >
                                  <option value="SUBMITTED">Submitted</option>
                                  <option value="DOCUMENT_VERIFICATION">Verification</option>
                                  {activeBranch?.hasEntranceTest && <option value="TEST_SCHEDULED">Entrance Test</option>}
                                  <option value="SHORTLISTED">Shortlisted</option>
                                  <option value="ADMITTED">Admitted</option>
                                  <option value="REJECTED">Reject</option>
                                </select>
                              </div>

                              {/* Quick contextual action buttons */}
                              <div className="flex justify-end gap-1.5 border-t border-slate-100 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {app.status === "SUBMITTED" && (
                                  <Button
                                    variant="text"
                                    size="sm"
                                    className="text-primary text-[11px] h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openVerifyModal(app);
                                    }}
                                  >
                                    Verify Documents
                                  </Button>
                                )}
                                {app.status === "DOCUMENT_VERIFICATION" && (
                                  <Button
                                    variant="text"
                                    size="sm"
                                    className="text-primary text-[11px] h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openVerifyModal(app);
                                    }}
                                  >
                                    Verify Docs
                                  </Button>
                                )}
                                {app.status === "TEST_SCHEDULED" && activeBranch?.hasEntranceTest && (
                                  <Button
                                    variant="text"
                                    size="sm"
                                    className="text-purple-600 text-[11px] h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openExamModal(app);
                                    }}
                                  >
                                    Log Marks
                                  </Button>
                                )}
                                {app.status === "SHORTLISTED" && (
                                  <Button
                                    variant="text"
                                    size="sm"
                                    className="text-emerald-600 text-[11px] h-7 px-2 hover:bg-emerald-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPromoteModal(app);
                                    }}
                                  >
                                    Promote Student
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 3B. Traditional List View Mode (Highly requested for simple real-world operation!) */
            <div className="h-full overflow-y-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-title-lg font-bold text-on-surface">Active Admission Applicants</h3>
                <span className="text-body-sm text-on-surface-variant font-semibold">{filteredApplications.length} applicants listed</span>
              </div>

              {filteredApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/40">
                  <Icon name="people" size={48} className="mb-2" />
                  <p className="text-body-lg">No matching applicants found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-label-md font-bold text-on-surface-variant">
                        <th className="py-3 px-4">Application No</th>
                        <th className="py-3 px-4">Applicant Name</th>
                        <th className="py-3 px-4">Grade</th>
                        <th className="py-3 px-4">Current Stage</th>
                        <th className="py-3 px-4">Documents</th>
                        <th className="py-3 px-4">Test Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplications.map((app) => {
                        const docs = app.documents || [];
                        const verifiedDocsCount = docs.filter((d) => d.status === "VERIFIED").length;
                        const totalDocs = docs.length;

                        return (
                          <tr key={app.id} className="border-b border-outline-variant/40 hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-primary">{app.applicationNo}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-on-surface">{app.firstName} {app.lastName}</div>
                              <div className="text-xs text-slate-400">Parent: {app.fatherName || app.motherName || "—"}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border">
                                {app.class?.name || "N/A"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  app.status === "ADMITTED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : app.status === "SHORTLISTED"
                                    ? "bg-teal-100 text-teal-800"
                                    : app.status === "TEST_SCHEDULED"
                                    ? "bg-purple-100 text-purple-800"
                                    : app.status === "DOCUMENT_VERIFICATION"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {statusLabels[app.status] || app.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                              {totalDocs > 0 ? (
                                <span className={verifiedDocsCount === totalDocs ? "text-emerald-600 font-bold" : ""}>
                                  {verifiedDocsCount}/{totalDocs} Verified
                                </span>
                              ) : (
                                <span className="text-slate-400">No documents</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {app.examResult ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    app.examResult.verdict === "PASS"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : app.examResult.verdict === "FAIL"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {app.examResult.marksObtained !== null ? `${app.examResult.marksObtained}/${app.examResult.maxMarks}` : "Scheduled"}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outlined"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedApp(app);
                                    setDetailsModalOpen(true);
                                  }}
                                >
                                  Details
                                </Button>
                                {app.status === "SUBMITTED" && (
                                  <Button
                                    variant="filled"
                                    className="bg-primary text-white"
                                    size="sm"
                                    onClick={() => openVerifyModal(app)}
                                  >
                                    Verify Docs
                                  </Button>
                                )}
                                {app.status === "DOCUMENT_VERIFICATION" && (
                                  <Button
                                    variant="filled"
                                    className="bg-primary text-white"
                                    size="sm"
                                    onClick={() => openVerifyModal(app)}
                                  >
                                    Verify Docs
                                  </Button>
                                )}
                                {app.status === "TEST_SCHEDULED" && activeBranch?.hasEntranceTest && (
                                  <Button
                                    variant="filled"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    size="sm"
                                    onClick={() => openExamModal(app)}
                                  >
                                    Score Log
                                  </Button>
                                )}
                                {app.status === "SHORTLISTED" && (
                                  <Button
                                    variant="filled"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    size="sm"
                                    onClick={() => openPromoteModal(app)}
                                  >
                                    Admit Student
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        ) : (
          /* Counselor Inquiries Tab View (Simple Table/List) */
          <div className="h-full overflow-y-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-title-lg font-bold text-on-surface">Recent Student Inquiries</h3>
              <span className="text-body-sm text-on-surface-variant font-semibold">{filteredInquiries.length} inquiries log</span>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/40">
                <Icon name="people" size={48} className="mb-2" />
                <p className="text-body-lg">No inquiries logged yet for this branch.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-md font-bold text-on-surface-variant">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Applied Grade</th>
                      <th className="py-3 px-4">Parent Details</th>
                      <th className="py-3 px-4">Logged Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInquiries.map((inq) => (
                      <tr key={inq.id} className="border-b border-outline-variant/40 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-on-surface">{inq.studentName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800 border">
                            {inq.classApplied?.name || "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-body-sm text-on-surface-variant">
                          <div>{inq.parentName}</div>
                          <div className="text-xs">{inq.parentPhone} | {inq.parentEmail}</div>
                        </td>
                        <td className="py-3 px-4 text-body-sm text-on-surface-variant">
                          {new Date(inq.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              inq.status === "APPLIED"
                                ? "bg-emerald-100 text-emerald-800"
                                : inq.status === "VISITED"
                                ? "bg-teal-100 text-teal-800"
                                : inq.status === "CONTACTED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {inq.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {inq.status !== "APPLIED" && (
                            <Button
                              variant="outlined"
                              size="sm"
                              icon="app_registration"
                              onClick={() => {
                                // Prefill application form
                                setAppForm((prev) => ({
                                  ...prev,
                                  firstName: inq.studentName.split(" ")[0] || "",
                                  lastName: inq.studentName.split(" ").slice(1).join(" ") || "",
                                  fatherName: inq.parentName,
                                  fatherPhone: inq.parentPhone,
                                  fatherEmail: inq.parentEmail,
                                  classId: inq.classApplied?.id || "",
                                }));
                                setApplicationModalOpen(true);
                              }}
                            >
                              Fill Application
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── DIALOGS / DRAWER COMPONENTS ──────────────────────────────── */}

      {/* 1. Inquiry Modal */}
      <Dialog open={inquiryModalOpen} onOpenChange={setInquiryModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Register New Inquiry</DialogTitle>
          <DialogDescription>Log initial candidate counseling or walk-in records.</DialogDescription>

          <form onSubmit={handleCreateInquiry} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Student Full Name"
                value={inquiryForm.studentName}
                onChange={(e) => setInquiryForm({ ...inquiryForm, studentName: e.target.value })}
                required
              />
              <TextField
                label="Date of Birth"
                type="date"
                value={inquiryForm.dateOfBirth}
                onChange={(e) => setInquiryForm({ ...inquiryForm, dateOfBirth: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Gender</label>
                <Select value={inquiryForm.gender} onValueChange={(val) => setInquiryForm({ ...inquiryForm, gender: val })}>
                  <SelectTrigger fullWidth>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Applied Class</label>
                <Select
                  value={inquiryForm.classAppliedId}
                  onValueChange={(val) => setInquiryForm({ ...inquiryForm, classAppliedId: val })}
                >
                  <SelectTrigger fullWidth>
                    <SelectValue placeholder="Select Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TextField
              label="Parent / Guardian Name"
              value={inquiryForm.parentName}
              onChange={(e) => setInquiryForm({ ...inquiryForm, parentName: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Parent Phone"
                value={inquiryForm.parentPhone}
                onChange={(e) => setInquiryForm({ ...inquiryForm, parentPhone: e.target.value })}
                required
              />
              <TextField
                label="Parent Email"
                type="email"
                value={inquiryForm.parentEmail}
                onChange={(e) => setInquiryForm({ ...inquiryForm, parentEmail: e.target.value })}
                required
              />
            </div>

            <TextField
              label="Counselor Notes"
              value={inquiryForm.notes}
              onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled">
                Save Inquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Application Modal */}
      <Dialog open={applicationModalOpen} onOpenChange={setApplicationModalOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <DialogTitle>New Admission Application</DialogTitle>
          <DialogDescription>Submit complete student application form inputs.</DialogDescription>

          <form onSubmit={handleCreateApplication} className="mt-4 space-y-5">
            <h4 className="font-bold border-b pb-1 text-primary text-body-md">1. Academic & Grade</h4>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Target Grade</label>
              <Select value={appForm.classId} onValueChange={(val) => setAppForm({ ...appForm, classId: val })}>
                <SelectTrigger fullWidth>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <h4 className="font-bold border-b pb-1 text-primary text-body-md">2. Applicant Personal Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="First Name"
                value={appForm.firstName}
                onChange={(e) => setAppForm({ ...appForm, firstName: e.target.value })}
                required
              />
              <TextField
                label="Last Name"
                value={appForm.lastName}
                onChange={(e) => setAppForm({ ...appForm, lastName: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <TextField
                label="Date of Birth"
                type="date"
                value={appForm.dateOfBirth}
                onChange={(e) => setAppForm({ ...appForm, dateOfBirth: e.target.value })}
                required
              />
              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Gender</label>
                <Select value={appForm.gender} onValueChange={(val) => setAppForm({ ...appForm, gender: val })}>
                  <SelectTrigger fullWidth>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TextField
                label="Blood Group"
                value={appForm.bloodGroup}
                onChange={(e) => setAppForm({ ...appForm, bloodGroup: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <TextField
                  label="Address"
                  value={appForm.address}
                  onChange={(e) => setAppForm({ ...appForm, address: e.target.value })}
                  required
                />
              </div>
              <TextField
                label="Pincode"
                value={appForm.pincode}
                onChange={(e) => setAppForm({ ...appForm, pincode: e.target.value })}
                required
              />
            </div>
            <TextField
              label="Emergency Phone Number"
              value={appForm.emergencyContact}
              onChange={(e) => setAppForm({ ...appForm, emergencyContact: e.target.value })}
              required
            />

            <h4 className="font-bold border-b pb-1 text-primary text-body-md">3. Parents Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Father Name"
                value={appForm.fatherName}
                onChange={(e) => setAppForm({ ...appForm, fatherName: e.target.value })}
              />
              <TextField
                label="Father Phone"
                value={appForm.fatherPhone}
                onChange={(e) => setAppForm({ ...appForm, fatherPhone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Mother Name"
                value={appForm.motherName}
                onChange={(e) => setAppForm({ ...appForm, motherName: e.target.value })}
              />
              <TextField
                label="Mother Phone"
                value={appForm.motherPhone}
                onChange={(e) => setAppForm({ ...appForm, motherPhone: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled">
                Save Application
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Verify Documents Dialog */}
      <Dialog open={verifyModalOpen} onOpenChange={setVerifyModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Document Verification Checklist</DialogTitle>
          <DialogDescription>
            Verify applicant uploads one-by-one. Rejected documents require counselor follow-up.
          </DialogDescription>

          <form onSubmit={handleVerifyDocuments} className="mt-4 space-y-4">
            {verifyForm.documents.length === 0 ? (
              <div className="p-4 bg-slate-50 border rounded-xl flex flex-col items-center">
                <p className="text-body-sm text-slate-500 mb-2">No documents have been uploaded for this candidate.</p>
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => {
                    // Create mock docs locally for clerk to check
                    setVerifyForm((prev) => ({
                      ...prev,
                      documents: [
                        { id: "mock-dob", status: "PENDING", remarks: "", documentType: "Birth Certificate" },
                        { id: "mock-id", status: "PENDING", remarks: "", documentType: "Aadhaar Card" },
                      ],
                    }));
                  }}
                >
                  Generate Verification Checklist
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {verifyForm.documents.map((doc, idx) => (
                  <div key={doc.id} className="p-3 border rounded-xl bg-slate-50 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-body-sm text-slate-700">{doc.documentType}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={doc.status === "VERIFIED" ? "filled" : "outlined"}
                          className={`h-7 px-2.5 text-xs ${doc.status === "VERIFIED" ? "bg-emerald-600 text-white" : ""}`}
                          onClick={() => {
                            const clone = [...verifyForm.documents];
                            clone[idx].status = "VERIFIED";
                            setVerifyForm({ ...verifyForm, documents: clone });
                          }}
                        >
                          Verify
                        </Button>
                        <Button
                          type="button"
                          variant={doc.status === "REJECTED" ? "filled" : "outlined"}
                          className={`h-7 px-2.5 text-xs ${doc.status === "REJECTED" ? "bg-red-600 text-white" : ""}`}
                          onClick={() => {
                            const clone = [...verifyForm.documents];
                            clone[idx].status = "REJECTED";
                            setVerifyForm({ ...verifyForm, documents: clone });
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                    <TextField
                      label="Document Remarks"
                      value={doc.remarks}
                      onChange={(e) => {
                        const clone = [...verifyForm.documents];
                        clone[idx].remarks = e.target.value;
                        setVerifyForm({ ...verifyForm, documents: clone });
                      }}
                      placeholder="e.g. Valid expiration date or blur remarks"
                      className="h-10 mt-1"
                    />
                  </div>
                ))}
              </div>
            )}

            <TextField
              label="Verification Summary Notes"
              value={verifyForm.verificationNotes}
              onChange={(e) => setVerifyForm({ ...verifyForm, verificationNotes: e.target.value })}
            />

            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Next Stage status</label>
              <Select
                value={verifyForm.nextStatus}
                onValueChange={(val: any) => setVerifyForm({ ...verifyForm, nextStatus: val })}
              >
                <SelectTrigger fullWidth>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeBranch?.hasEntranceTest && (
                    <SelectItem value="TEST_SCHEDULED">Entrance Examination Scheduled</SelectItem>
                  )}
                  <SelectItem value="SHORTLISTED">Direct Shortlist</SelectItem>
                  <SelectItem value="DOCUMENT_VERIFICATION">Keep In Document Verification</SelectItem>
                  <SelectItem value="REJECTED">Reject Application</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled">
                Save Verification
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Entrance Test Scheduling & Marks entry */}
      <Dialog open={examModalOpen} onOpenChange={setExamModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Entrance Exam Marks Log</DialogTitle>
          <DialogDescription>Schedule candidate exams and enter obtained scores.</DialogDescription>

          <form onSubmit={handleSaveExam} className="mt-4 space-y-4">
            <TextField
              label="Exam Date"
              type="date"
              value={examForm.examDate}
              onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Maximum Marks"
                type="number"
                value={String(examForm.maxMarks)}
                onChange={(e) => setExamForm({ ...examForm, maxMarks: Number(e.target.value) })}
                required
              />
              <TextField
                label="Marks Obtained"
                type="number"
                value={examForm.marksObtained}
                onChange={(e) => setExamForm({ ...examForm, marksObtained: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Verdict</label>
                <Select
                  value={examForm.verdict}
                  onValueChange={(val: any) => setExamForm((prev) => ({ ...prev, verdict: val }))}
                >
                  <SelectTrigger fullWidth>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending (Scheduled)</SelectItem>
                    <SelectItem value="PASS">Pass (Eligible)</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                    <SelectItem value="BORDERLINE">Borderline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Pipeline Status</label>
                <Select
                  value={examForm.applicationStatus}
                  onValueChange={(val: any) => setExamForm({ ...examForm, applicationStatus: val })}
                >
                  <SelectTrigger fullWidth>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEST_SCHEDULED">Keep In Testing stage</SelectItem>
                    <SelectItem value="SHORTLISTED">Shortlist (Pass & Move Forward)</SelectItem>
                    <SelectItem value="REJECTED">Reject Application</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TextField
              label="Entrance Exam Notes"
              value={examForm.notes}
              onChange={(e) => setExamForm({ ...examForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled">
                Save Exam Result
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Promote Candidate Dialog */}
      <Dialog open={promoteModalOpen} onOpenChange={setPromoteModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Promote Candidate to Student</DialogTitle>
          <DialogDescription>
            This executes a transaction provisioning a student, user, and invoice.
          </DialogDescription>

          <form onSubmit={handlePromote} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Assigned Section</label>
                <Select
                  value={promoteForm.sectionId}
                  onValueChange={(val) => setPromoteForm({ ...promoteForm, sectionId: val })}
                >
                  <SelectTrigger fullWidth>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSections.map((sec) => (
                      <SelectItem key={sec.id} value={sec.id}>
                        {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TextField
                label="Roll Number (Optional)"
                value={promoteForm.rollNo}
                onChange={(e) => setPromoteForm({ ...promoteForm, rollNo: e.target.value })}
              />
            </div>

            <TextField
              label="Admission Date"
              type="date"
              value={promoteForm.admissionDate}
              onChange={(e) => setPromoteForm({ ...promoteForm, admissionDate: e.target.value })}
              required
            />

            <h4 className="font-bold border-b pb-1 text-primary text-body-sm pt-2">Initial Fees Invoice & Collection</h4>

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Discount Percent (%)"
                type="number"
                value={String(promoteForm.discountPercent)}
                onChange={(e) => setPromoteForm({ ...promoteForm, discountPercent: Number(e.target.value) })}
              />
              <TextField
                label="Amount Paid Now (₹)"
                type="number"
                value={String(promoteForm.amountPaid)}
                onChange={(e) => setPromoteForm({ ...promoteForm, amountPaid: Number(e.target.value) })}
              />
            </div>

            {promoteForm.amountPaid > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Payment Mode</label>
                  <Select
                    value={promoteForm.paymentMethod}
                    onValueChange={(val: any) => setPromoteForm({ ...promoteForm, paymentMethod: val })}
                  >
                    <SelectTrigger fullWidth>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="ONLINE">Online Netbanking</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  label="Transaction ID / Receipt No"
                  value={promoteForm.transactionId}
                  onChange={(e) => setPromoteForm({ ...promoteForm, transactionId: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Admit Student
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Candidate Detail Overview Dialog */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          {selectedApp && (
            <>
              <DialogTitle>Candidate Detail Overview</DialogTitle>
              <DialogDescription>Pipeline Application Summary for counseling audits.</DialogDescription>

              <div className="mt-4 space-y-6">
                {/* Profile card summary */}
                <div className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="text-headline-sm font-semibold text-on-surface">
                      {selectedApp.firstName} {selectedApp.lastName}
                    </h3>
                    <p className="text-body-sm text-slate-500 font-medium">
                      App Number: {selectedApp.applicationNo} | Class: {selectedApp.class?.name || "N/A"}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-white">
                    {selectedApp.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Personal */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-body-md text-primary border-b pb-1">Personal Details</h4>
                    <div className="text-body-sm space-y-1">
                      <p><span className="font-medium text-slate-500">Gender:</span> {selectedApp.gender}</p>
                      <p><span className="font-medium text-slate-500">Date of Birth:</span> {new Date(selectedApp.dateOfBirth).toLocaleDateString("en-IN")}</p>
                      <p><span className="font-medium text-slate-500">Pincode:</span> {selectedApp.pincode}</p>
                      <p><span className="font-medium text-slate-500">Address:</span> {selectedApp.address}</p>
                    </div>
                  </div>

                  {/* Parents */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-body-md text-primary border-b pb-1">Parent Details</h4>
                    <div className="text-body-sm space-y-1">
                      <p><span className="font-medium text-slate-500">Father Name:</span> {selectedApp.fatherName || "—"}</p>
                      <p><span className="font-medium text-slate-500">Father Phone:</span> {selectedApp.fatherPhone || "—"}</p>
                      <p><span className="font-medium text-slate-500">Mother Name:</span> {selectedApp.motherName || "—"}</p>
                      <p><span className="font-medium text-slate-500">Mother Phone:</span> {selectedApp.motherPhone || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Docs Checklist list */}
                <div className="space-y-2">
                  <h4 className="font-bold text-body-md text-primary border-b pb-1">Uploaded Document Verification</h4>
                  {(!selectedApp.documents || selectedApp.documents.length === 0) ? (
                    <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <p className="text-body-sm text-slate-400 italic">No checklist documents available.</p>
                      <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        onClick={() => {
                          setSelectedApp((prev) => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              documents: [
                                { id: "mock-dob", status: "PENDING", remarks: "", documentType: "Birth Certificate", fileName: "birth.pdf", filePath: "/uploads/birth.pdf" },
                                { id: "mock-id", status: "PENDING", remarks: "", documentType: "Aadhaar Card", fileName: "aadhaar.pdf", filePath: "/uploads/aadhaar.pdf" },
                              ] as Document[],
                            };
                          });
                        }}
                      >
                        Generate Verification Checklist
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedApp.documents.map((doc) => (
                        <div key={doc.id} className="p-3 border rounded-xl bg-white flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-body-sm">{doc.documentType}</span>
                            <span className="text-xs text-slate-400 block">{doc.fileName}</span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                              doc.status === "VERIFIED"
                                ? "bg-emerald-100 text-emerald-800"
                                : doc.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exam logs */}
                {selectedApp.examResult && (
                  <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-body-md text-purple-800">Entrance Test & Interview Logs</h4>
                    <div className="text-body-sm grid grid-cols-3 gap-2">
                      <p><span className="font-medium text-slate-500">Exam Date:</span> {new Date(selectedApp.examResult.examDate).toLocaleDateString("en-IN")}</p>
                      <p><span className="font-medium text-slate-500">Obtained:</span> {selectedApp.examResult.marksObtained !== null ? `${selectedApp.examResult.marksObtained}/${selectedApp.examResult.maxMarks}` : "Not Graded"}</p>
                      <p><span className="font-medium text-slate-500">Verdict:</span> {selectedApp.examResult.verdict}</p>
                    </div>
                    {selectedApp.examResult.notes && (
                      <p className="text-xs text-slate-500 bg-white p-2 rounded border mt-1">
                        <span className="font-semibold text-purple-700">Examiner Notes:</span> {selectedApp.examResult.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions inside Detail panel */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <DialogClose asChild>
                    <Button variant="outlined">Close</Button>
                  </DialogClose>
                  {selectedApp.status === "SUBMITTED" && (
                    <Button
                      variant="filled"
                      icon="check_circle"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        openVerifyModal(selectedApp);
                      }}
                    >
                      Verify Documents
                    </Button>
                  )}
                  {selectedApp.status === "DOCUMENT_VERIFICATION" && (
                    <Button
                      variant="filled"
                      icon="check_circle"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        openVerifyModal(selectedApp);
                      }}
                    >
                      Verify Docs
                    </Button>
                  )}
                  {selectedApp.status === "TEST_SCHEDULED" && activeBranch?.hasEntranceTest && (
                    <Button
                      variant="filled"
                      icon="event"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        openExamModal(selectedApp);
                      }}
                    >
                      Enter Test Marks
                    </Button>
                  )}
                  {selectedApp.status === "SHORTLISTED" && (
                    <Button
                      variant="filled"
                      icon="school"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        openPromoteModal(selectedApp);
                      }}
                    >
                      Promote Candidate
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
