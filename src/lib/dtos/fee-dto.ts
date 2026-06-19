export interface FeeDTO {
  studentId: string;
  studentName: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  photo: string | null;
  className: string;
  branchName: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  dueDate: string;
}

export class FeeMapper {
  static toDTO(fee: any): FeeDTO {
    return {
      studentId: fee.studentId,
      studentName: fee.studentName || `${fee.firstName} ${fee.lastName}`,
      firstName: fee.firstName,
      lastName: fee.lastName,
      admissionNo: fee.admissionNo,
      photo: fee.photo || null,
      className: fee.className || "—",
      branchName: fee.branchName || "—",
      totalAmount: fee.totalAmount ?? 0,
      paidAmount: fee.paidAmount ?? 0,
      pendingAmount: fee.pendingAmount ?? 0,
      status: fee.status || "PENDING",
      dueDate: fee.dueDate instanceof Date
        ? fee.dueDate.toISOString().slice(0, 10)
        : fee.dueDate || "—",
    };
  }

  static toDTOList(fees: any[]): FeeDTO[] {
    return fees.map(f => this.toDTO(f));
  }
}
