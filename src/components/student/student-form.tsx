"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
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
import { useSnackbar } from "@/components/ui/snackbar";
import { useBranches } from "@/hooks/use-branches";
import {
  createStudentSchema,
  updateStudentSchema,
  BLOOD_GROUPS,
  ID_TYPES,
  PAYMENT_MODES,
} from "@/lib/validations/student";

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

interface FeeInfo {
  id: string;
  name: string;
  amount: number;
  frequency: string;
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

  // Personal Information
  const [firstName, setFirstName] = useState(initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(initialData?.lastName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(formatDateForInput(initialData?.dateOfBirth));
  const [gender, setGender] = useState(initialData?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState(initialData?.bloodGroup ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Family Information
  const [fatherName, setFatherName] = useState(initialData?.fatherName ?? "");
  const [fatherPhone, setFatherPhone] = useState(initialData?.fatherPhone ?? "");
  const [fatherEmail, setFatherEmail] = useState(initialData?.fatherEmail ?? "");
  const [fatherOccupation, setFatherOccupation] = useState(initialData?.fatherOccupation ?? "");
  const [motherName, setMotherName] = useState(initialData?.motherName ?? "");
  const [motherPhone, setMotherPhone] = useState(initialData?.motherPhone ?? "");
  const [motherEmail, setMotherEmail] = useState(initialData?.motherEmail ?? "");
  const [motherOccupation, setMotherOccupation] = useState(initialData?.motherOccupation ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [pincode, setPincode] = useState(initialData?.pincode ?? "");
  const [previousSchool, setPreviousSchool] = useState(initialData?.previousSchool ?? "");
  const [emergencyContact1, setEmergencyContact1] = useState(initialData?.emergencyContact1 ?? "");
  const [emergencyContact2, setEmergencyContact2] = useState(initialData?.emergencyContact2 ?? "");
  const [idType, setIdType] = useState(initialData?.idType ?? "");
  const [idNumber, setIdNumber] = useState(initialData?.idNumber ?? "");
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [guardianName, setGuardianName] = useState(initialData?.guardianName ?? "");

  // Administration Information
  const [admissionDate, setAdmissionDate] = useState(formatDateForInput(initialData?.admissionDate));
  const [branchId, setBranchId] = useState(initialData?.branch?.id ?? "");
  const [classId, setClassId] = useState(
    initialData?.enrollments?.[0]?.section?.class?.id ?? initialData?.classId ?? ""
  );
  const [sectionId, setSectionId] = useState(
    initialData?.enrollments?.[0]?.section?.id ?? ""
  );

  // Dropdown data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Fee display
  const [fees, setFees] = useState<FeeInfo[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);

  // Fee collection (create mode only)
  const [discountPercent, setDiscountPercent] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const TABS = ["personal", "family", "admin"] as const;
  const tabIndex = TABS.indexOf(activeTab as (typeof TABS)[number]);

  // Fee computation
  const annualTotal = useMemo(
    () =>
      fees.reduce((sum, f) => {
        switch (f.frequency) {
          case "MONTHLY": return sum + f.amount * 12;
          case "QUARTERLY": return sum + f.amount * 4;
          case "SEMI_ANNUAL": return sum + f.amount * 2;
          default: return sum + f.amount;
        }
      }, 0),
    [fees]
  );

  const discountAmt = annualTotal * (parseFloat(discountPercent) || 0) / 100;
  const discountedTotal = annualTotal - discountAmt;
  const paidNum = parseFloat(amountPaid) || 0;
  const remainingAmount = Math.max(0, discountedTotal - paidNum);

  const showTransactionId = paymentMethod === "UPI" || paymentMethod === "ONLINE" || paymentMethod === "BANK_TRANSFER";

  // Auto-assign branch for non-SUPER_ADMIN users
  useEffect(() => {
    if (!isSuperAdmin && session?.user?.branchId && !branchId) {
      setBranchId(session.user.branchId);
    }
  }, [isSuperAdmin, session?.user?.branchId, branchId]);

  // Fetch classes when branch changes
  useEffect(() => {
    if (!branchId) {
      setClasses([]);
      setClassId("");
      setSectionId("");
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
  }, [branchId]);

  // Fetch sections when class changes
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId("");
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
  }, [classId]);

  // Fetch fees when class changes
  useEffect(() => {
    setDiscountPercent("");
    setAmountPaid("");
    setPaymentMethod("");
    setTransactionId("");
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
  }, [classId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formFields = {
      firstName,
      lastName,
      dateOfBirth,
      gender: gender || undefined,
      bloodGroup: bloodGroup || undefined,
      address,
      pincode,
      previousSchool: previousSchool || undefined,
      emergencyContact1,
      emergencyContact2: emergencyContact2 || undefined,
      idType,
      idNumber,
      guardianName: guardianName || undefined,
      fatherName: fatherName || undefined,
      fatherPhone: fatherPhone || undefined,
      fatherEmail: fatherEmail || undefined,
      fatherOccupation: fatherOccupation || undefined,
      motherName: motherName || undefined,
      motherPhone: motherPhone || undefined,
      motherEmail: motherEmail || undefined,
      motherOccupation: motherOccupation || undefined,
      admissionDate: admissionDate || undefined,
      branchId,
      classId,
      sectionId,
      discountPercent: discountPercent || undefined,
      amountPaid: amountPaid || undefined,
      paymentMethod: paymentMethod || undefined,
      transactionId: transactionId || undefined,
    };

    if (mode === "create") {
      const result = createStudentSchema.safeParse(formFields);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const formData = new FormData();

        // Add all text fields
        for (const [key, value] of Object.entries(result.data)) {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        }

        // Add files
        if (photoFile) {
          formData.append("photo", photoFile);
        }
        if (idDocFile) {
          formData.append("idDocument", idDocFile);
        }

        const res = await fetch("/api/v1/students", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create student", "error");
          return;
        }

        snackbar.show("Student admitted successfully", "success");
        router.push("/students");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateStudentSchema.safeParse(formFields);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const formData = new FormData();
        for (const [key, value] of Object.entries(result.data)) {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        }
        if (photoFile) {
          formData.append("photo", photoFile);
        }
        if (idDocFile) {
          formData.append("idDocument", idDocFile);
        }

        const res = await fetch(`/api/v1/students/${initialData!.id}`, {
          method: "PATCH",
          body: formData,
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update student", "error");
          return;
        }

        snackbar.show("Student updated successfully", "success");
        router.push("/students");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="family">Family & Address</TabsTrigger>
          <TabsTrigger value="admin">Administration</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Personal Information ────────────────────── */}
        <TabsContent value="personal">
          <Card variant="outlined">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={errors.firstName}
                  required
                  fullWidth
                />
                <TextField
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  error={errors.lastName}
                  required
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Date of birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  error={errors.dateOfBirth}
                  required
                  fullWidth
                />
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Gender *
                  </label>
                  <Select value={gender} onValueChange={setGender}>
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
                  {errors.gender && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.gender}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Blood group
                  </label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
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
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  error={errors.fatherName}
                  fullWidth
                />
                <TextField
                  label="Contact number"
                  type="tel"
                  value={fatherPhone}
                  onChange={(e) => setFatherPhone(e.target.value)}
                  error={errors.fatherPhone}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Email address"
                  type="email"
                  value={fatherEmail}
                  onChange={(e) => setFatherEmail(e.target.value)}
                  error={errors.fatherEmail}
                  fullWidth
                />
                <TextField
                  label="Occupation"
                  value={fatherOccupation}
                  onChange={(e) => setFatherOccupation(e.target.value)}
                  error={errors.fatherOccupation}
                  fullWidth
                />
              </div>

              {/* Mother */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Mother name"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  error={errors.motherName}
                  fullWidth
                />
                <TextField
                  label="Contact number"
                  type="tel"
                  value={motherPhone}
                  onChange={(e) => setMotherPhone(e.target.value)}
                  error={errors.motherPhone}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Email address"
                  type="email"
                  value={motherEmail}
                  onChange={(e) => setMotherEmail(e.target.value)}
                  error={errors.motherEmail}
                  fullWidth
                />
                <TextField
                  label="Occupation"
                  value={motherOccupation}
                  onChange={(e) => setMotherOccupation(e.target.value)}
                  error={errors.motherOccupation}
                  fullWidth
                />
              </div>

              {/* Address & Other */}
              <TextField
                label="Full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={errors.address}
                required
                fullWidth
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  error={errors.pincode}
                  required
                  fullWidth
                />
                <TextField
                  label="Previous school"
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  error={errors.previousSchool}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Emergency number 1"
                  type="tel"
                  value={emergencyContact1}
                  onChange={(e) => setEmergencyContact1(e.target.value)}
                  error={errors.emergencyContact1}
                  required
                  fullWidth
                />
                <TextField
                  label="Emergency number 2"
                  type="tel"
                  value={emergencyContact2}
                  onChange={(e) => setEmergencyContact2(e.target.value)}
                  error={errors.emergencyContact2}
                  fullWidth
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    ID *
                  </label>
                  <Select value={idType} onValueChange={setIdType}>
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
                  {errors.idType && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.idType}</p>
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
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  error={errors.idNumber}
                  required
                  fullWidth
                />
                <TextField
                  label="Who looks after child at home"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  error={errors.guardianName}
                  fullWidth
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Administration ─────────────────────────── */}
        <TabsContent value="admin">
          <Card variant="outlined">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Admission date"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  error={errors.admissionDate}
                  fullWidth
                />
                {isSuperAdmin && (
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant px-1">
                      Branch *
                    </label>
                    <Select value={branchId} onValueChange={(v) => { setBranchId(v); setClassId(""); setSectionId(""); }}>
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
                    {errors.branchId && (
                      <p className="px-4 text-[12px] leading-4 text-error">{errors.branchId}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Standard *
                  </label>
                  <Select
                    value={classId}
                    onValueChange={(v) => { setClassId(v); setSectionId(""); }}
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
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant px-1">
                    Division
                  </label>
                  <Select
                    value={sectionId}
                    onValueChange={setSectionId}
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
                  {errors.sectionId && (
                    <p className="px-4 text-[12px] leading-4 text-error">{errors.sectionId}</p>
                  )}
                </div>
              </div>

              {feesLoading && (
                <p className="text-body-sm text-on-surface-variant">Loading fees...</p>
              )}
              {fees.length > 0 && !feesLoading && (
                <>
                  <div className="rounded-lg border border-outline-variant p-4 space-y-2">
                    <p className="text-label-lg font-medium text-on-surface">Fee Structure</p>
                    {fees.map((fee, i) => (
                      <div key={i} className="flex items-center justify-between text-body-sm text-on-surface-variant">
                        <span>{fee.name}</span>
                        <span>₹{fee.amount.toLocaleString("en-IN")} / {fee.frequency.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                    ))}
                    <Divider />
                    <div className="flex items-center justify-between">
                      <p className="text-label-md font-medium text-on-surface">Estimated Annual Total</p>
                      <p className="text-label-md font-semibold text-on-surface">
                        ₹{annualTotal.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  {mode === "create" && (
                    <div className="rounded-lg border border-outline-variant p-4 space-y-4">
                      <p className="text-label-lg font-medium text-on-surface">Fee Collection</p>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextField
                          label="Discount %"
                          type="number"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          error={errors.discountPercent}
                          fullWidth
                        />
                        <div className="flex flex-col justify-end">
                          <p className="text-body-sm text-on-surface-variant">Discounted Total</p>
                          <p className="text-label-lg font-semibold text-on-surface">
                            ₹{discountedTotal.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextField
                          label="Amount Paid"
                          type="number"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          error={errors.amountPaid}
                          fullWidth
                        />
                        <div className="flex flex-col justify-end">
                          <p className="text-body-sm text-on-surface-variant">Remaining</p>
                          <p className="text-label-lg font-semibold text-on-surface">
                            ₹{remainingAmount.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-label-md text-on-surface-variant px-1">
                            Payment Method
                          </label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                          {errors.paymentMethod && (
                            <p className="px-4 text-[12px] leading-4 text-error">{errors.paymentMethod}</p>
                          )}
                        </div>
                        {showTransactionId && (
                          <TextField
                            label="Transaction ID"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            error={errors.transactionId}
                            fullWidth
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {mode === "edit" && initialData?.totalFees != null && initialData.totalFees > 0 && (
                    <div className="rounded-lg border border-outline-variant p-4 space-y-4">
                      <p className="text-label-lg font-medium text-on-surface">Fee Summary</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <TextField
                          label="Total Fees"
                          value={`₹${initialData.totalFees.toLocaleString("en-IN")}`}
                          readOnly
                          fullWidth
                        />
                        <TextField
                          label="Collected"
                          value={`₹${(initialData.totalFeesPaid ?? 0).toLocaleString("en-IN")}`}
                          readOnly
                          fullWidth
                        />
                        <TextField
                          label="Remaining"
                          value={`₹${(initialData.pendingFees ?? 0).toLocaleString("en-IN")}`}
                          readOnly
                          fullWidth
                        />
                      </div>
                    </div>
                  )}
                </>
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
            <Button type="submit" variant="filled" loading={loading} icon="save">
              {mode === "create" ? "Admit Student" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
