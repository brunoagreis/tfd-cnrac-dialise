import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaPool?: Pool
}

function getPool() {
  if (globalForPrisma.prismaPool) {
    return globalForPrisma.prismaPool
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString || !connectionString.trim()) {
    throw new Error("DATABASE_URL não foi definida no arquivo .env")
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaPool = pool
  }

  return pool
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}