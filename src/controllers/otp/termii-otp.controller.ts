// src/controllers/termii-otp.controller.ts
import { Request, Response } from 'express';
import { TermiiOtpService } from '../../services/termii-otp.service';
import { HttpResponse } from '../../utils/http.util';
import { TermiiCreateOtpRequest, TermiiValidateOtpRequest } from '../../models/termii-otp.model';

declare module 'express' {
  interface Request {
    userId?: string;
  }
}

export class TermiiOtpController {
  static async createOtp(req: Request, res: Response) {
    const userId = req.userId;
    const { phoneNumber, medium } = req.body as Partial<TermiiCreateOtpRequest>;

    try {
      if (!userId) {
        return HttpResponse.error(res, 'User not authenticated', 401);
      }

      if (!phoneNumber || !/^234\d{10}$/.test(phoneNumber)) {
        return HttpResponse.error(res, 'Valid phone number in format 2349069284815 is required', 400);
      }

      const otpVerification = await TermiiOtpService.createOtp(userId, { phoneNumber, medium });
      return HttpResponse.success(
        res,
        {
          otpId: otpVerification.id,
          transactionReference: otpVerification.transactionReference,
          expiresAt: otpVerification.expiresAt,
        },
        'OTP sent successfully',
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      console.error('createOtp Error:', { message, userId, phoneNumber });
      return HttpResponse.error(res, message, 500);
    }
  }

  static async validateOtp(req: Request, res: Response) {
    const { transactionReference, otp: otpCode } = req.body as Partial<TermiiValidateOtpRequest>;

    try {
      if (!transactionReference || !otpCode || !/^\d{6}$/.test(otpCode)) {
        return HttpResponse.error(res, 'Valid transaction reference and 6-digit OTP code are required', 400);
      }

      const otpVerification = await TermiiOtpService.validateOtp({ transactionReference, otp: otpCode });
      return HttpResponse.success(
        res,
        { verified: otpVerification.verified },
        'OTP validated successfully'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate OTP';
      console.error('validateOtp Error:', { message, transactionReference });
      return HttpResponse.error(res, message, 400);
    }
  }
}