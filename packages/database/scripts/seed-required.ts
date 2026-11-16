import "dotenv/config";
import { createPrismaClient, localDatabaseUrl } from "../src";

/**
 * Reference data every environment needs (safe to run repeatedly, including production).
 * Demo users, workspaces and runs live in `seed-demo.ts`.
 */
const billingPlans = [
  { code: "FREE", name: "Free", monthlyRunLimit: 1000, dailyAiCallLimit: 100 },
  { code: "PRO", name: "Pro", monthlyRunLimit: 20000, dailyAiCallLimit: 2000 }
];

async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL ?? localDatabaseUrl);
  try {
    for (const plan of billingPlans) {
      await prisma.billingPlanMock.upsert({
        where: { code: plan.code },
        update: { name: plan.name, monthlyRunLimit: plan.monthlyRunLimit, dailyAiCallLimit: plan.dailyAiCallLimit },
        create: plan
      });
    }
    console.log(`Seeded required reference data (${billingPlans.length} billing plans).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
