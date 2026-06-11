import { chromium, type FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { getAdminAuth } from "../src/lib/firebase-admin";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

async function ensureFirebaseUser(email: string, password: string): Promise<string> {
  const adminAuth = getAdminAuth();
  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: email.split("@")[0],
    });
    return userRecord.uid;
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") {
      const userRecord = await adminAuth.getUserByEmail(email);
      await adminAuth.updateUser(userRecord.uid, { password });
      return userRecord.uid;
    }
    throw error;
  }
}

async function globalSetup(config: FullConfig) {
  console.log("Global Setup: Synchronizing seed users in Firebase and database...");

  // 1. Fetch organization, branch, and roles
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found in database. Run database seeder first.");

  const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: "CSVKRD" } }) || await prisma.branch.findFirst({ where: { organizationId: org.id } });
  if (!branch) throw new Error("No branch found for organization.");

  const schoolAdminRole = await prisma.role.findFirst({ where: { name: "SCHOOL_ADMIN" } });
  const counselorRole = await prisma.role.findFirst({ where: { name: "COUNSELOR" } });

  if (!schoolAdminRole || !counselorRole) {
    throw new Error("Default roles SCHOOL_ADMIN or COUNSELOR not found in database. Run seed first.");
  }

  // 1.5 Clean up existing test data to ensure test run is completely hermetic
  await prisma.admissionApplication.deleteMany({
    where: {
      OR: [
        { firstName: "Omkar", lastName: "Ranade" },
        { inquiry: { studentName: "Omkar Ranade" } }
      ]
    }
  });

  await prisma.admissionInquiry.deleteMany({
    where: { studentName: "Omkar Ranade" }
  });

  // 2. Setup credentials
  const usersToSeed = [
    {
      email: "test.admin@school.com",
      name: "Test Admin",
      roleId: schoolAdminRole.id,
    },
    {
      email: "test.counselor@school.com",
      name: "Test Counselor",
      roleId: counselorRole.id,
    },
  ];

  for (const u of usersToSeed) {
    const firebaseUid = await ensureFirebaseUser(u.email, "password123");
    await prisma.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: u.email } },
      update: {
        firebaseUid,
        isActive: true,
        roleId: u.roleId,
        branchId: branch.id,
      },
      create: {
        organizationId: org.id,
        branchId: branch.id,
        email: u.email,
        name: u.name,
        firebaseUid,
        roleId: u.roleId,
        isActive: true,
      },
    });
  }

  // 1.8. Seed Parent User & Linked Active Student with Invoices for integration tests
  console.log("Global Setup: Seeding parent user, active student, and invoice for tests...");
  let parentRole = await prisma.role.findFirst({ where: { name: "PARENT" } });
  if (!parentRole) {
    parentRole = await prisma.role.create({
      data: {
        name: "PARENT",
        description: "System default PARENT role",
        isSystem: true,
      },
    });
  }

  const parentEmail = "krishnaverma@test.com";
  const parentFirebaseUid = await ensureFirebaseUser(parentEmail, "password123");
  const parentUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: parentEmail } },
    update: {
      firebaseUid: parentFirebaseUid,
      isActive: true,
      roleId: parentRole.id,
      branchId: branch.id,
    },
    create: {
      organizationId: org.id,
      branchId: branch.id,
      email: parentEmail,
      name: "Krishna Verma",
      firebaseUid: parentFirebaseUid,
      roleId: parentRole.id,
      isActive: true,
    },
  });

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      relationship: "FATHER",
    },
  });

  let currentAcademicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } }) || await prisma.academicYear.findFirst();
  if (!currentAcademicYear) throw new Error("No academic year found in database");

  // Force isCurrent to true on the selected academic year to heal the DB state
  if (!currentAcademicYear.isCurrent) {
    await prisma.academicYear.updateMany({
      where: { organizationId: org.id },
      data: { isCurrent: false }
    });
    currentAcademicYear = await prisma.academicYear.update({
      where: { id: currentAcademicYear.id },
      data: { isCurrent: true }
    });
  }

  let studentClass = await prisma.class.findFirst({ where: { branchId: branch.id, academicYearId: currentAcademicYear.id } })
    || await prisma.class.findFirst({ where: { branchId: branch.id } })
    || await prisma.class.findFirst();
  if (!studentClass) throw new Error("No class found in database");

  // Align studentClass with current academic year and activate it
  if (studentClass.academicYearId !== currentAcademicYear.id || studentClass.status !== "ACTIVE") {
    studentClass = await prisma.class.update({
      where: { id: studentClass.id },
      data: {
        academicYearId: currentAcademicYear.id,
        status: "ACTIVE"
      }
    });
  }

  const studentSection = await prisma.section.findFirst({ where: { classId: studentClass.id } }) || await prisma.section.findFirst();
  if (!studentSection) throw new Error("No section found in database");

  const student = await prisma.student.upsert({
    where: { branchId_admissionNo: { branchId: branch.id, admissionNo: "ADM-KV-001" } },
    update: {
      organizationId: org.id,
      firstName: "Aarav",
      lastName: "Verma",
      dateOfBirth: new Date("2015-05-15"),
      gender: "MALE",
      fatherName: "Krishna Verma",
      fatherEmail: parentEmail,
      status: "ACTIVE",
    },
    create: {
      organizationId: org.id,
      branchId: branch.id,
      admissionNo: "ADM-KV-001",
      firstName: "Aarav",
      lastName: "Verma",
      dateOfBirth: new Date("2015-05-15"),
      gender: "MALE",
      fatherName: "Krishna Verma",
      fatherEmail: parentEmail,
      status: "ACTIVE",
    },
  });

  await prisma.studentParent.upsert({
    where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
    update: {},
    create: {
      studentId: student.id,
      parentId: parent.id,
      relation: "FATHER",
      isPrimary: true,
    },
  });

  await prisma.studentEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: currentAcademicYear.id } },
    update: {
      sectionId: studentSection.id,
    },
    create: {
      studentId: student.id,
      academicYearId: currentAcademicYear.id,
      sectionId: studentSection.id,
    },
  });

  let feeStructure = await prisma.feeStructure.findFirst({ where: { classId: studentClass.id } });
  if (!feeStructure) {
    let feeCategory = await prisma.feeCategory.findFirst({ where: { organizationId: org.id } });
    if (!feeCategory) {
      feeCategory = await prisma.feeCategory.create({
        data: {
          organizationId: org.id,
          name: "Tuition Fee Test",
        },
      });
    }
    feeStructure = await prisma.feeStructure.create({
      data: {
        academicYearId: currentAcademicYear.id,
        classId: studentClass.id,
        feeCategoryId: feeCategory.id,
        amount: 10000.00,
        frequency: "MONTHLY",
      },
    });
  }

  // Clean up any existing fee payments and invoices for the test student
  await prisma.feePayment.deleteMany({
    where: {
      studentId: student.id,
    },
  });

  await prisma.invoice.deleteMany({
    where: {
      studentId: student.id,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      studentId: student.id,
      organizationId: org.id,
      number: `INV-KV-${Date.now().toString().slice(-6)}`,
      year: new Date().getFullYear(),
      totalAmount: 15000.00,
      paidAmount: 0.00,
      status: "PENDING",
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            feeStructureId: feeStructure.id,
            amount: 15000.00,
            description: "Tuition Fee Payment",
          },
        ],
      },
    },
  });
  console.log(`Created fresh test invoice: ${invoice.number}`);

  // 1.9. Seed 205 dummy students if count is low, ensuring directory E2E search/filter tests pass
  // Clean up any existing seed students first to avoid unique constraint issues
  await prisma.student.deleteMany({
    where: {
      admissionNo: { startsWith: "ADM-SEED-" }
    }
  });

  const currentStudentCount = await prisma.student.count();
  if (currentStudentCount < 200) {
    console.log(`Global Setup: Only ${currentStudentCount} students found. Seeding 205 dummy students...`);
    const studentsToCreate = [];
    
    // Test requires at least 2 Aanya Verma and 1 Aanya Pawar in the database
    const specialStudents = [
      { firstName: "Aanya", lastName: "Verma", category: "GENERAL", gender: "FEMALE" },
      { firstName: "Aanya", lastName: "Verma", category: "GENERAL", gender: "FEMALE" },
      { firstName: "Aanya", lastName: "Pawar", category: "RTE", gender: "FEMALE" },
    ];

    for (let i = 0; i < 205; i++) {
      let firstName = `Student${i}`;
      let lastName = `Test`;
      let category = i < 35 ? "RTE" : "GENERAL"; // Seed 35 RTE students to satisfy > 0 card assertion
      let gender = i % 2 === 0 ? "MALE" : "FEMALE";

      if (i < specialStudents.length) {
        firstName = specialStudents[i].firstName;
        lastName = specialStudents[i].lastName;
        category = specialStudents[i].category;
        gender = specialStudents[i].gender;
      }

      studentsToCreate.push({
        branchId: branch.id,
        organizationId: org.id,
        admissionNo: `ADM-SEED-${1000 + i}`,
        firstName,
        lastName,
        dateOfBirth: new Date("2015-06-01"),
        gender: gender as any,
        category: category as any,
        status: "ACTIVE" as any,
      });
    }

    // Insert all students with enrollments in a transaction
    await prisma.$transaction(
      studentsToCreate.map((s) =>
        prisma.student.create({
          data: {
            ...s,
            enrollments: {
              create: {
                academicYearId: currentAcademicYear.id,
                sectionId: studentSection.id,
              },
            },
          } as any,
        })
      )
    );
    console.log("Global Setup: Successfully seeded 205 dummy students!");
  }

  console.log("Database & Firebase setup complete. Saving auth sessions...");

  // Ensure output directory exists
  const authDir = path.join(__dirname, "tmp", "auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 3. Capture auth sessions
  const browser = await chromium.launch();
  const baseURL = config.projects[0].use.baseURL || "http://localhost:3007";

  // Cache Admin Session
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', "test.admin@school.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${baseURL}/dashboard`);
    await context.storageState({ path: path.join(authDir, "admin.json") });
    await context.close();
    console.log("Cached Admin Session successfully.");
  }

  // Cache Counselor Session
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', "test.counselor@school.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${baseURL}/dashboard`);
    await context.storageState({ path: path.join(authDir, "counselor.json") });
    await context.close();
    console.log("Cached Counselor Session successfully.");
  }

  await browser.close();
  await prisma.$disconnect();
}

export default globalSetup;
