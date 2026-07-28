const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const app = await prisma.admissionApplication.findFirst();
  if(!app) return console.log('No apps');
  const token = crypto.randomBytes(24).toString('hex');
  const d = new Date();
  d.setDate(d.getDate()+14);
  await prisma.applicationToken.create({
    data: {
      applicationId: app.id,
      token,
      expiresAt: d
    }
  });
  console.log('http://localhost:3007/onboarding/' + token);
}

main().finally(()=>prisma.$disconnect());
