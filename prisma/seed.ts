import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password123', BCRYPT_ROUNDS);

  const user1 = await prisma.appUser.create({
    data: {
      email: 'alice@example.com',
      fullName: 'Alice Johnson',
      passwordHash,
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date('2027-12-31'),
    },
  });

  const user2 = await prisma.appUser.create({
    data: {
      email: 'bob@example.com',
      fullName: 'Bob Smith',
      passwordHash,
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date('2027-12-31'),
    },
  });

  const user3 = await prisma.appUser.create({
    data: {
      email: 'charlie@example.com',
      fullName: 'Charlie Brown',
      passwordHash,
      subscriptionStatus: 'active',
      subscriptionEndsAt: new Date('2027-12-31'),
    },
  });

  const company1 = await prisma.company.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerId: user1.id,
    },
  });

  const company2 = await prisma.company.create({
    data: {
      name: 'Globex Inc',
      slug: 'globex-inc',
      ownerId: user2.id,
    },
  });

  const members = [
    { companyId: company1.id, userId: user1.id, role: 'owner' },
    { companyId: company1.id, userId: user3.id, role: 'member' },
    { companyId: company2.id, userId: user2.id, role: 'owner' },
  ];

  for (const m of members) {
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: m.companyId, userId: m.userId } },
      update: { role: m.role },
      create: m,
    });
  }

  await prisma.appUser.update({
    where: { id: user1.id },
    data: { activeCompanyId: company1.id },
  });

  await prisma.appUser.update({
    where: { id: user2.id },
    data: { activeCompanyId: company2.id },
  });

  const project1 = await prisma.project.create({
    data: {
      companyId: company1.id,
      name: 'Website Redesign',
      description: 'Redesign the company website with new branding',
      createdById: user1.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      companyId: company1.id,
      name: 'Mobile App',
      description: 'Build the new mobile application',
      createdById: user1.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      companyId: company2.id,
      name: 'Internal Tools',
      description: 'Build internal productivity tools',
      createdById: user2.id,
    },
  });

  await prisma.task.createMany({
    data: [
      {
        companyId: company1.id,
        projectId: project1.id,
        title: 'Design mockups',
        description: 'Create design mockups for the new website',
        status: 'done',
        priority: 'high',
        assigneeId: user3.id,
      },
      {
        companyId: company1.id,
        projectId: project1.id,
        title: 'Implement frontend',
        description: 'Build the React frontend components',
        status: 'in_progress',
        priority: 'high',
        assigneeId: user3.id,
        dueDate: new Date('2026-08-15'),
      },
      {
        companyId: company1.id,
        projectId: project1.id,
        title: 'Setup CI/CD pipeline',
        status: 'todo',
        priority: 'medium',
      },
      {
        companyId: company1.id,
        projectId: project2.id,
        title: 'Define API schema',
        description: 'Design the REST API for the mobile app',
        status: 'todo',
        priority: 'high',
        dueDate: new Date('2026-08-01'),
      },
      {
        companyId: company1.id,
        projectId: project2.id,
        title: 'Setup React Native project',
        status: 'in_progress',
        priority: 'medium',
        assigneeId: user3.id,
      },
      {
        companyId: company2.id,
        projectId: project3.id,
        title: 'Build dashboard',
        status: 'todo',
        priority: 'high',
      },
    ],
  });

  console.log('Seed complete!');
  console.log('---');
  console.log('Users:');
  console.log(`  Alice: alice@example.com / Password123 (Company: acme-corp, role: owner)`);
  console.log(`  Bob:   bob@example.com / Password123 (Company: globex-inc, role: owner)`);
  console.log(`  Charlie: charlie@example.com / Password123 (Company: acme-corp, role: member)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
