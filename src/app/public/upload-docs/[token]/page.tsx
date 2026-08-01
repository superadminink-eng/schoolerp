"use client";

import { useEffect, useState, useRef, use } from "react";
import { 
  UploadCloud, 
  ShieldCheck, 
  FileCheck2, 
  AlertCircle, 
  FileText, 
  CheckCircle2,
  Clock,
  RefreshCcw,
  Camera,
  FileArchive,
  Lock,
  User,
  Hash
} from "lucide-react";

interface ChecklistItem {
  type: string;
  label: string;
  mandatory: boolean;
  id: string | null;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  status: "VERIFIED" | "PENDING" | "REJECTED" | "NOT_UPLOADED" | "HARDCOPY_SUBMITTED";
  remarks: string | null;
}

interface PortalData {
  studentName: string;
  applicationNo: string;
  className: string;
  branchName: string;
  branchLogo: string | null;
  applicationStatus: string;
  checklist: ChecklistItem[];
}

export default function PublicParentUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchPortalData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/public/upload-docs/${token}?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load upload portal");
      }
    } catch {
      setError("Network error. Please check your internet connection.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
    
    // Real-time Magic Polling: Sync UI with admin decisions instantly without refreshing
    const intervalId = setInterval(() => {
      fetchPortalData(true);
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [token]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectFileClick = (item: ChecklistItem) => {
    setActiveItem(item);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeItem) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast("File size cannot exceed 10MB to save your mobile data.", "error");
      return;
    }

    setUploadingType(activeItem.type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", activeItem.type);

      const res = await fetch(`/api/v1/public/upload-docs/${token}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        showToast(`${activeItem.label} uploaded successfully!`, "success");
        await fetchPortalData(); // Refresh checklist!
      } else {
        showToast(json.error?.message || "Upload failed", "error");
      }
    } catch {
      showToast("Upload failed due to network error", "error");
    } finally {
      setUploadingType(null);
      setActiveItem(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800">Loading Portal...</h2>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Link Unavailable</h1>
        <p className="text-sm text-slate-600 max-w-sm mb-6">{error || "This secure portal link has expired or is invalid."}</p>
        <p className="text-xs text-slate-500 font-medium">Please contact the admission desk for a new link.</p>
      </div>
    );
  }

  const studentInitials = data.studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Progress Calculation
  const mandatoryItems = data.checklist.filter(item => item.mandatory);
  const completedMandatory = mandatoryItems.filter(item => item.status === "VERIFIED" || item.status === "HARDCOPY_SUBMITTED" || item.status === "PENDING").length;
  const progressPercent = mandatoryItems.length > 0 ? Math.round((completedMandatory / mandatoryItems.length) * 100) : 100;

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 text-slate-900 font-sans pb-16 antialiased selection:bg-blue-100">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2.5 border animate-in slide-in-from-top-4 fade-in duration-300 min-w-[280px] max-w-[90vw] ${
            toastMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Premium Header - Ultra Compact */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
            {data.branchName.substring(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">{data.branchName}</h1>
          </div>
        </div>
        <div className="px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700 flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Secure</span>
        </div>
      </header>

      {/* Main Content Container - Centered and Compact */}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        
        {/* Combined Student & Progress Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 border border-blue-100">
              {studentInitials}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{data.studentName}</h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-slate-500">
                <span>{data.applicationNo}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{data.className || "N/A"}</span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-64">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-bold text-slate-700">Documents</span>
              <span className="text-xs font-bold text-blue-600">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Compact Document List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {data.checklist.map((item, index) => {
            const isUploading = uploadingType === item.type;
            const isLocked = item.status === "VERIFIED" || item.status === "HARDCOPY_SUBMITTED";
            const isLast = index === data.checklist.length - 1;
            
            return (
              <div
                key={item.type}
                className={`flex flex-col md:flex-row md:items-center justify-between p-3.5 gap-3 transition-colors ${
                  !isLast ? "border-b border-slate-100" : ""
                } ${isUploading ? "opacity-60 pointer-events-none" : ""} ${
                  isLocked ? "bg-slate-50/50" : "hover:bg-slate-50"
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.status === "VERIFIED" ? "bg-green-100 text-green-600" :
                    item.status === "REJECTED" ? "bg-red-100 text-red-600" :
                    item.status === "HARDCOPY_SUBMITTED" ? "bg-amber-100 text-amber-600" :
                    item.fileName ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    {item.status === "VERIFIED" ? <ShieldCheck className="w-4 h-4" /> :
                     item.status === "REJECTED" ? <AlertCircle className="w-4 h-4" /> :
                     item.status === "HARDCOPY_SUBMITTED" ? <FileArchive className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{item.label}</h4>
                      {item.mandatory && (
                        <span className="text-[9px] font-bold uppercase px-1 rounded bg-red-50 text-red-600 border border-red-100 shrink-0">
                          Req
                        </span>
                      )}
                    </div>
                    {item.fileName && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        📎 {item.fileName} {item.fileSize ? `(${Math.round(item.fileSize / 1024)} KB)` : ""}
                      </p>
                    )}
                  </div>

                  {/* Status Badge */}
                  {item.status === "VERIFIED" && (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 shrink-0">
                      <span>🟢</span> Approved
                    </span>
                  )}
                  {item.status === "HARDCOPY_SUBMITTED" && (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center gap-1 shrink-0">
                      <span>📁</span> Hardcopy Submitted
                    </span>
                  )}
                  {item.status === "PENDING" && (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1 shrink-0">
                      <span>🟡</span> Under Review
                    </span>
                  )}
                  {item.status === "REJECTED" && (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1 shrink-0">
                      <span>🔴</span> Re-upload Needed
                    </span>
                  )}
                  {item.status === "NOT_UPLOADED" && (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-400 flex items-center gap-1 shrink-0">
                      <span>⚪</span> Pending Upload
                    </span>
                  )}
                </div>

                {/* Rejection Urgent UI */}
                {item.status === "REJECTED" && (
                  <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/50 rounded-xl flex flex-col gap-3 animate-in fade-in zoom-in duration-300 shadow-md shadow-rose-900/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Action Required</span>
                    </div>
                    
                    {item.remarks && (
                      <div className="text-[11px] text-rose-800 dark:text-rose-300 font-medium">
                        <span className="font-bold opacity-80">Reason:</span> {item.remarks}
                      </div>
                    )}
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleSelectFileClick(item)}
                        className="h-9 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/40"
                      >
                        {isUploading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <span>⬆️</span>
                            <span>Re-Upload File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Action / Locked State */}
                {item.status !== "REJECTED" && (
                  <div className="pt-1 flex justify-end">
                    {isLocked ? (
                      <div className="flex flex-col items-end gap-1 animate-in fade-in zoom-in duration-300">
                        <div className="h-9 px-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 cursor-default shadow-sm shadow-emerald-900/20">
                          <span>🔒</span>
                          <span>Locked</span>
                        </div>
                        <span className="text-[9px] text-slate-500/80 font-medium">Secured by school administration.</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleSelectFileClick(item)}
                        className="h-9 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-blue-900/30"
                      >
                        {isUploading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <span>📷</span>
                            <span>{item.filePath ? "Replace File" : "Upload File"}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-2 pb-2 text-center">
          <div className="inline-flex items-center justify-center gap-1 px-2 text-[11px] text-slate-400 font-medium">
            <Lock className="w-3 h-3" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>
      </main>
    </div>
  );
}
