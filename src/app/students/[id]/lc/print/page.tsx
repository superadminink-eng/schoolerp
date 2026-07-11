"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Icon } from "@/components/ui/icon";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  rollNo: string | null;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string | null;
  category: string;
  admissionDate: string;
  fatherName: string | null;
  motherName: string | null;
  previousSchool: string | null;
  branch: { name: string };
  enrollments: Array<{
    section: {
      class: { name: string };
      name: string;
    };
  }>;
}

interface LeavingCertificateData {
  id: string;
  certificateNo: string;
  issueDate: string;
  conduct: string;
  leavingDate: string;
  reasonForLeaving: string;
  remarks: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

function getNumberInWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (num < 20) return ones[num];
  const digit = num % 10;
  return tens[Math.floor(num / 10)] + (digit !== 0 ? " " + ones[digit] : "");
}

function getDobInWords(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    const ordinals = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth", "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"];
    
    let yearWords = "";
    if (year >= 2000 && year < 2100) {
      yearWords = "Two Thousand " + getNumberInWords(year - 2000);
    } else if (year >= 1900 && year < 2000) {
      yearWords = "Nineteen " + getNumberInWords(year - 1900);
    } else {
      yearWords = year.toString();
    }

    return `${ordinals[day]} ${month} ${yearWords}`;
  } catch {
    return "—";
  }
}

export default function LeavingCertificatePrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [lc, setLc] = useState<LeavingCertificateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch student
        const studentRes = await fetch(`/api/v1/students/${params.id}`);
        const studentData = await studentRes.json();

        // Fetch LC
        const lcRes = await fetch(`/api/v1/students/${params.id}/issue-lc`);
        const lcData = await lcRes.json();

        if (studentData.success && lcData.success) {
          setStudent(studentData.data);
          setLc(lcData.data);
        } else {
          snackbar.show(lcData.error?.message ?? "Leaving Certificate has not been issued yet.", "error");
          router.push(`/students/${params.id}`);
        }
      } catch {
        snackbar.show("Failed to load certificate data.", "error");
        router.push(`/students/${params.id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (student && lc) {
      // Trigger print dialog after content renders
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [student, lc]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-semibold text-slate-500">
        <Icon name="progress_activity" className="animate-spin text-primary mr-2" size={24} />
        Loading Certificate...
      </div>
    );
  }

  if (!student || !lc) return null;

  const currentClass = student.enrollments?.[0]?.section?.class?.name || "—";
  const currentSection = student.enrollments?.[0]?.section?.name || "";

  return (
    <div className="min-h-screen bg-slate-50/50 p-0 md:p-8 flex flex-col items-center">
      {/* Control Bar (Hidden during print) */}
      <div className="w-full max-w-[800px] bg-white border border-slate-200 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm no-print">
        <button
          onClick={() => router.push(`/students/${params.id}`)}
          className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 font-semibold cursor-pointer"
        >
          <Icon name="arrow_back" size={16} />
          Back to Profile
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 cursor-pointer"
        >
          <Icon name="print" size={16} />
          Print Certificate
        </button>
      </div>

      {/* Leaving Certificate Container */}
      <div className="w-full max-w-[842px] min-h-[595px] bg-white border-2 border-slate-300 p-12 relative print-container flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        
        {/* Custom Security Border inside Padding */}
        <div className="absolute inset-4 border-2 border-double border-slate-800 pointer-events-none" />

        {/* Certificate Content */}
        <div className="space-y-6 relative z-10">
          
          {/* Header section with school details */}
          <div className="text-center space-y-1.5 border-b-2 border-slate-800 pb-5">
            <h1 className="text-2xl font-black text-slate-900 tracking-wide uppercase font-serif">
              {student.branch.name}
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Affiliated to CBSE / State Board | School ERP System
            </p>
            <h2 className="text-lg font-bold text-slate-800 border border-slate-800 px-6 py-1 inline-block bg-slate-50 rounded mt-2 uppercase">
              LEAVING CERTIFICATE
            </h2>
          </div>

          {/* Certificate metadata: LC Number, Date of issue */}
          <div className="flex justify-between text-xs font-mono font-bold text-slate-700 px-2">
            <div>LC No: <span className="text-slate-900 underline">{lc.certificateNo}</span></div>
            <div>Date of Issue: <span className="text-slate-900 underline">{new Date(lc.issueDate).toLocaleDateString("en-IN")}</span></div>
          </div>

          {/* Core grid of student information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2 text-sm text-slate-700">
            
            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Admission No.:</span>
              <strong className="text-slate-900 font-mono">{student.admissionNo}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Roll No.:</span>
              <strong className="text-slate-900 font-mono">{student.rollNo || "—"}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
              <span>Student's Full Name:</span>
              <strong className="text-slate-900">{student.firstName} {student.lastName}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Father's Name:</span>
              <strong className="text-slate-900">{student.fatherName || "—"}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Mother's Name:</span>
              <strong className="text-slate-900">{student.motherName || "—"}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
              <span>Date of Birth (in figures):</span>
              <strong className="text-slate-900 font-mono">
                {new Date(student.dateOfBirth).toLocaleDateString("en-IN")}
              </strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
              <span>Date of Birth (in words):</span>
              <strong className="text-slate-900 italic">{getDobInWords(student.dateOfBirth)}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Category / Caste:</span>
              <strong className="text-slate-900">{student.category}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Gender:</span>
              <strong className="text-slate-900 capitalize">{student.gender.toLowerCase()}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
              <span>Previous School Attended:</span>
              <strong className="text-slate-900">{student.previousSchool || "—"}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Date of Admission:</span>
              <strong className="text-slate-900">
                {new Date(student.admissionDate).toLocaleDateString("en-IN")}
              </strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Class Last Studied:</span>
              <strong className="text-slate-900">{currentClass} {currentSection}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Date of Leaving School:</span>
              <strong className="text-slate-900 font-semibold">
                {new Date(lc.leavingDate).toLocaleDateString("en-IN")}
              </strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between">
              <span>Conduct / Character:</span>
              <strong className="text-slate-900">{lc.conduct}</strong>
            </div>

            <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
              <span>Reason for Leaving School:</span>
              <strong className="text-slate-900">{lc.reasonForLeaving}</strong>
            </div>

            {lc.remarks && (
              <div className="border-b border-dashed border-slate-300 pb-1.5 flex justify-between md:col-span-2">
                <span>Remarks:</span>
                <strong className="text-slate-900 italic">{lc.remarks}</strong>
              </div>
            )}

          </div>

          {/* Verification Statement */}
          <p className="text-xs text-slate-500 text-center italic mt-6 border-t border-slate-100 pt-4">
            Certified that the above details match exactly with the official General Register of the School.
          </p>

        </div>

        {/* Footer layout for Signatures */}
        <div className="grid grid-cols-3 text-center text-xs font-bold text-slate-800 pt-16 px-2 relative z-10">
          <div className="space-y-8">
            <div className="h-[2px] w-32 bg-slate-300 mx-auto" />
            <div>Class Teacher</div>
          </div>
          <div className="space-y-8">
            <div className="h-[2px] w-32 bg-slate-300 mx-auto" />
            <div>Prepared By (Clerk)</div>
          </div>
          <div className="space-y-8">
            <div className="h-[2px] w-32 bg-slate-300 mx-auto" />
            <div>
              {lc.signatoryTitle || "Principal / Headmaster"}
              {lc.signatoryName && <span className="block font-normal text-[10px] mt-1">({lc.signatoryName})</span>}
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
          /* Ensure custom border prints */
          .absolute {
            position: absolute !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
