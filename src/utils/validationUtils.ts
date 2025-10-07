import { VerificationStatus } from '@prisma/client';
import { UrlStatuses } from '../services/ComplianceDocumentService';

export function isValidUrlStatuses(json: unknown): json is UrlStatuses {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return false;
  }

  const obj = json as Record<string, unknown>;

  return Object.values(obj).every((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const val = value as Record<string, unknown>;

    if (!('status' in val)) return false;
    if (!Object.values(VerificationStatus).includes(val.status as VerificationStatus)) return false;

    if (
      'rejectionReason' in val &&
      val.rejectionReason !== undefined &&
      val.rejectionReason !== null &&
      typeof val.rejectionReason !== 'string'
    ) {
      return false;
    }

    return true;
  });
}