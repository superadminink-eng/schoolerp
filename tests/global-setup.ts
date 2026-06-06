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

  const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } });
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

  console.log("Database & Firebase setup complete. Saving auth sessions...");

  // Ensure output directory exists
  const authDir = "C:/Users/Admin/.gemini/antigravity/brain/532c3931-a4a0-4f51-ab61-122b1ddfd523/scratch/auth";
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
