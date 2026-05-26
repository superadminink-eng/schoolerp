"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { StudentForm } from "@/components/student/student-form";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FormSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

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

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/students/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStudent(data.data);
        } else {
          snackbar.show(data.error?.message ?? "Student not found", "error");
          router.push("/students");
        }
      })
      .catch(() => {
        snackbar.show("Failed to load student", "error");
        router.push("/students");
      })
      .finally(() => setLoading(false));
  }, [params.id, router, snackbar]);

  async function handleDrop() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/students/${params.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        snackbar.show("Student dropped", "success");
        router.push("/students");
        router.refresh();
      } else {
        snackbar.show(data.error?.message ?? "Failed to drop student", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/students">Students</BreadcrumbItem>
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Edit Student
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!student) return null;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/students">Students</BreadcrumbItem>
        <BreadcrumbItem>Edit</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">
          Edit Student
        </h1>
        <PermissionGate module="students" action="delete">
          {student.status !== "DROPPED" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="text" icon="person_off" className="text-error">
                  Drop Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Drop student?</DialogTitle>
                <DialogDescription>
                  This will mark {student.firstName} {student.lastName} as dropped.
                  This action can be reversed by changing the student&apos;s status later.
                </DialogDescription>
                <div className="mt-6 flex justify-end gap-3">
                  <DialogClose asChild>
                    <Button variant="text">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="filled"
                    onClick={handleDrop}
                    loading={deleting}
                    className="bg-error text-on-error"
                  >
                    Drop Student
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </PermissionGate>
      </div>

      <StudentForm mode="edit" initialData={student} />
    </div>
  );
}
