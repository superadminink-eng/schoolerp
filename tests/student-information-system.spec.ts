import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Student Information System - Admin Profile & Directory Flow", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: "CSVKRD" } }) || await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");

    // Get or create Academic Year
    let academicYear = await prisma.academicYear.findFirst({ where: { organizationId: org.id, name: "2026-27" } });
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
    } else if (!academicYear.isCurrent) {
      academicYear = await prisma.academicYear.update({
        where: { id: academicYear.id },
        data: { isCurrent: true },
      });
    }

    // Get or create Class
    let classRecord = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: academicYear.id } });
    if (!classRecord) {
      classRecord = await prisma.class.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          academicYearId: academicYear.id,
          name: "Class 1",
          numericGrade: 1,
          status: "ACTIVE",
        },
      });
    } else if (classRecord.status !== "ACTIVE") {
      classRecord = await prisma.class.update({
        where: { id: classRecord.id },
        data: { status: "ACTIVE" },
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

    // Get or create Target Academic Year
    let targetYear = await prisma.academicYear.findFirst({ where: { organizationId: org.id, name: "2027-28" } });
    if (!targetYear) {
      targetYear = await prisma.academicYear.create({
        data: {
          organizationId: org.id,
          name: "2027-28",
          startDate: new Date("2027-06-01"),
          endDate: new Date("2028-04-30"),
          isCurrent: false,
        },
      });
    }

    // Get or create Target Class
    let targetClass = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: targetYear.id, name: "Class 2" } });
    if (!targetClass) {
      targetClass = await prisma.class.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          academicYearId: targetYear.id,
          name: "Class 2",
          numericGrade: 2,
          status: "ACTIVE",
        },
      });
    } else if (targetClass.status !== "ACTIVE") {
      targetClass = await prisma.class.update({
        where: { id: targetClass.id },
        data: { status: "ACTIVE" },
      });
    }

    // Get or create Target Section
    let targetSection = await prisma.section.findFirst({ where: { classId: targetClass.id, name: "A" } });
    if (!targetSection) {
      targetSection = await prisma.section.create({
        data: {
          classId: targetClass.id,
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
        organizationId: org.id,
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
            rollNo: "99",
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
        organizationId: org.id,
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
        organizationId: org.id,
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
    await expect(page.locator("h2:has-text('Direct Intake Details')")).toBeVisible();
    await expect(page.locator("text=This student was admitted via Direct Intake or legacy data migration.")).toBeVisible();
    await page.click("button:has-text('Close')");
    await expect(page.locator("h2:has-text('Direct Intake Details')")).not.toBeVisible();

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
    await expect(page.locator("div").filter({ hasText: /^Average Score$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("85%");
    await expect(page.locator("div").filter({ hasText: /^Passing Rate$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("100%");
    await expect(page.locator("div").filter({ hasText: /^Total Exams$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("text=Test Exam Term 1").first()).toBeVisible();
    await expect(page.locator("text=Test Mathematics").first()).toBeVisible();
    await expect(page.locator("text=85 / 100").first()).toBeVisible();
    await expect(page.getByText("PASS", { exact: true }).first()).toBeVisible();

    // Verify Fees Tab content
    await feesTabTrigger.click();
    await expect(page.locator("div").filter({ hasText: /^Total Billed$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹5,000");
    await expect(page.locator("div").filter({ hasText: /^Total Paid$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹3,000");
    await expect(page.locator("div").filter({ hasText: /^Remaining Dues$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("₹2,000");
    await expect(page.locator("text=INV-TEST-9999").first()).toBeVisible();
    await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible();
    await expect(page.locator("text=REC-TEST-9999").first()).toBeVisible();
    await expect(page.getByText("UPI", { exact: true }).first()).toBeVisible();

    // Verify Attendance Tab content
    await attendanceTabTrigger.click();
    await expect(page.locator("div").filter({ hasText: /^Attendance Rate$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("50%");
    await expect(page.locator("div").filter({ hasText: /^Present Days$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("div").filter({ hasText: /^Absent Days$/ }).locator("xpath=..").locator("div.font-black")).toHaveText("1");
    await expect(page.locator("text=Monthly Attendance Calendar").first()).toBeVisible();
    await expect(page.locator("text=Monthly Summary").first()).toBeVisible();
  });

  test("Admin can issue leaving certificate for a student with dues override and print it", async ({ page }) => {
    // Clean up leaving certificates from database for test student
    const student = await prisma.student.findFirst({ where: { admissionNo: "ADM-TEST-12345" } });
    if (!student) throw new Error("Test student not found");

    await prisma.leavingCertificate.deleteMany({ where: { studentId: student.id } });
    await prisma.student.update({ where: { id: student.id }, data: { status: "ACTIVE", leavingDate: null, leavingReason: null } });

    // Navigate to student profile page
    await page.goto(`/students/${student.id}`);
    await page.waitForLoadState("networkidle");

    // Click "Issue LC/TC" button
    const issueLcBtn = page.locator("button:has-text('Issue LC/TC')");
    await expect(issueLcBtn).toBeVisible();
    await issueLcBtn.click();

    // The modal opens. Verify title
    await expect(page.locator("h2:has-text('Issue Leaving Certificate')")).toBeVisible();

    // Click submit, should trigger PENDING_DUES warning block
    const submitBtn = page.locator("#lc-submit-btn");
    await submitBtn.click();

    // Verify warning text
    await expect(page.locator("text=Outstanding Dues Warning")).toBeVisible();
    await expect(page.locator("text=₹2,000")).toBeVisible();

    // Click "Proceed Anyway"
    const proceedBtn = page.locator("button:has-text('Proceed Anyway')");
    await proceedBtn.click();

    // The modal should close, student status changes to TRANSFERRED, showing Print LC
    await expect(page.locator("h2:has-text('Issue Leaving Certificate')")).not.toBeVisible();
    const printLcBtn = page.locator("button:has-text('Print LC')");
    await expect(printLcBtn).toBeVisible();

    // Verify database updates
    const dbLc = await prisma.leavingCertificate.findFirst({ where: { studentId: student.id } });
    expect(dbLc).not.toBeNull();
    expect(dbLc?.reasonForLeaving).toBe("Completed Studies");

    const dbStudent = await prisma.student.findUnique({ where: { id: student.id } });
    expect(dbStudent?.status).toBe("TRANSFERRED");
  });

  test("Admin can use bulk promotion wizard to promote students with automatic invoice rollover", async ({ page }) => {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");
    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: "CSVKRD" } }) || await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");
    const academicYear = await prisma.academicYear.findFirst({ where: { organizationId: org.id, isCurrent: true } });
    if (!academicYear) throw new Error("No academic year found");
    const classRecord = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: academicYear.id } });
    const sourceClassName = classRecord?.name || "Class 1";

    const targetYear = await prisma.academicYear.findFirst({ where: { organizationId: org.id, name: "2027-28" } });
    if (!targetYear) throw new Error("Target academic year not found");
    const targetClass = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: targetYear.id } });
    const targetClassName = targetClass?.name || "Class 2";

    // Navigate to Bulk Promotion Wizard
    await page.goto("/students/promote");
    await page.waitForLoadState("networkidle");

    // Step 1: Select Source Class, Section, Academic Year
    await page.locator("label:has-text('Class') + select").first().selectOption({ label: sourceClassName });
    await page.locator("label:has-text('Section') + select").first().selectOption({ label: "A" });
    // Click "Next"
    await page.click("button:has-text('Next')");

    // Step 2: Select Target Destination
    await page.locator("label:has-text('Target Academic Year') + select").selectOption({ label: "2027-28" });
    await page.locator("label:has-text('Target Class') + select").selectOption({ label: targetClassName });
    await page.locator("label:has-text('Target Section') + select").selectOption({ label: "A" });
    // Click "Load Students"
    await page.click("button:has-text('Load Students')");

    // Step 3: Select Students list should load
    await expect(page.locator("h3:has-text('Select Students')")).toBeVisible();
    // Check that Rajesh Kumar is listed with warning dues badge
    await expect(page.locator("text=Rajesh Kumar")).toBeVisible();
    await expect(page.locator("text=Outstanding Dues: ₹2,000")).toBeVisible();

    // Click "Next"
    await page.click("button:has-text('Next')");

    // Step 4: Confirm Billing & Discount
    await expect(page.locator("h3:has-text('Review & Billing Setup')")).toBeVisible();
    await page.locator("input[type='number']").fill("10");

    // Click "Promote Class"
    await page.click("button:has-text('Promote Class')");

    // Step 5: Process Success
    await expect(page.locator("h3:has-text('Class Promotion Completed Successfully!')")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Promoted", { exact: true })).toBeVisible();

    // Verify promotion database state
    const student = await prisma.student.findFirst({ where: { admissionNo: "ADM-TEST-12345" } });
    if (!student) throw new Error("Test student not found");

    const enrollment = await prisma.studentEnrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: student.id,
          academicYearId: targetYear.id,
        },
      },
    });
    expect(enrollment).not.toBeNull();
  });

  test("Admin student directory displays correct stats and can search all students without limit caps", async ({ page }) => {
    // 1. Navigate to student directory page
    await page.goto("/students");
    await page.waitForLoadState("networkidle");

    // 2. Verify Total Students card displays a number > 200 (since simulator seeds 201 students)
    const totalStudentsText = page.locator("div").filter({ hasText: /^Total Students$/ }).locator("xpath=..").locator("div.text-headline-md");
    await expect(totalStudentsText).toBeVisible();
    const totalCountStr = await totalStudentsText.textContent();
    const totalCount = parseInt(totalCountStr || "0", 10);
    console.log(`E2E Assert: Total students in UI is ${totalCount}`);
    expect(totalCount).toBeGreaterThan(200);

    // 3. Verify RTE Category card displays a number > 0 (e.g. 31) instead of 0
    const rteCategoryText = page.locator("div").filter({ hasText: /^RTE Category$/ }).locator("xpath=..").locator("div.text-headline-md");
    await expect(rteCategoryText).toBeVisible();
    const rteCountStr = await rteCategoryText.textContent();
    const rteCount = parseInt(rteCountStr || "0", 10);
    console.log(`E2E Assert: RTE students in UI is ${rteCount}`);
    expect(rteCount).toBeGreaterThan(0); // Checks category field selection is fixed

    // 4. Perform search for 'aanya'
    const searchBar = page.locator("input[placeholder='Search students']");
    await searchBar.fill("aanya");
    await page.waitForTimeout(1500); // Wait for client-side filter to apply in AG-Grid

    // 5. Verify that we find multiple rows matching Aanya (we have 2 Aanya Verma and 1 Aanya Pawar in database)
    const rows = page.locator(".ag-row");
    const rowCount = await rows.count();
    console.log(`E2E Assert: Search results count for 'aanya' is ${rowCount}`);
    expect(rowCount).toBeGreaterThan(1); // Should see at least 2 or 3 rows, confirming older records are not truncated
  });
});

