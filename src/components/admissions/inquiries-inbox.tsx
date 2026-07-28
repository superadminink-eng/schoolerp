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

  // Helper to format WhatsApp message
  const handleSendWelcomeWhatsApp = (inq: Inquiry) => {
    if (!inq.parentPhone) {
      alert("No parent phone number provided for this inquiry.");
      return;
    }

    // Sanitize phone number (digits only)
    let phone = inq.parentPhone.replace(/\D/g, "");
    
    // Automatically prepend 91 if it's exactly 10 digits (India)
    if (phone.length === 10) {
      phone = "91" + phone;
    }

    const classNameText = inq.classApplied ? ` in *${inq.classApplied.name}*` : "";
    
    const message = `✨ *Welcome to ${schoolName}!* ✨\n\nHi *${inq.parentName}*,\nThank you for showing interest in securing a bright future for *${inq.studentName}*${classNameText}. 🎓\n\nTo fast-track your admission process, please keep these documents ready for your campus visit:\n\n📄 *Birth Certificate*\n🪪 *Student Aadhaar*\n📸 *Passport Photo*\n📈 *Previous Marksheet* (if applicable)\n\nIf you have any questions, just reply here. We’d love to guide you through! 🤝`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Quick helper to determine SLA status (e.g. older than 48 hours is overdue)
  const isOverdue = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffHours > 48;
  };

  return (
    <div className="flex h-[calc(100vh-280px)] w-full border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
      
      {/* Left Pane: High-Density Lead List */}
      <div className="w-1/3 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950">
          <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <Icon name="inbox" size={18} className="text-sky-500" />
            Lead Inbox ({inquiries.length})
          </h3>
          <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-slate-500">
            <Icon name="filter_list" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
              <Icon name="done_all" size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-bold">Inbox Zero!</p>
              <p className="text-xs mt-1">No pending inquiries found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {inquiries.map((inq) => {
                const isSelected = selectedInquiry?.id === inq.id;
                const overdue = isOverdue(inq.createdAt) && inq.status !== "APPLIED";
                
                return (
                  <li 
                    key={inq.id}
                    onClick={() => setSelectedInquiry(inq)}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 ${
                      isSelected ? "bg-sky-50 dark:bg-sky-900/20 border-l-4 border-l-sky-500" : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm text-slate-800 dark:text-zinc-200 truncate pr-2">
                        {inq.studentName}
                      </span>
                      {overdue && (
                        <span className="shrink-0 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                          <Icon name="schedule" size={10} /> Overdue
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-2">
                      <span className="truncate">{inq.classApplied?.name || "N/A"}</span>
                      <span>•</span>
                      <span className="truncate">{inq.parentName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-medium text-slate-400">
                        {new Date(inq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        inq.status === "APPLIED" 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {inq.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right Pane: Details & Actions */}
      <div className="w-2/3 flex flex-col bg-slate-50 dark:bg-zinc-950/50 relative">
        {selectedInquiry ? (
          <div className="flex flex-col h-full">
            {/* Detail Header */}
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100">
                    {selectedInquiry.studentName}
                  </h2>
                  <div className="flex gap-4 mt-2 text-sm text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Icon name="school" size={16} /> {selectedInquiry.classApplied?.name || "No Class"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="group" size={16} /> {selectedInquiry.source}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outlined" size="sm" icon="edit" onClick={() => onOpenInquiryWorkspace(selectedInquiry)}>
                    Edit / Note
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="sm" 
                    icon="forum"
                    onClick={() => handleSendWelcomeWhatsApp(selectedInquiry)}
                    disabled={!selectedInquiry.parentPhone}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                  >
                    WhatsApp
                  </Button>
                  {selectedInquiry.status !== "APPLIED" && canVerifyDocs && (
                    <Button 
                      variant="filled" 
                      size="sm" 
                      icon="app_registration"
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

            {/* Detail Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Icon name="contact_phone" size={14} /> Parent Details
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Name</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{selectedInquiry.parentName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Phone</p>
                      <p className="text-sm font-mono text-slate-800 dark:text-zinc-200">{selectedInquiry.parentPhone}</p>
                    </div>
                    {selectedInquiry.parentEmail && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Email</p>
                        <p className="text-sm text-slate-800 dark:text-zinc-200">{selectedInquiry.parentEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Icon name="event_note" size={14} /> Logs & Notes
                  </h4>
                  <div className="text-sm text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 italic min-h-[100px]">
                    {selectedInquiry.notes ? selectedInquiry.notes : "No notes logged yet."}
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Icon name="ads_click" size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-bold text-slate-500 dark:text-zinc-400">Select an Inquiry</p>
            <p className="text-sm mt-1">Click on a lead from the list to view details or convert to an application.</p>
          </div>
        )}
      </div>

    </div>
  );
}
