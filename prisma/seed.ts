import { PrismaClient } from "@prisma/client";
import { MODULES, DEFAULT_ROLE_PERMISSIONS } from "../src/config/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding permissions...");

  // Create all permissions
  const permissions: { module: string; action: string }[] = [];
  for (const [module, actions] of Object.entries(MODULES)) {
    for (const action of actions) {
      permissions.push({ module, action });
    }
  }

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: {},
      create: {
        module: perm.module,
        action: perm.action,
        description: `${perm.action} ${perm.module}`,
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
        },
      });
    } else {
      roleRecord = await prisma.role.update({
        where: { id: roleRecord.id },
        data: {
          description: `System default ${role} role`,
          isSystem: true,
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
