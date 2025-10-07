import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

const VAT_RATE = parseFloat(process.env.VAT_RATE || "7.5") / 100;

export const generateTransactionReference = (): string => {
  return `ELEC-${uuidv4()}-${Date.now()}`;
};

export const generateJWT = (userId: string, paymentAmount: number, meterNumber: string, billerCode: string): string => {
  const secret = process.env.ELECTRICITY_JWT_SECRET || "your-secure-secret-key";
  return jwt.sign({ userId, paymentAmount, meterNumber, billerCode }, secret, { expiresIn: "1h" }); // Increased to 1 hour
};

export const verifyJWT = (token: string): any => {
  const secret = process.env.ELECTRICITY_JWT_SECRET || "your-secure-secret-key";
  return jwt.verify(token, secret);
};

export const isPrepaidElectricity = (billerCode: string): boolean => {
  const prepaidCodes = ["BIL112", "BIL113", "BIL114", "BIL115", "BIL117", "BIL119", "BIL120", "BIL204"];
  return prepaidCodes.includes(billerCode);
};

export const validateMeterNumber = (meterNumber: string): boolean => {
  return /^[0-9]{10,13}$/.test(meterNumber);
};

export const validatePaymentAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 1000000; // Example limit of 1M NGN
};

export const calculateTotalAmount = (
  paymentAmount: number,
  serviceFee: number,
  flutterwaveFee: number,
  vat: number = 0
): number => {
  const totalWithoutVat = paymentAmount + serviceFee + flutterwaveFee;
  const calculatedVat = vat === 0 ? Math.ceil(totalWithoutVat * VAT_RATE) : vat;
  return totalWithoutVat + calculatedVat;
};

export const calculateMerchantDeduction = (paymentAmount: number, flutterwaveFee: number): number => {
  return paymentAmount + flutterwaveFee;
};