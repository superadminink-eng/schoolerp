import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Student Information System - Admin Profile & Directory Flow", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");

    // Get or create Academic Year
    let academicYear = await prisma.academicYear.findFirst({ where: { organizationId: org.id } });
    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: {
          organizationId: org.id,
          name: "2026-27",
          startDate: new Date("2026-06-01"),
          endDate: new Date("2027-04-30"),
          isCurrent: true,
        },
      });
    }

    // Get or create Class
    let classRecord = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: academicYear.id } });
    if (!classRecord) {
      classRecord = await prisma.class.create({
        data: {
          branchId: branch.id,
          academicYearId: academicYear.id,
          name: "Class 1",
          numericGrade: 1,
        },
      });
    }

    // Get or create Section
    let section = await prisma.section.findFirst({ where: { classId: classRecord.id } });
    if (!section) {
      section = await prisma.section.create({
        data: {
          classId: classRecord.id,
          name: "A",
        },
      });
    }

    // Clean up any old test student
    await prisma.student.deleteMany({
      where: { admissionNo: "ADM-TEST-12345", branchId: branch.id }
    });

    // Seed/find related structures for Phase 3 testing
    const subject = await prisma.subject.upsert({
      where: { classId_code: { classId: classRecord.id, code: "MATH-TEST-123" } },
      update: {},
      create: {
        classId: classRecord.id,
        name: "Test Mathematics",
        code: "MATH-TEST-123",
        type: "THEORY",
      },
    });

    let exam = await prisma.exam.findFirst({
      where: { academicYearId: academicYear.id, name: "Test Exam Term 1" }
    });
    if (!exam) {
      exam = await prisma.exam.create({
        data: {
          academicYearId: academicYear.id,
          name: "Test Exam Term 1",
          type: "FINAL",
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-05"),
        },
      });
    }

    let examSubject = await prisma.examSubject.findFirst({
      where: { examId: exam.id, subjectId: subject.id }
    });
    if (!examSubject) {
      examSubject = await prisma.examSubject.create({
        data: {
          examId: exam.id,
          subjectId: subject.id,
          date: new Date("2026-06-03"),
          startTime: "09:00",
          endTime: "12:00",
          maxMarks: 100,
          passMarks: 35,
        },
      });
    }

    let feeCategory = await prisma.feeCategory.findFirst({
      where: { organizationId: org.id, name: "Test Tuition Fee" }
    });
    if (!feeCategory) {
      feeCategory = await prisma.feeCategory.create({
        data: {
          organizationId: org.id,
          name: "Test Tuition Fee",
        },
      });
    }

    let feeStructure = await prisma.feeStructure.findFirst({
      where: { academicYearId: academicYear.id, classId: classRecord.id, feeCategoryId: feeCategory.id }
    });
    if (!feeStructure) {
      feeStructure = await prisma.feeStructure.create({
        data: {
          academicYearId: academicYear.id,
          classId: classRecord.id,
          feeCategoryId: feeCategory.id,
          amount: 5000,
          frequency: "ANNUAL",
        },
      });
    }

    // Create our test student
    const student = await prisma.student.create({
      data: {
        branchId: branch.id,
        admissionNo: "ADM-TEST-12345",
        firstName: "Rajesh",
        lastName: "Kumar",
        dateOfBirth: new Date("2015-08-15"),
        gender: "MALE",
        bloodGroup: "O+",
        address: "123 Main St, Kothrud, Pune",
        pincode: "411038",
        emergencyContact1: "9876543210",
        idType: "Aadhaar",
        idNumber: "123456789012",
        fatherName: "Suresh Kumar",
        fatherPhone: "9876543211",
        fatherEmail: "suresh@example.com",
        fatherOccupation: "Engineer",
        motherName: "Sunita Kumar",
        motherPhone: "9876543212",
        motherEmail: "sunita@example.com",
        motherOccupation: "Teacher",
        category: "GENERAL",
        house: "Red",
        status: "ACTIVE",
        enrollments: {
          create: {
            academicYearId: academicYear.id,
            sectionId: section.id,
            rollNo: "10",
          },
        },
      },
    });

    // Seed Marks
    await prisma.mark.create({
      data: {
        examSubjectId: examSubject.id,
        studentId: student.id,
        marksObtained: 85.00,
        grade: "A",
        remarks: "Excellent performance",
        gradedBy: "Test Grader",
      },
    });

    // Seed Student Attendance (in June 2026 to align with system timestamp 2026-06-06)
    await prisma.studentAttendance.createMany({
      data: [
        {
          studentId: student.id,
          branchId: branch.id,
          sectionId: section.id,
          date: new Date("2026-06-05"),
          status: "PRESENT",
          markedBy: "Test Marker",
        },
        {
          studentId: student.id,
          branchId: branch.id,
          sectionId: section.id,
          date: new Date("2026-06-06"),
          status: "ABSENT",
          markedBy: "Test Marker",
        },
      ],
    });

    // Seed Invoice
    const invoice = await prisma.invoice.create({
      data: {
        studentId: student.id,
        number: "INV-TEST-9999",
        year: 2026,
        totalAmount: 5000.00,
        paidAmount: 3000.00,
        status: "PARTIAL",
        dueDate: new Date("2026-06-30"),
      },
    });

    // Seed Invoice Item
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        feeStructureId: feeStructure.id,
        amount: 5000.00,
        description: "Test Tuition Fee Item",
      },
    });

    // Seed Fee Payment
    await prisma.feePayment.create({
      data: {
        invoiceId: invoice.id,
        studentId: student.id,
        amount: 3000.00,
        method: "UPI",
        receiptNo: "REC-TEST-9999",
        paidAt: new Date("2026-06-06T12:00:00Z"),
        remarks: "Paid part fees",
      },
    });

    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE [Admin]: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR [Admin]: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED [Admin]: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test("Admin can view students directory, use filters, and open 360-degree Student Profile Hub", async ({ page }) => {
    // 1. Navigate to student directory page
    await page.goto("/students");
    await expect(page.locator("h1.text-headline-md")).toContainText("Students");

    // 2. Verify Bento Stats Cards are visible and populated
    await expect(page.getByText("Total Students")).toBeVisible();
    await expect(page.getByText(/^Active$/)).toBeVisible();
    await expect(page.getByText("RTE Category")).toBeVisible();
    await expect(page.getByText("Inactive / Dropped")).toBeVisible();

    // 3. Open filters drawer, check options, and close it
    await page.click("button:has-text('Filters')");
    await expect(page.locator("label:has-text('Class')")).toBeVisible();
    await expect(page.locator("label:has-text('Section')")).toBeVisible();
    await expect(page.locator("label:has-text('House')")).toBeVisible();
    await expect(page.locator("label:has-text('Category')")).toBeVisible();
    await page.click("button:has-text('Filters')"); // toggle close

    // 4. Wait for table data and click the student row to open profile
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const studentRow = page.locator(".ag-row").first();
    await expect(studentRow).toBeVisible();
    await studentRow.click();

    // 5. Verify redirect to the 360-Degree Profile Hub
    await expect(page).toHaveURL(/\/students\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
    
    // 6. Verify Left Profile Card displays key details
    await expect(page.locator("h2.text-headline-sm")).toBeVisible(); // Student Name
    await expect(page.locator("text=Class / Grade")).toBeVisible();
    await expect(page.locator("text=House")).toBeVisible();
    await expect(page.locator("text=Category")).toBeVisible();
    await expect(page.locator("button:has-text('Edit Profile')")).toBeVisible();
    await expect(page.locator("button:has-text('Direct Intake Details')")).toBeVisible();

    // 7. Click "Direct Intake Details" button and verify modal
    await page.click("button:has-text('Direct Intake Details')");
    await expect(page.locator("h2:has-text('थेट प्रवेश तपशील')")).toBeVisible();
    await expect(page.locator("text=जुना डेटा मायग्रेशनद्वारे दाखल करण्यात आला आहे")).toBeVisible();
    await page.click("button:has-text('बंद करा')");
    await expect(page.locator("h2:has-text('थेट प्रवेश तपशील')")).not.toBeVisible();

    // 8. Verify right-side Tabbed Area exists and navigation works
    const profileTabTrigger = page.locator("button[role='tab']:has-text('Profile Details')");
    const vaultTabTrigger = page.locator("button[role='tab']:has-text('Document Vault')");
    const academicsTabTrigger = page.locator("button[role='tab']:has-text('Academics')");
    const feesTabTrigger = page.locator("button[role='tab']:has-text('Fees Ledger')");
    const attendanceTabTrigger = page.locator("button[role='tab']:has-text('Attendance')");

    await expect(profileTabTrigger).toBeVisible();
    await expect(vaultTabTrigger).toBeVisible();
    await expect(academicsTabTrigger).toBeVisible();
    await expect(feesTabTrigger).toBeVisible();
    await expect(attendanceTabTrigger).toBeVisible();

    // Verify Tab 1: Profile Details content
    await expect(page.locator("h3:has-text('Personal Information')")).toBeVisible();
    await expect(page.locator("h3:has-text('Family Information')")).toBeVisible();
    await expect(page.locator("h3:has-text('Contact & Address Details')")).toBeVisible();

    // Verify Tab 2: Document Vault content
    await vaultTabTrigger.click();
    await expect(page.locator("h3:has-text('Identity Verification Vault')")).toBeVisible();
    await expect(page.locator("text=Primary ID Verification Record")).toBeVisible();
    await expect(page.locator("label:has-text('ID Document Type')")).toBeVisible();
    await expect(page.locator("label:has-text('ID Number')")).toBeVisible();
    await expect(page.locator("label:has-text('Attachment File')")).toBeVisible();

    // Verify Academics Tab content
    await academicsTabTrigger.click();
    await expect(page.locator("div").filter({ hasText: /^सरासरी गुण \(Average Score\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("85%");
    await expect(page.locator("div").filter({ hasText: /^उत्तीर्ण प्रमाण \(Passing Rate\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("100%");
    await expect(page.locator("div").filter({ hasText: /^एकूण परीक्षा \(Total Exams\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("text=Test Exam Term 1").first()).toBeVisible();
    await expect(page.locator("text=Test Mathematics").first()).toBeVisible();
    await expect(page.locator("text=85 / 100").first()).toBeVisible();
    await expect(page.getByText("PASS", { exact: true }).first()).toBeVisible();

    // Verify Fees Tab content
    await feesTabTrigger.click();
    await expect(page.locator("div").filter({ hasText: /^एकूण बिल \(Total Billed\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹5,000");
    await expect(page.locator("div").filter({ hasText: /^भरलेली फी \(Total Paid\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹3,000");
    await expect(page.locator("div").filter({ hasText: /^बाकी रक्कम \(Remaining Dues\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹2,000");
    await expect(page.locator("text=INV-TEST-9999").first()).toBeVisible();
    await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible();
    await expect(page.locator("text=REC-TEST-9999").first()).toBeVisible();
    await expect(page.getByText("UPI", { exact: true }).first()).toBeVisible();

    // Verify Attendance Tab content
    await attendanceTabTrigger.click();
    await expect(page.locator("div").filter({ hasText: /^हजेरी प्रमाण \(Rate\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("50%");
    await expect(page.locator("div").filter({ hasText: /^हजर दिवस \(Present\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("div").filter({ hasText: /^गैरहजर दिवस \(Absent\)$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("text=मासिक हजेरी दिनदर्शिका (Monthly Calendar)").first()).toBeVisible();
    await expect(page.locator("text=मासिक सारांश (Monthly Summary)").first()).toBeVisible();
  });
});
