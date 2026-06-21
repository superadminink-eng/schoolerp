"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Icon } from "@/components/ui/icon";
import { PermissionGate } from "@/components/shared/permission-gate";
import { FormSkeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/upload-url";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  rollNo: string | null;
  dateOfBirth: string | null;
  gender: string;
  bloodGroup: string | null;
  photo: string | null;
  address: string | null;
  pincode: string | null;
  previousSchool: string | null;
  emergencyContact1: string | null;
  emergencyContact2: string | null;
  idType: string | null;
  idNumber: string | null;
  idDocument: string | null;
  guardianName: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  admissionDate: string | null;
  status: string;
  house: string | null;
  category: string;
  branch: { id: string; name: string };
  enrollments?: Array<{
    rollNo: string | null;
    section: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  }>;
  totalFees?: number;
  totalFeesPaid?: number;
  pendingFees?: number;
}

const statusColor = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "GRADUATED":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "TRANSFERRED":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "DROPPED":
    case "SUSPENDED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const houseColor = (house: string | null) => {
  if (!house) return "bg-slate-50 text-slate-600 border-slate-200";
  switch (house.toLowerCase()) {
    case "red":
      return "bg-red-50 text-red-700 border-red-200/60";
    case "blue":
      return "bg-blue-50 text-blue-700 border-blue-200/60";
    case "green":
      return "bg-green-50 text-green-700 border-green-200/60";
    case "yellow":
      return "bg-amber-50 text-amber-700 border-amber-200/60";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docIdType, setDocIdType] = useState("");
  const [docIdNumber, setDocIdNumber] = useState("");
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Leaving Certificate Form States
  const [lcModalOpen, setLcModalOpen] = useState(false);
  const [lcLeavingDate, setLcLeavingDate] = useState(new Date().toISOString().split("T")[0]);
  const [lcReason, setLcReason] = useState("Completed Studies");
  const [lcCustomReason, setLcCustomReason] = useState("");
  const [lcConduct, setLcConduct] = useState("Good");
  const [lcRemarks, setLcRemarks] = useState("");
  const [lcSignatoryName, setLcSignatoryName] = useState("");
  const [lcSignatoryTitle, setLcSignatoryTitle] = useState("Principal");
  const [lcStatus, setLcStatus] = useState("TRANSFERRED");
  const [lcSubmitting, setLcSubmitting] = useState(false);
  const [lcDuesWarning, setLcDuesWarning] = useState<number | null>(null);
  const [lcAllowOverride, setLcAllowOverride] = useState(false);

  // Tab data states
  const [academics, setAcademics] = useState<any>(null);
  const [loadingAcademics, setLoadingAcademics] = useState(false);
  
  const [fees, setFees] = useState<any>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  
  const [attendance, setAttendance] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState("");

  const fetchAcademics = async () => {
    setLoadingAcademics(true);
    try {
      const res = await fetch(`/api/v1/students/${params.id}/academics`);
      const data = await res.json();
      if (data.success) {
        setAcademics(data.data);
      }
    } catch {
      snackbar.show("Failed to load academic records", "error");
    } finally {
      setLoadingAcademics(false);
    }
  };

  const fetchFees = async () => {
    setLoadingFees(true);
    try {
      const res = await fetch(`/api/v1/students/${params.id}/fees`);
      const data = await res.json();
      if (data.success) {
        setFees(data.data);
      }
    } catch {
      snackbar.show("Failed to load financial records", "error");
    } finally {
      setLoadingFees(false);
    }
  };

  const fetchAttendance = async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/v1/students/${params.id}/attendance`);
      const data = await res.json();
      if (data.success) {
        setAttendance(data.data);
      }
    } catch {
      snackbar.show("Failed to load attendance records", "error");
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (attendance && Object.keys(attendance.monthlySummary).length > 0) {
      const keys = Object.keys(attendance.monthlySummary);
      setSelectedMonth(keys[0]);
    }
  }, [attendance]);

  const getCalendarDays = () => {
    if (!selectedMonth) return [];
    const [mName, yStr] = selectedMonth.split(" ");
    const year = parseInt(yStr);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIdx = months.indexOf(mName);
    if (monthIdx === -1) return [];

    const firstDayIndex = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: null, dateKey: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ dayNum: day, dateKey });
    }
    return days;
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "PRESENT":
        return "bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]";
      case "ABSENT":
        return "bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse";
      case "LATE":
        return "bg-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)]";
      case "HALF_DAY":
        return "bg-amber-400 text-slate-800";
      case "EXCUSED":
        return "bg-slate-400 text-white";
      default:
        return "bg-slate-50 border border-slate-100 hover:bg-slate-100/50 text-slate-400";
    }
  };

  const handleIssueLc = async (e?: React.FormEvent, forceOverride?: boolean) => {
    if (e) e.preventDefault();
    setLcSubmitting(true);
    try {
      const finalReason = lcReason === "Other" ? lcCustomReason : lcReason;
      const res = await fetch(`/api/v1/students/${params.id}/issue-lc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leavingDate: lcLeavingDate,
          reasonForLeaving: finalReason,
          conduct: lcConduct,
          remarks: lcRemarks,
          signatoryName: lcSignatoryName,
          signatoryTitle: lcSignatoryTitle,
          status: lcStatus,
          allowOverride: forceOverride ?? lcAllowOverride,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Leaving Certificate issued successfully", "success");
        setLcModalOpen(false);
        fetchStudent();
        window.open(`/students/${params.id}/lc/print`, "_blank");
      } else if (data.error?.code === "PENDING_DUES") {
        setLcDuesWarning(data.error.details?.pendingAmount ?? 0);
      } else {
        snackbar.show(data.error?.message ?? "Failed to issue Leaving Certificate", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setLcSubmitting(false);
    }
  };

  const fetchStudent = async () => {
    try {
      const res = await fetch(`/api/v1/students/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setStudent(data.data);
        setDocIdType(data.data.idType || "");
        setDocIdNumber(data.data.idNumber || "");
      } else {
        snackbar.show(data.error?.message ?? "Student not found", "error");
        router.push("/students");
      }
    } catch {
      snackbar.show("Failed to load student profile", "error");
      router.push("/students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [params.id]);

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docIdType || !docIdNumber) {
      snackbar.show("Please enter ID Type and ID Number", "warning");
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("idType", docIdType);
    formData.append("idNumber", docIdNumber);
    if (selectedFile) {
      formData.append("idDocument", selectedFile);
    }

    try {
      const res = await fetch(`/api/v1/students/${params.id}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        snackbar.show("Document updated successfully", "success");
        setSelectedFile(null);
        fetchStudent();
      } else {
        snackbar.show(data.error?.message ?? "Failed to update document", "error");
      }
    } catch {
      snackbar.show("An error occurred during upload", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/students">Students</BreadcrumbItem>
          <BreadcrumbItem>Profile Hub</BreadcrumbItem>
        </Breadcrumb>
        <FormSkeleton />
      </div>
    );
  }

  if (!student) return null;

  const currentEnrollment = student.enrollments?.[0];
  const formattedDob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const formattedAdmissionDate = student.admissionDate
    ? new Date(student.admissionDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <PermissionGate module="students" action="read">
      <div className="p-1 md:p-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/students">Students</BreadcrumbItem>
          <BreadcrumbItem>{`${student.firstName} ${student.lastName}`}</BreadcrumbItem>
        </Breadcrumb>

        {/* Profile Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ─── LEFT COLUMN: QUICK CARD ────────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-0 flex flex-col items-center text-center space-y-4">
                
                {/* Photo / Initials Avatar */}
                <div className="relative w-28 h-28 rounded-full border-2 border-outline-variant/50 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                  {student.photo ? (
                    <img
                      src={getUploadUrl(student.photo)}
                      alt={`${student.firstName} ${student.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-display-sm font-bold text-slate-400 uppercase">
                      {student.firstName[0]}
                      {student.lastName[0]}
                    </span>
                  )}
                </div>

                {/* Name & Admission Number */}
                <div className="space-y-1">
                  <h2 className="text-headline-sm font-black text-on-surface">
                    {student.firstName} {student.lastName}
                  </h2>
                  <p className="text-body-sm text-on-surface-variant font-mono">
                    {student.admissionNo}
                  </p>
                </div>

                {/* Status Dot Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor(student.status)}`}>
                  {student.status}
                </span>

                {/* Secondary details list */}
                <div className="w-full border-t border-outline-variant/40 pt-4 space-y-2.5 text-left text-body-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Class / Grade</span>
                    <span className="font-bold text-on-surface">
                      {currentEnrollment
                        ? `${currentEnrollment.section.class.name} - ${currentEnrollment.section.name}`
                        : "Not Enrolled"}
                    </span>
                  </div>
                  {currentEnrollment?.rollNo && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Roll Number</span>
                      <span className="font-bold text-on-surface font-mono">{currentEnrollment.rollNo}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">House</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${houseColor(student.house)}`}>
                      {student.house || "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Category</span>
                    <span className="font-bold text-on-surface text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {student.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Branch</span>
                    <span className="font-bold text-on-surface text-xs truncate max-w-[150px]">
                      {student.branch.name}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full pt-4 border-t border-outline-variant/40 flex flex-col gap-2">
                  <PermissionGate module="students" action="update">
                    <Button
                      variant="filled"
                      icon="edit"
                      onClick={() => router.push(`/students/${student.id}/edit`)}
                      className="w-full bg-primary text-white"
                    >
                      Edit Profile
                    </Button>
                  </PermissionGate>
                  {student.status === "TRANSFERRED" || student.status === "GRADUATED" ? (
                    <Button
                      variant="filled"
                      icon="print"
                      onClick={() => window.open(`/students/${student.id}/lc/print`, "_blank")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Print LC
                    </Button>
                  ) : (
                    <PermissionGate module="students" action="update">
                      <Button
                        variant="tonal"
                        icon="assignment_turned_in"
                        onClick={() => setLcModalOpen(true)}
                        className="w-full bg-orange-100 text-orange-950 border border-orange-200"
                      >
                        Issue LC/TC
                      </Button>
                    </PermissionGate>
                  )}
                  <Button
                    variant="outlined"
                    icon="info"
                    onClick={() => setIntakeModalOpen(true)}
                    className="w-full bg-white text-on-surface border-outline-variant"
                  >
                    Direct Intake Details
                  </Button>
                  <Button
                    variant="outlined"
                    icon="arrow_back"
                    onClick={() => router.push("/students")}
                    className="w-full bg-white text-on-surface border-outline-variant"
                  >
                    Back to Directory
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT COLUMN: TABBED INFO HUB ──────────────────────────────── */}
          <div className="lg:col-span-8">
            <Tabs
              defaultValue="details"
              className="w-full space-y-6"
              onValueChange={(value) => {
                if (value === "academics" && !academics) fetchAcademics();
                if (value === "fees" && !fees) fetchFees();
                if (value === "attendance" && !attendance) fetchAttendance();
              }}
            >
              
              <TabsList className="bg-slate-100/80 p-1 rounded-2xl border flex flex-wrap gap-1 md:flex-nowrap">
                <TabsTrigger value="details" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all">
                  <Icon name="badge" size={16} />
                  Profile Details
                </TabsTrigger>
                <TabsTrigger value="vault" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all">
                  <Icon name="folder_shared" size={16} />
                  Document Vault
                </TabsTrigger>
                <TabsTrigger value="academics" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all">
                  <Icon name="school" size={16} />
                  Academics
                </TabsTrigger>
                <TabsTrigger value="fees" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all">
                  <Icon name="payments" size={16} />
                  Fees Ledger
                </TabsTrigger>
                <TabsTrigger value="attendance" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all">
                  <Icon name="calendar_month" size={16} />
                  Attendance
                </TabsTrigger>
              </TabsList>

              {/* ──────────────── TAB 1: PROFILE DETAILS ──────────────── */}
              <TabsContent value="details" className="space-y-6 animate-fadeIn">
                
                {/* Personal Information */}
                <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                  <CardContent className="p-0 space-y-4">
                    <h3 className="text-title-md font-bold text-primary border-b pb-2 flex items-center gap-2">
                      <Icon name="person" size={18} />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">First Name</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5">{student.firstName}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Last Name</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5">{student.lastName}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Gender</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5 capitalize">{student.gender.toLowerCase()}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Date of Birth</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5">{formattedDob}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Blood Group</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5">{student.bloodGroup || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Admission Date</div>
                        <div className="text-body-lg font-semibold text-on-surface mt-0.5">{formattedAdmissionDate}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Family Details */}
                <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                  <CardContent className="p-0 space-y-4">
                    <h3 className="text-title-md font-bold text-primary border-b pb-2 flex items-center gap-2">
                      <Icon name="family_history" size={18} />
                      Family Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Father info */}
                      <div className="space-y-3 p-4 bg-slate-50/50 border border-outline-variant/40 rounded-xl">
                        <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                          <Icon name="man" size={16} className="text-slate-500" />
                          Father Details
                        </div>
                        <div className="space-y-2 text-body-sm">
                          <div>
                            <span className="text-on-surface-variant">Name:</span> <strong className="text-on-surface ml-1">{student.fatherName || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Phone:</span> <strong className="text-on-surface ml-1">{student.fatherPhone || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Email:</span> <strong className="text-on-surface ml-1">{student.fatherEmail || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Occupation:</span> <strong className="text-on-surface ml-1">{student.fatherOccupation || "—"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Mother info */}
                      <div className="space-y-3 p-4 bg-slate-50/50 border border-outline-variant/40 rounded-xl">
                        <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                          <Icon name="woman" size={16} className="text-slate-500" />
                          Mother Details
                        </div>
                        <div className="space-y-2 text-body-sm">
                          <div>
                            <span className="text-on-surface-variant">Name:</span> <strong className="text-on-surface ml-1">{student.motherName || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Phone:</span> <strong className="text-on-surface ml-1">{student.motherPhone || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Email:</span> <strong className="text-on-surface ml-1">{student.motherEmail || "—"}</strong>
                          </div>
                          <div>
                            <span className="text-on-surface-variant">Occupation:</span> <strong className="text-on-surface ml-1">{student.motherOccupation || "—"}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact & Address Details */}
                <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                  <CardContent className="p-0 space-y-4">
                    <h3 className="text-title-md font-bold text-primary border-b pb-2 flex items-center gap-2">
                      <Icon name="location_on" size={18} />
                      Contact & Address Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Residential Address</div>
                        <div className="text-body-md font-semibold text-on-surface mt-0.5 leading-relaxed">{student.address || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Pincode</div>
                        <div className="text-body-md font-semibold text-on-surface mt-0.5">{student.pincode || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Emergency Contact 1</div>
                        <div className="text-body-md font-semibold text-on-surface mt-0.5 text-error">{student.emergencyContact1 || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Emergency Contact 2</div>
                        <div className="text-body-md font-semibold text-on-surface mt-0.5">{student.emergencyContact2 || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface-variant/70 uppercase">Previous School</div>
                        <div className="text-body-md font-semibold text-on-surface mt-0.5">{student.previousSchool || "—"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </TabsContent>

              {/* ──────────────── TAB 2: DOCUMENT VAULT ────────────────── */}
              <TabsContent value="vault" className="space-y-6 animate-fadeIn">
                
                <Card className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                  <CardContent className="p-0 space-y-5">
                    <h3 className="text-title-md font-bold text-primary border-b pb-2 flex items-center gap-2">
                      <Icon name="shield" size={18} />
                      Identity Verification Vault
                    </h3>

                    {/* Active Verification Status */}
                    <div className="p-4 bg-slate-50 border border-outline-variant/40 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex gap-3 items-start">
                        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                          <Icon name="description" size={24} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface">Primary ID Verification Record</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {student.idType ? `${student.idType} Card: ${student.idNumber}` : "No verification documents registered."}
                          </div>
                        </div>
                      </div>

                      {/* Download link */}
                      {student.idDocument ? (
                        <a
                          href={getUploadUrl(student.idDocument)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-bold text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-all cursor-pointer self-start md:self-auto"
                        >
                          <Icon name="download" size={16} />
                          Download Attachment
                        </a>
                      ) : (
                        <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <Icon name="error" size={14} />
                          Attachment Missing
                        </span>
                      )}
                    </div>

                    {/* Form to upload / update identity file */}
                    <form onSubmit={handleDocUpload} className="border-t border-outline-variant/40 pt-5 space-y-4">
                      <h4 className="font-bold text-sm text-on-surface">Update Verification Attachment</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ID Document Type</label>
                          <select
                            value={docIdType}
                            onChange={(e) => setDocIdType(e.target.value)}
                            required
                            className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                          >
                            <option value="">Select ID Type</option>
                            <option value="Aadhaar">Aadhaar Card</option>
                            <option value="PAN Card">PAN Card</option>
                            <option value="Passport">Passport</option>
                            <option value="Birth Certificate">Birth Certificate</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ID Number</label>
                          <input
                            type="text"
                            value={docIdNumber}
                            onChange={(e) => setDocIdNumber(e.target.value)}
                            placeholder="Enter Document number"
                            required
                            className="w-full h-[46px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                          />
                        </div>
                      </div>

                      {/* File select drop area */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Attachment File</label>
                        <div className="border border-dashed border-outline-variant rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition-colors">
                          <Icon name="cloud_upload" size={32} className="text-slate-400" />
                          <div className="text-body-sm text-on-surface-variant font-semibold mt-2">
                            {selectedFile ? selectedFile.name : "Select or drag new PDF/image file"}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Accepts images and PDF files up to 5MB</p>
                          <input
                            type="file"
                            onChange={(e) => {
                              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          variant="filled"
                          icon="check"
                          loading={uploadingDoc}
                          className="bg-primary text-white"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </form>

                  </CardContent>
                </Card>

              </TabsContent>

              {/* ──────────────── TAB 3: ACADEMICS LEDGER ──────────────── */}
              <TabsContent value="academics" className="space-y-6 animate-fadeIn">
                {loadingAcademics ? (
                  <div className="p-12 text-center text-on-surface-variant">
                    <Icon name="progress_activity" className="animate-spin text-primary" size={32} />
                    <p className="text-body-sm mt-2 font-medium">Loading report card...</p>
                  </div>
                ) : !academics || academics.exams.length === 0 ? (
                  <Card className="border border-outline-variant/60 bg-surface-container-lowest p-12 rounded-2xl text-center">
                    <CardContent className="p-0 flex flex-col items-center max-w-sm mx-auto space-y-4">
                       <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl">
                        <Icon name="school" size={40} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-title-md font-bold text-on-surface">No Academic Records</h3>
                        <p className="text-body-sm text-on-surface-variant font-medium">No Academic Records Found</p>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        No examination marks have been recorded for this student yet.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                          <Icon name="analytics" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Average Score</div>
                          <div className="text-title-lg font-black text-on-surface mt-0.5">{academics.averageScore}%</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                          <Icon name="verified" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Passing Rate</div>
                          <div className="text-title-lg font-black text-on-surface mt-0.5">{academics.passRate}%</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                          <Icon name="assignment" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Exams</div>
                          <div className="text-title-lg font-black text-on-surface mt-0.5">{academics.totalExams}</div>
                        </div>
                      </div>
                    </div>

                    {/* Exams List */}
                    {academics.exams.map((ex: any) => (
                      <Card key={ex.examId} className="border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-3">
                          <div className="space-y-1">
                            <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2">
                              <Icon name="assignment" size={18} className="text-slate-500" />
                              {ex.examName}
                            </h3>
                            <p className="text-xs text-on-surface-variant font-mono">
                              {new Date(ex.startDate).toLocaleDateString("en-IN")} - {new Date(ex.endDate).toLocaleDateString("en-IN")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {ex.examType}
                            </span>
                            <Button
                              variant="outlined"
                              icon="print"
                              size="sm"
                              className="bg-white text-xs py-1 h-[32px] px-3 rounded-lg border-outline-variant"
                              onClick={() => {
                                window.print();
                              }}
                            >
                              Print
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-body-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-outline-variant/40 text-on-surface-variant/80 font-bold text-xs uppercase tracking-wider bg-slate-50/60">
                                <th className="py-2.5 px-3">Subject</th>
                                <th className="py-2.5 px-3">Marks Obtained</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Grade</th>
                                <th className="py-2.5 px-3">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ex.subjects.map((sub: any, idx: number) => {
                                const percentage = sub.maxMarks > 0 ? ((sub.marksObtained ?? 0) / sub.maxMarks) * 100 : 0;
                                return (
                                  <tr key={idx} className="border-b border-outline-variant/20 hover:bg-slate-50/30 transition-colors">
                                    <td className="py-3 px-3">
                                      <div className="font-semibold text-on-surface">{sub.subjectName}</div>
                                      <div className="text-[10px] text-on-surface-variant font-mono uppercase mt-0.5">{sub.subjectCode}</div>
                                    </td>
                                    <td className="py-3 px-3">
                                      {sub.isAbsent ? (
                                        <span className="font-semibold text-slate-400">Absent</span>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-on-surface">
                                            {sub.marksObtained} <span className="text-on-surface-variant font-normal">/ {sub.maxMarks}</span>
                                          </div>
                                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${sub.status === "PASS" ? "bg-emerald-500" : "bg-rose-500"}`}
                                              style={{ width: `${Math.min(percentage, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        sub.status === "PASS"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : sub.status === "ABSENT"
                                          ? "bg-slate-100 text-slate-600 border border-slate-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200"
                                      }`}>
                                        {sub.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 font-semibold text-on-surface font-mono">{sub.grade || "—"}</td>
                                    <td className="py-3 px-3 text-on-surface-variant italic text-xs max-w-[150px] truncate" title={sub.remarks || ""}>
                                      {sub.remarks || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ──────────────── TAB 4: FEES LEDGER ──────────────── */}
              <TabsContent value="fees" className="space-y-6 animate-fadeIn">
                {loadingFees ? (
                  <div className="p-12 text-center text-on-surface-variant">
                    <Icon name="progress_activity" className="animate-spin text-primary" size={32} />
                    <p className="text-body-sm mt-2 font-medium">Loading financial records...</p>
                  </div>
                ) : !fees ? (
                  <div className="text-center p-6 text-on-surface-variant">Failed to load financial records.</div>
                ) : (
                  <div className="space-y-6">
                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                          <Icon name="account_balance_wallet" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Billed</div>
                          <div className="text-title-lg font-black text-on-surface mt-0.5">₹{fees.totalBilled.toLocaleString("en-IN")}</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                          <Icon name="payments" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Paid</div>
                          <div className="text-title-lg font-black text-on-surface mt-0.5">₹{fees.totalPaid.toLocaleString("en-IN")}</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                          <Icon name="pending_actions" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Remaining Dues</div>
                          <div className={`text-title-lg font-black mt-0.5 ${fees.totalPending > 0 ? "text-rose-600 animate-pulse" : "text-on-surface"}`}>
                            ₹{fees.totalPending.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Invoices List */}
                      <div className="lg:col-span-7 space-y-4">
                        <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2 pl-1">
                          <Icon name="receipt" size={18} className="text-slate-500" />
                          Fee Invoices
                        </h3>

                        {fees.invoices.length === 0 ? (
                          <div className="text-center p-8 bg-slate-50 border border-dashed rounded-xl text-on-surface-variant text-xs">
                            No invoices found.
                          </div>
                        ) : (
                          fees.invoices.map((inv: any) => (
                            <Card key={inv.id} className="border border-outline-variant/50 bg-surface-container-lowest p-4.5 rounded-xl shadow-none">
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                  <div className="font-mono text-sm font-bold text-on-surface">{inv.number}</div>
                                  <div className="text-xs text-slate-400">
                                    Due Date: {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  inv.status === "PAID"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : inv.status === "PARTIAL"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {inv.status}
                                </span>
                              </div>

                              <div className="mt-3.5 pt-3.5 border-t border-dashed border-outline-variant/30 space-y-1.5 text-xs text-on-surface-variant">
                                {inv.items.map((item: any) => (
                                  <div key={item.id} className="flex justify-between">
                                    <span>{item.description}</span>
                                    <strong className="font-semibold text-on-surface">₹{item.amount.toLocaleString("en-IN")}</strong>
                                  </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t border-outline-variant/30 text-body-sm font-bold mt-2 text-on-surface">
                                  <span>Total Amount</span>
                                  <span>₹{inv.totalAmount.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 font-semibold">
                                  <span>Paid</span>
                                  <span>₹{inv.paidAmount.toLocaleString("en-IN")}</span>
                                </div>
                                {inv.balanceAmount > 0 && (
                                  <div className="flex justify-between text-rose-600 font-semibold">
                                    <span>Remaining</span>
                                    <span>₹{inv.balanceAmount.toLocaleString("en-IN")}</span>
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))
                        )}
                      </div>

                      {/* Payment Receipts List */}
                      <div className="lg:col-span-5 space-y-4">
                        <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2 pl-1">
                          <Icon name="history" size={18} className="text-slate-500" />
                          Payment Receipts
                        </h3>

                        {fees.payments.length === 0 ? (
                          <div className="text-center p-8 bg-slate-50 border border-dashed rounded-xl text-on-surface-variant text-xs">
                            No payment transactions recorded.
                          </div>
                        ) : (
                          fees.payments.map((pm: any) => (
                            <div key={pm.id} className="p-4 bg-slate-50/50 border border-outline-variant/30 rounded-xl space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="font-bold font-mono text-on-surface">{pm.receiptNo || "Receipt"}</span>
                                <strong className="text-emerald-600 font-bold">₹{pm.amount.toLocaleString("en-IN")}</strong>
                              </div>
                              <div className="text-[11px] text-on-surface-variant leading-relaxed">
                                <div>Method: <strong>{pm.method}</strong></div>
                                {pm.transactionId && <div>Txn ID: <strong className="font-mono">{pm.transactionId}</strong></div>}
                                <div>Invoice: <strong className="font-mono">{pm.invoiceNumber}</strong></div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Date: {new Date(pm.paidAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ──────────────── TAB 5: ATTENDANCE TRACKER ──────────────── */}
              <TabsContent value="attendance" className="space-y-6 animate-fadeIn">
                {loadingAttendance ? (
                  <div className="p-12 text-center text-on-surface-variant">
                    <Icon name="progress_activity" className="animate-spin text-primary" size={32} />
                    <p className="text-body-sm mt-2 font-medium">Loading attendance records...</p>
                  </div>
                ) : !attendance ? (
                  <div className="text-center p-6 text-on-surface-variant">Failed to load attendance records.</div>
                ) : (
                  <div className="space-y-6">
                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                          <Icon name="percent" size={18} />
                        </div>
                        <div>
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Attendance Rate</div>
                          <div className="text-title-md font-black text-on-surface mt-0.5">{attendance.attendanceRate}%</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                          <Icon name="done" size={18} />
                        </div>
                        <div>
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Present Days</div>
                          <div className="text-title-md font-black text-on-surface mt-0.5">{attendance.presentDays}</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                          <Icon name="close" size={18} />
                        </div>
                        <div>
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Absent Days</div>
                          <div className="text-title-md font-black text-on-surface mt-0.5">{attendance.absentDays}</div>
                        </div>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                          <Icon name="info" size={18} />
                        </div>
                        <div>
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Total Classes</div>
                          <div className="text-title-md font-black text-on-surface mt-0.5">{attendance.totalClasses}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Calendar Visualizer Card */}
                      <Card className="md:col-span-8 border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                        <div className="p-0 space-y-5">
                          {/* Calendar Header with Switcher */}
                          <div className="flex justify-between items-center gap-4 border-b border-outline-variant/30 pb-3">
                            <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2">
                              <Icon name="calendar_month" size={18} className="text-slate-500" />
                              Monthly Attendance Calendar
                            </h3>

                            {Object.keys(attendance.monthlySummary).length > 0 && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={
                                    Object.keys(attendance.monthlySummary).indexOf(selectedMonth) ===
                                    Object.keys(attendance.monthlySummary).length - 1
                                  }
                                  onClick={() => {
                                    const keys = Object.keys(attendance.monthlySummary);
                                    const idx = keys.indexOf(selectedMonth);
                                    if (idx < keys.length - 1) setSelectedMonth(keys[idx + 1]);
                                  }}
                                  className="p-1.5 rounded-lg border border-outline-variant hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                                >
                                  <Icon name="chevron_left" size={16} />
                                </button>
                                <span className="text-xs font-bold text-slate-700 min-w-[90px] text-center">
                                  {selectedMonth}
                                </span>
                                <button
                                  type="button"
                                  disabled={Object.keys(attendance.monthlySummary).indexOf(selectedMonth) === 0}
                                  onClick={() => {
                                    const keys = Object.keys(attendance.monthlySummary);
                                    const idx = keys.indexOf(selectedMonth);
                                    if (idx > 0) setSelectedMonth(keys[idx - 1]);
                                  }}
                                  className="p-1.5 rounded-lg border border-outline-variant hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                                >
                                  <Icon name="chevron_right" size={16} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Calendar Grid */}
                          {!selectedMonth ? (
                            <div className="text-center p-8 text-slate-400">No months available</div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                <div>Sun</div>
                                <div>Mon</div>
                                <div>Tue</div>
                                <div>Wed</div>
                                <div>Thu</div>
                                <div>Fri</div>
                                <div>Sat</div>
                              </div>
                              <div className="grid grid-cols-7 gap-2">
                                {(() => {
                                  const historyMap = new Map<string, string | undefined>(
                                    attendance.history.map((att: any) => [
                                      new Date(att.date).toISOString().split("T")[0],
                                      att.status,
                                    ])
                                  );

                                  return getCalendarDays().map((cell: any, idx: number) => {
                                    if (cell.dayNum === null) {
                                      return <div key={idx} className="aspect-square bg-slate-50/20 rounded-lg" />;
                                    }
                                    const status = historyMap.get(cell.dateKey);
                                    return (
                                      <div
                                        key={idx}
                                        className={cn(
                                          "aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-sm transition-all relative group cursor-pointer",
                                          getStatusColor(status)
                                        )}
                                        title={status ? `${cell.dateKey}: ${status}` : undefined}
                                      >
                                        {cell.dayNum}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>

                              {/* Calendar Legend */}
                              <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-outline-variant/30 text-[10px] font-bold text-on-surface-variant/80 uppercase">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Excused
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Summary Table Card */}
                      <Card className="md:col-span-4 border border-outline-variant/60 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
                        <div className="p-0 space-y-4">
                          <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                            <Icon name="summarize" size={18} className="text-slate-500" />
                            Monthly Summary
                          </h3>
                          <div className="space-y-3">
                            {Object.entries(attendance.monthlySummary).map(([month, stats]: [string, any]) => (
                              <div key={month} className="p-3 bg-slate-50/50 border border-outline-variant/20 rounded-xl space-y-1.5 text-xs">
                                <div className="flex justify-between font-bold text-on-surface">
                                  <span>{month}</span>
                                  <span className="text-primary">{stats.rate}%</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 leading-none">
                                  <div>Present: <strong>{stats.present}</strong></div>
                                  <div>Absent: <strong>{stats.absent}</strong></div>
                                  <div>Total: <strong>{stats.total}</strong></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </div>

        </div>

        {/* Direct Intake Details Dialog */}
        <Dialog open={intakeModalOpen} onOpenChange={setIntakeModalOpen}>
          <DialogContent className="max-w-md bg-surface-container-lowest border border-outline-variant/60 p-6 rounded-2xl shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <Icon name="info" size={24} className="text-primary" />
                <DialogTitle className="text-title-lg font-bold text-on-surface">
                  Direct Intake Details
                </DialogTitle>
              </div>
              
              <DialogDescription className="text-body-sm text-on-surface-variant leading-relaxed">
                This student was admitted via Direct Intake or legacy data migration.
              </DialogDescription>

              <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 flex gap-3 text-amber-800 text-xs">
                <Icon name="warning" size={16} className="text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">Migration Note</p>
                  <p className="text-[11px] text-amber-700/90 mt-0.5">
                    This record was imported directly via data migration, bypassing regular admission workflows.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-outline-variant/30 text-body-sm">
                <div>
                  <span className="text-on-surface-variant block text-xs font-medium uppercase tracking-wider">Admission No</span>
                  <strong className="text-on-surface font-mono">{student.admissionNo}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-xs font-medium uppercase tracking-wider">Admission Date</span>
                  <strong className="text-on-surface">{formattedAdmissionDate}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-xs font-medium uppercase tracking-wider">Category</span>
                  <strong className="text-on-surface">{student.category}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-xs font-medium uppercase tracking-wider">House</span>
                  <strong className="text-on-surface">{student.house || "None"}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-on-surface-variant block text-xs font-medium uppercase tracking-wider">Previous School</span>
                  <strong className="text-on-surface leading-normal">{student.previousSchool || "—"}</strong>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="tonal"
                  onClick={() => setIntakeModalOpen(false)}
                  className="bg-slate-100 text-on-surface px-6 py-2.5 rounded-xl text-xs font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Issue Leaving Certificate Dialog */}
        <Dialog open={lcModalOpen} onOpenChange={(open) => {
          setLcModalOpen(open);
          if (!open) {
            setLcDuesWarning(null);
            setLcAllowOverride(false);
          }
        }}>
          <DialogContent className="max-w-md bg-surface-container-lowest border border-outline-variant/60 p-6 rounded-2xl shadow-lg">
            <form onSubmit={handleIssueLc} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/40">
                <Icon name="assignment_turned_in" size={24} className="text-orange-600" />
                <DialogTitle className="text-title-lg font-bold text-on-surface">
                  Issue Leaving Certificate (LC/TC)
                </DialogTitle>
              </div>

              {lcDuesWarning !== null ? (
                <div className="space-y-4">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-800 text-xs">
                    <Icon name="warning" size={20} className="text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold">Outstanding Dues Warning</p>
                      <p className="text-[11px] text-rose-700/90 mt-1">
                        This student has outstanding dues of <strong>₹{lcDuesWarning.toLocaleString("en-IN")}</strong>.
                      </p>
                      <p className="text-[11px] text-rose-700/90 mt-1">
                        Are you sure you want to issue the certificate anyway?
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="tonal"
                      onClick={() => {
                        setLcDuesWarning(null);
                        setLcAllowOverride(false);
                      }}
                      className="bg-slate-100 text-on-surface"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="filled"
                      onClick={() => {
                        setLcAllowOverride(true);
                        handleIssueLc(undefined, true);
                      }}
                      className="bg-rose-600 text-white"
                    >
                      Proceed Anyway
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Leaving Date</label>
                      <input
                        type="date"
                        value={lcLeavingDate}
                        onChange={(e) => setLcLeavingDate(e.target.value)}
                        required
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Status</label>
                      <select
                        value={lcStatus}
                        onChange={(e) => setLcStatus(e.target.value)}
                        required
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      >
                        <option value="TRANSFERRED">TRANSFERRED</option>
                        <option value="GRADUATED">GRADUATED</option>
                        <option value="DROPPED">DROPPED</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reason for Leaving</label>
                    <select
                      value={lcReason}
                      onChange={(e) => setLcReason(e.target.value)}
                      required
                      className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    >
                      <option value="Completed Studies">Completed Studies</option>
                      <option value="Transferred to another school">Transferred to another school</option>
                      <option value="Parents relocated">Parents relocated</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {lcReason === "Other" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Custom Reason</label>
                      <input
                        type="text"
                        value={lcCustomReason}
                        onChange={(e) => setLcCustomReason(e.target.value)}
                        required
                        placeholder="e.g. Family Relocation"
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Conduct</label>
                      <select
                        value={lcConduct}
                        onChange={(e) => setLcConduct(e.target.value)}
                        required
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Poor">Poor</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Signatory Title</label>
                      <input
                        type="text"
                        value={lcSignatoryTitle}
                        onChange={(e) => setLcSignatoryTitle(e.target.value)}
                        required
                        className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Signatory Name</label>
                    <input
                      type="text"
                      value={lcSignatoryName}
                      onChange={(e) => setLcSignatoryName(e.target.value)}
                      placeholder="e.g. Principal Name"
                      className="w-full h-[40px] rounded-xl border border-outline px-3 text-body-md outline-none focus:border-primary bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Remarks</label>
                    <textarea
                      value={lcRemarks}
                      onChange={(e) => setLcRemarks(e.target.value)}
                      rows={2}
                      placeholder="Write any comments..."
                      className="w-full rounded-xl border border-outline p-3 text-body-md outline-none focus:border-primary bg-white transition-colors resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button
                      type="button"
                      variant="tonal"
                      onClick={() => setLcModalOpen(false)}
                      className="bg-slate-100 text-on-surface px-5 py-2 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      id="lc-submit-btn"
                      variant="filled"
                      loading={lcSubmitting}
                      className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-bold"
                    >
                      Issue LC
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </PermissionGate>
  );
}
