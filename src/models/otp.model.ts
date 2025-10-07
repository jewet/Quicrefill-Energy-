// src/models/otp.model.ts

// Represents the mediums supported for OTP delivery
export type OtpMedium = 'sms' | 'email' | 'whatsapp';

// Represents the full OTP record stored in the database and returned to the frontend
export interface OtpVerification {
  id: string; // Unique identifier for the OTP record
  userId: string; // ID of the user associated with the OTP
  transactionReference: string; // Unique reference from Flutterwave for the OTP
  phoneNumber: string; // Phone number used for OTP delivery (E.164 format)
  email?: string; // Email used for OTP delivery (optional, for email medium)
  otp: string | null; // OTP code (null until validated, then stores the verified code)
  medium: OtpMedium[]; // Array of mediums used for this OTP (e.g., ["sms"], ["whatsapp"])
  expiresAt: Date; // Timestamp when the OTP expires
  verified: boolean; // Indicates if the OTP has been validated
  createdAt: Date; // Timestamp when the OTP record was created
  updatedAt: Date; // Timestamp when the OTP record was last updated
  attempts?: number; // Number of validation attempts (optional, for tracking)
}

// Request payload for creating an OTP
export interface CreateOtpRequest {
  phoneNumber: string; // Phone number in E.164 format (required)
  medium?: OtpMedium[]; // Optional array of mediums (defaults to ["sms"] in service)
  email?: string; // Optional email for email-based OTP (required if medium includes "email")
}

// Request payload for validating an OTP
export interface ValidateOtpRequest {
  transactionReference: string; // Unique reference from Flutterwave to identify the OTP
  otp: string; // OTP code provided by the user for validation
}