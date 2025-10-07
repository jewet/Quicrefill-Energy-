export type TermiiOtpMedium = 'sms' | 'whatsapp';

export interface TermiiOtpVerification {
  id: string;
  userId: string;
  transactionReference: string; // Termii’s message_id
  phoneNumber: string;
  otp: string | null; // Stored locally for validation
  medium: TermiiOtpMedium[];
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  attempts?: number;
}

export interface TermiiCreateOtpRequest {
  phoneNumber: string; // International format (e.g., 23490126727)
  medium?: TermiiOtpMedium[]; // Defaults to ["sms"]
}

export interface TermiiValidateOtpRequest {
  transactionReference: string; // Termii message_id
  otp: string; // OTP code to validate
}