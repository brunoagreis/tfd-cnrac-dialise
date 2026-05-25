import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("OK: Prisma conectou no Postgres ✅");
}

main().finally(async () => prisma.$disconnect());