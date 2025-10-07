import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { OrderStatus } from "@prisma/client";

// Ensure that Request interface is extended properly
declare module "express" {
  interface Request {
    isNewCustomer?: boolean;
  }
}

// Middleware to check Pay on Delivery eligibility for Product orders
export const checkPayOnDeliveryEligibility = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  try {
    // Fetching the count of completed product orders
    const orderCount = await prisma.productOrder.count({
      where: { userId, orderStatus: OrderStatus.DELIVERED },
    });

    console.log(`Product order count for user ${userId}: ${orderCount}`);

    // Determine if the user is a new customer
    const isNewCustomer = orderCount === 0;
    req.isNewCustomer = isNewCustomer; // Add to request with type-safe access

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Error checking pay on delivery eligibility:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};