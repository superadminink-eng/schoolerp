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
    <div className="flex flex-col h-full bg-slate-50/60 dark:bg-zinc-950/40 relative animate-in fade-in zoom-in-95 duration-200">
      
      {/* Unified Sleek Header */}
      <div className="px-8 py-6 border-b border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 sticky top-0 z-20">
        <div className="flex flex-col 2xl:flex-row justify-between items-start gap-4">
          <div className="min-w-0 flex items-start gap-3">
            {onClose && (
              <button onClick={onClose} className="md:hidden mt-1 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
                <Icon name="arrow_back" size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    selectedInquiry.status === "APPLIED" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedInquiry.status === "APPLIED" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                  {selectedInquiry.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded-full border border-slate-200/50">
                  <Icon name="sensor_door" size={12} /> {selectedInquiry.source || "—"}
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                {selectedInquiry.studentName}
              </h2>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 mt-3 2xl:mt-1 w-full 2xl:w-auto">
            {hasAppAccess && selectedInquiry.status !== "APPLIED" && (
              <Button variant="text" size="sm" icon="person_add" className="h-9 text-xs font-semibold text-slate-600 hover:text-teal-700 dark:text-zinc-400 dark:hover:text-teal-400 rounded-xl transition-all" onClick={() => onOpenInquiryWorkspace(selectedInquiry)}>
                Express Admit
              </Button>
            )}
            <Button 
              variant="text" 
              size="sm" 
              icon="forum"
              onClick={() => handleSendWelcomeWhatsApp(selectedInquiry)}
              disabled={!selectedInquiry.parentPhone}
              className="h-9 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              WhatsApp
            </Button>
            {selectedInquiry.status !== "APPLIED" && canVerifyDocs && (
              <Button 
                variant="filled" 
                size="sm" 
                icon="rocket_launch"
                className="h-9 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md hover:shadow-lg rounded-xl transition-all"
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
      <div className="p-4 md:p-8 flex-1 flex flex-col min-h-0 space-y-6">
        
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 shrink-0">
          
          {/* Island Card: Family Information */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm p-6">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Icon name="family_restroom" size={14} className="text-slate-300" /> Family Details
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 dark:border-zinc-700/50">
                  <Icon name="person" size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Parent Name</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{selectedInquiry.parentName || "—"}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-100 dark:border-emerald-800/30">
                  <Icon name="call" size={16} />
                </div>
                <div className="flex flex-col min-w-0 items-start">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Phone</span>
                  {selectedInquiry.parentPhone ? (
                    <a href={`tel:${selectedInquiry.parentPhone}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                      {selectedInquiry.parentPhone} <Icon name="open_in_new" size={10} />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500 shrink-0 border border-sky-100 dark:border-sky-800/30">
                  <Icon name="mail" size={16} />
                </div>
                <div className="flex flex-col min-w-0 items-start">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                  {selectedInquiry.parentEmail ? (
                    <a href={`mailto:${selectedInquiry.parentEmail}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors text-xs font-medium text-slate-700 dark:text-zinc-300 max-w-full truncate">
                      <span className="truncate">{selectedInquiry.parentEmail}</span> <Icon name="open_in_new" size={10} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Island Card: Student Profile */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm p-6">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Icon name="face" size={14} className="text-slate-300" /> Student Profile
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-100 dark:border-indigo-800/30">
                  <Icon name="school" size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target Class</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{selectedInquiry.classApplied?.name || "—"}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100 dark:border-rose-800/30">
                  <Icon name="cake" size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    {selectedInquiry.dateOfBirth ? new Date(selectedInquiry.dateOfBirth).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 dark:border-zinc-700/50">
                  <Icon name="wc" size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gender</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 capitalize">{selectedInquiry.gender?.toLowerCase() || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed & Inline Composer - Takes all remaining vertical space */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm overflow-hidden">
          
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-slate-50/50 dark:bg-zinc-950/20 rounded-t-2xl">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Icon name="forum" size={14} className="text-slate-300" /> Counselor Activity Feed
            </h4>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-white dark:bg-zinc-900">
            {selectedInquiry.notes && (!selectedInquiry.followUps || selectedInquiry.followUps.length === 0) && (
              <div className="relative pl-8 pb-4">
                <div className="absolute left-[-11px] top-1 flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900">
                  <Icon name="push_pin" size={12} className="text-slate-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200">System</span>
                    <span className="text-[10px] text-slate-400">Initial Inquiry</span>
                  </div>
                  <p className="text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {selectedInquiry.notes}
                  </p>
                </div>
              </div>
            )}

            {selectedInquiry.followUps && selectedInquiry.followUps.length > 0 ? (
              <div className="relative border-l border-slate-200 dark:border-zinc-800 ml-[11px] space-y-0">
                {selectedInquiry.followUps.map((log) => (
                  <div key={log.id} className="relative pl-8 pb-6 group">
                    <div className="absolute left-[-13px] top-1 flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900">
                      <Icon name="chat_bubble_outline" size={11} className="text-slate-400" />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-800 dark:text-zinc-200">Counselor</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(log.followUpDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {log.statusReached}
                        </span>
                      </div>
                      
                      <p className="text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {log.conversationNotes}
                      </p>
                      
                      {log.nextFollowUpDate && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <Icon name="event" size={12} className="text-slate-400" />
                          Next action: {new Date(log.nextFollowUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !selectedInquiry.notes && (
                <div className="flex flex-col items-center justify-center p-6 text-center h-32">
                  <Icon name="chat" size={24} className="text-slate-200 dark:text-zinc-700 mb-2" />
                  <span className="text-sm font-medium text-slate-400">No activity logged yet.</span>
                </div>
              )
            )}
          </div>

          {selectedInquiry.status !== "APPLIED" ? (
            <div className="p-0 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-2xl shrink-0">
              <form onSubmit={onSubmitFollowUp} className="flex flex-col relative m-4 border border-slate-200 dark:border-zinc-700 focus-within:border-slate-400 dark:focus-within:border-zinc-500 rounded-xl bg-white dark:bg-zinc-950 transition-colors">
                
                <textarea
                  rows={1}
                  required
                  value={followUpForm.conversationNotes}
                  onChange={(e) => handleFieldChange("conversationNotes", e.target.value)}
                  placeholder="Leave a note..."
                  className="w-full px-4 pt-3 pb-2 bg-transparent text-[13px] text-slate-800 dark:text-zinc-100 focus:outline-none resize-none min-h-[64px]"
                />
                
                <div className="flex items-center justify-between px-2 pb-2">
                  <div className="flex items-center gap-1">
                    {/* Status Dropdown */}
                    <Select value={followUpForm.statusReached} onValueChange={(val) => handleFieldChange("statusReached", val)}>
                      <SelectTrigger className="h-7 px-2 rounded-lg border-0 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-slate-600 dark:text-zinc-400 focus:ring-0 w-auto min-w-[100px] transition-colors shadow-none gap-1.5 cursor-pointer">
                        <Icon name="flag" size={12} className="text-slate-400" />
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
                    <div className="flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg px-2 h-7 transition-colors border-0 text-slate-600 dark:text-zinc-400 cursor-text">
                      <Icon name="event" size={12} className="text-slate-400" />
                      <input
                        type="date"
                        value={followUpForm.nextFollowUpDate}
                        onChange={(e) => handleFieldChange("nextFollowUpDate", e.target.value)}
                        className="bg-transparent text-[11px] font-medium text-slate-600 dark:text-zinc-400 focus:outline-none w-[95px] cursor-pointer"
                      />
                    </div>
                  </div>

                  <Button type="submit" loading={loading} className="h-7 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white text-[11px] font-semibold shadow-none transition-all">
                    Comment
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 rounded-b-2xl shrink-0 text-center text-xs font-semibold text-slate-400">
              Inquiry converted to application. Follow-up is disabled.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
