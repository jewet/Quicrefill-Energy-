import { z } from 'zod';
import { VerificationStatus, DocumentType } from '@prisma/client';

// License type enum (aligned with Prisma schema)
export const LicenseTypeEnum = z.enum([
  'DRIVERS_LICENSE',
  'DRIVING_LICENSE',
  'OPERATORS_LICENSE',
  'BUSINESS',
  'VEHICLE',
  'SAFETY',
  'OPERATIONAL',
]);

export const DocumentTypeEnum = z.enum(Object.values(DocumentType) as [string, ...string[]], {
  errorMap: () => ({
    message: `documentType must be one of: ${Object.values(DocumentType).join(', ')}`,
  }),
});

// URL status schema for updates
const urlStatusSchema = z.object({
  status: z.enum(Object.values(VerificationStatus) as [string, ...string[]], {
    errorMap: () => ({
      message: `Status must be one of: ${Object.values(VerificationStatus).join(', ')}`,
    }),
  }),
  rejectionReason: z.string().optional(),
}).refine(
  (data) => data.status !== VerificationStatus.REJECTED || !!data.rejectionReason,
  {
    message: 'rejectionReason is required when status is REJECTED',
    path: ['rejectionReason'],
  }
);

// Base schema for vehicle (without refinement)
const baseVehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required'),
  documentType: DocumentTypeEnum,
  driverLicenseUrl: z.string().url('Invalid driver license URL').nullable().optional(),
  vehicleRoadLicenseUrl: z.string().url('Invalid vehicle road license URL').nullable().optional(),
  plateNumberUrl: z.string().url('Invalid plate number URL').nullable().optional(),
});

// Vehicle schema with refinement
export const vehicleSchema = baseVehicleSchema.refine(
  (data) => {
    const hasUrls = data.driverLicenseUrl && data.vehicleRoadLicenseUrl && data.plateNumberUrl;
    const hasNoUrls = !data.driverLicenseUrl && !data.vehicleRoadLicenseUrl && !data.plateNumberUrl;
    return hasUrls || hasNoUrls;
  },
  {
    message: 'All file URLs (driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl) must be provided together or none at all',
    path: ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl'],
  }
);

// Resubmit vehicle schema
export const resubmitVehicleSchema = baseVehicleSchema.extend({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
}).refine(
  (data) => {
    // Ensure at least one URL is provided for resubmission
    return data.driverLicenseUrl || data.vehicleRoadLicenseUrl || data.plateNumberUrl;
  },
  {
    message: 'At least one document (driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl) must be provided for resubmission',
    path: ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl'],
  }
);

// Base schema for business verification (without refinement)
const baseBusinessVerificationSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  rcNumber: z.string().min(1, 'RC number is required'),
  businessAddress: z.string().min(1, 'Business address is required'),
  tinNumber: z.string().min(1, 'TIN number is required'),
  businessLogoUrl: z.string().url('Invalid business logo URL').nullable().optional(),
  handles: z.record(z.string()).nullable().optional(),
  documentType: DocumentTypeEnum,
  cacDocumentUrl: z.string().url('Invalid CAC document URL').nullable().optional(),
  proofOfAddressUrl: z.string().url('Invalid proof of address URL').nullable().optional(),
  tinDocumentUrl: z.string().url('Invalid TIN document URL').nullable().optional(),
});

// Business verification schema with refinement
export const businessVerificationSchema = baseBusinessVerificationSchema.refine(
  (data) => {
    const hasUrls = data.cacDocumentUrl && data.proofOfAddressUrl && data.tinDocumentUrl;
    const hasNoUrls = !data.cacDocumentUrl && !data.proofOfAddressUrl && !data.tinDocumentUrl;
    return hasUrls || hasNoUrls;
  },
  {
    message: 'All file URLs (cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl) must be provided together or none at all',
    path: ['cacDocumentUrl', 'proofOfAddressUrl', 'tinDocumentUrl'],
  }
);

// Resubmit business verification schema
export const resubmitBusinessVerificationSchema = baseBusinessVerificationSchema.extend({
  businessVerificationId: z.string().uuid('Invalid business verification ID'),
}).refine(
  (data) => {
    // Ensure at least one URL is provided for resubmission
    return data.cacDocumentUrl || data.proofOfAddressUrl || data.tinDocumentUrl;
  },
  {
    message: 'At least one document (cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl) must be provided for resubmission',
    path: ['cacDocumentUrl', 'proofOfAddressUrl', 'tinDocumentUrl'],
  }
);

// Base schema for license (without refinement)
const baseLicenseSchema = z.object({
  licenseType: LicenseTypeEnum,
  licenseNumber: z.string().min(1, 'License number is required'),
  issuedBy: z.string().min(1, 'Issued by is required'),
  issuedDate: z.string().min(1, 'Issued date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  documentType: DocumentTypeEnum,
  frontImageUrl: z.string().url('Invalid front image URL').nullable().optional(),
  backImageUrl: z.string().url('Invalid back image URL').nullable().optional(),
});

// License schema with refinement
export const licenseSchema = baseLicenseSchema.refine(
  (data) => {
    const hasUrls = data.frontImageUrl && data.backImageUrl;
    const hasNoUrls = !data.frontImageUrl && !data.backImageUrl;
    return hasUrls || hasNoUrls;
  },
  {
    message: 'All file URLs (frontImageUrl, backImageUrl) must be provided together or none at all',
    path: ['frontImageUrl', 'backImageUrl'],
  }
);

// Resubmit license schema
export const resubmitLicenseSchema = baseLicenseSchema.extend({
  licenseId: z.string().uuid('Invalid license ID'),
}).refine(
  (data) => {
    // Ensure at least one URL is provided for resubmission
    return data.frontImageUrl || data.backImageUrl;
  },
  {
    message: 'At least one document (frontImageUrl, backImageUrl) must be provided for resubmission',
    path: ['frontImageUrl', 'backImageUrl'],
  }
);

// Updated schema for batch verification status updates
export const updateVerificationStatusSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid('Invalid verification ID'),
      verificationStatus: z.enum(Object.values(VerificationStatus) as [string, ...string[]], {
        errorMap: () => ({
          message: `Status must be one of: ${Object.values(VerificationStatus).join(', ')}`,
        }),
      }),
      rejectionReason: z.string().optional(),
      urls: z
        .record(
          z.string(),
          urlStatusSchema
        )
        .optional()
        .refine(
          (urls) => {
            if (!urls) return true;
            const keys = Object.keys(urls);
            const validUrlFields = [
              'cacDocumentUrl',
              'proofOfAddressUrl',
              'tinDocumentUrl',
              'documentUrl',
              'documentBackUrl',
              'driverLicenseUrl',
              'vehicleRoadLicenseUrl',
              'plateNumberUrl',
            ];
            return keys.every((key) => validUrlFields.includes(key));
          },
          {
            message: `URLs must only contain valid fields: cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl, documentUrl, documentBackUrl, driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl`,
          }
        ),
    }).refine(
      (data) => {
        // Require rejectionReason only if verificationStatus is REJECTED
        return data.verificationStatus !== VerificationStatus.REJECTED || !!data.rejectionReason;
      },
      {
        message: 'rejectionReason is required when verificationStatus is REJECTED',
        path: ['rejectionReason'],
      }
    )
  ).nonempty('Updates array cannot be empty'),
});