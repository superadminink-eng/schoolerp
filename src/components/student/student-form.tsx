"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { useBranches } from "@/hooks/use-branches";
import {
  createStudentSchema,
  updateStudentSchema,
  BLOOD_GROUPS,
  ID_TYPES,
  PAYMENT_MODES,
} from "@/lib/validations/student";
import { FeeConfiguration, FeeInfo, CustomInstallment } from "./fee-configuration";

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CHEQUE: "Cheque",
  BANK_TRANSFER: "Bank Transfer",
  ONLINE: "Online",
};

interface ClassOption {
  id: string;
  name: string;
  numericGrade: number;
}

interface SectionOption {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  bloodGroup: string | null;
  photo: string | null;
  address: string | null;
  pincode: string | null;
  previousSchool: string | null;
  emergencyContact1: string | null;
  emergencyContact2: string | null;
  idType: string | null;
  idNumber: string | null;
  idDocument: string | null;
  guardianName: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  admissionDate: string | null;
  status: string;
  branch: { id: string; name: string };
  enrollments?: Array<{
    section: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  }>;
  classId?: string | null;
  totalFees?: number;
  totalFeesPaid?: number;
  pendingFees?: number;
  feeAssignments?: Array<{
    feeStructureId: string;
    isOptedIn: boolean;
    discountPercent: string | null;
    discountAmount: string | null;
    feeStructure: {
      applicability: string;
    };
  }>;
  invoices?: Array<{
    id: string;
    number: string;
    dueDate: string;
    totalAmount: string;
    paidAmount: string;
    status: string;
    remarks: string | null;
  }>;
}

interface StudentFormProps {
  mode: "create" | "edit";
  initialData?: StudentData;
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function StudentForm({ mode, initialData }: StudentFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const { branches, isLoading: branchesLoading } = useBranches();

  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(mode === "create" ? createStudentSchema : updateStudentSchema),
    defaultValues: {
      firstName: initialData?.firstName ?? "",
      lastName: initialData?.lastName ?? "",
      dateOfBirth: formatDateForInput(initialData?.dateOfBirth),
      gender: initialData?.gender ?? "",
      bloodGroup: initialData?.bloodGroup ?? "",
      fatherName: initialData?.fatherName ?? "",
      fatherPhone: initialData?.fatherPhone ?? "",
      fatherEmail: initialData?.fatherEmail ?? "",
      fatherOccupation: initialData?.fatherOccupation ?? "",
      motherName: initialData?.motherName ?? "",
      motherPhone: initialData?.motherPhone ?? "",
      motherEmail: initialData?.motherEmail ?? "",
      motherOccupation: initialData?.motherOccupation ?? "",
      address: initialData?.address ?? "",
      pincode: initialData?.pincode ?? "",
      previousSchool: initialData?.previousSchool ?? "",
      emergencyContact1: initialData?.emergencyContact1 ?? "",
      emergencyContact2: initialData?.emergencyContact2 ?? "",
      idType: initialData?.idType ?? "",
      idNumber: initialData?.idNumber ?? "",
      guardianName: initialData?.guardianName ?? "",
      admissionDate: formatDateForInput(initialData?.admissionDate) || new Date().toISOString().slice(0, 10),
      branchId: initialData?.branch?.id ?? "",
      classId: initialData?.enrollments?.[0]?.section?.class?.id ?? initialData?.classId ?? "",
      sectionId: initialData?.enrollments?.[0]?.section?.id ?? "",
      discountPercent: (initialData?.feeAssignments?.find(fa => fa.discountPercent)?.discountPercent) ?? "",
      discountAmount: (initialData?.feeAssignments?.find(fa => fa.discountAmount)?.discountAmount) ?? "",
      optionalFeeIds: initialData?.feeAssignments?.filter(fa => fa.isOptedIn && fa.feeStructure.applicability === "OPTIONAL").map(fa => fa.feeStructureId) ?? [],
      customInstallments: (initialData?.invoices?.map(inv => ({
        name: inv.remarks?.replace('Installment: ', '') || 'Installment',
        dueDate: formatDateForInput(inv.dueDate),
        amount: Number(inv.totalAmount),
        status: inv.status,
        paidAmount: Number(inv.paidAmount)
      })) as CustomInstallment[]) ?? ([] as CustomInstallment[]),
      amountPaid: "",
      paymentMethod: "",
      transactionId: "",
    }
  });

  const branchId = watch("branchId");
  const classId = watch("classId");
  const paymentMethod = watch("paymentMethod");
  const discountPercent = watch("discountPercent");
  const discountAmount = watch("discountAmount");
  const optionalFeeIds = watch("optionalFeeIds");
  const customInstallments = watch("customInstallments");
  const amountPaid = watch("amountPaid");

  // File states (handled manually since react-hook-form manages text inputs by default)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);

  // Dropdown data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Fee display
  const [fees, setFees] = useState<FeeInfo[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const TABS = ["personal", "family", "admin", "fees"] as const;
  const tabIndex = TABS.indexOf(activeTab as (typeof TABS)[number]);

  // Fee computation is now mostly handled in FeeConfiguration, but we calculate remaining amount for Initial Payment UI
  const showTransactionId = paymentMethod === "UPI" || paymentMethod === "ONLINE" || paymentMethod === "BANK_TRANSFER";

  // Auto-assign branch for non-SUPER_ADMIN users
  useEffect(() => {
    if (!isSuperAdmin && session?.user?.branchId && !branchId) {
      setValue("branchId", session.user.branchId);
    }
  }, [isSuperAdmin, session?.user?.branchId, branchId, setValue]);

  // Fetch classes when branch changes
  useEffect(() => {
    if (!branchId) {
      setClasses([]);
      setValue("classId", "");
      setValue("sectionId", "");
      return;
    }

    setClassesLoading(true);
    fetch(`/api/v1/classes?branchId=${branchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setClasses(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setClassesLoading(false));
  }, [branchId, setValue]);

  // Fetch sections and fees when class changes
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setValue("sectionId", "");
      return;
    }

    setSectionsLoading(true);
    fetch(`/api/v1/classes/${classId}/sections`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSections(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setSectionsLoading(false));
  }, [classId, setValue]);

  const prevClassId = useRef(classId);
  useEffect(() => {
    if (prevClassId.current !== undefined && prevClassId.current !== classId) {
      setValue("discountPercent", "");
      setValue("amountPaid", "");
      setValue("paymentMethod", "");
      setValue("transactionId", "");
    }
    prevClassId.current = classId;

    if (!classId) {
      setFees([]);
      return;
    }

    setFeesLoading(true);
    fetch(`/api/v1/classes/${classId}/fees`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFees(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setFeesLoading(false));
  }, [classId, setValue]);

  async function onSubmit(formDataFields: any) {
    setLoading(true);
    try {
      const formData = new FormData();

      // Add all text fields
      for (const [key, value] of Object.entries(formDataFields)) {
        if (value !== undefined && value !== null && value !== "") {
          if (key === "optionalFeeIds") {
            (value as string[]).forEach(id => formData.append("optionalFeeIds", id));
          } else if (key === "customInstallments") {
            formData.append("customInstallments", JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      }

      // Add files
      if (photoFile) {
        formData.append("photo", photoFile);
      }
      if (idDocFile) {
        formData.append("idDocument", idDocFile);
      }

      const url = mode === "create" ? "/api/v1/students" : `/api/v1/students/${initialData!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        snackbar.show(data.error?.message ?? `Failed to ${mode} student`, "error");
        return;
      }

      snackbar.show(`Student ${mode === "create" ? "admitted" : "updated"} successfully`, "success");
      router.push(`/students/${data.data.id}`);
      router.refresh();
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "create" && !branchesLoading && branches.length === 0) {
    return (
      <Card variant="outlined" className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-sm shadow-red-500/10">
            <Icon name="warning" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm font-black text-on-surface">Campus Branch Configuration Required</h2>
            <p className="text-body-md text-on-surface-variant/80 max-w-md">
              To enroll students, your organization must first configure at least one active Campus Branch.
            </p>
          </div>
          <Button
            variant="tonal"
            icon="domain"
            onClick={() => router.push("/branches")}
            className="hover:scale-[1.02] transition-all duration-200"
          >
            Configure Branches
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "create" && branchId && !classesLoading && classes.length === 0) {
    return (
      <Card variant="outlined" className="mx-auto max-w-2xl border-red-500/20 bg-red-500/5">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-sm shadow-red-500/10">
            <Icon name="warning" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm font-black text-on-surface">Classes & Divisions Required</h2>
            <p className="text-body-md text-on-surface-variant/80 max-w-md">
              No classes are configured for the selected branch. You must create classes and divisions before enrolling students.
            </p>
          </div>
          <Button
            variant="tonal"
            icon="class"
            onClick={() => router.push("/classes")}
            className="hover:scale-[1.02] transition-all duration-200"
          >
            Configure Classes & Divisions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="family">Family & Address</TabsTrigger>
          <TabsTrigger value="admin">Academic</TabsTrigger>
          <TabsTrigger value="fees">Fee Configuration</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Personal Information ────────────────────── */}
        <TabsContent value="personal">
          <Card variant="outlined">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="First name"
                  {...register("firstName")}
                  error={errors.firstName?.message}
                  required
                  fullWidth
                />
                <TextField
                  label="Last name"
                  {...register("lastName")}
                  error={errors.lastName?.message}
                  required
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Date of birth"
                  type="date"
                  {...register("dateOfBirth")}
                  error={errors.dateOfBirth?.message}
                  required
                  fullWidth
                />
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Gender *
                  </label>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger fullWidth>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.gender?.message && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.gender.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Blood group
                  </label>
                  <Controller
                    control={control}
                    name="bloodGroup"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger fullWidth>
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOOD_GROUPS.map((bg) => (
                            <SelectItem key={bg} value={bg}>
                              {bg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <FileUpload
                  label="Photo"
                  accept="image/jpeg,image/png,image/webp"
                  value={photoFile}
                  onChange={setPhotoFile}
                  preview={initialData?.photo}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Family & Address ───────────────────────── */}
        <TabsContent value="family">
          <Card variant="outlined">
            <CardContent className="p-6 space-y-4">
              {/* Father */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Father name"
                  {...register("fatherName")}
                  error={errors.fatherName?.message}
                  fullWidth
                />
                <TextField
                  label="Contact number"
                  type="tel"
                  {...register("fatherPhone")}
                  error={errors.fatherPhone?.message}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Email address"
                  type="email"
                  {...register("fatherEmail")}
                  error={errors.fatherEmail?.message}
                  fullWidth
                />
                <TextField
                  label="Occupation"
                  {...register("fatherOccupation")}
                  error={errors.fatherOccupation?.message}
                  fullWidth
                />
              </div>

              {/* Mother */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Mother name"
                  {...register("motherName")}
                  error={errors.motherName?.message}
                  fullWidth
                />
                <TextField
                  label="Contact number"
                  type="tel"
                  {...register("motherPhone")}
                  error={errors.motherPhone?.message}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Email address"
                  type="email"
                  {...register("motherEmail")}
                  error={errors.motherEmail?.message}
                  fullWidth
                />
                <TextField
                  label="Occupation"
                  {...register("motherOccupation")}
                  error={errors.motherOccupation?.message}
                  fullWidth
                />
              </div>

              {/* Address & Other */}
              <TextField
                label="Full address"
                {...register("address")}
                error={errors.address?.message}
                required
                fullWidth
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Pincode"
                  {...register("pincode")}
                  error={errors.pincode?.message}
                  required
                  fullWidth
                />
                <TextField
                  label="Previous school"
                  {...register("previousSchool")}
                  error={errors.previousSchool?.message}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Emergency number 1"
                  type="tel"
                  {...register("emergencyContact1")}
                  error={errors.emergencyContact1?.message}
                  required
                  fullWidth
                />
                <TextField
                  label="Emergency number 2"
                  type="tel"
                  {...register("emergencyContact2")}
                  error={errors.emergencyContact2?.message}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    ID *
                  </label>
                  <Controller
                    control={control}
                    name="idType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger fullWidth>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ID_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.idType?.message && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.idType.message}</p>
                  )}
                </div>
                <FileUpload
                  label="Upload ID"
                  accept="image/jpeg,image/png,image/webp"
                  value={idDocFile}
                  onChange={setIdDocFile}
                  preview={initialData?.idDocument}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="ID number"
                  {...register("idNumber")}
                  error={errors.idNumber?.message}
                  required
                  fullWidth
                />
                <TextField
                  label="Who looks after child at home"
                  {...register("guardianName")}
                  error={errors.guardianName?.message}
                  fullWidth
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Academic ─────────────────────────── */}
        <TabsContent value="admin">
          <Card variant="outlined">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Admission date"
                  type="date"
                  {...register("admissionDate")}
                  error={errors.admissionDate?.message}
                  fullWidth
                />
                {isSuperAdmin && (
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant px-1">
                      Branch *
                    </label>
                    <Controller
                      control={control}
                      name="branchId"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={(v) => { field.onChange(v); setValue("classId", ""); setValue("sectionId", ""); }}>
                          <SelectTrigger fullWidth>
                            <SelectValue placeholder={branchesLoading ? "Loading..." : "Select branch"} />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.branchId?.message && (
                      <p className="px-4 text-[12px] leading-4 text-error">{errors.branchId.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Standard *
                  </label>
                  <Controller
                    control={control}
                    name="classId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => { field.onChange(v); setValue("sectionId", ""); }}
                        disabled={!branchId}
                      >
                        <SelectTrigger fullWidth>
                          <SelectValue placeholder={classesLoading ? "Loading..." : "Select standard"} />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Division
                  </label>
                  <Controller
                    control={control}
                    name="sectionId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!classId}
                      >
                        <SelectTrigger fullWidth>
                          <SelectValue placeholder={sectionsLoading ? "Loading..." : "Select division"} />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.sectionId?.message && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.sectionId.message}</p>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 4: Fee Configuration ─────────────────────────── */}
          <TabsContent value="fees">
            <Card variant="outlined">
              <CardContent className="p-6 space-y-6">
                {feesLoading && (
                  <p className="text-body-sm text-on-surface-variant">Loading fees...</p>
                )}
                {fees.length > 0 && !feesLoading && (
                  <>
                    <FeeConfiguration 
                      fees={fees}
                      discountPercent={discountPercent}
                      discountAmount={discountAmount}
                      amountPaid={amountPaid}
                      optionalFeeIds={optionalFeeIds}
                      customInstallments={customInstallments}
                      onUpdate={(field, val) => setValue(field as any, val, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                    />

                    {mode === "create" && (
                      <div className="rounded-lg border border-outline-variant p-4 space-y-4 mt-6">
                        <p className="text-label-lg font-bold text-on-surface">Initial Payment Collection</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Controller
                            control={control}
                            name="amountPaid"
                            render={({ field }) => (
                              <CurrencyInput
                                label="Amount Paid Now (₹)"
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.amountPaid?.message}
                                fullWidth
                              />
                            )}
                          />
                          <div className="flex flex-col gap-1">
                            <label className="text-label-md text-on-surface-variant px-1">
                              Payment Method
                            </label>
                            <Controller
                              control={control}
                              name="paymentMethod"
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger fullWidth>
                                    <SelectValue placeholder="Select method" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAYMENT_MODES.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {PAYMENT_METHOD_LABELS[m]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.paymentMethod?.message && (
                              <p className="px-4 text-[12px] leading-4 text-error">{errors.paymentMethod.message}</p>
                            )}
                          </div>
                          {showTransactionId && (
                            <TextField
                              label="Transaction ID"
                              {...register("transactionId")}
                              error={errors.transactionId?.message}
                              fullWidth
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {fees.length === 0 && !feesLoading && classId && (
                  <p className="text-body-sm text-error">No fee structure configured for this class yet. Please set it up in Settings.</p>
                )}

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-6">
        <div>
          {tabIndex === 0 && (
            <Button
              type="button"
              variant="outlined"
              onClick={() => router.push("/students")}
            >
              Cancel
            </Button>
          )}
          {tabIndex > 0 && (
            <Button
              type="button"
              variant="outlined"
              icon="arrow_back"
              onClick={() => setActiveTab(TABS[tabIndex - 1])}
            >
              Back
            </Button>
          )}
        </div>
        <div>
          {tabIndex < TABS.length - 1 && (
            <Button
              type="button"
              variant="filled"
              onClick={() => setActiveTab(TABS[tabIndex + 1])}
            >
              {tabIndex === 0 ? "Continue" : "Next"}
            </Button>
          )}
          {tabIndex === TABS.length - 1 && (
            <Button type="submit" variant="filled" loading={loading} icon={mode === "create" ? "add" : "check"}>
              {mode === "create" ? "Admit Student" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
