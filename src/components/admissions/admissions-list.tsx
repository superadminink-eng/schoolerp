"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface ClassItem {
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

interface ListProps {
  activeTab: "applications" | "inquiries";
  filteredApplications: Application[];
  filteredInquiries: Inquiry[];
  statusLabels: Record<string, string>;
  isDatabaseEmpty: boolean;
  hasInqAccess: boolean;
  canVerifyDocs: boolean;
  onOpenWorkspace: (app: Application) => void;
  onOpenInquiryWorkspace: (inq: Inquiry) => void;
  onResetFilters: () => void;
  setAppForm: (val: any) => void;
  setApplicationModalOpen: (val: boolean) => void;
}

export default function AdmissionsList({
  activeTab,
  filteredApplications,
  filteredInquiries,
  statusLabels,
  isDatabaseEmpty,
  hasInqAccess,
  canVerifyDocs,
  onOpenWorkspace,
  onOpenInquiryWorkspace,
  onResetFilters,
  setAppForm,
  setApplicationModalOpen,
}: ListProps) {
  if (activeTab === "applications") {
    return (
      <div className="h-full overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 rounded-3xl p-6 shadow-sm">
        {filteredApplications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
            <Icon name="search_off" size={48} className="text-slate-300 dark:text-zinc-700" />
            <div className="text-center">
              <p className="text-base font-bold text-slate-600 dark:text-zinc-300">
                No candidates match active filters.
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Try resetting search query, changing grade filter or clearing the active stage.
              </p>
            </div>
            <Button
              variant="outlined"
              size="sm"
              icon="rotate_ccw"
              className="text-primary border-primary/30 mt-2"
              onClick={onResetFilters}
            >
              Clear Search & Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="py-4 px-4">Application ID</th>
                  <th className="py-4 px-4">Candidate Name</th>
                  <th className="py-4 px-4">Target Class</th>
                  <th className="py-4 px-4">Active Stage</th>
                  <th className="py-4 px-4">Docs Verified</th>
                  <th className="py-4 px-4">Entrance Exam</th>
                  <th className="py-4 px-4 text-right">Action</th>
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
                      onClick={() => onOpenWorkspace(app)}
                      className="border-b border-slate-100/60 dark:border-zinc-800/40 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 font-bold text-primary dark:text-sky-400 text-sm">
                        {app.applicationNo}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">
                          {app.firstName} {app.lastName}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          Parent: {app.fatherName || app.motherName || "—"}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-100 dark:border-zinc-800">
                          {app.class?.name || "N/A"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            app.status === "ADMITTED"
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/40"
                              : app.status === "SHORTLISTED"
                              ? "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-950/40"
                              : app.status === "TEST_SCHEDULED"
                              ? "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-950/40"
                              : app.status === "DOCUMENT_VERIFICATION"
                              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-950/40"
                              : "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-950/40"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              app.status === "ADMITTED"
                                ? "bg-emerald-500"
                                : app.status === "SHORTLISTED"
                                ? "bg-teal-500"
                                : app.status === "TEST_SCHEDULED"
                                ? "bg-purple-500"
                                : app.status === "DOCUMENT_VERIFICATION"
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                          {statusLabels[app.status] || app.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        {totalDocs > 0 ? (
                          <span className={verifiedDocsCount === totalDocs ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
                            {verifiedDocsCount}/{totalDocs} verified
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-600 font-normal">Empty checklist</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {app.examResult ? (
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold ${
                              app.examResult.verdict === "PASS"
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/40"
                                : app.examResult.verdict === "FAIL"
                                ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-950/40"
                                : "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-950/40"
                            }`}
                          >
                            {app.examResult.marksObtained !== null
                              ? `${app.examResult.marksObtained}/${app.examResult.maxMarks} Marks`
                              : "Scheduled"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="outlined"
                          size="sm"
                          icon="chevron_right"
                          iconPosition="trailing"
                          className="text-primary border-primary/20 dark:border-sky-500/25 group-hover:bg-primary group-hover:text-white transition-all duration-300 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenWorkspace(app);
                          }}
                        >
                          Workspace
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
    );
  }

  // Counselor Inquiries Tab View
  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">Prospect Inquiries</h3>
        <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold bg-slate-50 dark:bg-zinc-800/50 border px-3 py-1 rounded-full">
          {filteredInquiries.length} Logs
        </span>
      </div>

      {filteredInquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
          <Icon name="search_off" size={48} className="text-slate-300 dark:text-zinc-700" />
          <div className="text-center">
            <p className="text-base font-bold text-slate-600 dark:text-zinc-300">
              No inquiries match active filters.
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              Try resetting search queries or clearing filters.
            </p>
          </div>
          <Button
            variant="outlined"
            size="sm"
            icon="rotate_ccw"
            className="text-primary border-primary/30 mt-2"
            onClick={onResetFilters}
          >
            Clear Search & Filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                <th className="py-4 px-4">Student Name</th>
                <th className="py-4 px-4">Grade</th>
                <th className="py-4 px-4">Parent Details</th>
                <th className="py-4 px-4">Date Logged</th>
                <th className="py-4 px-4">Current Status</th>
                <th className="py-4 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInquiries.map((inq) => (
                <tr
                  key={inq.id}
                  onClick={() => onOpenInquiryWorkspace(inq)}
                  className="border-b border-slate-100/60 dark:border-zinc-800/40 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 font-bold text-slate-800 dark:text-zinc-200 text-sm">
                    {inq.studentName}
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-100 dark:border-zinc-800">
                      {inq.classApplied?.name || "N/A"}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-500 dark:text-zinc-400">
                    <div className="font-bold text-slate-700 dark:text-zinc-300">{inq.parentName}</div>
                    <div className="mt-0.5 text-slate-400 dark:text-zinc-500">
                      {inq.parentPhone} | {inq.parentEmail}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-500 dark:text-zinc-400">
                    {new Date(inq.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                        inq.status === "APPLIED"
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/40"
                          : inq.status === "VISITED"
                          ? "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-950/40"
                          : inq.status === "CONTACTED"
                          ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-950/40"
                          : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-950/40"
                      }`}
                    >
                      {inq.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {inq.status !== "APPLIED" && canVerifyDocs && (
                      <Button
                        variant="outlined"
                        size="sm"
                        icon="app_registration"
                        className="text-primary border-primary/20 dark:border-sky-500/25 group-hover:bg-primary group-hover:text-white transition-all duration-300 rounded-xl"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
