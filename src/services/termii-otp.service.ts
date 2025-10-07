// src/services/termii-otp.service.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { TermiiCreateOtpRequest, TermiiValidateOtpRequest, TermiiOtpVerification, TermiiOtpMedium } from '../models/termii-otp.model';

const prisma = new PrismaClient();
const TERMII_API_BASE_URL = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com';
const TERMII_API_KEY = process.env.TERMII_API_KEY || 'TLFVodKZXRufYhpozZbgqUshgMfFiWOHaWrqihSTSdjxbVBjRUHnCWWcEzlbXL';
const TERMII_DEVICE_ID = process.env.TERMII_DEVICE_ID || 'talert'; // Kept as fallback
const TERMII_TEMPLATE_ID = process.env.TERMII_TEMPLATE_ID || '1493-csdn3-ns34w-sd3434-dfdf'; // Kept as fallback

interface TermiiOtpResponse {
  code: string;
  message_id?: string;
  message: string;
  balance?: string;
  user?: string;
  pinId?: string; // Added for OTP send response
}

interface TermiiVerifyResponse {
  pinId: string;
  verified: boolean;
  msisdn: string;
  status: string;
  message?: string;
}

export class TermiiOtpService {
  static async createOtp(
    userId: string,
    { phoneNumber, medium = ['sms'] }: TermiiCreateOtpRequest
  ): Promise<TermiiOtpVerification> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const validMediums: TermiiOtpMedium[] = ['sms', 'whatsapp'];
      if (!medium.every((m) => validMediums.includes(m))) {
        throw new Error("Medium must be 'sms' or 'whatsapp'");
      }

      if (!phoneNumber.match(/^234\d{10}$/)) {
        console.error('Invalid phone number format:', phoneNumber);
        throw new Error('Phone number must be in format 2349069284815');
      }

      const apiKey = TERMII_API_KEY;
      if (!apiKey) throw new Error('TERMII_API_KEY is not defined');

      const otpPayload = {
        api_key: apiKey,
        message_type: 'NUMERIC',
        to: phoneNumber,
        from: 'QUICREFILL',
        channel: 'generic', // 'dnd' for DND numbers if needed
        pin_attempts: 3,
        pin_time_to_live: 10, // 10 minutes
        pin_length: 6,
      };

      console.log('Sending OTP payload to Termii:', JSON.stringify(otpPayload, null, 2));

      const otpResponse = await axios.post<TermiiOtpResponse>(
        `${TERMII_API_BASE_URL}/api/sms/otp/send`,
        otpPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      console.log('Termii OTP send response:', JSON.stringify(otpResponse.data, null, 2));

      if (otpResponse.data.code !== 'ok' || !otpResponse.data.pinId) {
        throw new Error(`Failed to send OTP: ${otpResponse.data.message || 'Unknown error'}`);
      }

      const pinId = otpResponse.data.pinId;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Fallback template logic (unchanged, kept for reference)
      const templatePayload = {
        phone_number: phoneNumber,
        device_id: TERMII_DEVICE_ID,
        template_id: TERMII_TEMPLATE_ID,
        api_key: apiKey,
        data: {
          product_name: 'Quicrefill',
          otp: Math.floor(100000 + Math.random() * 900000).toString(),
          expiry_time: '10 minutes',
        },
      };
      console.log('Template payload (unused unless fallback needed):', JSON.stringify(templatePayload, null, 2));

      const existingOtp = await prisma.otp.findFirst({
        where: { userId, phoneNumber, verified: false },
      });
      if (existingOtp) {
        await prisma.otp.delete({ where: { id: existingOtp.id } });
        console.log('Deleted stale OTP:', existingOtp.id);
      }

      const otpRecord = await prisma.otp.create({
        data: {
          userId,
          transactionReference: pinId,
          phoneNumber,
          code: 'PENDING',
          medium,
          expiresAt,
          attempts: 0,
        },
      });

      return {
        id: otpRecord.id,
        userId: otpRecord.userId,
        transactionReference: otpRecord.transactionReference,
        phoneNumber: otpRecord.phoneNumber || '',
        otp: null,
        medium: otpRecord.medium as TermiiOtpMedium[],
        expiresAt: otpRecord.expiresAt,
        verified: otpRecord.verified,
        createdAt: otpRecord.createdAt,
        updatedAt: otpRecord.updatedAt,
        attempts: otpRecord.attempts,
      };
    } catch (error: any) {
      console.error('Termii createOtp Error:', {
        message: error.message,
        response: error.response?.data,
      });
      throw error instanceof Error ? error : new Error('Failed to create OTP with Termii');
    }
  }

  static async validateOtp({ transactionReference, otp }: TermiiValidateOtpRequest): Promise<TermiiOtpVerification> {
    try {
      const otpRecord = await prisma.otp.findUnique({
        where: { transactionReference },
        include: { user: true },
      });
      if (!otpRecord) throw new Error('Invalid transaction reference');
      if (otpRecord.verified) throw new Error('OTP already verified');
      if (new Date() > otpRecord.expiresAt) throw new Error('OTP expired');
      if (otpRecord.attempts >= 3) throw new Error('Maximum attempts exceeded');

      const apiKey = TERMII_API_KEY;
      if (!apiKey) throw new Error('TERMII_API_KEY is not defined');

      const verifyPayload = {
        api_key: apiKey,
        pin_id: transactionReference,
        pin: otp,
      };

      console.log('Validating OTP with Termii:', JSON.stringify(verifyPayload, null, 2));

      const verifyResponse = await axios.post<TermiiVerifyResponse>(
        `${TERMII_API_BASE_URL}/api/sms/otp/verify`,
        verifyPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      console.log('Termii validation response:', JSON.stringify(verifyResponse.data, null, 2));

      if (!verifyResponse.data.verified) {
        await prisma.otp.update({
          where: { transactionReference },
          data: { attempts: otpRecord.attempts + 1 },
        });
        throw new Error(`Invalid OTP: ${verifyResponse.data.message || 'Verification failed'}`);
      }

      const updatedOtpRecord = await prisma.otp.update({
        where: { transactionReference },
        data: {
          verified: true,
          attempts: otpRecord.attempts + 1,
          code: otp,
        },
      });

      await prisma.user.update({
        where: { id: otpRecord.userId },
        data: { phoneNumber: otpRecord.phoneNumber },
      });

      return {
        id: updatedOtpRecord.id,
        userId: updatedOtpRecord.userId,
        transactionReference: updatedOtpRecord.transactionReference,
        phoneNumber: updatedOtpRecord.phoneNumber || '',
        otp: null,
        medium: updatedOtpRecord.medium as TermiiOtpMedium[],
        expiresAt: updatedOtpRecord.expiresAt,
        verified: updatedOtpRecord.verified,
        createdAt: updatedOtpRecord.createdAt,
        updatedAt: updatedOtpRecord.updatedAt,
        attempts: updatedOtpRecord.attempts,
      };
    } catch (error: any) {
      console.error('Termii validateOtp Error:', {
        message: error.message,
        response: error.response?.data,
      });
      throw error instanceof Error ? error : new Error('Failed to validate OTP with Termii');
    }
  }
}