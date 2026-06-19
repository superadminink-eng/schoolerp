export interface StudentDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNo: string;
  gender: string;
  status: string;
  category: string;
  house: string | null;
  dateOfBirth: string;
  admissionDate: string;
  fatherPhone: string | null;
  motherPhone: string | null;
  emergencyContact1: string | null;
  totalFees: number;
  totalFeesPaid: number;
  pendingFees: number;
  branch: {
    id: string;
    name: string;
  };
  className: string;
  sectionName: string;
  rollNo: string | null;
}

export class StudentMapper {
  static toDTO(student: any): StudentDTO {
    const enrollment = student.enrollments?.[0] || null;
    const className = enrollment?.section?.class?.name || "—";
    const sectionName = enrollment?.section?.name || "—";
    const rollNo = enrollment?.rollNo || null;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      admissionNo: student.admissionNo,
      gender: student.gender,
      status: student.status,
      category: student.category,
      house: student.house || null,
      dateOfBirth: student.dateOfBirth instanceof Date 
        ? student.dateOfBirth.toISOString().slice(0, 10) 
        : student.dateOfBirth,
      admissionDate: student.admissionDate instanceof Date 
        ? student.admissionDate.toISOString().slice(0, 10) 
        : student.admissionDate,
      fatherPhone: student.fatherPhone || null,
      motherPhone: student.motherPhone || null,
      emergencyContact1: student.emergencyContact1 || null,
      totalFees: student.totalFees ?? 0,
      totalFeesPaid: student.totalFeesPaid ?? 0,
      pendingFees: student.pendingFees ?? 0,
      branch: {
        id: student.branch?.id || "",
        name: student.branch?.name || "",
      },
      className,
      sectionName,
      rollNo,
    };
  }

  static toDTOList(students: any[]): StudentDTO[] {
    return students.map(s => this.toDTO(s));
  }
}
