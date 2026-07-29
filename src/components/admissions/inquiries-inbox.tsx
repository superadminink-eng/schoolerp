"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

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

interface InquiriesInboxProps {
  inquiries: Inquiry[];
  canVerifyDocs: boolean;
  onOpenInquiryWorkspace: (inq: Inquiry) => void;
  setAppForm: (val: any) => void;
  setApplicationModalOpen: (val: boolean) => void;
  schoolName?: string;
}

export default function InquiriesInbox({
  inquiries,
  canVerifyDocs,
  onOpenInquiryWorkspace,
  setAppForm,
  setApplicationModalOpen,
  schoolName = "our school",
}: InquiriesInboxProps) {
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // Helper to generate deterministic avatar colors
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
      "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700",
      "bg-pink-100 text-pink-700", "bg-sky-100 text-sky-700"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  // Helper to format WhatsApp message globally
  const handleSendWelcomeWhatsApp = (inq: Inquiry) => {
    if (!inq.parentPhone) {
      alert("No parent phone number provided for this inquiry.");
      return;
    }

    // Keep only digits and '+'
    let phone = inq.parentPhone.replace(/[^+\d]/g, "");
    
    // Smart Country Code handling
    if (phone.length === 10 && !phone.startsWith("+")) {
      phone = "91" + phone; // Fallback to 91 only if strictly 10 digits without code
    } else if (phone.startsWith("+")) {
      phone = phone.substring(1); // Remove '+' for wa.me link
    }

    const classNameText = inq.classApplied ? ` in *${inq.classApplied.name}*` : "";
    const message = `✨ *Welcome to ${schoolName}!* ✨\n\nHi *${inq.parentName}*,\nThank you for showing interest in securing a bright future for *${inq.studentName}*${classNameText}. 🎓\n\nTo fast-track your admission process, please keep these documents ready for your campus visit:\n\n📄 *Birth Certificate*\n🪪 *Student Aadhaar*\n📸 *Passport Photo*\n📈 *Previous Marksheet* (if applicable)\n\nIf you have any questions, just reply here. We’d love to guide you through! 🤝`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Quick helper to determine SLA status
  const isOverdue = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffHours > 48;
  };

  return (
    <div className="flex h-[calc(100vh-280px)] w-full border border-slate-200/60 dark:border-zinc-800/60 rounded-3xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
      
      {/* Left Pane: High-Density Lead List */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
        {/* Header */}
        <div className="py-4 px-5 border-b border-slate-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-950 z-10 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <h3 className="font-bold text-sm tracking-tight text-slate-800 dark:text-zinc-100 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Icon name="inbox" size={14} />
            </div>
            Lead Inbox 
            <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold ml-1 border border-slate-200/50 dark:border-zinc-700/50">{inquiries.length}</span>
          </h3>
          <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition-colors" title="Filter & Sort">
            <Icon name="tune" size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {inquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-900 flex items-center justify-center mb-4 border border-slate-100 dark:border-zinc-800">
                <Icon name="inbox" size={24} className="text-slate-300 dark:text-zinc-700" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">Inbox Zero</p>
              <p className="text-xs mt-1 text-slate-400 max-w-[200px]">You've caught up! No pending inquiries found right now.</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {inquiries.map((inq) => {
                const isSelected = selectedInquiry?.id === inq.id;
                const overdue = isOverdue(inq.createdAt) && inq.status !== "APPLIED";
                
                return (
                  <li 
                    key={inq.id}
                    onClick={() => setSelectedInquiry(inq)}
                    className={`relative py-3.5 px-5 cursor-pointer transition-all duration-200 group flex items-start gap-3.5 min-w-0 border-b border-slate-100/50 dark:border-zinc-800/30 ${
                      isSelected ? "bg-gradient-to-r from-sky-50/50 to-transparent dark:from-sky-900/10" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    {/* Active Line Indicator */}
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md"></div>}

                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tracking-wider shadow-sm border border-white/50 ${getAvatarColor(inq.studentName)}`}>
                      {getInitials(inq.studentName)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-bold text-sm tracking-tight truncate pr-2 transition-colors ${isSelected ? "text-primary dark:text-sky-400" : "text-slate-800 dark:text-zinc-200"}`}>
                          {inq.studentName}
                        </span>
                        {/* Status Dots */}
                        <div className="shrink-0 flex items-center gap-1.5 mt-1">
                          {overdue && (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 animate-pulse" title="Overdue">
                              <Icon name="priority_high" size={10} />
                            </span>
                          )}
                          <span className={`h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white dark:ring-zinc-950 ${
                            inq.status === "APPLIED" ? "bg-emerald-500" : "bg-amber-400"
                          }`} title={inq.status} />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 truncate mb-1.5">
                        <span className="truncate font-medium">{inq.parentName || "—"}</span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate">{inq.classApplied?.name || "—"}</span>
                      </div>
                      
                      <div className="text-[10px] font-semibold tracking-wider text-slate-400/80 dark:text-zinc-500 uppercase">
                        {new Date(inq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right Pane: Smart Details Workspace */}
      <div className="flex-1 flex flex-col bg-slate-50/60 dark:bg-zinc-950/40 relative min-w-0">
        {selectedInquiry ? (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
            {/* Unified Sleek Header */}
            <div className="px-8 py-6 border-b border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 sticky top-0 z-20">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
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
                
                <div className="flex items-center gap-2.5 shrink-0 mt-1">
                  <Button variant="text" size="sm" icon="edit_note" className="h-9 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-xl" onClick={() => onOpenInquiryWorkspace(selectedInquiry)}>
                    Add Note
                  </Button>
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
            <div className="p-8 flex-1 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                
                {/* Island Card: Family Information */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
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
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
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

              {/* Activity & Notes (Timeline Style) */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <Icon name="format_quote" size={100} />
                </div>
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                  <Icon name="forum" size={14} className="text-slate-300" /> Counselor Notes
                </h4>
                <div className="relative z-10">
                  {selectedInquiry.notes ? (
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-amber-300 p-4 rounded-r-xl">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {selectedInquiry.notes}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-dashed border-slate-200 dark:border-zinc-800">
                      <Icon name="history_edu" size={20} className="text-slate-300" />
                      <span className="text-sm font-medium text-slate-400">No activity notes recorded yet. Add a note to start tracking this lead.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400/80">
            <div className="w-20 h-20 mb-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/50 shadow-sm flex items-center justify-center relative">
              <Icon name="person_search" size={36} className="text-slate-300 dark:text-zinc-700" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white border-4 border-slate-50 dark:border-zinc-950 shadow-sm">
                <Icon name="arrow_back" size={14} />
              </div>
            </div>
            <p className="text-lg font-extrabold tracking-tight text-slate-700 dark:text-zinc-300">Select a Pipeline Lead</p>
            <p className="text-xs mt-2 text-slate-400 max-w-[240px] text-center leading-relaxed">Click on a prospect from the list to view their profile, send a message, or convert them to a formal application.</p>
          </div>
        )}
      </div>

    </div>
  );
}
