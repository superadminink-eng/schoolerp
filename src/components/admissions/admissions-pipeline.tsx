"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

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
}

interface PipelineProps {
  filteredApplications: Application[];
  filteredInquiries: Inquiry[];
  hasInqAccess: boolean;
  canVerifyDocs: boolean;
  hasAppAccess: boolean;
  onOpenWorkspace: (app: Application) => void;
  onOpenInquiryWorkspace: (inq: Inquiry) => void;
  onVerifyDocsClick: (app: Application) => void;
  onScoreExamClick: (app: Application) => void;
  onPromoteClick: (app: Application) => void;
  setAppForm: (val: any) => void;
  setApplicationModalOpen: (val: boolean) => void;
}

export default function AdmissionsPipeline({
  filteredApplications,
  filteredInquiries,
  hasInqAccess,
  canVerifyDocs,
  hasAppAccess,
  onOpenWorkspace,
  onOpenInquiryWorkspace,
  onVerifyDocsClick,
  onScoreExamClick,
  onPromoteClick,
  setAppForm,
  setApplicationModalOpen,
}: PipelineProps) {
  // Group applications by status columns
  const submittedApps = filteredApplications.filter((a) => a.status === "SUBMITTED");
  const docCheckApps = filteredApplications.filter((a) => a.status === "DOCUMENT_VERIFICATION");
  const examApps = filteredApplications.filter((a) => a.status === "TEST_SCHEDULED");
  const shortlistedApps = filteredApplications.filter((a) => a.status === "SHORTLISTED");

  // Columns data structure
  const columns = [
    {
      id: "inquiries",
      title: "1. Inquiry Logs",
      count: filteredInquiries.length,
      icon: "group_add",
      colorClass: "border-t-sky-400 bg-sky-500/5 text-sky-500",
      visible: hasInqAccess,
      renderCards: () =>
        filteredInquiries.map((inq) => (
          <div
            key={inq.id}
            onClick={() => onOpenInquiryWorkspace(inq)}
            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 hover:border-sky-300 hover:shadow-md transition-all duration-300 cursor-pointer space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-100/40">
                INQUIRY
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {new Date(inq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-primary transition-colors">
                {inq.studentName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">{inq.classApplied?.name || "N/A"}</p>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 border-t border-slate-50 dark:border-zinc-800 pt-2 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Icon name="person" size={12} className="text-slate-400" />
                <span>{inq.parentName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="phone" size={12} className="text-slate-400" />
                <span>{inq.parentPhone}</span>
              </div>
            </div>
            {inq.status !== "APPLIED" && canVerifyDocs && (
              <Button
                variant="outlined"
                size="sm"
                fullWidth
                icon="app_registration"
                className="mt-2 text-primary border-primary/20 hover:bg-primary hover:text-white transition-colors duration-300 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setAppForm({
                    inquiryId: inq.id,
                    firstName: inq.studentName.split(" ")[0] || "",
                    lastName: inq.studentName.split(" ").slice(1).join(" ") || "",
                    dateOfBirth: inq.dateOfBirth ? inq.dateOfBirth.split("T")[0] : "",
                    gender: inq.gender || "MALE",
                    bloodGroup: "",
                    address: "",
                    pincode: "",
                    emergencyContact: "",
                    fatherName: inq.parentName,
                    fatherPhone: inq.parentPhone,
                    fatherEmail: inq.parentEmail,
                    fatherOccupation: "",
                    motherName: "",
                    motherPhone: "",
                    motherEmail: "",
                    motherOccupation: "",
                    classId: inq.classApplied?.id || "",
                  });
                  setApplicationModalOpen(true);
                }}
              >
                Register App
              </Button>
            )}
          </div>
        )),
    },
    {
      id: "submitted",
      title: "2. Intake",
      count: submittedApps.length,
      icon: "app_registration",
      colorClass: "border-t-blue-400 bg-blue-500/5 text-blue-500",
      visible: hasAppAccess,
      renderCards: () =>
        submittedApps.map((app) => (
          <div
            key={app.id}
            onClick={() => onOpenWorkspace(app)}
            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 hover:border-blue-300 hover:shadow-md transition-all duration-300 cursor-pointer space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100/40">
                {app.applicationNo}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{app.class?.name || "N/A"}</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-primary transition-colors">
                {app.firstName} {app.lastName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Parent: {app.fatherName || "—"}</p>
            </div>
            <Button
              variant="outlined"
              size="sm"
              fullWidth
              icon="check_circle"
              className="mt-2 text-blue-600 border-blue-500/20 hover:bg-blue-600 hover:text-white transition-colors duration-300 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                onVerifyDocsClick(app);
              }}
            >
              Verify Docs
            </Button>
          </div>
        )),
    },
    {
      id: "doc_check",
      title: "3. Doc Review",
      count: docCheckApps.length,
      icon: "check_circle",
      colorClass: "border-t-amber-400 bg-amber-500/5 text-amber-500",
      visible: hasAppAccess,
      renderCards: () =>
        docCheckApps.map((app) => (
          <div
            key={app.id}
            onClick={() => onOpenWorkspace(app)}
            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 hover:border-amber-300 hover:shadow-md transition-all duration-300 cursor-pointer space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100/40">
                {app.applicationNo}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{app.class?.name || "N/A"}</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-primary transition-colors">
                {app.firstName} {app.lastName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Parent: {app.fatherName || "—"}</p>
            </div>
            <Button
              variant="outlined"
              size="sm"
              fullWidth
              icon="check_circle"
              className="mt-2 text-amber-600 border-amber-500/20 hover:bg-amber-600 hover:text-white transition-colors duration-300 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                onVerifyDocsClick(app);
              }}
            >
              Complete Check
            </Button>
          </div>
        )),
    },
    {
      id: "exam",
      title: "4. Entrance Test",
      count: examApps.length,
      icon: "event",
      colorClass: "border-t-purple-400 bg-purple-500/5 text-purple-500",
      visible: hasAppAccess,
      renderCards: () =>
        examApps.map((app) => (
          <div
            key={app.id}
            onClick={() => onOpenWorkspace(app)}
            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 hover:border-purple-300 hover:shadow-md transition-all duration-300 cursor-pointer space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100/40">
                {app.applicationNo}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{app.class?.name || "N/A"}</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-primary transition-colors">
                {app.firstName} {app.lastName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Parent: {app.fatherName || "—"}</p>
            </div>
            <Button
              variant="outlined"
              size="sm"
              fullWidth
              icon="edit"
              className="mt-2 text-purple-600 border-purple-500/20 hover:bg-purple-600 hover:text-white transition-colors duration-300 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                onScoreExamClick(app);
              }}
            >
              Grade Test
            </Button>
          </div>
        )),
    },
    {
      id: "registrar",
      title: "5. Enrollment",
      count: shortlistedApps.length,
      icon: "star",
      colorClass: "border-t-teal-400 bg-teal-500/5 text-teal-500",
      visible: hasAppAccess,
      renderCards: () =>
        shortlistedApps.map((app) => (
          <div
            key={app.id}
            onClick={() => onOpenWorkspace(app)}
            className="group relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 hover:border-teal-300 hover:shadow-md transition-all duration-300 cursor-pointer space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-100/40">
                {app.applicationNo}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{app.class?.name || "N/A"}</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-primary transition-colors">
                {app.firstName} {app.lastName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Parent: {app.fatherName || "—"}</p>
            </div>
            <Button
              variant="outlined"
              size="sm"
              fullWidth
              icon="school"
              className="mt-2 text-teal-600 border-teal-500/20 hover:bg-teal-600 hover:text-white transition-colors duration-300 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                onPromoteClick(app);
              }}
            >
              Promote Student
            </Button>
          </div>
        )),
    },
  ];

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 select-none min-h-[500px]">
      {columns
        .filter((col) => col.visible)
        .map((col) => (
          <div
            key={col.id}
            className="flex flex-col w-[260px] md:w-[290px] shrink-0 h-full bg-slate-50/70 dark:bg-zinc-900/10 border border-slate-100/80 dark:border-zinc-800/20 rounded-[28px] overflow-hidden"
          >
            {/* Column Header */}
            <div
              className={`p-4 border-t-4 ${col.colorClass} border-b border-slate-100/60 dark:border-zinc-800/40 flex items-center justify-between shrink-0`}
            >
              <div className="flex items-center gap-2">
                <Icon name={col.icon} size={18} />
                <h3 className="font-bold text-xs text-slate-800 dark:text-zinc-200">{col.title}</h3>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {col.count}
              </span>
            </div>

            {/* Column Body / Cards List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {col.count === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-slate-300 dark:text-zinc-700">
                  <Icon name={col.icon} size={28} className="opacity-40" />
                  <p className="text-[10px] font-bold mt-1.5 uppercase tracking-wider opacity-60">Column Empty</p>
                </div>
              ) : (
                col.renderCards()
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
