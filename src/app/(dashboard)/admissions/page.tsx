"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useSnackbar } from "@/components/ui/snackbar";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Import Redesigned Modular Components
import AdmissionsStats from "@/components/admissions/admissions-stats";
import AdmissionsFilters from "@/components/admissions/admissions-filters";
import AdmissionsList from "@/components/admissions/admissions-list";
import AdmissionsPipeline from "@/components/admissions/admissions-pipeline";
import InquiryModal from "@/components/admissions/inquiry-modal";
import ApplicationModal from "@/components/admissions/application-modal";
import InquiryWorkspace from "@/components/admissions/inquiry-workspace";
import ApplicantWorkspace from "@/components/admissions/applicant-workspace";

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
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  address: string;
  pincode: string;
  verificationNotes: string | null;
  previousSchool?: string | null;
  archiveReason?: string | null;
  statusBeforeArchive?: string | null;
}

interface FollowUp {
  id: string;
  followUpDate: string;
  conversationNotes: string;
  nextFollowUpDate: string | null;
  statusReached: string;
  counselorId: string;
}

interface Inquiry {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  status: string;
  createdAt: string;
  dateOfBirth: string;
  gender: string;
  notes: string | null;
  source: string;
  classApplied?: { id: string; name: string } | null;
  followUps?: FollowUp[];
}

export default function AdmissionsPage() {
  const { data: session } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const snackbar = useSnackbar();

  // Roles & Permissions check
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const hasAppAccess = can("admissions", "document_verification") || can("admissions", "entrance_exam") || can("admissions", "registrar_desk");
  const hasInqAccess = can("admissions", "inquiry_desk");
  const canVerifyDocs = can("admissions", "document_verification");

  // State configurations
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState<string>("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // View Settings: Board/Pipeline vs Classic List
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Filter states
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"applications" | "inquiries">("applications");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  
  // Custom Generator State
  const [billingMode, setBillingMode] = useState<"STANDARD" | "CUSTOM">("STANDARD");
  const [customConfigRows, setCustomConfigRows] = useState(6);
  const [customConfigStartDate, setCustomConfigStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [customConfigInterval, setCustomConfigInterval] = useState<"MONTHLY" | "BIMONTHLY" | "QUARTERLY">("MONTHLY");
  const [customConfigLateFee, setCustomConfigLateFee] = useState(true);

  const hasDemoData = useMemo(() => {
    return applications.some(a => a.previousSchool === 'DEMO_SANDBOX' || ["Rohan", "Aarav", "Isha", "Ananya"].includes(a.firstName)) || 
           inquiries.some(i => i.notes?.startsWith('DEMO_DATA') || i.studentName === 'Aditya Kulkarni');
  }, [applications, inquiries]);
  const [includeArchives, setIncludeArchives] = useState<boolean>(false);
  const [includeAppliedInquiries, setIncludeAppliedInquiries] = useState<boolean>(false);

  // Inquiry Workspace controllers
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [inquiryWorkspaceOpen, setInquiryWorkspaceOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    conversationNotes: "",
    nextFollowUpDate: "",
    statusReached: "INQUIRY",
  });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Dialog & Workspace controllers
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selection configurations
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [classSections, setClassSections] = useState<Section[]>([]);
  const [installmentTemplates, setInstallmentTemplates] = useState<any[]>([]);
  const [customInstallments, setCustomInstallments] = useState<any[]>([]);

  // Stepper Wizards Form States
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
    inquiryId: "",
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
    archiveReason: string;
  }>({
    documents: [],
    verificationNotes: "",
    nextStatus: "TEST_SCHEDULED",
    archiveReason: "",
  });

  const [examForm, setExamForm] = useState({
    examDate: "",
    maxMarks: 100,
    marksObtained: "",
    verdict: "PENDING" as "PENDING" | "PASS" | "FAIL" | "BORDERLINE",
    notes: "",
    applicationStatus: "TEST_SCHEDULED" as "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED",
    archiveReason: "",
  });

  const [promoteForm, setPromoteForm] = useState({
    sectionId: "",
    rollNo: "",
    admissionDate: new Date().toISOString().split("T")[0],
    discountPercent: 0,
    amountPaid: 0,
    paymentMethod: "CASH" as "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI",
    transactionId: "",
    termType: "FULL_TERM" as "FULL_TERM" | "HALF_TERM" | "SHORT_TERM",
  });

  const [classFees, setClassFees] = useState<any[]>([]);
  const [selectedOptionalFees, setSelectedOptionalFees] = useState<{ id: string; amount: number }[]>([]);

  // Persistent Filters State Engine
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedBranch = localStorage.getItem("adm_branchFilter");
      const savedSessionBranch = localStorage.getItem("adm_sessionBranchId");
      const currentSessionBranch = session?.user?.branchId || "";

      if (currentSessionBranch && currentSessionBranch !== savedSessionBranch) {
        setBranchFilter(currentSessionBranch);
        localStorage.setItem("adm_branchFilter", currentSessionBranch);
        localStorage.setItem("adm_sessionBranchId", currentSessionBranch);
      } else if (savedBranch) {
        setBranchFilter(savedBranch);
      } else if (currentSessionBranch) {
        setBranchFilter(currentSessionBranch);
        localStorage.setItem("adm_branchFilter", currentSessionBranch);
        localStorage.setItem("adm_sessionBranchId", currentSessionBranch);
      }

      const savedClass = localStorage.getItem("adm_classFilter");
      if (savedClass) setClassFilter(savedClass);

      const savedSearch = localStorage.getItem("adm_searchQuery");
      if (savedSearch) setSearchQuery(savedSearch);

      const savedTab = localStorage.getItem("adm_activeTab");
      if (savedTab && (savedTab === "applications" || savedTab === "inquiries")) {
        setActiveTab(savedTab as any);
      }

      const savedStage = localStorage.getItem("adm_stageFilter");
      if (savedStage) setStageFilter(savedStage);

      const savedApplied = localStorage.getItem("adm_includeAppliedInquiries");
      if (savedApplied) setIncludeAppliedInquiries(savedApplied === "true");

      const savedView = localStorage.getItem("adm_viewMode");
      if (savedView === "board" || savedView === "list") {
        setViewMode(savedView);
      }

      setIsInitialized(true);
    }
  }, [session?.user?.branchId]);

  useEffect(() => {
    if (isInitialized && branchFilter) {
      localStorage.setItem("adm_branchFilter", branchFilter);
      if (session?.user?.branchId) {
        localStorage.setItem("adm_sessionBranchId", session.user.branchId);
      }
    }
  }, [branchFilter, isInitialized, session?.user?.branchId]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_classFilter", classFilter);
    }
  }, [classFilter, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_searchQuery", searchQuery);
    }
  }, [searchQuery, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_activeTab", activeTab);
    }
  }, [activeTab, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_stageFilter", stageFilter);
    }
  }, [stageFilter, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_includeAppliedInquiries", String(includeAppliedInquiries));
    }
  }, [includeAppliedInquiries, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("adm_viewMode", viewMode);
    }
  }, [viewMode, isInitialized]);

  // Adjust default active tab based on permission access
  useEffect(() => {
    if (!permissionsLoading) {
      if (activeTab === "applications" && !hasAppAccess && hasInqAccess) {
        setActiveTab("inquiries");
      } else if (activeTab === "inquiries" && !hasInqAccess && hasAppAccess) {
        setActiveTab("applications");
      }
    }
  }, [permissionsLoading, hasAppAccess, hasInqAccess, activeTab]);

  // Load templates dynamically when selectedApp or termType changes
  useEffect(() => {
    if (workspaceOpen && selectedApp && selectedApp.class?.id) {
      const fetchTemplates = async () => {
        try {
          const res = await fetch(`/api/v1/fee-installment-templates?classId=${selectedApp.class?.id || ""}&academicYearId=${selectedApp.academicYear?.id || ""}&termType=${promoteForm.termType}`);
          const data = await res.json();
          if (data.success) {
            setInstallmentTemplates(data.data);
            setCustomInstallments(
              data.data.map((t: any) => ({
                id: `template-${t.id}`,
                templateId: t.id,
                name: t.name,
                dueDate: t.dueDate,
                amount: Math.round(Number(t.amount) * (1 - (promoteForm.discountPercent || 0) / 100)),
                checked: true,
                isCustom: false,
              }))
            );
          }
        } catch {
          console.error("Failed to load installment templates.");
        }
      };
      fetchTemplates();
    }
  }, [workspaceOpen, selectedApp?.class?.id, promoteForm.termType]);

  // Load sections and fees dynamically when selectedApp changes
  useEffect(() => {
    if (workspaceOpen && selectedApp && selectedApp.class?.id) {
      const fetchSections = async () => {
        try {
          const res = await fetch(`/api/v1/classes/${selectedApp.class?.id}/sections`);
          const data = await res.json();
          if (data.success && data.data.length > 0) {
            setClassSections(data.data);
            setPromoteForm((prev) => ({ ...prev, sectionId: data.data[0].id }));
          }
        } catch {
          console.error("Failed to load sections.");
        }
      };
      const fetchFees = async () => {
        try {
          const res = await fetch(`/api/v1/classes/${selectedApp.class?.id}/fees`);
          const data = await res.json();
          if (data.success) {
            setClassFees(data.data);
          }
        } catch {
          console.error("Failed to load fees.");
        }
      };
      fetchSections();
      fetchFees();
    }
  }, [workspaceOpen, selectedApp?.class?.id]);

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
          const savedBranch = typeof window !== "undefined" ? localStorage.getItem("adm_branchFilter") : null;
          const currentSessionBranch = session?.user?.branchId;
          const savedSessionBranch = typeof window !== "undefined" ? localStorage.getItem("adm_sessionBranchId") : null;

          let defaultBranchId = "";
          if (currentSessionBranch && currentSessionBranch !== savedSessionBranch) {
            defaultBranchId = currentSessionBranch;
          } else if (savedBranch && dataBranches.data.some((b: any) => b.id === savedBranch)) {
            defaultBranchId = savedBranch;
          } else {
            defaultBranchId = currentSessionBranch || dataBranches.data[0]?.id || "";
          }

          const defaultBranch = dataBranches.data.find((b: any) => b.id === defaultBranchId);
          if (defaultBranch) {
            setBranchFilter(defaultBranch.id);
            setActiveBranch(defaultBranch);
            if (typeof window !== "undefined") {
              localStorage.setItem("adm_branchFilter", defaultBranch.id);
              if (currentSessionBranch) {
                localStorage.setItem("adm_sessionBranchId", currentSessionBranch);
              }
            }
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
        snackbar.show("Failed to load configuration details.", "error");
      }
    }
    if (session) {
      loadInitialData();
    }
  }, [session?.user?.branchId, session !== undefined]);

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
      snackbar.show("Error loading admissions.", "error");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, snackbar]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Toggle Branch exam settings
  const handleToggleEntranceExam = async () => {
    if (!activeBranch) return;
    setActionLoading(true);
    try {
      const nextSetting = !activeBranch.hasEntranceTest;
      const res = await fetch(`/api/v1/branches/${activeBranch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasEntranceTest: nextSetting }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show(`Branch settings updated. Entrance exam: ${nextSetting ? "ENABLED" : "DISABLED"}`, "success");
        setBranches((prev) =>
          prev.map((b) => (b.id === activeBranch.id ? { ...b, hasEntranceTest: nextSetting } : b))
        );
        setActiveBranch((prev) => (prev ? { ...prev, hasEntranceTest: nextSetting } : null));
      } else {
        snackbar.show(data.error?.message || "Failed to update branch settings.", "error");
      }
    } catch {
      snackbar.show("Network error during branch configuration.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Client side filters
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (!includeArchives && (app.status === "ADMITTED" || app.status === "REJECTED" || app.status === "WITHDRAWN")) {
        return false;
      }
      if (classFilter !== "ALL" && app.class?.id !== classFilter) return false;
      if (stageFilter !== "ALL" && app.status !== stageFilter) return false;
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
  }, [applications, classFilter, searchQuery, includeArchives, stageFilter]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      if (!includeAppliedInquiries && inq.status === "APPLIED") {
        return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (inq.studentName || "").toLowerCase().includes(q) ||
        (inq.parentName || "").toLowerCase().includes(q) ||
        (inq.parentPhone || "").toLowerCase().includes(q) ||
        (inq.parentEmail || "").toLowerCase().includes(q)
      );
    });
  }, [inquiries, searchQuery, includeAppliedInquiries]);

  const stats = useMemo(() => {
    const activeApps = applications.filter((a) => a.status !== "ADMITTED" && a.status !== "REJECTED" && a.status !== "WITHDRAWN");
    const activeInquiries = inquiries.filter((i) => i.status !== "APPLIED" && i.status !== "CLOSED");
    return {
      inquiryCount: activeInquiries.length,
      activeCount: activeApps.length,
      submittedCount: activeApps.filter((a) => a.status === "SUBMITTED").length,
      pendingVerify: activeApps.filter((a) => a.status === "DOCUMENT_VERIFICATION").length,
      awaitingExam: activeApps.filter((a) => a.status === "TEST_SCHEDULED").length,
      readyToEnroll: activeApps.filter((a) => a.status === "SHORTLISTED").length,
    };
  }, [applications, inquiries]);

  const isDatabaseEmpty = applications.length === 0 && inquiries.length === 0;

  // Filter actions
  const handleStageClick = (stage: "inquiries" | "SUBMITTED" | "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED") => {
    if (stage === "inquiries") {
      if (activeTab === "inquiries") {
        setActiveTab("applications");
        setStageFilter("ALL");
      } else {
        setActiveTab("inquiries");
        setStageFilter("ALL");
      }
    } else {
      setActiveTab("applications");
      if (stageFilter === stage) {
        setStageFilter("ALL");
      } else {
        setStageFilter(stage);
      }
    }
  };

  const hasActiveFilters = stageFilter !== "ALL" || classFilter !== "ALL" || searchQuery !== "";
  const handleResetFilters = () => {
    setStageFilter("ALL");
    setClassFilter("ALL");
    setSearchQuery("");
  };

  // Demo Pipeline Generator
  const handleGenerateDemoData = async () => {
    if (classes.length === 0) {
      snackbar.show("Please create Classes first, so that dummy data can be generated.", "warning");
      return;
    }
    if (!branchFilter || !activeAcademicYearId) {
      snackbar.show("Branch or Academic Year configuration not found.", "error");
      return;
    }

    setIsGeneratingDemo(true);
    snackbar.show("Generating dummy data pipeline...", "info");

    try {
      const targetClassId = classes[0].id;

      // 1. Create Counselor Inquiry
      await fetch("/api/v1/admissions/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: "Aditya Kulkarni",
          dateOfBirth: "2015-08-12",
          gender: "MALE",
          classAppliedId: targetClassId,
          parentName: "Sanjay Kulkarni",
          parentPhone: "9876543210",
          parentEmail: "sanjay.kulkarni@example.com",
          source: "WALK_IN",
          notes: "DEMO_DATA: Interested in Class 3 admission. Needs school bus facility.",
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
        }),
      });

      // 2. Create Application 1 (Rohan Deshmukh - Submitted)
      await fetch("/api/v1/admissions/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
          classId: targetClassId,
          firstName: "Rohan",
          lastName: "Deshmukh",
          dateOfBirth: "2014-04-20",
          gender: "MALE",
          bloodGroup: "O+",
          address: "402, Shivajinagar, Pune",
          pincode: "411005",
          emergencyContact: "9812345678",
          fatherName: "Anand Deshmukh",
          fatherPhone: "9812345678",
          fatherEmail: "anand.d@example.com",
          fatherOccupation: "Business",
          motherName: "Sunita Deshmukh",
          motherPhone: "9823456789",
          motherEmail: "sunita.d@example.com",
          motherOccupation: "Teacher",
          previousSchool: "DEMO_SANDBOX",
        }),
      });

      // 3. Create Application 2 (Aarav Patel - Document Verification)
      const resApp2 = await fetch("/api/v1/admissions/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
          classId: targetClassId,
          firstName: "Aarav",
          lastName: "Patel",
          dateOfBirth: "2015-01-15",
          gender: "MALE",
          bloodGroup: "A+",
          address: "B-12, Aundh, Pune",
          pincode: "411007",
          emergencyContact: "9833445566",
          fatherName: "Rajesh Patel",
          fatherPhone: "9833445566",
          fatherEmail: "rajesh.patel@example.com",
          fatherOccupation: "Consultant",
          motherName: "Kiran Patel",
          motherPhone: "9844556677",
          motherEmail: "kiran.patel@example.com",
          motherOccupation: "Designer",
          previousSchool: "DEMO_SANDBOX",
        }),
      });
      const app2Data = await resApp2.json();
      if (app2Data.success) {
        await fetch(`/api/v1/admissions/applications/${app2Data.data.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: [
              { id: "mock-dob", status: "PENDING", remarks: "Birth Certificate uploaded", documentType: "Birth Certificate" },
              { id: "mock-id", status: "PENDING", remarks: "Aadhaar Card uploaded", documentType: "Aadhaar Card" },
            ],
            verificationNotes: "Documents uploaded, pending clerk review",
            applicationStatus: "DOCUMENT_VERIFICATION",
          }),
        });
      }

      // 4. Create Application 3 (Isha Joshi - Entrance Test)
      const resApp3 = await fetch("/api/v1/admissions/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
          classId: targetClassId,
          firstName: "Isha",
          lastName: "Joshi",
          dateOfBirth: "2014-11-30",
          gender: "FEMALE",
          bloodGroup: "B+",
          address: "Flat 203, Kothrud, Pune",
          pincode: "411038",
          emergencyContact: "9855667788",
          fatherName: "Milind Joshi",
          fatherPhone: "9855667788",
          fatherEmail: "milind.j@example.com",
          fatherOccupation: "Engineer",
          motherName: "Anjali Joshi",
          motherPhone: "9866778899",
          motherEmail: "anjali.j@example.com",
          motherOccupation: "Manager",
          previousSchool: "DEMO_SANDBOX",
        }),
      });
      const app3Data = await resApp3.json();
      if (app3Data.success) {
        await fetch(`/api/v1/admissions/applications/${app3Data.data.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: [
              { id: "mock-dob", status: "VERIFIED", remarks: "Verified by Clerk", documentType: "Birth Certificate" },
              { id: "mock-id", status: "VERIFIED", remarks: "Verified by Clerk", documentType: "Aadhaar Card" },
            ],
            verificationNotes: "All documents verified successfully. Entrance test scheduled.",
            applicationStatus: "TEST_SCHEDULED",
          }),
        });
      }

      // 5. Create Application 4 (Ananya Shinde - Shortlisted)
      const resApp4 = await fetch("/api/v1/admissions/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branchFilter,
          academicYearId: activeAcademicYearId,
          classId: targetClassId,
          firstName: "Ananya",
          lastName: "Shinde",
          dateOfBirth: "2015-06-05",
          gender: "FEMALE",
          bloodGroup: "AB+",
          address: "501, Baner Road, Pune",
          pincode: "411045",
          emergencyContact: "9877889900",
          fatherName: "Prasad Shinde",
          fatherPhone: "9877889900",
          fatherEmail: "prasad.s@example.com",
          fatherOccupation: "Doctor",
          motherName: "Seema Shinde",
          motherPhone: "9888990011",
          motherEmail: "seema.s@example.com",
          motherOccupation: "Professor",
          previousSchool: "DEMO_SANDBOX",
        }),
      });
      const app4Data = await resApp4.json();
      if (app4Data.success) {
        await fetch(`/api/v1/admissions/applications/${app4Data.data.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: [
              { id: "mock-dob", status: "VERIFIED", remarks: "Verified by Clerk", documentType: "Birth Certificate" },
              { id: "mock-id", status: "VERIFIED", remarks: "Verified by Clerk", documentType: "Aadhaar Card" },
            ],
            verificationNotes: "Documents verified. Ready for exam.",
            applicationStatus: "TEST_SCHEDULED",
          }),
        });
        await fetch(`/api/v1/admissions/applications/${app4Data.data.id}/schedule-test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examDate: new Date().toISOString().split("T")[0],
            maxMarks: 100,
            marksObtained: 88,
            verdict: "PASS",
            notes: "Excellent performance in aptitude and communication. Highly recommended.",
            applicationStatus: "SHORTLISTED",
          }),
        });
      }

      snackbar.show("Dummy pipeline created successfully!", "success");
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      snackbar.show("Error creating dummy data.", "error");
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleClearDemoData = async () => {
    if (!branchFilter) return;
    setIsClearingDemo(true);
    snackbar.show("Clearing admissions sandbox demo data...", "info");
    try {
      const res = await fetch(`/api/v1/admissions/demo-clear?branchId=${branchFilter}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show(data.data.message || "Demo data cleared successfully!", "success");
        await fetchDashboardData();
      } else {
        snackbar.show(data.message || "Failed to clear demo data.", "error");
      }
    } catch (err) {
      console.error("Clear demo error:", err);
      snackbar.show("Network error clearing demo data.", "error");
    } finally {
      setIsClearingDemo(false);
    }
  };

  // Inquiry Workspace Panel Handlers
  const handleOpenInquiryWorkspace = (inq: Inquiry) => {
    setSelectedInquiry(inq);
    setFollowUpForm({
      conversationNotes: "",
      nextFollowUpDate: "",
      statusReached: inq.status,
    });
    setInquiryWorkspaceOpen(true);
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions/inquiries/${selectedInquiry.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(followUpForm),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Follow-up log saved successfully.", "success");
        setFollowUpForm((prev) => ({
          ...prev,
          conversationNotes: "",
          nextFollowUpDate: "",
        }));
        fetchDashboardData();
        setInquiryWorkspaceOpen(false);
      } else {
        snackbar.show(data.error?.message || "Failed to log follow-up.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Open candidate details in Unified Workspace panel
  const handleOpenWorkspace = async (app: Application) => {
    setSelectedApp(app);
    setFormError(null);
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
      archiveReason: app.archiveReason || "",
    });

    setExamForm({
      examDate: app.examResult?.examDate
        ? new Date(app.examResult.examDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      maxMarks: app.examResult?.maxMarks ? Number(app.examResult.maxMarks) : 100,
      marksObtained: app.examResult?.marksObtained ? String(app.examResult.marksObtained) : "",
      verdict: (app.examResult?.verdict || "PENDING") as any,
      notes: app.examResult?.notes || "",
      applicationStatus: "SHORTLISTED",
      archiveReason: app.archiveReason || "",
    });

    setPromoteForm({
      sectionId: "",
      rollNo: "",
      admissionDate: new Date().toISOString().split("T")[0],
      discountPercent: 0,
      amountPaid: 0,
      paymentMethod: "CASH",
      transactionId: "",
      termType: "FULL_TERM",
    });
    setSelectedOptionalFees([]);

    setWorkspaceOpen(true);
  };

  // Dialog forms submissions
  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFilter || !activeAcademicYearId) return;
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
        return { success: true };
      } else {
        if (data.error?.code === "VALIDATION_ERROR") {
          snackbar.show("Validation failed. Please check highlighted errors.", "error");
        } else {
          snackbar.show(data.error?.message || "Failed to submit inquiry.", "error");
        }
        return { success: false, error: data.error };
      }
    } catch {
      snackbar.show("Network error.", "error");
      return { success: false, error: { message: "Network error." } };
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFilter || !activeAcademicYearId) return;
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
          inquiryId: "",
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
        return { success: true };
      } else {
        if (data.error?.code === "VALIDATION_ERROR") {
          snackbar.show("Validation failed. Please check highlighted errors.", "error");
        } else {
          snackbar.show(data.error?.message || "Failed to submit application.", "error");
        }
        return { success: false, error: data.error };
      }
    } catch {
      snackbar.show("Network error.", "error");
      return { success: false, error: { message: "Network error." } };
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setActionLoading(true);
    setFormError(null);

    if (verifyForm.nextStatus === "REJECTED" && (!verifyForm.archiveReason || verifyForm.archiveReason.trim() === "")) {
      setFormError("Rejection reason is required.");
      snackbar.show("Rejection reason is required.", "error");
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: verifyForm.documents,
          verificationNotes: verifyForm.verificationNotes,
          applicationStatus: verifyForm.nextStatus,
          archiveReason: verifyForm.nextStatus === "REJECTED" ? verifyForm.archiveReason : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Document checks updated.", "success");
        setFormError(null);
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
      } else {
        const errMsg = data.error?.message || "Failed to verify documents.";
        setFormError(errMsg);
        snackbar.show(errMsg, "error");
      }
    } catch {
      setFormError("Network error.");
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setActionLoading(true);
    setFormError(null);

    const nextStatus = examForm.verdict === "PASS" ? "SHORTLISTED" : examForm.applicationStatus;
    if (nextStatus === "REJECTED" && (!examForm.archiveReason || examForm.archiveReason.trim() === "")) {
      setFormError("Rejection reason is required.");
      snackbar.show("Rejection reason is required.", "error");
      setActionLoading(false);
      return;
    }

    try {
      const payload = {
        examDate: examForm.examDate,
        maxMarks: Number(examForm.maxMarks),
        marksObtained: examForm.marksObtained ? Number(examForm.marksObtained) : undefined,
        verdict: examForm.verdict,
        notes: examForm.notes,
        applicationStatus: nextStatus,
        archiveReason: nextStatus === "REJECTED" ? examForm.archiveReason : undefined,
      };
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/schedule-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Exam score saved successfully.", "success");
        setFormError(null);
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
      } else {
        const errMsg = data.error?.message || "Failed to save exam details.";
        setFormError(errMsg);
        snackbar.show(errMsg, "error");
      }
    } catch {
      setFormError("Network error.");
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawApplicant = async (reason: string) => {
    if (!selectedApp) return false;
    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Application withdrawn successfully.", "success");
        setFormError(null);
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
        return true;
      } else {
        const errMsg = data.error?.message || "Failed to withdraw application.";
        setFormError(errMsg);
        snackbar.show(errMsg, "error");
        return false;
      }
    } catch {
      setFormError("Network error.");
      snackbar.show("Network error.", "error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateApplicant = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Applicant reactivated successfully.", "success");
        setFormError(null);
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
      } else {
        const errMsg = data.error?.message || "Failed to reactivate applicant.";
        setFormError(errMsg);
        snackbar.show(errMsg, "error");
      }
    } catch {
      setFormError("Network error.");
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setFormError(null);

    // 0. Validate Incomplete Candidate Data
    if (!selectedApp.class?.id || !selectedApp.academicYear?.id) {
      const errMsg = "Target Class and Academic Year are required to initialize billing.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    // 1. Validate Division/Section
    if (!promoteForm.sectionId) {
      const errMsg = "Class Division (Section) is required.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    // 2. Validate Admission Date
    if (!promoteForm.admissionDate) {
      const errMsg = "Admission Date is required.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    // 3. Validate Student Age (Minimum 3 years old on admission date)
    const dob = new Date(selectedApp.dateOfBirth);
    const admDate = new Date(promoteForm.admissionDate);
    const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageAtAdmission < 3.0) {
      const errMsg = "Student must be at least 3 years old on the admission date.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    // 4. Validate Scholarship / Discount Percentage
    const discount = Number(promoteForm.discountPercent) || 0;
    if (discount < 0 || discount > 100) {
      const errMsg = "Discount percent must be between 0% and 100%.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    // 5. Validate Installments configured
    if (customInstallments.length === 0) {
      const errMsg = "At least one fee installment template must be configured for this class.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    const baseTotal = installmentTemplates.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalDiscountedFee = Math.max(0, Math.round(baseTotal * (1 - discount / 100)));

    // 6. Validate Upfront Payment
    const amountPaidVal = Number(promoteForm.amountPaid) || 0;
    if (amountPaidVal < 0) {
      const errMsg = "Amount paid cannot be negative.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    if (amountPaidVal > 0 && !promoteForm.paymentMethod) {
      const errMsg = "Please select a payment mode for the upfront payment.";
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    if (amountPaidVal > totalDiscountedFee) {
      const errMsg = `Upfront payment of ₹${amountPaidVal} cannot exceed the onboarding total of ₹${totalDiscountedFee}.`;
      setFormError(errMsg);
      snackbar.show(errMsg, "error");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...promoteForm,
        amountPaid: Number(promoteForm.amountPaid),
        discountPercent: Number(promoteForm.discountPercent),
        installments: customInstallments.filter((i) => i.checked),
        optionalFees: selectedOptionalFees,
      };
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Candidate successfully promoted to student!", "success");
        setFormError(null);
        setWorkspaceOpen(false);
        fetchDashboardData();
      } else {
        const errMsg = data.error?.message || "Failed to promote student.";
        setFormError(errMsg);
        snackbar.show(errMsg, "error");
      }
    } catch {
      setFormError("Network error.");
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    DOCUMENT_VERIFICATION: "Doc Check",
    TEST_SCHEDULED: "Entrance Exam",
    SHORTLISTED: "Shortlisted",
    ADMITTED: "Enrolled (Admitted)",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-400 gap-3">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        <span className="text-sm font-bold tracking-wider uppercase">Loading Permissions...</span>
      </div>
    );
  }

  if (!hasInqAccess && !hasAppAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 space-y-4">
        <Icon name="lock" size={48} className="text-slate-400" />
        <h2 className="text-xl font-bold text-slate-800">Insufficient permissions</h2>
        <p className="text-sm text-slate-500 max-w-md">
          You do not have permission to view admissions inquiries or applications. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6 overflow-hidden">
      {/* 1. Header & Branch Switcher */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 shrink-0">
        <div>
          <Breadcrumb>
            <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
            <BreadcrumbItem>Admissions</BreadcrumbItem>
          </Breadcrumb>
          <h1 className="text-headline-md font-semibold text-on-surface">Admissions Pipeline Desk</h1>
          <p className="text-body-md text-on-surface-variant">
            A visual workflow-driven manager for prospective school intake leads and enrollments.
          </p>
        </div>

        {/* Entrance Exam Settings Badge & Toggle */}
        {activeBranch && (
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-sm">
            <Icon name="palette" size={18} className="text-primary shrink-0" />
            <div className="text-left">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Entrance Exam</span>
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                {activeBranch.hasEntranceTest ? "Required for Selection" : "Skipped (Direct Mode)"}
              </span>
            </div>
            {isSuperAdmin && (
              <button
                onClick={handleToggleEntranceExam}
                disabled={actionLoading}
                className={`ml-2 relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ${
                  activeBranch.hasEntranceTest ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                    activeBranch.hasEntranceTest ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Visual Connected Stepper Statistics */}
      <AdmissionsStats
        stats={stats}
        hasInqAccess={hasInqAccess}
        hasAppAccess={hasAppAccess}
        activeTab={activeTab}
        stageFilter={stageFilter}
        onStageClick={handleStageClick}
      />

      {/* 3. Filter Desk panel */}
      <AdmissionsFilters
        activeTab={activeTab}
        classFilter={classFilter}
        setClassFilter={setClassFilter}
        classes={classes}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        includeArchives={includeArchives}
        setIncludeArchives={setIncludeArchives}
        includeAppliedInquiries={includeAppliedInquiries}
        setIncludeAppliedInquiries={setIncludeAppliedInquiries}
        hasInqAccess={hasInqAccess}
        canVerifyDocs={canVerifyDocs}
        hasDemoData={hasDemoData}
        isClearingDemo={isClearingDemo}
        onClearDemoClick={handleClearDemoData}
        onNewInquiryClick={() => {
          if (classes.length === 0) {
            snackbar.show("Please create classes first.", "warning");
            return;
          }
          setInquiryForm((prev) => ({ ...prev, classAppliedId: classes[0].id }));
          setInquiryModalOpen(true);
        }}
        onNewApplicationClick={() => {
          if (classes.length === 0) {
            snackbar.show("Please create classes first.", "warning");
            return;
          }
          setAppForm((prev) => ({ ...prev, classId: classes[0].id }));
          setApplicationModalOpen(true);
        }}
      />

      {/* 4. Tab & View Toggle Segment Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3 shrink-0 gap-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-950/40 border border-slate-200/40 dark:border-zinc-800 rounded-2xl">
          {hasAppAccess && (
            <button
              onClick={() => {
                setActiveTab("applications");
                setStageFilter("ALL");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                activeTab === "applications" && stageFilter === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon name="app_registration" size={15} />
              Applications Desk ({filteredApplications.length})
            </button>
          )}
          {hasInqAccess && (
            <button
              onClick={() => {
                setActiveTab("inquiries");
                setStageFilter("ALL");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                activeTab === "inquiries"
                  ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon name="group_add" size={15} />
              Counselor Inquiries ({filteredInquiries.length})
            </button>
          )}
        </div>

        {/* View Toggle Board vs List (iOS Pill Style) */}
        <div className="flex items-center gap-2">
          {stageFilter !== "ALL" && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/5 text-primary border border-primary/10 flex items-center gap-1.5 animate-pulse">
              Stage: {statusLabels[stageFilter] || stageFilter}
              <button
                onClick={() => setStageFilter("ALL")}
                className="hover:text-red-600 font-extrabold text-sm ml-1"
              >
                ×
              </button>
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-950/40 border border-slate-200/40 dark:border-zinc-800 rounded-2xl">
            <button
              onClick={() => setViewMode("board")}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                viewMode === "board"
                  ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Pipeline Board View"
            >
              <Icon name="dashboard" size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Table List View"
            >
              <Icon name="filter_list" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Desk Workspace rendering */}
      <div className="flex-1 overflow-hidden min-h-0">
        {viewMode === "board" ? (
          <div className="h-full overflow-y-auto space-y-4">
            {includeArchives && activeTab === "applications" && (
              <div className="mx-1 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                <Icon name="warning" size={16} className="text-amber-600 shrink-0" />
                <span>Archives (Admitted, Rejected, Withdrawn) are only visible in List View. Switch to List View to manage archived candidates.</span>
              </div>
            )}
            {isDatabaseEmpty ? (
              <div className="max-w-4xl mx-auto py-10 space-y-8 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-8 rounded-3xl">
                <div className="text-center space-y-2 p-6 bg-gradient-to-br from-primary/10 to-teal-50/50 border border-primary/10 rounded-3xl shadow-sm">
                  <span className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary text-white mb-2 shadow-elevation-1">
                    <Icon name="school" size={32} />
                  </span>
                  <h2 className="text-headline-sm font-extrabold text-slate-800">
                    Welcome to Admissions Overview Control Desk
                  </h2>
                  <p className="text-body-md text-slate-600 max-w-xl mx-auto">
                    Manage prospective student inquiries, documents verification, aptitude entrance testing, and official SIS enrollments in a single, visual workspace.
                  </p>
                </div>
                <div className="p-6 bg-slate-50 border border-dashed rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                  <div className="text-center md:text-left space-y-1">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5 justify-center md:justify-start">
                      <Icon name="sparkles" size={16} className="text-primary" />
                      Explore with Sandbox Demo Data
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md">
                      Click the button below to generate 4 mock candidate pipeline records at various stages (submitted, verification, test, and shortlist).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="filled"
                    icon="cpu"
                    loading={isGeneratingDemo}
                    className="bg-primary text-white shrink-0 shadow-elevation-1 py-2.5 px-5"
                    onClick={handleGenerateDemoData}
                  >
                    {isGeneratingDemo ? "Creating Demo..." : "⚡ Generate Demo Pipeline"}
                  </Button>
                </div>
              </div>
            ) : (
              <AdmissionsPipeline
                filteredApplications={filteredApplications}
                filteredInquiries={filteredInquiries}
                hasInqAccess={hasInqAccess}
                canVerifyDocs={canVerifyDocs}
                hasAppAccess={hasAppAccess}
                onOpenWorkspace={handleOpenWorkspace}
                onOpenInquiryWorkspace={handleOpenInquiryWorkspace}
                onVerifyDocsClick={handleOpenWorkspace}
                onScoreExamClick={handleOpenWorkspace}
                onPromoteClick={handleOpenWorkspace}
                setAppForm={setAppForm}
                setApplicationModalOpen={setApplicationModalOpen}
              />
            )}
          </div>
        ) : (
          <AdmissionsList
            activeTab={activeTab}
            filteredApplications={filteredApplications}
            filteredInquiries={filteredInquiries}
            statusLabels={statusLabels}
            isDatabaseEmpty={isDatabaseEmpty}
            hasInqAccess={hasInqAccess}
            canVerifyDocs={canVerifyDocs}
            onOpenWorkspace={handleOpenWorkspace}
            onOpenInquiryWorkspace={handleOpenInquiryWorkspace}
            onResetFilters={handleResetFilters}
            setAppForm={setAppForm}
            setApplicationModalOpen={setApplicationModalOpen}
          />
        )}
      </div>

      {/* 6. MODALS & WORKSPACES */}

      {/* Inquiry Creation Modal */}
      <InquiryModal
        open={inquiryModalOpen}
        onOpenChange={setInquiryModalOpen}
        classes={classes}
        inquiryForm={inquiryForm}
        setInquiryForm={setInquiryForm}
        onSubmit={handleCreateInquiry}
        loading={actionLoading}
        branchId={branchFilter || ""}
        academicYearId={activeAcademicYearId || ""}
        onSuccess={() => {
          fetchDashboardData();
          setInquiryModalOpen(false);
        }}
      />

      {/* Application Creation/Conversion Modal */}
      <ApplicationModal
        open={applicationModalOpen}
        onOpenChange={setApplicationModalOpen}
        classes={classes}
        appForm={appForm}
        setAppForm={setAppForm}
        onSubmit={handleCreateApplication}
        loading={actionLoading}
      />

      {/* Counselor Inquiry Workspace Drawer */}
      <InquiryWorkspace
        open={inquiryWorkspaceOpen}
        onOpenChange={setInquiryWorkspaceOpen}
        selectedInquiry={selectedInquiry}
        followUpForm={followUpForm}
        setFollowUpForm={setFollowUpForm}
        onSubmitFollowUp={handleCreateFollowUp}
        loading={actionLoading}
        onSuccess={() => {
          fetchDashboardData();
          setInquiryWorkspaceOpen(false);
        }}
      />

      {/* Unified Applicant Workspace Drawer */}
      <ApplicantWorkspace
        open={workspaceOpen}
        onOpenChange={setWorkspaceOpen}
        selectedApp={selectedApp}
        statusLabels={statusLabels}
        hasEntranceTest={!!activeBranch?.hasEntranceTest}
        classSections={classSections}
        installmentTemplates={installmentTemplates}
        customInstallments={customInstallments}
        setCustomInstallments={setCustomInstallments}
        billingMode={billingMode}
        setBillingMode={setBillingMode}
        customConfigRows={customConfigRows}
        setCustomConfigRows={setCustomConfigRows}
        customConfigStartDate={customConfigStartDate}
        setCustomConfigStartDate={setCustomConfigStartDate}
        customConfigInterval={customConfigInterval}
        setCustomConfigInterval={setCustomConfigInterval}
        customConfigLateFee={customConfigLateFee}
        setCustomConfigLateFee={setCustomConfigLateFee}
        promoteForm={promoteForm}
        setPromoteForm={setPromoteForm}
        verifyForm={verifyForm}
        setVerifyForm={setVerifyForm}
        examForm={examForm}
        setExamForm={setExamForm}
        onVerifyDocs={handleVerifyDocuments}
        onSaveExam={handleSaveExam}
        onPromote={handlePromote}
        onWithdrawApplicant={handleWithdrawApplicant}
        onReactivateApplicant={handleReactivateApplicant}
        actionLoading={actionLoading}
        formError={formError}
        setFormError={setFormError}
        classFees={classFees}
        selectedOptionalFees={selectedOptionalFees}
        setSelectedOptionalFees={setSelectedOptionalFees}
      />
    </div>
  );
}
