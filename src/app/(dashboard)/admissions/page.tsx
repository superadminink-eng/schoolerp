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
import { AdmissionsSearch, AdmissionsGlobalActions, AdmissionsDataToggles } from "@/components/admissions/admissions-filters";
import AdmissionsList from "@/components/admissions/admissions-list";
import NewInquiryPane from "@/components/admissions/new-inquiry-pane";
import ApplicationModal from "@/components/admissions/application-modal";
import InquiryWorkspace from "@/components/admissions/inquiry-workspace";
import ApplicantWorkspace from "@/components/admissions/applicant-workspace";
import { UnifiedInboxList } from "@/components/admissions/unified-inbox-list";
import { InquiryDetailPane } from "@/components/admissions/inquiry-detail-pane";

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
  tokens?: any[] | null;
  examResult?: ExamResult | null;
  enrolledStudent?: any;
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
  isProvisional?: boolean;
  provisionalDeadline?: string | null;
  overrideReason?: string | null;
}

interface FollowUp {
  id: string;
  followUpDate: string;
  conversationNotes: string;
  nextFollowUpDate: string | null;
  statusReached: string;
  counselorId?: string;
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

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Dialog & Workspace controllers
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
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
    documents: { id: string; status: "PENDING" | "VERIFIED" | "REJECTED" | "HARDCOPY_SUBMITTED"; remarks: string; documentType: string }[];
    verificationNotes: string;
    nextStatus: "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
    archiveReason: string;
    isProvisional: boolean;
    provisionalDeadline: string;
    provisionalReason: string;
    overrideReason: string;
  }>({
    documents: [],
    verificationNotes: "",
    nextStatus: "TEST_SCHEDULED",
    archiveReason: "",
    isProvisional: false,
    provisionalDeadline: "",
    provisionalReason: "",
    overrideReason: "",
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
    discountAmount: 0,
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

  // Load templates and fees dynamically when selectedApp or termType changes
  useEffect(() => {
    if (selectedApp && selectedApp.class?.id) {
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
                amount: Number(t.amount) || 0,
                checked: true,
                isCustom: false,
              }))
            );
          } else {
            setInstallmentTemplates([]);
            setCustomInstallments([]);
          }
        } catch {
          console.error("Failed to load installment templates.");
          setInstallmentTemplates([]);
          setCustomInstallments([]);
        }
      };
      const fetchFees = async () => {
        try {
          const res = await fetch(`/api/v1/classes/${selectedApp.class?.id}/fees?termType=${promoteForm.termType}`);
          const data = await res.json();
          if (data.success) {
            setClassFees(data.data);
          } else {
            setClassFees([]);
          }
        } catch {
          console.error("Failed to load fees.");
          setClassFees([]);
        }
      };
      fetchTemplates();
      fetchFees();
    }
  }, [selectedApp?.class?.id, promoteForm.termType]);

  // Load sections dynamically when selectedApp changes
  useEffect(() => {
    if (selectedApp && selectedApp.class?.id) {
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
      fetchSections();
    }
  }, [selectedApp?.class?.id]);

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
    
    // Reset selected candidates when switching branches to prevent cross-school data leaks
    setSelectedApp(null);
    setSelectedInquiry(null);

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

  // Toggle Branch exam settings logic moved to Settings (Security & Privacy)

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
    setInquiryWorkspaceOpen(true);
  };

  const handleInquiryUpdated = (updatedInquiry: Inquiry) => {
    setInquiries((prev) => prev.map((inq) => inq.id === updatedInquiry.id ? updatedInquiry : inq));
    if (selectedInquiry?.id === updatedInquiry.id) {
      setSelectedInquiry(updatedInquiry);
    }
  };

  // Open candidate details in Unified Workspace panel
  const handleOpenWorkspace = async (app: Application) => {
    setSelectedApp(app);
    setFormError(null);
    const docs = app.documents || [];
    const allVerified = docs.length > 0 && docs.every((d: any) => d.status === "VERIFIED");
    const anyRejected = docs.some((d: any) => d.status === "REJECTED");
    let initialNextStatus: "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED" = "DOCUMENT_VERIFICATION";
    if (anyRejected) {
      initialNextStatus = "REJECTED";
    } else if (allVerified) {
      initialNextStatus = activeBranch?.hasEntranceTest ? "TEST_SCHEDULED" : "SHORTLISTED";
    }

    setVerifyForm({
      documents: docs.map((d: any) => ({
        id: d.id,
        status: d.status,
        remarks: d.remarks || "",
        documentType: d.documentType,
        fileName: d.fileName,
        filePath: d.filePath,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
      })),
      verificationNotes: app.verificationNotes || "",
      nextStatus: initialNextStatus,
      archiveReason: app.archiveReason || "",
      isProvisional: app.isProvisional || false,
      provisionalDeadline: app.provisionalDeadline ? new Date(app.provisionalDeadline).toISOString().split("T")[0] : "",
      provisionalReason: app.provisionalReason || "",
      overrideReason: app.overrideReason || "",
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
      discountAmount: 0,
      amountPaid: 0,
      paymentMethod: "CASH",
      transactionId: "",
      termType: "FULL_TERM",
    });
    setSelectedOptionalFees([]);

    setWorkspaceOpen(true);
  };

  // Dialog forms submissions
  const handleCreateInquiry = async (e: React.FormEvent, force?: boolean) => {
    e.preventDefault();
    if (!branchFilter || !activeAcademicYearId) return;
    setActionLoading(true);
    try {
      const url = force ? "/api/v1/admissions/inquiries?force=true" : "/api/v1/admissions/inquiries";
      const res = await fetch(url, {
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
        setIsCreatingInquiry(false);
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
          isProvisional: verifyForm.isProvisional,
          overrideReason: verifyForm.overrideReason,
          provisionalDeadline: verifyForm.provisionalDeadline ? new Date(verifyForm.provisionalDeadline).toISOString() : null,
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

    // 1. Guard Default Section (User requested hiding Section)
    let finalSectionId = promoteForm.sectionId;
    if (!finalSectionId && classSections && classSections.length > 0) {
      finalSectionId = classSections[0].id;
    }
    if (!finalSectionId) {
      const errMsg = "A Class Division (Section) is required but none exists. Please create one in settings first.";
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

    // 4. Validate Scholarship / Discount Amount
    const discount = Number(promoteForm.discountAmount) || 0;
    if (discount < 0) {
      const errMsg = "Discount amount cannot be negative.";
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
    const totalDiscountedFee = Math.max(0, baseTotal - discount);

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
        sectionId: finalSectionId,
        amountPaid: Number(promoteForm.amountPaid),
        discountAmount: Number(promoteForm.discountAmount),
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
        setSelectedApp({ ...selectedApp, status: "ADMITTED", enrolledStudent: data.data });
        fetchDashboardData();
      } else {
        const errMsg = data.error?.message || "Failed to promote student.";
        if (data.error?.code === "CONFLICT" && errMsg === "Candidate has already been admitted") {
          // Recover from double-click or timeout-retry
          snackbar.show("Candidate is already enrolled!", "success");
          setFormError(null);
          setSelectedApp({ ...selectedApp, status: "ADMITTED", enrolledStudent: data.data || selectedApp.enrolledStudent });
          fetchDashboardData();
        } else {
          setFormError(errMsg);
          snackbar.show(errMsg, "error");
        }
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
    <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[600px] space-y-3 overflow-hidden bg-slate-50/30 dark:bg-zinc-950/30">
      
      {/* 1. THE SILICON VALLEY TOOLBAR (Unified) */}
      <div className="relative overflow-hidden flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full bg-slate-50/80 dark:bg-zinc-900/50 p-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] mt-1">
        
        {/* Subtle Gradient background for that premium feel */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5 pointer-events-none"></div>
        
        {/* Left Group: Identity, Search */}
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 flex-1 relative z-10">
          
          {/* Compact Title Segment */}
          <div className="flex items-center pl-2 pr-1 shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary mr-2 shadow-[0_0_8px_rgba(0,100,255,0.6)] animate-pulse"></div>
            <h1 className="text-[15px] font-black tracking-tight text-slate-800 dark:text-zinc-100 uppercase">Inbox</h1>
          </div>

          <div className="hidden xl:block w-px h-6 bg-slate-200 dark:bg-zinc-700 mx-1 shrink-0"></div>

          {/* Local Data Search */}
          <div className="flex-1 max-w-[350px]">
            <AdmissionsSearch
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
              onNewInquiryClick={() => {}}
              onNewApplicationClick={() => {}}
            />
          </div>

          {hasActiveFilters && (
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl shadow-sm shrink-0">
              <Icon name="filter_alt" size={14} className="text-amber-600 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-700">Active</span>
              <div className="w-px h-3 bg-amber-200 mx-1"></div>
              <button onClick={handleResetFilters} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700">Clear</button>
            </div>
          )}
        </div>

        {/* Right Group: Filters, View, Global Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 relative z-10 xl:justify-end">
          <AdmissionsDataToggles
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
            onNewInquiryClick={() => {}}
            onNewApplicationClick={() => {}}
          />

          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-zinc-700 mx-1 shrink-0"></div>

          <AdmissionsGlobalActions
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
              setIsCreatingInquiry(true);
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
        </div>
      </div>

      {/* 2. THE MASTER-DETAIL WORKSPACE */}
      <div className="flex-1 flex overflow-hidden min-h-0 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm bg-white dark:bg-zinc-950">
        
        {/* LEFT PANE - MASTER LIST */}
        <div className={`w-full md:w-[280px] lg:w-[320px] shrink-0 border-r border-slate-200/60 dark:border-zinc-800/60 flex flex-col ${selectedApp || selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
          <UnifiedInboxList 
            applications={filteredApplications}
            inquiries={filteredInquiries}
            activeTab={activeTab}
            stageFilter={stageFilter}
            onStageClick={handleStageClick}
            selectedAppId={selectedApp?.id || null}
            selectedInqId={selectedInquiry?.id || null}
            onSelectApp={(app) => {
              handleOpenWorkspace(app);
              setSelectedInquiry(null);
            }}
            onSelectInquiry={(inq) => {
              setSelectedInquiry(inq);
              setSelectedApp(null);
            }}
            stats={stats}
            hasInqAccess={hasInqAccess}
            hasAppAccess={hasAppAccess}
            hasEntranceTest={!!activeBranch?.hasEntranceTest}
          />
        </div>

        {/* RIGHT PANE - DETAIL WORKSPACE */}
        <div className={`flex-1 flex flex-col min-w-0 relative ${!selectedApp && !selectedInquiry && !isCreatingInquiry ? 'hidden md:flex' : 'flex'}`}>
          {isCreatingInquiry ? (
            <NewInquiryPane
              onClose={() => setIsCreatingInquiry(false)}
              classes={classes}
              inquiryForm={inquiryForm}
              setInquiryForm={setInquiryForm}
              handleFormSubmit={handleCreateInquiry}
              loading={actionLoading}
              branchFilter={branchFilter}
              activeAcademicYearId={activeAcademicYearId}
            />
          ) : selectedApp ? (
            <ApplicantWorkspace
              onClose={() => setSelectedApp(null)}
              selectedApp={selectedApp}
              statusLabels={statusLabels}
              classes={classes}
              onApplicantUpdated={(updatedApp) => {
                setSelectedApp(updatedApp);
                fetchDashboardData();
              }}
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
          ) : selectedInquiry ? (
            <InquiryDetailPane
              selectedInquiry={selectedInquiry}
              canVerifyDocs={canVerifyDocs}
              onOpenInquiryWorkspace={handleOpenInquiryWorkspace}
              setAppForm={setAppForm}
              setApplicationModalOpen={setApplicationModalOpen}
              schoolName={branches.find(b => b.id === branchFilter)?.name || "Our School"}
              onClose={() => setSelectedInquiry(null)}
              onInquiryUpdated={handleInquiryUpdated}
              hasAppAccess={hasAppAccess}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 dark:bg-zinc-950/20">
              <div className="w-20 h-20 mb-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/50 shadow-sm flex items-center justify-center relative">
                <Icon name="inbox" size={36} className="text-slate-300 dark:text-zinc-700" />
              </div>
              <p className="text-lg font-extrabold tracking-tight text-slate-700 dark:text-zinc-300">Unified Admissions Inbox</p>
              <p className="text-xs mt-2 text-slate-400 max-w-[280px] text-center leading-relaxed">
                Select a candidate from the left to view their complete 360° profile and take action.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* 6. MODALS & WORKSPACES */}

      

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
        loading={actionLoading}
        onSuccess={() => {
          fetchDashboardData();
          setInquiryWorkspaceOpen(false);
        }}
      />

    </div>
  );
}
