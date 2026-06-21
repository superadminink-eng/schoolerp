"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSnackbar } from "@/components/ui/snackbar";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/upload-url";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  plan: string;
}

interface BranchData {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
}

interface AcademicYearData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

type TabType = "school" | "branch" | "academic";

function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const snackbar = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("school");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Original Data Backup (for dirty checking & discard action)
  const [originalData, setOriginalData] = useState<any>(null);

  // School profile states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [plan, setPlan] = useState("FREE");
  const [slug, setSlug] = useState("");

  // Branch profile states
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchAddress, setBranchAddress] = useState("");

  // Academic year states
  const [academicYearName, setAcademicYearName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);

  // Load settings for Organization, Branch, and Academic Year
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/v1/organizations/settings");
        const data = await res.json();
        if (data.success && data.data) {
          const organization = data.data.organization as OrganizationData;
          const branch = data.data.mainBranch as BranchData;
          const academicYear = data.data.academicYear as AcademicYearData;

          const logoPath = organization?.logo ? getUploadUrl(organization.logo) : null;

          // Save backup for dirty state comparisons
          setOriginalData({
            name: organization?.name || "",
            phone: organization?.phone ?? "",
            website: organization?.website ?? "",
            address: organization?.address ?? "",
            logoPreview: logoPath,
            plan: organization?.plan || "FREE",
            slug: organization?.slug || "",
            branchName: branch?.name || "",
            branchCode: branch?.code || "",
            branchPhone: branch?.phone ?? "",
            branchAddress: branch?.address ?? "",
            academicYearName: academicYear?.name || "",
            startDate: academicYear ? formatDateForInput(academicYear.startDate) : "",
            endDate: academicYear ? formatDateForInput(academicYear.endDate) : "",
          });

          // Populate school profile
          if (organization) {
            setName(organization.name);
            setPhone(organization.phone ?? "");
            setWebsite(organization.website ?? "");
            setAddress(organization.address ?? "");
            setPlan(organization.plan);
            setSlug(organization.slug);
            setLogoPreview(logoPath);
          }

          // Populate main branch profile
          if (branch) {
            setBranchName(branch.name);
            setBranchCode(branch.code);
            setBranchPhone(branch.phone ?? "");
            setBranchAddress(branch.address ?? "");
          }

          // Populate academic year details
          if (academicYear) {
            setAcademicYearName(academicYear.name);
            setStartDate(formatDateForInput(academicYear.startDate));
            setEndDate(formatDateForInput(academicYear.endDate));
          }
        } else {
          snackbar.show(data.error?.message || "Failed to load school settings", "error");
        }
      } catch (error) {
        console.error("Load settings error:", error);
        snackbar.show("An error occurred while loading settings", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [snackbar]);

  // Dirty state calculation
  const isDirty = originalData ? (
    name !== originalData.name ||
    phone !== originalData.phone ||
    website !== originalData.website ||
    address !== originalData.address ||
    logoFile !== null ||
    removeLogo !== false ||
    branchName !== originalData.branchName ||
    branchCode !== originalData.branchCode ||
    branchPhone !== originalData.branchPhone ||
    branchAddress !== originalData.branchAddress ||
    academicYearName !== originalData.academicYearName ||
    startDate !== originalData.startDate ||
    endDate !== originalData.endDate
  ) : false;

  const handleDiscard = () => {
    if (!originalData) return;
    setName(originalData.name);
    setPhone(originalData.phone);
    setWebsite(originalData.website);
    setAddress(originalData.address);
    setLogoPreview(originalData.logoPreview);
    setLogoFile(null);
    setRemoveLogo(false);
    setConfirmDelete(false);

    setBranchName(originalData.branchName);
    setBranchCode(originalData.branchCode);
    setBranchPhone(originalData.branchPhone);
    setBranchAddress(originalData.branchAddress);

    setAcademicYearName(originalData.academicYearName);
    setStartDate(originalData.startDate);
    setEndDate(originalData.endDate);

    setErrors({});
    snackbar.show("Changes discarded.", "info");
  };

  // Handle Logo Drag-and-Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      snackbar.show("Invalid file type. Only JPG, PNG, and WebP are allowed.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      snackbar.show("File too large. Maximum size is 2MB.", "error");
      return;
    }

    setLogoFile(file);
    setRemoveLogo(false);
    setConfirmDelete(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "School Name is required";
    if (!branchName.trim()) newErrors.branchName = "Branch Name is required";
    if (!branchCode.trim()) newErrors.branchCode = "Branch Code is required";
    if (!academicYearName.trim()) newErrors.academicYearName = "Academic Year Name is required";
    if (!startDate) newErrors.startDate = "Start Date is required";
    if (!endDate) newErrors.endDate = "End Date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // Autofocus Tab depending on where the error is
      if (newErrors.name) {
        setActiveTab("school");
      } else if (newErrors.branchName || newErrors.branchCode) {
        setActiveTab("branch");
      } else if (newErrors.academicYearName || newErrors.startDate || newErrors.endDate) {
        setActiveTab("academic");
      }

      snackbar.show("Please fill in all mandatory fields.", "error");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      // School
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      formData.append("website", website.trim());
      formData.append("address", address.trim());
      formData.append("removeLogo", removeLogo ? "true" : "false");
      if (logoFile) {
        formData.append("logo", logoFile);
      }
      
      // Branch
      formData.append("branchName", branchName.trim());
      formData.append("branchCode", branchCode.trim().toUpperCase());
      formData.append("branchPhone", branchPhone.trim());
      formData.append("branchAddress", branchAddress.trim());

      // Academic Year
      formData.append("academicYearName", academicYearName.trim());
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);

      const res = await fetch("/api/v1/organizations/settings", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data) {
        const organization = data.data.organization as OrganizationData;
        const branch = data.data.mainBranch as BranchData;
        const academicYear = data.data.academicYear as AcademicYearData;

        // Reset local states
        setLogoFile(null);
        setRemoveLogo(false);
        setConfirmDelete(false);

        const logoPath = organization?.logo ? getUploadUrl(organization.logo) : null;

        // Update backup
        setOriginalData({
          name: organization?.name || "",
          phone: organization?.phone ?? "",
          website: organization?.website ?? "",
          address: organization?.address ?? "",
          logoPreview: logoPath,
          plan: organization?.plan || "FREE",
          slug: organization?.slug || "",
          branchName: branch?.name || "",
          branchCode: branch?.code || "",
          branchPhone: branch?.phone ?? "",
          branchAddress: branch?.address ?? "",
          academicYearName: academicYear?.name || "",
          startDate: academicYear ? formatDateForInput(academicYear.startDate) : "",
          endDate: academicYear ? formatDateForInput(academicYear.endDate) : "",
        });

        if (organization) {
          setName(organization.name);
          setPhone(organization.phone ?? "");
          setWebsite(organization.website ?? "");
          setAddress(organization.address ?? "");
          setPlan(organization.plan);
          setLogoPreview(logoPath);
        }

        if (branch) {
          setBranchName(branch.name);
          setBranchCode(branch.code);
          setBranchPhone(branch.phone ?? "");
          setBranchAddress(branch.address ?? "");
        }

        if (academicYear) {
          setAcademicYearName(academicYear.name);
          setStartDate(formatDateForInput(academicYear.startDate));
          setEndDate(formatDateForInput(academicYear.endDate));
        }

        snackbar.show("School profile & branch settings updated successfully!", "success");

        // Dynamically update NextAuth session
        await update({
          organizationName: organization.name,
          organizationLogo: organization.logo,
        });
      } else {
        snackbar.show(data.error?.message || "Failed to update school settings.", "error");
      }
    } catch (error) {
      console.error("Save settings error:", error);
      snackbar.show("An error occurred while saving settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    setConfirmDelete(false);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-body-md text-on-surface-variant font-medium">Loading school settings...</p>
      </div>
    );
  }

  const tabs = [
    { id: "school", label: "School Profile", icon: "domain" },
    { id: "branch", label: "Main Branch", icon: "location_city" },
    { id: "academic", label: "Academic Session", icon: "date_range" },
  ] as const;

  return (
    <div className="relative space-y-6 max-w-5xl mx-auto pb-24">
      {/* Ambient background blur orbs */}
      <div className="absolute top-0 right-1/4 -z-10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 left-1/3 -z-10 w-80 h-80 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-slate-800/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">School Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your organization details, main campus branch, and active academic sessions.
          </p>
        </div>
      </div>

      {/* Modern Pill Capsule Tab Headers */}
      <div className="flex bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/40 gap-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold tracking-tight transition-all duration-150 cursor-pointer flex items-center gap-2 border-none outline-none focus:outline-none focus:ring-0 select-none",
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Glassmorphic form details */}
          <div className="lg:col-span-8">
            <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm shadow-slate-100/50 dark:shadow-none rounded-2xl overflow-hidden transition-all duration-200">
              <CardContent className="p-6 md:p-8 space-y-6">
                
                {/* 1. SCHOOL PROFILE TAB */}
                {activeTab === "school" && (
                  <div className="space-y-6">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-2">
                      <Icon name="domain" className="text-primary" size={18} />
                      School Profile Details
                    </h2>

                    <TextField
                      label="School / Organization Name *"
                      variant="compact"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={errors.name}
                      placeholder="e.g. Silver Oak International School"
                      className="w-full"
                    />

                    {slug && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">Workspace URL Slug</span>
                        <div className="flex items-center h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-3 text-xs font-mono text-slate-500 dark:text-slate-450 select-all">
                          {slug}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        label="Contact Phone"
                        variant="compact"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full"
                      />

                      <TextField
                        label="School Website"
                        variant="compact"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="e.g. https://www.silveroak.edu.in"
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">School Address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter campus physical address..."
                        rows={3}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all duration-200 outline-none",
                          "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary",
                          "placeholder:text-slate-400 dark:placeholder:text-slate-650"
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* 2. MAIN BRANCH TAB */}
                {activeTab === "branch" && (
                  <div className="space-y-6">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-2">
                      <Icon name="location_city" className="text-primary" size={18} />
                      Primary Campus Branch Info
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <TextField
                          label="Main Branch Name *"
                          variant="compact"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                          error={errors.branchName}
                          placeholder="e.g. Main Branch"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <TextField
                          label="Branch Code *"
                          variant="compact"
                          value={branchCode}
                          onChange={(e) => setBranchCode(e.target.value)}
                          error={errors.branchCode}
                          placeholder="e.g. SLV-MAIN"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <TextField
                      label="Branch Phone"
                      variant="compact"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      placeholder="e.g. +91 22 2345 6789"
                      className="w-full"
                    />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">Branch Address</label>
                      <textarea
                        value={branchAddress}
                        onChange={(e) => setBranchAddress(e.target.value)}
                        placeholder="Enter branch physical address..."
                        rows={3}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all duration-200 outline-none",
                          "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary",
                          "placeholder:text-slate-400 dark:placeholder:text-slate-650"
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* 3. ACADEMIC SESSION TAB */}
                {activeTab === "academic" && (
                  <div className="space-y-6">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-2">
                      <Icon name="date_range" className="text-primary" size={18} />
                      Active Academic Session
                    </h2>

                    <TextField
                      label="Academic Year Name *"
                      variant="compact"
                      value={academicYearName}
                      onChange={(e) => setAcademicYearName(e.target.value)}
                      error={errors.academicYearName}
                      placeholder="e.g. 2026-27"
                      className="w-full"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">
                          Start Date <span className="text-error ml-0.5">*</span>
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={cn(
                            "w-full h-10 rounded-lg border px-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all duration-200 outline-none",
                            errors.startDate
                              ? "border-error focus:ring-2 focus:ring-error/20 focus:border-error"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary"
                          )}
                        />
                        {errors.startDate && <p className="mt-0.5 px-0.5 text-[11px] leading-4 text-error">{errors.startDate}</p>}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">
                          End Date <span className="text-error ml-0.5">*</span>
                        </span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={cn(
                            "w-full h-10 rounded-lg border px-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all duration-200 outline-none",
                            errors.endDate
                              ? "border-error focus:ring-2 focus:ring-error/20 focus:border-error"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary"
                          )}
                        />
                        {errors.endDate && <p className="mt-0.5 px-0.5 text-[11px] leading-4 text-error">{errors.endDate}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Branding Logo box (persistent display) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm shadow-slate-100/50 dark:shadow-none rounded-2xl overflow-hidden transition-all duration-200">
              <CardContent className="p-6 md:p-8 flex flex-col items-center text-center space-y-6">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 w-full border-b border-slate-100 dark:border-slate-800/50 pb-3 text-left">
                  Workspace Logo
                </h2>

                {/* Logo Preview card */}
                <div className="relative w-36 h-36 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-center shadow-inner overflow-hidden shrink-0 transition-all duration-300 group hover:border-slate-200 dark:hover:border-slate-700">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="School Logo Preview"
                      className="w-full h-full object-cover animate-fade-in transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                      <Icon name="school" size={36} className="text-slate-300 dark:text-slate-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No Logo</span>
                    </div>
                  )}
                </div>

                {/* Double click/Safety confirm Delete button */}
                {logoPreview && (
                  <div className="transition-all duration-200">
                    {confirmDelete ? (
                      <div className="flex items-center gap-2 animate-fade-in bg-red-50/50 dark:bg-red-950/10 p-1.5 rounded-xl border border-red-100/30 dark:border-red-900/20">
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 cursor-pointer shadow-sm shadow-red-500/10 active:scale-95 border-none outline-none"
                        >
                          <Icon name="check" size={12} />
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/85 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-none outline-none"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-500/80 hover:text-red-650 transition-colors uppercase tracking-widest cursor-pointer outline-none border-none bg-transparent"
                      >
                        <Icon name="delete" size={14} className="text-red-500/80" />
                        Remove Logo
                      </button>
                    )}
                  </div>
                )}

                {/* Upload drag & drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 select-none",
                    dragActive 
                      ? "border-primary bg-primary/5 dark:bg-primary/10" 
                      : "border-slate-200 dark:border-slate-805 hover:border-primary/50 dark:hover:border-primary/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon name="upload" size={16} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Click or drag logo</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">JPEG, PNG, WebP up to 2MB</p>
                  </div>
                </div>

                {/* Info block */}
                <div className="w-full text-left bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-2">Guidelines</span>
                  <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 font-medium list-disc pl-4">
                    <li>Transparent PNG recommended</li>
                    <li>Square ratio (1:1) displays best</li>
                    <li>Updates propagate instantly</li>
                  </ul>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>

        {/* 4. SILICON VALLEY FLOATING UNSAVED CHANGES BANNER (Vercel Style) */}
        {isDirty && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-slide-up">
            <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white border border-white/10 dark:border-white/5 backdrop-blur-lg rounded-2xl px-6 py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold tracking-tight text-slate-200">
                  You have unsaved changes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDiscard}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer outline-none bg-transparent border-none"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-white text-slate-950 rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-white/5 outline-none border-none"
                >
                  {saving ? (
                    <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="save" size={13} />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </form>
    </div>
  );
}

