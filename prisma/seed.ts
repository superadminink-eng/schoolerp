import { PrismaClient } from "@prisma/client";
import { MODULES, DEFAULT_ROLE_PERMISSIONS } from "../src/config/permissions";

const prisma = new PrismaClient();

console.log("INSIDE SEED.TS - MODULES.admissions:", MODULES.admissions);

async function main() {
  console.log("Seeding permissions...");

  // Create all permissions
  const permissions: { module: string; action: string }[] = [];
  for (const [module, config] of Object.entries(MODULES)) {
    const actions = [...config.standard, ...(config.special || [])];
    for (const action of actions) {
      permissions.push({ module, action });
    }
  }

  // Auto-cleanup obsolete permissions from DB to prevent orphan duplicates in Roles UI
  const existingPerms = await prisma.permission.findMany();
  const activeKeys = new Set(permissions.map(p => `${p.module}:${p.action}`));
  const permsToDelete = existingPerms.filter(p => !activeKeys.has(`${p.module}:${p.action}`));

  if (permsToDelete.length > 0) {
    console.log(`Cleaning up ${permsToDelete.length} obsolete permissions...`);
    const deleteIds = permsToDelete.map(p => p.id);
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: deleteIds } },
    });
    await prisma.userPermission.deleteMany({
      where: { permissionId: { in: deleteIds } },
    });
    await prisma.permission.deleteMany({
      where: { id: { in: deleteIds } },
    });
  }

  const descriptions: Record<string, string> = {
    "admissions:inquiry_desk": "Inquiry Desk - Register and follow-up counselor inquiries",
    "admissions:document_verification": "Document Verification - Verify applicant documents",
    "admissions:entrance_exam": "Entrance Exam - Schedule and score entrance tests",
    "admissions:registrar_desk": "Registrar Desk - Promote shortlisted candidates and collect fees",
    "admissions:delete": "Delete admissions inquiries or applications records",
  };

  for (const perm of permissions) {
    if (perm.module === 'admissions') {
      console.log(`Upserting admissions permission: ${perm.action}`);
    }
    const key = `${perm.module}:${perm.action}`;
    const desc = descriptions[key] || `${perm.action} ${perm.module}`;
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: {
        description: desc,
      },
      create: {
        module: perm.module,
        action: perm.action,
        description: desc,
      },
    });
  }

  console.log(`Created ${permissions.length} permissions`);

  // Assign default permissions to roles
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(
    allPermissions.map((p) => [`${p.module}:${p.action}`, p.id])
  );

  for (const [role, permKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (!permKeys) continue;

    const desiredPermIds = new Set(
      permKeys.map((key) => permMap.get(key)).filter(Boolean) as string[]
    );

    const roleType = role === "STUDENT" ? "STUDENT" : role === "PARENT" ? "PARENT" : "STAFF";

    // Upsert the system Role manually because of nullable unique constraint
    let roleRecord = await prisma.role.findFirst({
      where: { organizationId: null, name: role },
    });

    if (!roleRecord) {
      roleRecord = await prisma.role.create({
        data: {
          name: role,
          description: `System default ${role} role`,
          isSystem: true,
          type: roleType,
        },
      });
    } else {
      roleRecord = await prisma.role.update({
        where: { id: roleRecord.id },
        data: {
          description: `System default ${role} role`,
          isSystem: true,
          type: roleType,
        },
      });
    }

    // Remove role permissions that are no longer in the config
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: roleRecord.id,
        permissionId: { notIn: Array.from(desiredPermIds) },
      },
    });

    for (const key of permKeys) {
      const permId = permMap.get(key);
      if (!permId) {
        console.warn(`Permission ${key} not found, skipping`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecord.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: roleRecord.id,
          permissionId: permId,
        },
      });
    }

    console.log(`Assigned ${permKeys.length} permissions to ${role}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
