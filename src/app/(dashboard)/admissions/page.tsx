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
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  address: string;
  pincode: string;
  verificationNotes: string | null;
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
  const snackbar = useSnackbar();

  // Roles & Permissions check
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";

  // State configurations
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
  const [activeTab, setActiveTab] = useState<"applications" | "inquiries">("applications");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [includeArchives, setIncludeArchives] = useState<boolean>(false); // Hides Admitted/Rejected by default

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

  // Selection configurations
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [classSections, setClassSections] = useState<Section[]>([]);

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

  // 3. Fetch applications and inquiries (Flicker-free baseline query)
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

  // Dynamic quick toggling of branch settings directly on the Admissions page
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
        // Update local state
        setBranches((prev) =>
          prev.map((b) => (b.id === activeBranch.id ? { ...b, hasEntranceTest: nextSetting } : b))
        );
        setActiveBranch((prev) => (prev ? { ...prev, hasEntranceTest: nextSetting } : null));
      } else {
        snackbar.show(data.error?.message || "Failed to update branch configuration.", "error");
      }
    } catch {
      snackbar.show("Network error during branch configuration.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Client-side local filtering for keystroke search (prevents auto-loading infinite loops)
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Archive filter
      if (!includeArchives && (app.status === "ADMITTED" || app.status === "REJECTED" || app.status === "WITHDRAWN")) {
        return false;
      }
      // Grade filter
      if (classFilter !== "ALL" && app.class?.id !== classFilter) return false;
      // Stage filter
      if (stageFilter !== "ALL" && app.status !== stageFilter) return false;
      // Search text filter
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

  // Aggregate stats computation
  const stats = useMemo(() => {
    const activeApps = applications.filter((a) => a.status !== "ADMITTED" && a.status !== "REJECTED" && a.status !== "WITHDRAWN");
    return {
      inquiryCount: inquiries.length,
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

  // Demo Sandbox Pipeline Generator
  const handleGenerateDemoData = async () => {
    if (classes.length === 0) {
      snackbar.show("कृपया आधी Classes तयार करा, जेणेकरून डमी डेटा तयार करता येईल.", "warning");
      return;
    }
    if (!branchFilter || !activeAcademicYearId) {
      snackbar.show("Branch किंवा Academic Year कॉन्फिगरेशन सापडले नाही.", "error");
      return;
    }

    setIsGeneratingDemo(true);
    snackbar.show("डमी डेटा पाईपलाईन तयार होत आहे...", "info");

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
          notes: "Interested in Class 3 admission. Needs school bus facility.",
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

      snackbar.show("डमी पाईपलाईन यशस्वीरित्या तयार झाली आहे!", "success");
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      snackbar.show("डमी डेटा तयार करताना त्रुटी आली.", "error");
    } finally {
      setIsGeneratingDemo(false);
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
        
        // Refresh local dashboard list
        fetchDashboardData();
        
        // Close modal workspace
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
    // Initialize stepper wizard forms dynamically depending on candidate's current stage
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

    setPromoteForm({
      sectionId: "",
      rollNo: "",
      admissionDate: new Date().toISOString().split("T")[0],
      discountPercent: 0,
      amountPaid: 0,
      paymentMethod: "CASH",
      transactionId: "",
    });

    setWorkspaceOpen(true);

    // If at Shortlist stage, load sections for class
    if (app.status === "SHORTLISTED" && app.class?.id) {
      try {
        const res = await fetch(`/api/v1/classes/${app.class.id}/sections`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setClassSections(data.data);
          setPromoteForm((prev) => ({ ...prev, sectionId: data.data[0].id }));
        }
      } catch {
        console.error("Failed to load sections.");
      }
    }
  };

  // Submissions inside wizards
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
      } else {
        snackbar.show(data.error?.message || "Failed to submit inquiry.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
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
      snackbar.show("Network error.", "error");
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
        snackbar.show("Document checks updated.", "success");
        // Fast UI refresh and reopen workspace with updated app details
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to verify documents.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
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
        snackbar.show("Exam score saved successfully.", "success");
        const refreshedApp = data.data;
        setApplications((prev) => prev.map((a) => (a.id === refreshedApp.id ? refreshedApp : a)));
        handleOpenWorkspace(refreshedApp);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to save exam details.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
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
        snackbar.show("Candidate successfully promoted to student!", "success");
        setWorkspaceOpen(false);
        fetchDashboardData();
      } else {
        snackbar.show(data.error?.message || "Failed to promote student.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Helper labels mapping
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

  return (
    <div className="flex flex-col h-full space-y-6 overflow-hidden">
      {/* 1. Header & Quick Settings Switch */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 shrink-0">
        <div>
          <Breadcrumb>
            <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
            <BreadcrumbItem>Admissions</BreadcrumbItem>
          </Breadcrumb>
          <h1 className="text-headline-md font-semibold text-on-surface">
            Admissions Overview Desk
          </h1>
          <p className="text-body-md text-on-surface-variant">
            A unified pipeline manager for counseling inquiries and applicant promotions.
          </p>
        </div>

        {/* Dynamic Branch Settings Switch directly on header */}
        {activeBranch && (
          <div className="flex items-center gap-3 bg-surface-container-lowest p-3 border border-outline-variant/60 rounded-xl shadow-elevation-1">
            <Icon name="palette" size={18} className="text-primary shrink-0" />
            <div className="text-left">
              <span className="block text-[11px] text-slate-400 font-bold uppercase tracking-wide">Entrance Examination</span>
              <span className="text-xs font-semibold text-slate-700">
                {activeBranch.hasEntranceTest ? "Required for Admissions" : "Skipped (Direct Selection)"}
              </span>
            </div>
            {isSuperAdmin && (
              <button
                onClick={handleToggleEntranceExam}
                disabled={actionLoading}
                className={`ml-2 relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  activeBranch.hasEntranceTest ? "bg-primary" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    activeBranch.hasEntranceTest ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Connected Funnel Pipeline Stepper (Stats & Filter in one) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        {/* Step 1: Counselor Inquiries */}
        <button
          onClick={() => handleStageClick("inquiries")}
          className={`text-left p-3.5 border rounded-2xl transition-all duration-200 group flex items-start gap-3 bg-gradient-to-br from-white to-sky-50/20 border-sky-100 ${
            activeTab === "inquiries"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-elevation-2"
              : "hover:border-sky-300 hover:shadow-elevation-1"
          }`}
        >
          <div className={`p-2.5 rounded-xl bg-sky-100 text-sky-700 transition-colors ${
            activeTab === "inquiries" ? "bg-primary text-white" : ""
          }`}>
            <Icon name="group_add" size={18} />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 1: Inquiry</span>
            <span className="block text-headline-sm font-extrabold text-slate-800 mt-0.5">{stats.inquiryCount}</span>
            <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-700">Counselor logs</span>
          </div>
        </button>

        {/* Step 2: Submitted Applications */}
        <button
          onClick={() => handleStageClick("SUBMITTED")}
          className={`text-left p-3.5 border rounded-2xl transition-all duration-200 group flex items-start gap-3 bg-gradient-to-br from-white to-blue-50/20 border-blue-100 ${
            activeTab === "applications" && stageFilter === "SUBMITTED"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-elevation-2"
              : "hover:border-blue-300 hover:shadow-elevation-1"
          }`}
        >
          <div className={`p-2.5 rounded-xl bg-blue-100 text-blue-700 transition-colors ${
            activeTab === "applications" && stageFilter === "SUBMITTED" ? "bg-primary text-white" : ""
          }`}>
            <Icon name="app_registration" size={18} />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 2: Submit</span>
            <span className="block text-headline-sm font-extrabold text-slate-800 mt-0.5">{stats.submittedCount}</span>
            <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-700">New applications</span>
          </div>
        </button>

        {/* Step 3: Document Verification */}
        <button
          onClick={() => handleStageClick("DOCUMENT_VERIFICATION")}
          className={`text-left p-3.5 border rounded-2xl transition-all duration-200 group flex items-start gap-3 bg-gradient-to-br from-white to-amber-50/20 border-amber-100 ${
            activeTab === "applications" && stageFilter === "DOCUMENT_VERIFICATION"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-elevation-2"
              : "hover:border-amber-300 hover:shadow-elevation-1"
          }`}
        >
          <div className={`p-2.5 rounded-xl bg-amber-100 text-amber-700 transition-colors ${
            activeTab === "applications" && stageFilter === "DOCUMENT_VERIFICATION" ? "bg-primary text-white" : ""
          }`}>
            <Icon name="check_circle" size={18} />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 3: Verify Docs</span>
            <span className="block text-headline-sm font-extrabold text-slate-800 mt-0.5">{stats.pendingVerify}</span>
            <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-700">Awaiting checks</span>
          </div>
        </button>

        {/* Step 4: Entrance Test */}
        <button
          onClick={() => handleStageClick("TEST_SCHEDULED")}
          className={`text-left p-3.5 border rounded-2xl transition-all duration-200 group flex items-start gap-3 bg-gradient-to-br from-white to-purple-50/20 border-purple-100 ${
            activeTab === "applications" && stageFilter === "TEST_SCHEDULED"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-elevation-2"
              : "hover:border-purple-300 hover:shadow-elevation-1"
          }`}
        >
          <div className={`p-2.5 rounded-xl bg-purple-100 text-purple-700 transition-colors ${
            activeTab === "applications" && stageFilter === "TEST_SCHEDULED" ? "bg-primary text-white" : ""
          }`}>
            <Icon name="event" size={18} />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 4: Entrance Exam</span>
            <span className="block text-headline-sm font-extrabold text-slate-800 mt-0.5">{stats.awaitingExam}</span>
            <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-700">Grades & interviews</span>
          </div>
        </button>

        {/* Step 5: Shortlist/Enroll */}
        <button
          onClick={() => handleStageClick("SHORTLISTED")}
          className={`text-left p-3.5 border rounded-2xl transition-all duration-200 group flex items-start gap-3 bg-gradient-to-br from-white to-teal-50/20 border-teal-100 ${
            activeTab === "applications" && stageFilter === "SHORTLISTED"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-elevation-2"
              : "hover:border-teal-300 hover:shadow-elevation-1"
          }`}
        >
          <div className={`p-2.5 rounded-xl bg-teal-100 text-teal-700 transition-colors ${
            activeTab === "applications" && stageFilter === "SHORTLISTED" ? "bg-primary text-white" : ""
          }`}>
            <Icon name="star" size={18} />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 5: Shortlisted</span>
            <span className="block text-headline-sm font-extrabold text-slate-800 mt-0.5">{stats.readyToEnroll}</span>
            <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-700">Ready to promote</span>
          </div>
        </button>
      </div>

      {/* 3. Filtering Desk Panel */}
      <div className="flex flex-col space-y-4 p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-elevation-1 shrink-0 md:flex-row md:items-end md:space-y-0 md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Branch filter (superadmin scope) */}
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

          {/* Grade filter */}
          {activeTab === "applications" && (
            <div className="w-48 shrink-0">
              <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Applied Grade</label>
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
          <div className="flex-1 min-w-[240px]">
            <label className="block text-label-sm text-on-surface-variant mb-1 font-medium">Search Candidate</label>
            <SearchBar
              placeholder="Search candidate name, application ID..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
        </div>

        {/* Toggle include archives and Actions */}
        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          {activeTab === "applications" && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600 bg-slate-100 border px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={includeArchives}
                onChange={(e) => setIncludeArchives(e.target.checked)}
                className="rounded text-primary focus:ring-primary w-4 h-4"
              />
              Show Archives
            </label>
          )}

          <Button
            variant="tonal"
            icon="group_add"
            onClick={() => {
              if (classes.length === 0) {
                snackbar.show("Please create classes first.", "warning");
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
                snackbar.show("Please create classes first.", "warning");
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

      {/* 4. Tab Navigation Desks (Segmented Control style) */}
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3 shrink-0">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border">
          <button
            onClick={() => {
              setActiveTab("applications");
              setStageFilter("ALL");
            }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === "applications" && stageFilter === "ALL"
                ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="app_registration" size={16} />
            Applications Desk ({filteredApplications.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("inquiries");
              setStageFilter("ALL");
            }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === "inquiries"
                ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="group_add" size={16} />
            Counselor Inquiries ({filteredInquiries.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {stageFilter !== "ALL" && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 animate-pulse">
              Active Stage: {statusLabels[stageFilter] || stageFilter}
              <button onClick={() => setStageFilter("ALL")} className="hover:text-red-600 font-bold p-0.5">×</button>
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Desks Lists */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === "applications" ? (
          <div className="h-full overflow-y-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            {filteredApplications.length === 0 ? (
              isDatabaseEmpty ? (
                <div className="max-w-4xl mx-auto py-10 space-y-8">
                  {/* Onboarding welcome card */}
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

                  {/* Operational Steps Map */}
                  <div>
                    <h3 className="text-title-sm font-bold text-slate-400 uppercase tracking-wide text-center mb-5">
                      Understanding the School Intake Funnel
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {/* Step 1 */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 relative group hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm">
                          1
                        </div>
                        <h4 className="font-bold text-xs text-slate-800">Inquiry Intake</h4>
                        <p className="text-[11px] text-slate-400">Log walk-ins or calls into prospective lead database.</p>
                      </div>

                      {/* Step 2 */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 relative group hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                          2
                        </div>
                        <h4 className="font-bold text-xs text-slate-800">Submit Application</h4>
                        <p className="text-[11px] text-slate-400">Fill standard intake application with candidate & family details.</p>
                      </div>

                      {/* Step 3 */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 relative group hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
                          3
                        </div>
                        <h4 className="font-bold text-xs text-slate-800">Verify Checklist</h4>
                        <p className="text-[11px] text-slate-400">Review student birth certificates, Aadhaar IDs, and mark sheets.</p>
                      </div>

                      {/* Step 4 */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 relative group hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm">
                          4
                        </div>
                        <h4 className="font-bold text-xs text-slate-800">Entrance Grading</h4>
                        <p className="text-[11px] text-slate-400">Score entrance tests & schedule interviews (can be disabled).</p>
                      </div>

                      {/* Step 5 */}
                      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2 relative group hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
                          5
                        </div>
                        <h4 className="font-bold text-xs text-slate-800">Promote to SIS</h4>
                        <p className="text-[11px] text-slate-400">Section class, issue auto-invoice, and promote to student.</p>
                      </div>
                    </div>
                  </div>

                  {/* Sandbox generator callout */}
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
                <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/40 space-y-3">
                  <Icon name="search_off" size={48} className="text-slate-300" />
                  <div className="text-center">
                    <p className="text-body-lg font-bold text-slate-600">No candidates match active filters.</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search query, changing grade filter or clearing the stage.</p>
                  </div>
                  <Button
                    variant="outlined"
                    size="sm"
                    icon="rotate_ccw"
                    className="text-primary border-primary/30 mt-2"
                    onClick={handleResetFilters}
                  >
                    Clear Search & Filters
                  </Button>
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-md font-bold text-on-surface-variant">
                      <th className="py-3 px-4">Application ID</th>
                      <th className="py-3 px-4">Candidate Name</th>
                      <th className="py-3 px-4">Target Class</th>
                      <th className="py-3 px-4">Active Stage</th>
                      <th className="py-3 px-4">Docs Verified</th>
                      <th className="py-3 px-4">Entrance exam</th>
                      <th className="py-3 px-4 text-right">Wizard Desk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => {
                      const docs = app.documents || [];
                      const verifiedDocsCount = docs.filter((d) => d.status === "VERIFIED").length;
                      const totalDocs = docs.length;

                      return (
                        <tr
                          key={app.id}
                          onClick={() => handleOpenWorkspace(app)}
                          className="border-b border-outline-variant/40 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 font-bold text-primary">{app.applicationNo}</td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-on-surface">{app.firstName} {app.lastName}</div>
                            <div className="text-xs text-slate-400">Parent: {app.fatherName || app.motherName || "—"}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border">
                              {app.class?.name || "N/A"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
                          <td className="py-4 px-4 text-xs font-semibold text-slate-600">
                            {totalDocs > 0 ? (
                              <span className={verifiedDocsCount === totalDocs ? "text-emerald-600 font-bold" : ""}>
                                {verifiedDocsCount}/{totalDocs} files verified
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">Checklist empty</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {app.examResult ? (
                              <span
                                className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                                  app.examResult.verdict === "PASS"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : app.examResult.verdict === "FAIL"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {app.examResult.marksObtained !== null ? `${app.examResult.marksObtained}/${app.examResult.maxMarks} Marks` : "Scheduled"}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              variant="outlined"
                              size="sm"
                              icon="arrow_back"
                              className="rotate-180 text-primary border-primary/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenWorkspace(app);
                              }}
                            >
                              Open Workspace
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Counselor Inquiries Table Desk */
          <div className="h-full overflow-y-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-title-lg font-bold text-on-surface">Prospect Counselor Logs</h3>
              <span className="text-body-sm text-on-surface-variant font-semibold">{filteredInquiries.length} logged inquiries</span>
            </div>

            {filteredInquiries.length === 0 ? (
              isDatabaseEmpty ? (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40 space-y-3">
                  <Icon name="group_add" size={48} className="text-slate-300 animate-bounce" />
                  <div className="text-center">
                    <p className="text-body-lg font-bold text-slate-600">No prospect inquiries registered.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "New Inquiry" or "Generate Demo Pipeline" to populate this workspace.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40 space-y-3">
                  <Icon name="search_off" size={48} className="text-slate-300" />
                  <div className="text-center">
                    <p className="text-body-lg font-bold text-slate-600">No inquiries match active filters.</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search query or clearing the filters.</p>
                  </div>
                  <Button
                    variant="outlined"
                    size="sm"
                    icon="rotate_ccw"
                    className="text-primary border-primary/30 mt-2"
                    onClick={handleResetFilters}
                  >
                    Clear Search & Filters
                  </Button>
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-md font-bold text-on-surface-variant">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Grade</th>
                      <th className="py-3 px-4">Parent Details</th>
                      <th className="py-3 px-4">Date Logged</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInquiries.map((inq) => (
                      <tr
                        key={inq.id}
                        onClick={() => handleOpenInquiryWorkspace(inq)}
                        className="border-b border-outline-variant/40 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-on-surface">{inq.studentName}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800 border">
                            {inq.classApplied?.name || "N/A"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-body-sm text-on-surface-variant">
                          <div>{inq.parentName}</div>
                          <div className="text-xs">{inq.parentPhone} | {inq.parentEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 text-body-sm text-on-surface-variant">
                          {new Date(inq.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
                        <td className="py-3.5 px-4">
                          {inq.status !== "APPLIED" && (
                            <Button
                              variant="outlined"
                              size="sm"
                              icon="app_registration"
                              onClick={(e) => {
                                e.stopPropagation();
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

      {/* ─── REDESIGNED UNIFIED APPLICANT WORKSPACE PANEL (MODAL split-pane) ─── */}
      <Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <DialogContent className="max-w-5xl h-[88vh] overflow-hidden flex flex-col p-0 rounded-2xl bg-surface-container-lowest border border-outline-variant">
          {selectedApp && (
            <>
              {/* Header Title bar */}
              <div className="p-5 border-b border-outline-variant bg-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary text-white">
                      {statusLabels[selectedApp.status] || selectedApp.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">Application Number:</span>
                    <span className="text-xs font-bold text-slate-700">{selectedApp.applicationNo}</span>
                  </div>
                  <h2 className="text-title-lg font-bold text-on-surface mt-1">
                    {selectedApp.firstName} {selectedApp.lastName}
                  </h2>
                </div>
                <DialogClose className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 transition-colors mr-10">
                  <Icon name="close" size={20} />
                </DialogClose>
              </div>

              {/* Stepper Wizard Horizontal Path */}
              <div className="p-4 bg-white border-b border-outline-variant/60 flex items-center justify-around text-center shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span className="p-1 px-2.5 rounded-full bg-emerald-100 text-emerald-800">1</span>
                  <span>Submitted</span>
                </div>
                <div className="text-slate-300">➔</div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`p-1 px-2.5 rounded-full ${
                      selectedApp.status !== "SUBMITTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-primary text-white"
                    }`}
                  >
                    2
                  </span>
                  <span className={selectedApp.status === "DOCUMENT_VERIFICATION" ? "text-primary font-extrabold" : "text-slate-700"}>
                    Document Verification
                  </span>
                </div>
                {activeBranch?.hasEntranceTest && (
                  <>
                    <div className="text-slate-300">➔</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span
                        className={`p-1 px-2.5 rounded-full ${
                          selectedApp.status === "SHORTLISTED" || selectedApp.status === "ADMITTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : selectedApp.status === "TEST_SCHEDULED"
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        3
                      </span>
                      <span className={selectedApp.status === "TEST_SCHEDULED" ? "text-primary font-extrabold" : "text-slate-500"}>
                        Entrance Test
                      </span>
                    </div>
                  </>
                )}
                <div className="text-slate-300">➔</div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`p-1 px-2.5 rounded-full ${
                      selectedApp.status === "ADMITTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedApp.status === "SHORTLISTED"
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {activeBranch?.hasEntranceTest ? "4" : "3"}
                  </span>
                  <span className={selectedApp.status === "SHORTLISTED" ? "text-primary font-extrabold" : "text-slate-500"}>
                    Shortlisted Selection
                  </span>
                </div>
                <div className="text-slate-300">➔</div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`p-1 px-2.5 rounded-full ${
                      selectedApp.status === "ADMITTED" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {activeBranch?.hasEntranceTest ? "5" : "4"}
                  </span>
                  <span className={selectedApp.status === "ADMITTED" ? "text-emerald-600 font-extrabold" : "text-slate-500"}>
                    Enrolled (Promoted)
                  </span>
                </div>
              </div>

              {/* Main Split Body Area */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* A. Left Pane: Candidate Profile Summary */}
                <div className="w-[38%] overflow-y-auto p-5 border-r border-outline-variant space-y-5">
                  <div>
                    <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Application Details</h3>
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-1.5 text-xs">
                      <p><span className="font-semibold text-slate-500">Grade Applied:</span> {selectedApp.class?.name || "N/A"}</p>
                      <p><span className="font-semibold text-slate-500">Academic Year:</span> {selectedApp.academicYear?.name || "N/A"}</p>
                      <p><span className="font-semibold text-slate-500">Application Status:</span> {selectedApp.status}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Personal Details</h3>
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-2 text-xs">
                      <p><span className="font-semibold text-slate-500">Birth Date:</span> {new Date(selectedApp.dateOfBirth).toLocaleDateString("en-IN")}</p>
                      <p><span className="font-semibold text-slate-500">Gender:</span> {selectedApp.gender}</p>
                      <p><span className="font-semibold text-slate-500">Address:</span> {selectedApp.address}, {selectedApp.pincode}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Family Contacts</h3>
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-3 text-xs">
                      {selectedApp.fatherName && (
                        <div>
                          <p className="font-bold text-slate-700">Father: {selectedApp.fatherName}</p>
                          <p className="text-[11px] text-slate-400">Phone: {selectedApp.fatherPhone || "—"} | Occ: {selectedApp.fatherOccupation || "—"}</p>
                        </div>
                      )}
                      {selectedApp.motherName && (
                        <div>
                          <p className="font-bold text-slate-700">Mother: {selectedApp.motherName}</p>
                          <p className="text-[11px] text-slate-400">Phone: {selectedApp.motherPhone || "—"} | Occ: {selectedApp.motherOccupation || "—"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. Right Pane: Wizard Active Card Forms */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                  {/* Step 2 Form: Document verification */}
                  {(selectedApp.status === "SUBMITTED" || selectedApp.status === "DOCUMENT_VERIFICATION") && (
                    <Card variant="outlined" className="border-amber-200 bg-white shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2 text-amber-800 font-bold">
                          <Icon name="check_circle" size={20} />
                          <h3>Step 2: Document Checklist Verification</h3>
                        </div>
                        <p className="text-xs text-slate-500">Verify candidate documents. If none are present, click to initialize checklist.</p>

                        <form onSubmit={handleVerifyDocuments} className="space-y-4">
                          {verifyForm.documents.length === 0 ? (
                            <div className="p-4 bg-slate-50 border border-dashed rounded-xl flex flex-col items-center justify-center">
                              <p className="text-xs text-slate-400 mb-2">No documents checklists initialized yet.</p>
                              <Button
                                type="button"
                                variant="outlined"
                                size="sm"
                                onClick={() => {
                                  setVerifyForm((prev) => ({
                                    ...prev,
                                    documents: [
                                      { id: "mock-dob", status: "PENDING", remarks: "", documentType: "Birth Certificate" },
                                      { id: "mock-id", status: "PENDING", remarks: "", documentType: "Aadhaar Card" },
                                    ],
                                  }));
                                }}
                              >
                                Initialize Checklist Checklist
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {verifyForm.documents.map((doc, idx) => (
                                <div key={doc.id} className="p-3.5 border rounded-xl bg-slate-50/50 flex flex-col space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-slate-700">{doc.documentType}</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const clone = [...verifyForm.documents];
                                          clone[idx].status = "VERIFIED";
                                          setVerifyForm({ ...verifyForm, documents: clone });
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                          doc.status === "VERIFIED"
                                            ? "bg-emerald-600 border-emerald-600 text-white"
                                            : "bg-white hover:bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        Verify
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const clone = [...verifyForm.documents];
                                          clone[idx].status = "REJECTED";
                                          setVerifyForm({ ...verifyForm, documents: clone });
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                          doc.status === "REJECTED"
                                            ? "bg-red-600 border-red-600 text-white"
                                            : "bg-white hover:bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                  <TextField
                                    label="Remarks"
                                    value={doc.remarks}
                                    placeholder="Clerk verification remarks"
                                    onChange={(e) => {
                                      const clone = [...verifyForm.documents];
                                      clone[idx].remarks = e.target.value;
                                      setVerifyForm({ ...verifyForm, documents: clone });
                                    }}
                                    className="h-10 mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <TextField
                            label="Summary Verification Notes"
                            value={verifyForm.verificationNotes}
                            onChange={(e) => setVerifyForm({ ...verifyForm, verificationNotes: e.target.value })}
                          />

                          <div>
                            <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Advance Pipeline To</label>
                            <Select
                              value={verifyForm.nextStatus}
                              onValueChange={(val: any) => setVerifyForm({ ...verifyForm, nextStatus: val })}
                            >
                              <SelectTrigger fullWidth>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeBranch?.hasEntranceTest ? (
                                  <SelectItem value="TEST_SCHEDULED">Move to Entrance Examination</SelectItem>
                                ) : (
                                  <SelectItem value="SHORTLISTED">Direct Shortlist (Approved)</SelectItem>
                                )}
                                <SelectItem value="DOCUMENT_VERIFICATION">Keep in Verification stage</SelectItem>
                                <SelectItem value="REJECTED">Reject Application</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="pt-2 flex justify-end">
                            <Button type="submit" loading={actionLoading} variant="filled" className="bg-primary text-white">
                              Confirm & Save Step 2
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 3 Form: Entrance Examination */}
                  {selectedApp.status === "TEST_SCHEDULED" && activeBranch?.hasEntranceTest && (
                    <Card variant="outlined" className="border-purple-200 bg-white shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2 text-purple-800 font-bold">
                          <Icon name="event" size={20} />
                          <h3>Step 3: Entrance Exam Score Log</h3>
                        </div>
                        <p className="text-xs text-slate-500">Log results and decide whether to shortlist the applicant.</p>

                        <form onSubmit={handleSaveExam} className="space-y-4">
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
                              <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Verdict</label>
                              <Select
                                value={examForm.verdict}
                                onValueChange={(val: any) => setExamForm((prev) => ({ ...prev, verdict: val }))}
                              >
                                <SelectTrigger fullWidth>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">Pending Verdict</SelectItem>
                                  <SelectItem value="PASS">Pass (Approved)</SelectItem>
                                  <SelectItem value="FAIL">Fail</SelectItem>
                                  <SelectItem value="BORDERLINE">Borderline</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Advance Status</label>
                              <Select
                                value={examForm.applicationStatus}
                                onValueChange={(val: any) => setExamForm({ ...examForm, applicationStatus: val })}
                              >
                                <SelectTrigger fullWidth>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TEST_SCHEDULED">Keep in Examination</SelectItem>
                                  <SelectItem value="SHORTLISTED">Promote to Shortlisted</SelectItem>
                                  <SelectItem value="REJECTED">Reject Application</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <TextField
                            label="Notes / Interview Summary"
                            value={examForm.notes}
                            onChange={(e) => setExamForm({ ...examForm, notes: e.target.value })}
                          />

                          <div className="pt-2 flex justify-end">
                            <Button type="submit" loading={actionLoading} variant="filled" className="bg-purple-600 hover:bg-purple-700 text-white">
                              Confirm & Log Marks
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 4 Form: Shortlist & Promote Bridge */}
                  {selectedApp.status === "SHORTLISTED" && (
                    <Card variant="outlined" className="border-teal-200 bg-white shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2 text-teal-800 font-bold">
                          <Icon name="star" size={20} />
                          <h3>Step 4: Promote Candidate to Active Student</h3>
                        </div>
                        <p className="text-xs text-slate-500">
                          Promoting आरव creates their official SIS student profile, user account, and initial enrollment classes.
                        </p>

                        <form onSubmit={handlePromote} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Section Assignment</label>
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

                          <h4 className="font-bold border-b pb-1 text-primary text-xs pt-2">Invoice Fee details</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <TextField
                              label="Discount Percent (%)"
                              type="number"
                              value={String(promoteForm.discountPercent)}
                              onChange={(e) => setPromoteForm({ ...promoteForm, discountPercent: Number(e.target.value) })}
                            />
                            <TextField
                              label="Amount Collected (₹)"
                              type="number"
                              value={String(promoteForm.amountPaid)}
                              onChange={(e) => setPromoteForm({ ...promoteForm, amountPaid: Number(e.target.value) })}
                            />
                          </div>

                          {promoteForm.amountPaid > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Payment Mode</label>
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

                          <div className="pt-2 flex justify-end">
                            <Button type="submit" loading={actionLoading} variant="filled" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              Confirm Promotion & Admit Student
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 5 View: Promoted (Active Student) */}
                  {selectedApp.status === "ADMITTED" && (
                    <Card variant="outlined" className="border-emerald-200 bg-emerald-50/30">
                      <CardContent className="p-6 text-center space-y-4">
                        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Icon name="check_circle" size={32} />
                        </div>
                        <div>
                          <h3 className="text-title-lg font-bold text-emerald-900">Enrolled Successfully!</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {selectedApp.firstName} is now a registered student of Little Champ School.
                          </p>
                        </div>
                        <div className="p-4 bg-white border border-emerald-100 rounded-2xl max-w-sm mx-auto text-left text-xs space-y-1.5 shadow-sm">
                          <p><span className="font-semibold text-slate-500">Student Profile:</span> Active</p>
                          <p><span className="font-semibold text-slate-500">Target Grade Class:</span> {selectedApp.class?.name || "N/A"}</p>
                          <p><span className="font-semibold text-slate-500">Intake Application:</span> {selectedApp.applicationNo}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Rejected State Card */}
                  {selectedApp.status === "REJECTED" && (
                    <Card variant="outlined" className="border-red-200 bg-red-50/20">
                      <CardContent className="p-6 text-center space-y-4">
                        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                          <Icon name="cancel" size={32} />
                        </div>
                        <div>
                          <h3 className="text-title-lg font-bold text-red-900">Application Rejected</h3>
                          <p className="text-xs text-slate-500 mt-1">This application has been declined during processing.</p>
                        </div>
                        {selectedApp.verificationNotes && (
                          <div className="p-3 bg-white border border-red-100 rounded-xl text-left text-xs text-slate-600 max-w-md mx-auto">
                            <span className="font-bold text-red-800 block">Rejection Remarks:</span>
                            {selectedApp.verificationNotes}
                          </div>
                        )}
                        <Button
                          variant="outlined"
                          size="sm"
                          className="border-red-200 text-red-700 bg-white"
                          onClick={async () => {
                            setActionLoading(true);
                            try {
                              const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/verify`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ applicationStatus: "SUBMITTED" }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                snackbar.show("Application reopened.", "success");
                                handleOpenWorkspace(data.data);
                                fetchDashboardData();
                              }
                            } catch {
                              snackbar.show("Error reopening application.", "error");
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                        >
                          Reopen & Reconsider Application
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── INTAKE FORMS MODALS ─────────────────────────────────────────── */}

      {/* A. Inquiry Creation Modal */}
      <Dialog open={inquiryModalOpen} onOpenChange={setInquiryModalOpen}>
        <DialogContent className="max-w-xl">
          <div className="flex justify-between items-start border-b pb-3 mb-4">
            <div>
              <DialogTitle>Register Counselor Inquiry</DialogTitle>
              <DialogDescription>Log walk-in counseling or web inquiry prospect details.</DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => {
                if (classes.length > 0) {
                  setInquiryForm({
                    studentName: "Omkar Ranade",
                    dateOfBirth: "2016-05-14",
                    gender: "MALE",
                    classAppliedId: classes[0].id,
                    parentName: "Vijay Ranade",
                    parentPhone: "9876543211",
                    parentEmail: "vijay.ranade@example.com",
                    source: "WALK_IN",
                    notes: "Looking for immediate admission. Good academic record.",
                  });
                  snackbar.show("Demo inquiry data filled!", "success");
                } else {
                  snackbar.show("No classes found to pre-fill.", "warning");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all shrink-0"
            >
              <Icon name="sparkles" size={14} />
              Autofill
            </button>
          </div>

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
                <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Gender</label>
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
                <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Grade Applied</label>
                <Select
                  value={inquiryForm.classAppliedId}
                  onValueChange={(val) => setInquiryForm({ ...inquiryForm, classAppliedId: val })}
                >
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
              label="Notes"
              value={inquiryForm.notes}
              onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <DialogClose asChild>
                <Button variant="outlined">Cancel</Button>
              </DialogClose>
              <Button type="submit" loading={actionLoading} variant="filled" className="bg-primary text-white">
                Log Inquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* B. Formal Application Submission Modal */}
      <Dialog open={applicationModalOpen} onOpenChange={setApplicationModalOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[85vh]">
          <div className="flex justify-between items-start border-b pb-3 mb-4">
            <div>
              <DialogTitle>Formal Intake Application</DialogTitle>
              <DialogDescription>Submit complete candidate application form data.</DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => {
                if (classes.length > 0) {
                  setAppForm({
                    firstName: "Isha",
                    lastName: "Kulkarni",
                    dateOfBirth: "2015-09-18",
                    gender: "FEMALE",
                    bloodGroup: "A+",
                    address: "Flat 101, Shanti Niketan, Kothrud, Pune",
                    pincode: "411038",
                    emergencyContact: "9822334455",
                    fatherName: "Prasanna Kulkarni",
                    fatherPhone: "9822334455",
                    fatherEmail: "prasanna.k@example.com",
                    fatherOccupation: "Software Engineer",
                    motherName: "Rashmi Kulkarni",
                    motherPhone: "9855667788",
                    motherEmail: "rashmi.k@example.com",
                    motherOccupation: "Doctor",
                    classId: classes[0].id,
                  });
                  snackbar.show("Demo application data filled!", "success");
                } else {
                  snackbar.show("No classes found to pre-fill.", "warning");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all shrink-0"
            >
              <Icon name="sparkles" size={14} />
              Autofill
            </button>
          </div>

          <form onSubmit={handleCreateApplication} className="mt-4 space-y-5">
            <h4 className="font-bold border-b pb-1 text-primary text-xs">1. Applied Grade</h4>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Grade</label>
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

            <h4 className="font-bold border-b pb-1 text-primary text-xs">2. Applicant Details</h4>
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
                <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Gender</label>
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
              label="Emergency Phone"
              value={appForm.emergencyContact}
              onChange={(e) => setAppForm({ ...appForm, emergencyContact: e.target.value })}
              required
            />

            <h4 className="font-bold border-b pb-1 text-primary text-xs">3. Parents Info</h4>
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
              <Button type="submit" loading={actionLoading} variant="filled" className="bg-primary text-white">
                Submit Application
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── C. Counselor Inquiry Workspace Panel ───────────────────────── */}
      <Dialog open={inquiryWorkspaceOpen} onOpenChange={setInquiryWorkspaceOpen}>
        <DialogContent className="max-w-4xl h-[78vh] overflow-hidden flex flex-col p-0 rounded-2xl bg-surface-container-lowest border border-outline-variant">
          {selectedInquiry && (
            <>
              {/* Header Title bar */}
              <div className="p-5 border-b border-outline-variant bg-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-600 text-white">
                      Inquiry Lead
                    </span>
                    <span className="text-xs font-semibold text-slate-400">Current Status:</span>
                    <span className="text-xs font-bold text-slate-700">{selectedInquiry.status}</span>
                  </div>
                  <h2 className="text-title-lg font-bold text-on-surface mt-1">
                    {selectedInquiry.studentName}
                  </h2>
                </div>
                <DialogClose className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 transition-colors mr-10">
                  <Icon name="close" size={20} />
                </DialogClose>
              </div>

              {/* Main Split Body Area */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* A. Left Pane: Inquiry Info */}
                <div className="w-[40%] overflow-y-auto p-5 border-r border-outline-variant space-y-5">
                  <div>
                    <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Inquiry Profile</h3>
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-2 text-xs">
                      <p><span className="font-semibold text-slate-500">Class Applied:</span> {selectedInquiry.classApplied?.name || "N/A"}</p>
                      <p><span className="font-semibold text-slate-500">Date of Birth:</span> {new Date(selectedInquiry.dateOfBirth).toLocaleDateString("en-IN")}</p>
                      <p><span className="font-semibold text-slate-500">Gender:</span> {selectedInquiry.gender}</p>
                      <p><span className="font-semibold text-slate-500">Source:</span> {selectedInquiry.source}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Parent Contact</h3>
                    <div className="p-3.5 bg-slate-50 border rounded-xl space-y-2 text-xs">
                      <p><span className="font-semibold text-slate-500">Parent Name:</span> {selectedInquiry.parentName}</p>
                      <p><span className="font-semibold text-slate-500">Phone Number:</span> {selectedInquiry.parentPhone}</p>
                      <p><span className="font-semibold text-slate-500">Email Address:</span> {selectedInquiry.parentEmail}</p>
                    </div>
                  </div>

                  {selectedInquiry.notes && (
                    <div>
                      <h3 className="text-label-md text-primary font-bold uppercase tracking-wider mb-2">Initial Notes</h3>
                      <div className="p-3.5 bg-amber-50/30 border border-amber-100 rounded-xl text-xs text-slate-600">
                        {selectedInquiry.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* B. Right Pane: Follow-up logs & Form */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Log New Conversation form */}
                    <Card variant="outlined" className="bg-white border-sky-100 shadow-sm shrink-0">
                      <CardContent className="p-4 space-y-4">
                        <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 border-b pb-2">
                          <Icon name="campaign" size={16} className="text-primary" />
                          Log New Conversation
                        </h4>
                        
                        <form onSubmit={handleCreateFollowUp} className="space-y-3">
                          <TextField
                            label="Conversation Notes"
                            value={followUpForm.conversationNotes}
                            onChange={(e) => setFollowUpForm({ ...followUpForm, conversationNotes: e.target.value })}
                            placeholder="Detail your conversation with the parent..."
                            required
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-label-sm text-on-surface-variant mb-1 font-semibold">Status Reached</label>
                              <Select
                                value={followUpForm.statusReached}
                                onValueChange={(val: any) => setFollowUpForm({ ...followUpForm, statusReached: val })}
                              >
                                <SelectTrigger fullWidth>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="INQUIRY">Inquiry</SelectItem>
                                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                                  <SelectItem value="VISITED">Visited</SelectItem>
                                  <SelectItem value="CLOSED">Closed (Archived)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <TextField
                              label="Next Follow-up Date (Optional)"
                              type="date"
                              value={followUpForm.nextFollowUpDate}
                              onChange={(e) => setFollowUpForm({ ...followUpForm, nextFollowUpDate: e.target.value })}
                            />
                          </div>

                          <div className="pt-2 flex justify-end">
                            <Button type="submit" loading={actionLoading} variant="filled" className="bg-primary text-white text-xs py-1.5 px-4">
                              Save Follow-up
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Historical Timeline Logs */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wide">Conversation Log History</h4>
                      {(!selectedInquiry.followUps || selectedInquiry.followUps.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No follow-up conversations logged yet.</p>
                      ) : (
                        <div className="space-y-3.5">
                          {selectedInquiry.followUps.map((log) => (
                            <div key={log.id} className="p-3 bg-white border rounded-xl shadow-xs space-y-1.5 text-xs">
                              <div className="flex items-center justify-between border-b pb-1 text-slate-400">
                                <span className="font-semibold">
                                  Logged: {new Date(log.followUpDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                                  {log.statusReached}
                                </span>
                              </div>
                              <p className="text-slate-700 whitespace-pre-wrap">{log.conversationNotes}</p>
                              {log.nextFollowUpDate && (
                                <p className="text-[10px] text-amber-600 font-semibold">
                                  📅 Scheduled Next Follow-up: {new Date(log.nextFollowUpDate).toLocaleDateString("en-IN")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
