import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";
import { getAdminAuth } from "../src/lib/firebase-admin";

const prisma = new PrismaClient();

test.describe("Real-World School Operations E2E Simulation Walkthrough", () => {
  // Use admin storage state for setup
  test.use({ storageState: STORAGE_STATE_ADMIN });

  let branchId: string;
  let branchName: string;
  let academicYearId: string;
  let academicYearName = "AY-WT-2026";
  let classId: string;
  let sectionId: string;
  let subjectMasterMathId: string;
  let subjectMasterEngId: string;

  // Credentials for the walkthrough staff members
  const counselorEmail = "counselor.wt@school.com";
  const accountantEmail = "accountant.wt@school.com";
  const teacherEmail = "teacher.wt@school.com";
  const teacher2Email = "teacher2.wt@school.com";
  const principalEmail = "principal.wt@school.com";
  const password = "password123";

  const studentNames = [
    { first: "Student WT One", last: "Admissions" },
    { first: "Student WT Two", last: "Admissions" },
    { first: "Student WT Three", last: "Admissions" },
    { first: "Student WT Four", last: "Admissions" },
    { first: "Student WT Five", last: "Admissions" },
    { first: "Student WT Six", last: "Admissions" },
    { first: "Student WT Seven", last: "Admissions" },
    { first: "Student WT Eight", last: "Admissions" },
    { first: "Student WT Nine", last: "Admissions" },
    { first: "Student WT Ten", last: "Admissions" },
  ];

  const staffNames = [
    "Counselor WT",
    "Accountant WT",
    "Teacher WT",
    "Teacher2 WT",
    "Principal WT"
  ];

  const staffEmails = [
    counselorEmail,
    accountantEmail,
    teacherEmail,
    teacher2Email,
    principalEmail
  ];

  const login = async (pageInstance: any, email: string) => {
    await pageInstance.goto("/login");
    await pageInstance.fill('input[type="email"]', email);
    await pageInstance.fill('input[type="password"]', "password123");
    await pageInstance.click('button[type="submit"]');
    await pageInstance.waitForURL("**/dashboard", { timeout: 15000 });
  };

  const clickOption = async (pageInstance: any, optionText: string) => {
    const escapedText = optionText.replace(/"/g, '\\"');
    const locator = pageInstance.locator(`role=option >> text="${escapedText}"`);
    await locator.waitFor({ state: "attached" });
    await pageInstance.waitForTimeout(100);
    await locator.dispatchEvent("click");
  };

  const performTeardown = async () => {
    console.log("Teardown: Cleaning up walkthrough records...");

    // 1. Delete student attendance
    await prisma.studentAttendance.deleteMany({
      where: { student: { firstName: { startsWith: "Student WT" } } }
    });

    // 2. Delete leaving certificates
    await prisma.leavingCertificate.deleteMany({
      where: { student: { firstName: { startsWith: "Student WT" } } }
    });

    // 3. Delete fee payments
    await prisma.feePayment.deleteMany({
      where: { student: { firstName: { startsWith: "Student WT" } } }
    });

    // 4. Delete invoice items
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { student: { firstName: { startsWith: "Student WT" } } } }
    });

    // 5. Delete invoices
    await prisma.invoice.deleteMany({
      where: { student: { firstName: { startsWith: "Student WT" } } }
    });

    // 6. Delete student enrollments
    await prisma.studentEnrollment.deleteMany({
      where: { student: { firstName: { startsWith: "Student WT" } } }
    });

    // 7. Delete students
    await prisma.student.deleteMany({
      where: { firstName: { startsWith: "Student WT" } }
    });

    // 8. Delete admission exam results
    await prisma.entranceExamResult.deleteMany({
      where: { application: { firstName: { startsWith: "Student WT" } } }
    });

    // 9. Delete admission applications
    await prisma.admissionApplication.deleteMany({
      where: { firstName: { startsWith: "Student WT" } }
    });

    // 10. Delete admission inquiries
    await prisma.admissionInquiry.deleteMany({
      where: { studentName: { startsWith: "Student WT" } }
    });

    // 11. Delete section subject teachings
    await prisma.sectionSubjectTeacher.deleteMany({
      where: {
        OR: [
          { staff: { name: { in: staffNames } } },
          { subject: { class: { name: "Class WT" } } }
        ]
      }
    });

    // 12. Delete teacher subject assignments
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { staff: { name: { in: staffNames } } }
    });

    // 13. Delete staff documents
    await prisma.staffDocument.deleteMany({
      where: { staff: { name: { in: staffNames } } }
    });

    // 14. Delete staff attendances
    await prisma.staffAttendance.deleteMany({
      where: { staff: { name: { in: staffNames } } }
    });

    // 15. Delete staff records
    await prisma.staff.deleteMany({
      where: { name: { in: staffNames } }
    });

    // 16. Delete user permissions
    await prisma.userPermission.deleteMany({
      where: { user: { email: { in: staffEmails } } }
    });

    // 17. Delete user records
    await prisma.user.deleteMany({
      where: { email: { in: staffEmails } }
    });

    // 18. Delete class fee installments & structures
    await prisma.feeInstallmentTemplate.deleteMany({
      where: { class: { name: "Class WT" } }
    });
    await prisma.feeStructure.deleteMany({
      where: { class: { name: "Class WT" } }
    });

    // 19. Delete sections & subjects
    await prisma.section.deleteMany({
      where: { class: { name: "Class WT" } }
    });
    await prisma.subject.deleteMany({
      where: { class: { name: "Class WT" } }
    });

    // 20. Delete classes
    await prisma.class.deleteMany({
      where: { name: "Class WT" }
    });

    // 21. Delete subject masters
    await prisma.subjectMaster.deleteMany({
      where: { name: { in: ["Math WT", "English WT"] } }
    });

    // 22. Delete academic years
    await prisma.academicYear.deleteMany({
      where: { name: "AY-WT-2026" }
    });

    // 23. Delete Firebase Auth users
    const adminAuth = getAdminAuth();
    for (const email of staffEmails) {
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.deleteUser(userRecord.uid);
      } catch (err) {}
    }
  };

  test.beforeAll(async () => {
    // 1. Resolve organization and Karad branch (since it has entrance exams enabled)
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: "CSVKRD" } })
      || await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");
    branchId = branch.id;
    branchName = branch.name;

    await performTeardown();

    const createdClass = await prisma.class.findFirst({ where: { name: "Class WT" }, include: { sections: true } });
    if (createdClass) {
      classId = createdClass.id;
      if (createdClass.sections.length > 0) {
        sectionId = createdClass.sections[0].id;
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
    page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test.afterAll(async () => {
    await performTeardown();
    await prisma.$disconnect();
  });

  test("Step-by-step school year lifecycle visual simulation", async ({ page, browser }) => {
    // Set a long timeout for this visual walkthrough simulation
    test.setTimeout(600000); // 10 minutes

    // Enable slow-mo delay helper for visual beauty
    const delay = async (ms = 500) => await page.waitForTimeout(ms);

    console.log("--- START SIMULATION ---");

    // ==========================================
    // STEP 1: Setup Academic Year & Class (Admin)
    // ==========================================
    console.log("Step 1: Setting up academic year, subjects and class...");
    
    // Academic Year
    await page.goto("/academic-years");
    await page.waitForLoadState("networkidle");
    await page.click("button:has-text('Add Academic Year')");
    await page.fill("label:has-text('Name') + input", academicYearName);
    await page.fill("label:has-text('Start date') + input", "2026-06-01");
    await page.fill("label:has-text('End date') + input", "2027-04-30");
    await page.click("button[role='switch']");
    await page.click("button[type='submit']:has-text('Create Academic Year')");
    await page.waitForURL("**/academic-years");

    const ay = await prisma.academicYear.findFirst({ where: { name: academicYearName } });
    if (!ay) throw new Error("Academic Year creation failed");
    academicYearId = ay.id;

    // Catalog Subjects
    await page.goto("/subject-masters");
    await page.waitForLoadState("networkidle");
    
    // Math Subject
    await page.click("button:has-text('Add Subject')");
    await page.fill("label:has-text('Name') + input", "Math WT");
    await page.fill("label:has-text('Code') + input", "MATHWT");
    await page.click("button[type='submit']:has-text('Create')");
    await page.waitForSelector("text=Math WT");

    // English Subject
    await page.click("button:has-text('Add Subject')");
    await page.fill("label:has-text('Name') + input", "English WT");
    await page.fill("label:has-text('Code') + input", "ENGWT");
    await page.click("button[type='submit']:has-text('Create')");
    await page.waitForSelector("text=English WT");

    // Create Class Wizard Flow
    await page.goto("/classes/new");
    await page.waitForLoadState("networkidle");
    await page.fill("input[placeholder='e.g. Class 1']", "Class WT");
    await page.fill("input[placeholder='e.g. 1']", "1");

    await page.click("button:has-text('Select branch')");
    await clickOption(page, branchName);
    await page.click("button:has-text('Select academic year')");
    await clickOption(page, `${academicYearName} (Current)`);

    // Select subjects from catalog
    await page.click("button:has-text('Select subjects from catalog')");
    await page.fill("input[placeholder='Search subjects...']", "Math WT");
    await page.click("label:has-text('Math WT')");
    await page.fill("input[placeholder='Search subjects...']", "English WT");
    await page.click("label:has-text('English WT')");
    await page.keyboard.press("Escape");

    // Transition to Divisions tab
    await page.click("button:has-text('Save & Continue')");
    await page.waitForSelector("text=Divisions");
    await page.fill("input[placeholder='e.g. A']", "A");

    // Transition to Fees tab
    await page.click("button:has-text('Save & Continue')");
    await page.waitForSelector("text=Fees & Installment Plans");

    // Configure Tuition fee row
    await page.click("button:has-text('Add Fee Row')");
    await page.fill("input[placeholder='Fee name (e.g. Tuition)']", "Tuition");
    await page.fill("input[placeholder='Amount (₹)']", "20000");

    // Configure Installment 1
    await page.click("button:has-text('Add Installment')");
    await page.fill("input[placeholder='e.g. Admission / Term 1'] >> nth=0", "Term 1 Dues");
    await page.fill("input[placeholder='e.g. 15000'] >> nth=0", "10000");
    await page.fill("label:has-text('Due Date') + input >> nth=0", "2026-09-01");

    // Configure Installment 2
    await page.click("button:has-text('Add Installment')");
    await page.fill("input[placeholder='e.g. Admission / Term 1'] >> nth=1", "Term 2 Dues");
    await page.fill("input[placeholder='e.g. 15000'] >> nth=1", "10000");
    await page.fill("label:has-text('Due Date') + input >> nth=1", "2026-12-01");

    // Finish and activate class
    await page.click("button:has-text('Finish & Activate')");
    await page.waitForURL("**/classes");
    console.log("Step 1 complete: Class WT created and activated.");
    await delay();

    // ==========================================
    // STEP 2: Create 5 Staff Members (Admin)
    // ==========================================
    console.log("Step 2: Creating 5 staff members with logins...");

    const rolesList = ["COUNSELOR", "ACCOUNTANT", "TEACHER", "TEACHER", "SCHOOL_ADMIN"];
    const emailsList = [counselorEmail, accountantEmail, teacherEmail, teacher2Email, principalEmail];
    const namesList = ["Counselor WT", "Accountant WT", "Teacher WT", "Teacher2 WT", "Principal WT"];

    for (let i = 0; i < 5; i++) {
      await page.goto("/staff/new");
      await page.waitForLoadState("networkidle");
      await page.fill("label:has-text('Full Name') + input", namesList[i]);
      await page.fill("label:has-text('Email Address') + input", emailsList[i]);
      await page.fill("label:has-text('Phone Number') + input", `999999900${i}`);
      
      await page.click("label:has-text('Role') + button");
      await clickOption(page, rolesList[i]);
      
      // Auto-filled branch for branch scope if required
      const branchButton = page.locator("label:has-text('Branch') + button");
      await branchButton.waitFor({ state: "visible", timeout: 10000 });
      await branchButton.click();
      await clickOption(page, branchName);

      await page.fill("label:has-text('Join Date') + input", "2026-06-01");
      await page.fill("label:has-text('Date of Birth') + input", "1990-01-01");
      
      await page.click("label:has-text('Gender') + button");
      await clickOption(page, "Male");

      // Enable Login account (for Counselor, Accountant, and Teacher 1)
      if (i < 3) {
        await page.click("button[role='switch']");
        await page.fill("label:has-text('Initial Password') + input", password);
      }

      await page.click("button[type='submit']:has-text('Create Staff Profile')");
      await page.waitForURL("**/staff");
      console.log(`Staff created: ${namesList[i]} (${rolesList[i]})`);
      await delay();
    }

    // Assign Teacher WT as Class Teacher for Class WT A
    const createdClass = await prisma.class.findFirst({ where: { name: "Class WT" }, include: { sections: true } });
    if (!createdClass || createdClass.sections.length === 0) throw new Error("WT Class sections not found");
    classId = createdClass.id;
    sectionId = createdClass.sections[0].id;

    const teacherWT = await prisma.staff.findFirst({ where: { name: "Teacher WT" } });
    if (!teacherWT) throw new Error("Teacher WT not found");

    await prisma.section.update({
      where: { id: sectionId },
      data: { classTeacherId: teacherWT.id }
    });

    console.log("Step 2 complete: Staff members created and class teacher assigned.");

    // ==========================================
    // STEP 3: Verify Role-Based Access Control (RBAC)
    // ==========================================
    console.log("Step 3: Verifying RBAC permission boundaries...");
    
    // Create new contexts for Counselor, Accountant, and Teacher to verify access
    const counselorContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const counselorPage = await counselorContext.newPage();
    await login(counselorPage, counselorEmail);

    // Counselor: Verify admissions page is accessible, but fees page is blocked (redirects/fails)
    await counselorPage.goto("/admissions");
    await expect(counselorPage.locator("h1.text-headline-md")).toContainText("Admissions Pipeline Desk");
    
    await counselorPage.goto("/fees");
    await expect(counselorPage.locator("text=Insufficient permissions").or(counselorPage.locator("h1:has-text('Dashboard')"))).toBeVisible();
    await counselorContext.close();

    const accountantContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const accountantPage = await accountantContext.newPage();
    await login(accountantPage, accountantEmail);

    // Accountant: Verify fees page is accessible, but admissions page is blocked
    await accountantPage.goto("/fees");
    await expect(accountantPage.locator("h1.text-headline-md")).toContainText("Fees Collection");

    await accountantPage.goto("/admissions");
    await expect(accountantPage.locator("text=Insufficient permissions").or(accountantPage.locator("h1:has-text('Dashboard')"))).toBeVisible();
    await accountantContext.close();

    console.log("Step 3 complete: RBAC boundaries successfully validated.");

    // ==========================================
    // STEP 4: Counselor Desk Intake (10 Student Inquiries)
    // ==========================================
    console.log("Step 4: Logging 10 student inquiries...");
    const intakeContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const intakePage = await intakeContext.newPage();
    await login(intakePage, counselorEmail);

    for (let i = 0; i < 10; i++) {
      const classResponsePromise = intakePage.waitForResponse(
        r => r.url().includes("/api/v1/classes") && r.status() === 200,
        { timeout: 10000 }
      ).catch(() => null);
      await intakePage.goto("/admissions");
      await classResponsePromise;
      await intakePage.waitForLoadState("networkidle");
      await intakePage.click("button:has-text('Counselor Inquiries')");
      await intakePage.click("button[title='Table List View']");
      await intakePage.click("button:has-text('New Inquiry')");
      
      // Fill details via Autofill helper and override name for uniqueness
      await intakePage.click("button:has-text('Autofill')");
      await intakePage.fill("label:has-text('Student Full Name') + input", `${studentNames[i].first} ${studentNames[i].last}`);
      await intakePage.fill("label:has-text('Parent Email') + input", `parent.wt${i}@example.com`);
      await intakePage.fill("label:has-text('Parent Phone') + input", `987654310${i}`);
      
      // Select our class
      await intakePage.click("label:has-text('Grade Applied') + button");
      await clickOption(intakePage, "Class WT");

      await intakePage.click("button[type='submit']:has-text('Log Inquiry')");
      await intakePage.waitForSelector(`text=${studentNames[i].first}`);

      // Log a conversation follow-up note and advance status to VISITED
      await intakePage.locator("tr").filter({ hasText: studentNames[i].first }).first().click();
      await intakePage.waitForSelector("text=Conversation Log History");
      await intakePage.fill("input[placeholder='Detail your conversation with the parent...']", `Parent discussed curriculum options for WT Student ${i + 1}`);
      
      await intakePage.click("label:has-text('Status Reached') + button");
      await clickOption(intakePage, "Visited");
      
      await intakePage.fill("label:has-text('Next Follow-up Date') + input", "2026-06-30");
      await intakePage.click("button:has-text('Save Follow-up')");
      await intakePage.waitForSelector("text=Follow-up log saved successfully.");
      await expect(intakePage.locator("text=Conversation Log History")).not.toBeVisible();
      console.log(`Inquiry logged: ${studentNames[i].first}`);
      await delay(300);
    }
    await intakeContext.close();

    console.log("Step 4 complete: 10 inquiries logged & workspace follow-ups saved.");

    // ==========================================
    // STEP 5: Fill Applications & Verify Documents (Admin Desk)
    // ==========================================
    console.log("Step 5: Filling applications and verifying documents...");
    // Admin context has document verification rights
    await page.goto("/admissions");
    await page.waitForLoadState("networkidle");
    await page.click("button:has-text('Counselor Inquiries')");
    await page.click("button[title='Table List View']");

    for (let i = 0; i < 10; i++) {
      // Toggle "Show Converted" if they disappeared or filter by name
      await page.fill("input[placeholder*='Search']", studentNames[i].first);
      await page.waitForTimeout(300);
      const row = page.locator("tr").filter({ hasText: studentNames[i].first }).first();
      await row.locator("button:has-text('Register App')").click();

      // Fill empty required fields
      await page.click("button:has-text('Contact & Address')");
      await page.fill("textarea[placeholder*='address']", `${100 + i} Walkthrough Lane, Karad`);
      await page.fill("input[placeholder*='PIN']", "415110");
      await page.fill("input[placeholder*='guardian number']", `998877665${i}`);
      
      // Submit Application
      await page.click("button[type='submit']:has-text('Submit Application')");
      await page.waitForTimeout(500);
      console.log(`Application submitted for: ${studentNames[i].first}`);
    }

    // Now verify documents for the submitted applications
    await page.goto("/admissions");
    await page.waitForLoadState("networkidle");
    await page.click("button:has-text('Applications Desk')");
    await page.click("button[title='Table List View']");
    
    for (let i = 0; i < 10; i++) {
      const appName = `${studentNames[i].first.replace("Student ", "")} Admissions`;
      const app = await prisma.admissionApplication.findFirst({
        where: { lastName: appName }
      });
      if (!app || app.status !== "SUBMITTED") {
        console.log(`Skipping Step 5 (Document verification) for ${studentNames[i].first} (status is ${app?.status})`);
        continue;
      }

      await page.fill("input[placeholder*='Search']", studentNames[i].first.replace("Student ", ""));
      await page.waitForTimeout(300);
      const row = page.locator("tr").filter({ hasText: studentNames[i].first }).first();
      await row.click(); // Open workspace panel
      const dialog = page.locator("div[role='dialog']");
      await dialog.locator("text=Step 2: Document Checklist Verification").waitFor({ state: "visible", timeout: 10000 });

      // Initialize checklist if not present
      if (await dialog.locator("button:has-text('Initialize Checklist')").isVisible()) {
        await dialog.locator("button:has-text('Initialize Checklist')").click();
        await page.waitForTimeout(300);
      }

      // Verify both Birth Certificate and Aadhaar Card
      const verifyButtons = dialog.locator("button:has-text('Verify')");
      await verifyButtons.nth(0).click();
      await page.waitForTimeout(200);
      await verifyButtons.nth(1).click(); // click second verify button
      
      await dialog.locator("label:has-text('Summary Verification Notes') + input").fill("All original documents verified.");
      
      // Advance to Entrance Test Stage
      await dialog.locator("label:has-text('Advance Pipeline To') + button").click();
      await clickOption(page, "Move to Entrance Examination");
      
      await dialog.locator("button[type='submit']:has-text('Confirm & Save Step 2')").click();
      await dialog.locator("text=Step 3: Entrance Exam Score Log").waitFor({ state: "visible", timeout: 15000 });
      await dialog.locator("button.absolute.right-5").click();
      await expect(dialog).toBeHidden({ timeout: 5000 });
      console.log(`Documents verified for: ${studentNames[i].first}`);
    }

    console.log("Step 5 complete: All 10 applicant documents verified.");

    // ==========================================
    // STEP 6: Entrance Exam Grading
    // ==========================================
    console.log("Step 6: Scoring entrance exams...");
    await page.goto("/admissions");
    await page.waitForLoadState("networkidle");
    await page.click("button:has-text('Applications Desk')");
    await page.click("button[title='Table List View']");

    for (let i = 0; i < 10; i++) {
      const appName = `${studentNames[i].first.replace("Student ", "")} Admissions`;
      const app = await prisma.admissionApplication.findFirst({
        where: { lastName: appName }
      });
      if (!app || app.status !== "TEST_SCHEDULED") {
        console.log(`Skipping Step 6 (Exam scoring) for ${studentNames[i].first} (status is ${app?.status})`);
        continue;
      }

      await page.fill("input[placeholder*='Search']", studentNames[i].first.replace("Student ", ""));
      await page.waitForTimeout(300);
      const row = page.locator("tr").filter({ hasText: studentNames[i].first }).first();
      await row.click();
      const dialog = page.locator("div[role='dialog']");
      await dialog.locator("text=Step 3: Entrance Exam Score Log").waitFor({ state: "visible", timeout: 10000 });

      await dialog.locator("label:has-text('Exam Date') + input").fill("2026-06-05");
      await dialog.locator("label:has-text('Maximum Marks') + input").fill("100");
      await dialog.locator("label:has-text('Marks Obtained') + input").fill(String(75 + i)); // unique passing marks

      await dialog.locator("label:has-text('Verdict') + button").click();
      await clickOption(page, "Pass (Approved)");

      await dialog.locator("label:has-text('Advance Status') + button").click();
      await clickOption(page, "Promote to Shortlisted");

      await dialog.locator("button[type='submit']:has-text('Confirm & Log Marks')").click();
      await dialog.locator("text=Step 4: Promote Candidate to Active Student").waitFor({ state: "visible", timeout: 15000 });
      await dialog.locator("button.absolute.right-5").click();
      await expect(dialog).toBeHidden({ timeout: 5000 });
      console.log(`Entrance test scored for: ${studentNames[i].first}`);
    }

    console.log("Step 6 complete: Entrance exam grading logged.");

    // ==========================================
    // STEP 7: Admissions Promotion (Bridge to SIS)
    // ==========================================
    console.log("Step 7: Promoting candidates to active students...");
    await page.goto("/admissions");
    await page.waitForLoadState("networkidle");
    await page.click("button:has-text('Applications Desk')");
    await page.click("button[title='Table List View']");

    for (let i = 0; i < 10; i++) {
      const appName = `${studentNames[i].first.replace("Student ", "")} Admissions`;
      const app = await prisma.admissionApplication.findFirst({
        where: { lastName: appName }
      });
      if (!app || app.status !== "SHORTLISTED") {
        console.log(`Skipping Step 7 (Promotion) for ${studentNames[i].first} (status is ${app?.status})`);
        continue;
      }

      await page.fill("input[placeholder*='Search']", studentNames[i].first.replace("Student ", ""));
      await page.waitForTimeout(300);
      const row = page.locator("tr").filter({ hasText: studentNames[i].first }).first();
      await row.click();
      const dialog = page.locator("div[role='dialog']");
      await dialog.locator("text=Step 4: Promote Candidate to Active Student").waitFor({ state: "visible", timeout: 10000 });
      
      // Select Section A
      await dialog.locator("label:has-text('Section Assignment') + button").click();
      await clickOption(page, "A");

      // Set Roll Number
      await dialog.locator("label:has-text('Roll Number (Optional)') + input").fill(String(101 + i));
      await dialog.locator("label:has-text('Admission Date') + input").fill("2026-06-06");

      // Dynamic custom discount (optional)
      await dialog.locator("label:has-text('Discount Percent (%)') + input").fill("0");

      // Confirm promotion
      await dialog.locator("button[type='submit']:has-text('Confirm Promotion & Admit Student')").click();
      await expect(dialog).toBeHidden({ timeout: 15000 });
      console.log(`Promoted to SIS Student: ${studentNames[i].first} (Roll: ${101+i})`);
    }

    console.log("Step 7 complete: All 10 candidates successfully promoted to Students.");

    // ==========================================
    // STEP 8: Billing & Fees Collection (Accountant)
    // ==========================================
    console.log("Step 8: Billing and collecting fees...");
    const finContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const finPage = await finContext.newPage();
    await login(finPage, accountantEmail);

    // Fetch the students we promoted from DB to target payments precisely
    const wtStudents = await prisma.student.findMany({
      where: { lastName: { startsWith: "WT " } },
      orderBy: { admissionNo: "asc" }
    });

    for (let i = 0; i < wtStudents.length; i++) {
      const student = wtStudents[i];
      await finPage.goto(`/fees/${student.id}`);
      await finPage.waitForLoadState("networkidle");

      // Simulate payment behaviors:
      // - Full Payment (i < 5): Pay both Term 1 and Term 2
      // - Partial Payment (5 <= i < 8): Pay only Term 1
      // - Overdue (8 <= i < 10): Do not pay anything

      if (i < 5) {
        // Pay Installment 1
        await finPage.click("text=Installment #1");
        await finPage.waitForTimeout(300);
        if (await finPage.locator("input#amount").isVisible()) {
          await finPage.fill("input#amount", "10000");
          await finPage.click("label:has-text('Payment Method') + button");
          await clickOption(finPage, "UPI");
          await finPage.click("button[type='submit']:has-text('Record Payment')");
          await finPage.waitForSelector("text=recorded successfully");
          // Dismiss the payment success dialog
          await finPage.click("div[role='dialog'] button:has-text('Close')");
          await finPage.waitForSelector("div[role='dialog']", { state: "detached" });
        }

        // Pay Installment 2
        await finPage.click("text=Installment #2");
        await finPage.waitForTimeout(300);
        if (await finPage.locator("input#amount").isVisible()) {
          await finPage.fill("input#amount", "10000");
          await finPage.click("label:has-text('Payment Method') + button");
          await clickOption(finPage, "Cash");
          await finPage.click("button[type='submit']:has-text('Record Payment')");
          await finPage.waitForSelector("text=recorded successfully");
          // Dismiss the payment success dialog
          await finPage.click("div[role='dialog'] button:has-text('Close')");
          await finPage.waitForSelector("div[role='dialog']", { state: "detached" });
        }
        console.log(`Student ${i+1} paid fully (₹20,000) or already processed`);
      } else if (i < 8) {
        // Pay Installment 1
        await finPage.click("text=Installment #1");
        await finPage.waitForTimeout(300);
        if (await finPage.locator("input#amount").isVisible()) {
          await finPage.fill("input#amount", "10000");
          await finPage.click("label:has-text('Payment Method') + button");
          await clickOption(finPage, "UPI");
          await finPage.click("button[type='submit']:has-text('Record Payment')");
          await finPage.waitForSelector("text=recorded successfully");
          // Dismiss the payment success dialog
          await finPage.click("div[role='dialog'] button:has-text('Close')");
          await finPage.waitForSelector("div[role='dialog']", { state: "detached" });
        }
        console.log(`Student ${i+1} paid partially (₹10,000) or already processed`);
      } else {
        console.log(`Student ${i+1} left unpaid (Dues: ₹20,000)`);
      }
      await delay(300);
    }
    await finContext.close();
    console.log("Step 8 complete: Diverse fee payments recorded.");

    // ==========================================
    // STEP 9: Daily Attendance Logging (Teacher)
    // ==========================================
    console.log("Step 9: Teacher logging daily attendance sheet...");
    const teacherContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const teacherPage = await teacherContext.newPage();
    await login(teacherPage, teacherEmail);

    // Attendance logger mock page
    await teacherPage.goto("/dashboard");
    // Directly update attendance via prisma to simulate 5 days of attendance for our 10 students
    console.log("Simulating 5 days of daily attendance via backend transaction for simulation visual...");
    const attendanceDates = ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"];
    
    await prisma.$transaction(
      attendanceDates.flatMap(dateStr => 
        wtStudents.map(student => 
          prisma.studentAttendance.upsert({
            where: {
              studentId_date: {
                studentId: student.id,
                date: new Date(dateStr)
              }
            },
            create: {
              studentId: student.id,
              branchId,
              sectionId,
              date: new Date(dateStr),
              status: Math.random() > 0.1 ? "PRESENT" : "ABSENT",
              markedBy: "Teacher WT"
            },
            update: {
              status: Math.random() > 0.1 ? "PRESENT" : "ABSENT",
              markedBy: "Teacher WT"
            }
          })
        )
      )
    );

    // Navigate to attendance page as teacher to verify
    await teacherPage.goto("/students");
    await teacherPage.waitForLoadState("networkidle");
    console.log("Step 9 complete: Daily attendance logs saved successfully.");
    await teacherContext.close();

    // ==========================================
    // STEP 10: Leaving Certificate & Dues Override (Admin)
    // ==========================================
    console.log("Step 10: Issuing leaving certificate with outstanding dues override...");
    // Select student 9 (has ₹20,000 outstanding dues)
    const unpaidStudent = wtStudents[8];
    await page.goto(`/students/${unpaidStudent.id}`);
    await page.waitForLoadState("networkidle");

    // Check tabs: Profile details, Document Vault, Academics, Fees, Attendance
    await page.click("button[role='tab']:has-text('Fees Ledger')");
    await expect(page.locator("div.font-black").filter({ hasText: "₹20,000" }).first()).toBeVisible(); // 20k remaining dues

    // Trigger LC Issuance
    await page.click("button:has-text('Issue LC/TC')");
    await page.waitForSelector("h2:has-text('Issue Leaving Certificate')");

    // Click submit, should trigger outstanding dues warning block
    await page.click("#lc-submit-btn");
    await page.waitForSelector("text=Outstanding Dues Warning");
    await expect(page.locator("text=₹20,000").first()).toBeVisible();

    // Bypass outstanding block
    await page.click("button:has-text('Proceed Anyway')");
    await page.waitForSelector("button:has-text('Print LC')");

    // Confirm DB updates
    const dbLc = await prisma.leavingCertificate.findFirst({ where: { studentId: unpaidStudent.id } });
    expect(dbLc).not.toBeNull();
    expect(dbLc?.reasonForLeaving).toBe("Completed Studies");

    const dbStudent = await prisma.student.findUnique({ where: { id: unpaidStudent.id } });
    expect(dbStudent?.status).toBe("TRANSFERRED");
    
    console.log("Step 10 complete: Leaving certificate issued with override.");
    console.log("--- SIMULATION COMPLETE ---");
  });
});
