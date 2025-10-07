import { PrismaClient } from "@prisma/client";
import { ENV } from "./env";
export const prismaClient = new PrismaClient();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: ENV.POSTGRES_URL,
    },
  },
  log: ENV.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
});

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully.");
  } catch (error) {
    console.error(" Database connection failed:", error);
    process.exit(1);
  }
};

export default prisma;
