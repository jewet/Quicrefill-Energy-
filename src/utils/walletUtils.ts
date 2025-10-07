import prisma from "../config/db";
import logger from "../config/logger"; 

export const ensureWalletExists = async (userId: string): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      await prisma.wallet.create({
        data: { userId, balance: 0 },
      });
      logger.info(`Created wallet for user ${userId}`);
    }
  } catch (error: any) {
    logger.error(`Error ensuring wallet exists for user ${userId}: ${error.message}`);
    throw error;
  }
};
