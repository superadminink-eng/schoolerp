"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useSnackbar } from "@/components/ui/snackbar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface ClassItem {
  id: string;
  name: string;
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
  classApplied?: ClassItem | null;
  followUps?: FollowUp[];
}

interface InquiryDetailPaneProps {
  selectedInquiry: Inquiry;
  canVerifyDocs: boolean;
  onOpenInquiryWorkspace: (inq: Inquiry) => void;
  setAppForm: (val: any) => void;
  setApplicationModalOpen: (val: boolean) => void;
  schoolName?: string;
  onClose?: () => void;
  onInquiryUpdated?: (inq: Inquiry) => void;
  hasAppAccess?: boolean;
}

export function InquiryDetailPane({
  selectedInquiry,
  canVerifyDocs,
  onOpenInquiryWorkspace,
  setAppForm,
  setApplicationModalOpen,
  schoolName = "our school",
  onClose,
  onInquiryUpdated,
  hasAppAccess = false,
}: InquiryDetailPaneProps) {
  
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    conversationNotes: "",
    nextFollowUpDate: "",
    statusReached: selectedInquiry.status || "INQUIRY",
  });

  const handleFieldChange = (field: string, value: string) => {
    setFollowUpForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const onSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admissions/inquiries/${selectedInquiry.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(followUpForm),
      });
      const data = await res.json();
      if (data.success && onInquiryUpdated) {
        snackbar.show("Follow-up logged successfully.", "success");
        setFollowUpForm((prev) => ({
          ...prev,
          conversationNotes: "",
          nextFollowUpDate: "",
        }));
        
        // Optimistic UI Update
        const newFollowUp = data.data; // The returned followUp log
        onInquiryUpdated({
          ...selectedInquiry,
          status: newFollowUp.statusReached,
          followUps: [
            newFollowUp,
            ...(selectedInquiry.followUps || [])
          ]
        });
      } else {
        snackbar.show(data.error?.message || "Failed to log follow-up.", "error");
      }
    } catch {
      snackbar.show("Network error.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendWelcomeWhatsApp = (inq: Inquiry) => {
    if (!inq.parentPhone) {
      alert("No parent phone number provided for this inquiry.");
      return;
    }
    let phone = inq.parentPhone.replace(/[^+\d]/g, "");
    if (phone.length === 10 && !phone.startsWith("+")) phone = "91" + phone;
    else if (phone.startsWith("+")) phone = phone.substring(1);
    
    const classNameText = inq.classApplied ? ` in *${inq.classApplied.name}*` : "";
    const message = `✨ *Welcome to ${schoolName}!* ✨\n\nHi *${inq.parentName}*,\nThank you for showing interest in securing a bright future for *${inq.studentName}*${classNameText}. 🎓\n\nTo fast-track your admission process, please keep these documents ready for your campus visit:\n\n📄 *Birth Certificate*\n🪪 *Student Aadhaar*\n📸 *Passport Photo*\n📈 *Previous Marksheet* (if applicable)\n\nIf you have any questions, just reply here. We’d love to guide you through! 🤝`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 relative animate-in fade-in zoom-in-95 duration-200">
      
      {/* Unified Sleek Header */}
      <div className="px-6 py-5 border-b border-slate-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shrink-0 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 max-w-7xl mx-auto w-full">
          <div className="min-w-0 flex items-center gap-4">
            {onClose && (
              <button onClick={onClose} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 transition-colors">
                <Icon name="arrow_back" size={20} />
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                    selectedInquiry.status === "APPLIED" 
                      ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedInquiry.status === "APPLIED" ? "bg-emerald-500" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"}`}></span>
                  {selectedInquiry.status}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-slate-100/50 dark:bg-zinc-900/50 px-2 py-0.5 rounded-md">
                  <Icon name="sensor_door" size={12} className="text-slate-400" /> {selectedInquiry.source || "—"}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {selectedInquiry.studentName}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {hasAppAccess && selectedInquiry.status !== "APPLIED" && (
              <Button variant="text" size="sm" icon="person_add" className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors" onClick={() => onOpenInquiryWorkspace(selectedInquiry)}>
                Express Admit
              </Button>
            )}
            <Button 
              variant="text" 
              size="sm" 
              icon="forum"
              onClick={() => handleSendWelcomeWhatsApp(selectedInquiry)}
              disabled={!selectedInquiry.parentPhone}
              className="h-9 px-3 text-xs font-semibold text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/50 dark:bg-emerald-900/10 dark:text-emerald-400 dark:hover:bg-emerald-900/20 disabled:opacity-50 rounded-lg transition-colors"
            >
              WhatsApp
            </Button>
            {selectedInquiry.status !== "APPLIED" && canVerifyDocs && (
              <Button 
                variant="filled" 
                size="sm" 
                icon="rocket_launch"
                className="h-9 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm rounded-lg transition-all"
                onClick={() => {
                  setAppForm({
                    inquiryId: selectedInquiry.id,
                    firstName: selectedInquiry.studentName.split(" ")[0] || "",
                    lastName: selectedInquiry.studentName.split(" ").slice(1).join(" ") || "",
                    dateOfBirth: selectedInquiry.dateOfBirth ? selectedInquiry.dateOfBirth.split("T")[0] : "",
                    gender: selectedInquiry.gender || "MALE",
                    bloodGroup: "",
                    address: "",
                    pincode: "",
                    emergencyContact: "",
                    fatherName: selectedInquiry.parentName,
                    fatherPhone: selectedInquiry.parentPhone,
                    fatherEmail: selectedInquiry.parentEmail,
                    fatherOccupation: "",
                    motherName: "",
                    motherPhone: "",
                    motherEmail: "",
                    motherOccupation: "",
                    classId: selectedInquiry.classApplied?.id || "",
                  });
                  setApplicationModalOpen(true);
                }}
              >
                Convert to App
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Inner Body */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-950">
        <div className="flex flex-col lg:flex-row h-full">
        
          {/* Left Sidebar: Highly Dense Metadata */}
          <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 border-r border-slate-100 dark:border-zinc-800/60 overflow-y-auto [&::-webkit-scrollbar]:hidden p-6 lg:p-8 flex flex-col gap-10">
            
            {/* Family Details Segment */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-5">Family Details</h4>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">Parent</span>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 truncate">{selectedInquiry.parentName || "—"}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">Phone</span>
                  {selectedInquiry.parentPhone ? (
                    <a href={`tel:${selectedInquiry.parentPhone}`} className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 hover:text-indigo-600 transition-colors truncate">
                      {selectedInquiry.parentPhone}
                    </a>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">Email</span>
                  {selectedInquiry.parentEmail ? (
                    <a href={`mailto:${selectedInquiry.parentEmail}`} className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 hover:text-indigo-600 transition-colors truncate">
                      {selectedInquiry.parentEmail}
                    </a>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Student Profile Segment */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-5">Student Profile</h4>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">Class</span>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 truncate">{selectedInquiry.classApplied?.name || "—"}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">DOB</span>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {selectedInquiry.dateOfBirth ? new Date(selectedInquiry.dateOfBirth).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[13px] text-slate-500 font-medium">Gender</span>
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 capitalize truncate">{selectedInquiry.gender?.toLowerCase() || "—"}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Area: Minimal Timeline & Floating Pill Composer */}
          <div className="flex-1 flex flex-col min-h-0 relative bg-slate-50/30 dark:bg-zinc-950/20">
            
            {/* Header for Activity */}
            <div className="px-6 lg:px-10 pt-6 lg:pt-8 pb-4 shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/50">
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-zinc-100">Activity</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">{selectedInquiry.followUps?.length || 0} Events</span>
            </div>

            {/* Timeline Stream */}
            <div className="flex-1 overflow-y-auto px-6 lg:px-10 pt-8 pb-40 [&::-webkit-scrollbar]:hidden">
              
              <div className="relative">
                {/* The continuous vertical line */}
                <div className="absolute left-[4px] top-2 bottom-0 w-[2px] bg-slate-100 dark:bg-zinc-800 rounded-full" />
                
                <div className="flex flex-col gap-10">
                  {/* Initial Event */}
                  {selectedInquiry.notes && (
                    <div className="relative pl-8">
                      <div className="absolute left-[1px] top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600 ring-4 ring-white dark:ring-zinc-950" />
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">System</span>
                        <span className="text-xs font-medium text-slate-500">logged the initial inquiry</span>
                      </div>
                      <div className="text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl bg-white dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800/80 shadow-sm shadow-slate-200/20 whitespace-pre-wrap">
                        {selectedInquiry.notes}
                      </div>
                    </div>
                  )}

                  {/* Follow Ups */}
                  {selectedInquiry.followUps?.map((log) => (
                    <div key={log.id} className="relative pl-8">
                      <div className="absolute left-[1px] top-1.5 h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-4 ring-white dark:ring-zinc-950" />
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">Counselor</span>
                        <span className="text-xs font-medium text-slate-500">
                          {new Date(log.followUpDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full ml-1">
                          {log.statusReached}
                        </span>
                      </div>
                      
                      <div className="text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed max-w-2xl">
                        {log.conversationNotes}
                      </div>
                      
                      {log.nextFollowUpDate && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Icon name="event" size={14} className="text-slate-400" />
                          Next action: {new Date(log.nextFollowUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(!selectedInquiry.notes && (!selectedInquiry.followUps || selectedInquiry.followUps.length === 0)) && (
                     <div className="flex flex-col items-center justify-center p-6 text-center h-32 pl-8">
                       <span className="text-[13px] font-medium text-slate-400">No activity logged yet.</span>
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Apple-Style Floating Pill Composer */}
            {selectedInquiry.status !== "APPLIED" && (
              <div className="absolute bottom-6 left-6 right-6 lg:left-10 lg:right-10 flex justify-center pointer-events-none z-10">
                <form onSubmit={onSubmitFollowUp} className="w-full max-w-3xl pointer-events-auto bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-700/80 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-1.5 flex flex-col transition-all focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:shadow-2xl focus-within:shadow-slate-200/60 focus-within:border-slate-300 dark:focus-within:border-zinc-600">
                  
                  <textarea
                    rows={1}
                    required
                    value={followUpForm.conversationNotes}
                    onChange={(e) => handleFieldChange("conversationNotes", e.target.value)}
                    placeholder="Leave a note or log an activity..."
                    className="w-full px-4 pt-3 pb-2 bg-transparent text-[13px] font-medium text-slate-900 dark:text-zinc-100 focus:outline-none resize-none min-h-[56px] placeholder:text-slate-400 placeholder:font-normal"
                  />
                  
                  <div className="flex items-center justify-between px-1.5 pb-1">
                    <div className="flex items-center gap-1">
                      {/* Status Dropdown */}
                      <Select value={followUpForm.statusReached} onValueChange={(val) => handleFieldChange("statusReached", val)}>
                        <SelectTrigger className="h-8 px-3 rounded-xl border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-300 focus:ring-0 w-auto transition-colors shadow-none gap-2 cursor-pointer bg-transparent">
                          <Icon name="flag" size={14} className="text-slate-400" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INQUIRY">New Inquiry</SelectItem>
                          <SelectItem value="CONTACTED">Contacted</SelectItem>
                          <SelectItem value="VISITED">Visited Campus</SelectItem>
                          <SelectItem value="CLOSED">Closed Lead</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Date Picker */}
                      <div className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl px-3 h-8 transition-colors text-slate-600 dark:text-zinc-300 cursor-text bg-transparent">
                        <Icon name="event" size={14} className="text-slate-400" />
                        <input
                          type="date"
                          value={followUpForm.nextFollowUpDate}
                          onChange={(e) => handleFieldChange("nextFollowUpDate", e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-600 dark:text-zinc-300 focus:outline-none w-[105px] cursor-pointer"
                        />
                      </div>
                    </div>

                    <Button type="submit" loading={loading} className="h-8 px-4 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 text-white text-[12px] font-bold shadow-sm transition-all">
                      Comment
                    </Button>
                  </div>
                </form>
              </div>
            )}
            
            {selectedInquiry.status === "APPLIED" && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-slate-900/90 dark:bg-zinc-100/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 dark:border-zinc-300 text-[11px] font-bold text-white dark:text-zinc-900 tracking-widest uppercase shadow-xl">
                  Inquiry Converted
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
