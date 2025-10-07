import { z } from 'zod';
import { DocumentStatus } from '@prisma/client';

export const reviewIdentityVerificationSchema = z.object({
  status: z.enum([DocumentStatus.VERIFIED, DocumentStatus.NOT_VERIFIED, DocumentStatus.UNDER_REVIEW]),
  rejectionReason: z.string().nullish(), // Allow null explicitly to match API Gateway
  notifyUser: z.boolean().optional().default(true),
});

export const verificationIdParamSchema = z.object({
  verificationId: z.string().uuid(),
});