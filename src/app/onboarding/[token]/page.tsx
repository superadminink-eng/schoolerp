"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const REQUIRED_DOCS = ["STUDENT_PHOTO", "BIRTH_CERTIFICATE"];
const OPTIONAL_DOCS = ["AADHAAR_CARD", "PREVIOUS_MARKSHEET"];
const ALL_DOCS = [...REQUIRED_DOCS, ...OPTIONAL_DOCS];

export default function ParentOnboardingPortal() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<any>(null);
  
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/public/onboarding/${token}`);
      const data = await res.json();
      if (data.success) {
        setAppData(data.data);
      } else {
        setError(data.error?.message || "Failed to load portal.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (docType: string) => {
    setCurrentUploadType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadType) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Maximum size is 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingDoc(currentUploadType);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", currentUploadType);

    try {
      const res = await fetch(`/api/public/onboarding/${token}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await fetchData(); // Refresh docs
      } else {
        alert(data.error?.message || "Failed to upload document.");
      }
    } catch (err) {
      alert("Network error during upload.");
    } finally {
      setUploadingDoc(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <Icon name="sync" size={32} className="animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <Icon name="error" size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-200 mb-2 text-center">{error}</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 text-center max-w-sm">
          Please contact the school administration if you believe this is a mistake.
        </p>
      </div>
    );
  }

  const getDocStatus = (docType: string) => {
    return appData?.documents?.find((d: any) => d.documentType === docType);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED": return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20";
      case "REJECTED": return "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20";
      case "PENDING": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20";
      default: return "bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED": return "check_circle";
      case "REJECTED": return "cancel";
      case "PENDING": return "hourglass_empty";
      default: return "radio_button_unchecked";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20 font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-5 sticky top-0 z-10 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="school" size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-zinc-100">Admission Portal</h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Document Upload & Verification</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-6">
        {/* Student Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Applicant Details</p>
              <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mb-1">{appData.studentName}</h2>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><Icon name="class" size={14} /> Class: {appData.className}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1"><Icon name="tag" size={14} /> App No: {appData.applicationNo}</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 font-bold text-[10px] uppercase tracking-wider border border-blue-100 dark:border-blue-500/20">
              {appData.status.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*,.pdf" 
        />

        {/* Upload Checklist */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <Icon name="checklist" size={18} className="text-primary" />
              Required Documents
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {appData.documents.filter((d:any) => d.status === "VERIFIED").length} / {REQUIRED_DOCS.length} Verified
            </span>
          </div>

          <div className="space-y-3">
            {ALL_DOCS.map((docType) => {
              const doc = getDocStatus(docType);
              const isRequired = REQUIRED_DOCS.includes(docType);
              const status = doc ? doc.status : "MISSING";
              const isUploading = uploadingDoc === docType;
              const isLocked = status === "VERIFIED";

              return (
                <div key={docType} className={`p-4 rounded-2xl border transition-all ${getStatusColor(status)} ${isLocked ? 'opacity-90' : 'hover:shadow-md bg-white dark:bg-zinc-900'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        status === "VERIFIED" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" :
                        status === "REJECTED" ? "bg-red-100 text-red-600 dark:bg-red-500/20" :
                        status === "PENDING" ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20" :
                        "bg-slate-100 text-slate-400 dark:bg-zinc-800"
                      }`}>
                        <Icon name={getStatusIcon(status)} size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                            {docType.replace(/_/g, " ")}
                          </h4>
                          {isRequired && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">REQUIRED</span>}
                        </div>
                        
                        <div className="mt-1">
                          {status === "MISSING" && (
                            <p className="text-xs text-slate-500">Not uploaded yet. Please upload a clear photo or PDF.</p>
                          )}
                          {status === "PENDING" && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">Uploaded. Waiting for school verification.</p>
                          )}
                          {status === "VERIFIED" && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Verified by school administration.</p>
                          )}
                          {status === "REJECTED" && (
                            <div className="mt-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                              <p className="text-xs font-bold text-red-700 dark:text-red-400">Rejected</p>
                              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Reason: {doc.remarks || "Unclear image or incorrect document."}</p>
                              <p className="text-[10px] text-red-500 mt-1 uppercase tracking-wider font-bold">Please re-upload</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isLocked && (
                      <button
                        onClick={() => handleUploadClick(docType)}
                        disabled={isUploading}
                        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                      >
                        {isUploading ? <Icon name="sync" size={20} className="animate-spin" /> : <Icon name={status === "MISSING" ? "add_a_photo" : "edit"} size={20} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-8 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-center">
          <Icon name="info" size={24} className="text-blue-500 mb-2 mx-auto" />
          <p className="text-xs text-blue-700 dark:text-blue-400">Your application will be processed once all required documents are verified.</p>
        </div>
      </div>
    </div>
  );
}
