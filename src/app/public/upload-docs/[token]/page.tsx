"use client";

import { useEffect, useState, useRef, use } from "react";

interface ChecklistItem {
  type: string;
  label: string;
  mandatory: boolean;
  id: string | null;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  status: "VERIFIED" | "PENDING" | "REJECTED" | "NOT_UPLOADED";
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

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/public/upload-docs/${token}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load upload portal");
      }
    } catch {
      setError("Network error. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
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
      showToast("File size cannot exceed 10MB", "error");
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
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300 animate-pulse">Loading Admission Portal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4 text-2xl">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-slate-100 mb-2">Link Unavailable</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{error || "Portal not found"}</p>
        <p className="text-xs text-slate-500">Please contact the school admission desk for assistance.</p>
      </div>
    );
  }

  const studentInitials = data.studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 antialiased">
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
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 border animate-in slide-in-from-top-4 duration-300 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}
        >
          <span>{toastMessage.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md">
            {data.branchName.substring(0, 1)}
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white uppercase">{data.branchName}</h1>
            <p className="text-[10px] text-slate-400 font-medium">Admission Document Portal</p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
          🔒 Secure Upload
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Student Banner */}
        <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-lg shrink-0">
              {studentInitials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white tracking-tight truncate">{data.studentName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/50">
                  App: {data.applicationNo}
                </span>
                <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                  Class: {data.className || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Required Documents</h3>
          <p className="text-[11px] text-slate-400">
            Please tap <span className="text-white font-semibold">"Upload File"</span> next to each item to attach your documents. Clear camera photos or PDF files are accepted.
          </p>
        </div>

        {/* Document Checklist */}
        <div className="space-y-3">
          {data.checklist.map((item) => {
            const isUploading = uploadingType === item.type;
            return (
              <div
                key={item.type}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.label}</span>
                      {item.mandatory ? (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          Optional
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

                {/* Rejection Remarks Alert */}
                {item.remarks && item.status === "REJECTED" && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2">
                    <span className="shrink-0">💬</span>
                    <div>
                      <span className="font-bold">School Feedback:</span> {item.remarks}
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => handleSelectFileClick(item)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                      item.status === "VERIFIED"
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : item.status === "REJECTED"
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
                    }`}
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
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-6 text-center text-[11px] text-slate-500">
          Powered by Google Antigravity School ERP • Protected by End-to-End Encryption
        </div>
      </main>
    </div>
  );
}
