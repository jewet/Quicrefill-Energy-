import crypto from "crypto";

export const generateUUID = () => {
  return crypto.randomUUID();
};

export const verifyPayment = async (transactionRef: string): Promise<boolean> => {
  // Mock verification (Replace with Flutterwave API call)
  return transactionRef.startsWith("FLW");
};
// Generate a unique transaction reference
export const generateTransactionReference = (): string => {
  return `PRD-${crypto.randomUUID()}-${Date.now()}`;
};

// Calculate total amount due (price + service fee)
export const calculateTotalAmountDue = (price: number, serviceFee: number = 700): number => {
  return price ;
};