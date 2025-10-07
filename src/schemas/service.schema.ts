import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Service status enum
export const ServiceStatusEnum = z.enum([
  'PENDING_VERIFICATION',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'DISCONTINUED',
]);

// Business hours schema
export const BusinessHoursSchema = z
  .string()
  .transform((val) => {
    try {
      return JSON.parse(val);
    } catch (error) {
      throw new Error('Business hours must be a valid JSON string');
    }
  })
  .refine(
    (val) => {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      return (
        typeof val === 'object' &&
        val !== null &&
        days.every(
          (day) =>
            val[day] === 'closed' ||
            /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val[day])
        )
      );
    },
    { message: 'Business hours must have valid time ranges (HH:mm-HH:mm) or "closed" for each day' }
  );

// Dynamically fetch ServiceType IDs
async function getValidServiceTypeIds(): Promise<string[]> {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      select: { id: true },
    });
    return serviceTypes.map((st) => st.id);
  } catch (error) {
    console.error('Error fetching ServiceType IDs:', error);
    return [];
  } finally {
    await prisma.$disconnect();
  }
}

// Create Service Schema
export const createServiceSchema = z
  .object({
    name: z.string().min(3, 'Service name must be at least 3 characters'),
    businessName: z.string().min(3, 'Business name must be at least 3 characters').optional(),
    description: z.string().optional(),
    serviceTypeId: z
      .string()
      .uuid('Service type ID must be a valid UUID')
      .refine(
        async (id) => {
          const validIds = await getValidServiceTypeIds();
          return validIds.includes(id);
        },
        { message: 'Invalid service type ID' }
      ),
    pricePerUnit: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Price per unit must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val > 0, 'Price per unit must be a positive number'),
    deliveryCostPerKm: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Delivery cost per km must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= 0, 'Delivery cost per km must be a non-negative number'),
    minimumOrder: z
      .string()
      .regex(/^\d+$/, 'Minimum order must be a valid integer')
      .transform((val) => parseInt(val))
      .refine((val) => val > 0, 'Minimum order must be a positive integer')
      .optional()
      .default('1'),
    businessHours: BusinessHoursSchema,
    expectedDeliveryTime: z
      .string()
      .regex(/^\d+$/, 'Expected delivery time must be a valid integer')
      .transform((val) => parseInt(val))
      .refine((val) => val > 0, 'Expected delivery time must be a positive number'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    longitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, 'Longitude must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= -180 && val <= 180, 'Longitude must be between -180 and 180'),
    latitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, 'Latitude must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= -90 && val <= 90, 'Latitude must be between -90 and 90'),
    serviceRadius: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Service radius must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val > 0, 'Service radius must be a positive number'),
    providerId: z.string().uuid('Provider ID must be a valid UUID'),
    businessVerificationId: z.string().uuid('Business verification ID must be a valid UUID').optional(),
    licenseIds: z
      .string()
      .transform((val) => {
        try {
          return JSON.parse(val);
        } catch (error) {
          throw new Error('License IDs must be a valid JSON array');
        }
      })
      .refine((val) => Array.isArray(val) && val.every((id) => z.string().uuid().safeParse(id).success), {
        message: 'License IDs must be an array of valid UUIDs',
      })
      .optional(),
    vehicleIds: z
      .string()
      .transform((val) => {
        try {
          return JSON.parse(val);
        } catch (error) {
          throw new Error('Vehicle IDs must be a valid JSON array');
        }
      })
      .refine((val) => Array.isArray(val) && val.every((id) => z.string().uuid().safeParse(id).success), {
        message: 'Vehicle IDs must be an array of valid UUIDs',
      })
      .optional(),
    status: ServiceStatusEnum.optional().default('PENDING_VERIFICATION'),
    verified: z
      .string()
      .transform((val) => val === 'true')
      .refine((val) => typeof val === 'boolean', 'Verified must be a boolean'),
    Contact: z.string().optional(),
    baseServicePrice: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Base service price must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= 0, 'Base service price must be a non-negative number')
      .optional(),
    lgaId: z
      .string()
      .regex(/^\d+$/, 'LGA ID must be a valid integer')
      .transform((val) => parseInt(val))
      .optional(),
    cityId: z
      .string()
      .regex(/^\d+$/, 'City ID must be a valid integer')
      .transform((val) => parseInt(val))
      .optional(),
    stateId: z
      .string()
      .regex(/^\d+$/, 'State ID must be a valid integer')
      .transform((val) => parseInt(val))
      .optional(),
    countryId: z
      .string()
      .regex(/^\d+$/, 'Country ID must be a valid integer')
      .transform((val) => parseInt(val))
      .optional(),
  })
  .strict();

// Update Service Schema
export const updateServiceSchema = z
  .object({
    id: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        name: z.string().min(3, 'Service name must be at least 3 characters').optional(),
        businessName: z.string().min(3, 'Business name must be at least 3 characters').optional(),
        description: z.string().optional(),
        serviceTypeId: z
          .string()
          .uuid('Service type ID must be a valid UUID')
          .refine(
            async (id) => {
              const validIds = await getValidServiceTypeIds();
              return validIds.includes(id);
            },
            { message: 'Invalid service type ID' }
          )
          .optional(),
        pricePerUnit: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Price per unit must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val > 0, 'Price per unit must be a positive number')
          .optional(),
        deliveryCostPerKm: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Delivery cost per km must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= 0, 'Delivery cost per km must be a non-negative number')
          .optional(),
        minimumOrder: z
          .string()
          .regex(/^\d+$/, 'Minimum order must be a valid integer')
          .transform((val) => parseInt(val))
          .refine((val) => val > 0, 'Minimum order must be a positive integer')
          .optional(),
        businessHours: BusinessHoursSchema.optional(),
        expectedDeliveryTime: z
          .string()
          .regex(/^\d+$/, 'Expected delivery time must be a valid integer')
          .transform((val) => parseInt(val))
          .refine((val) => val > 0, 'Expected delivery time must be a positive number')
          .optional(),
        address: z.string().min(5, 'Address must be at least 5 characters').optional(),
        longitude: z
          .string()
          .regex(/^-?\d+(\.\d+)?$/, 'Longitude must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= -180 && val <= 180, 'Longitude must be between -180 and 180')
          .optional(),
        latitude: z
          .string()
          .regex(/^-?\d+(\.\d+)?$/, 'Latitude must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= -90 && val <= 90, 'Latitude must be between -90 and 90')
          .optional(),
        serviceRadius: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Service radius must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val > 0, 'Service radius must be a positive number')
          .optional(),
        status: ServiceStatusEnum.optional(),
        verified: z
          .string()
          .transform((val) => val === 'true')
          .refine((val) => typeof val === 'boolean', 'Verified must be a boolean')
          .optional(),
        Contact: z.string().optional(),
        baseServicePrice: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Base service price must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= 0, 'Base service price must be a non-negative number')
          .optional(),
        lgaId: z
          .string()
          .regex(/^\d+$/, 'LGA ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        cityId: z
          .string()
          .regex(/^\d+$/, 'City ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        stateId: z
          .string()
          .regex(/^\d+$/, 'State ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        countryId: z
          .string()
          .regex(/^\d+$/, 'Country ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
      })
      .strict(),
  })
  .strict();

// Update Service Status Schema
export const updateServiceStatusSchema = z
  .object({
    id: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        status: ServiceStatusEnum,
      })
      .strict(),
  })
  .strict();

// Toggle Service Active Status Schema
export const toggleServiceActiveStatusSchema = z
  .object({
    id: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        isActive: z.enum(['true', 'false']).transform((val) => val === 'true'),
      })
      .strict(),
  })
  .strict();

// Service ID Param Schema
export const serviceIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid service ID'),
  })
  .strict();

// Create License Schema
export const createLicenseSchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        licenseType: z.enum([
          'DRIVERS_LICENSE',
          'DRIVING_LICENSE',
          'OPERATORS_LICENSE',
          'BUSINESS',
          'VEHICLE',
          'SAFETY',
          'OPERATIONAL',
        ]),
        licenseNumber: z.string().min(3, 'License number must be at least 3 characters'),
        issuedBy: z.string().min(2, 'Issuing authority must be at least 2 characters'),
        issuedDate: z
          .string()
          .refine((value) => !isNaN(Date.parse(value)), { message: 'Invalid issue date format' }),
        expiryDate: z
          .string()
          .refine((value) => !isNaN(Date.parse(value)), { message: 'Invalid expiry date format' }),
        documentUrl: z.string().url('Document URL must be a valid URL'),
        documentBackUrl: z.string().url('Document back URL must be a valid URL'),
        documentType: z.enum([
          'NIN',
          'INTERNATIONAL_PASSPORT',
          'VOTER_CARD',
          'DRIVING_LICENCE',
          'RESIDENCE_PERMIT',
          'CAC',
          'SAFETY_CERTIFICATE',
          'COMPLIANCE_CERTIFICATE',
          'PLATE_NUMBER',
          'VEHICLE_ROAD_LICENSE',
        ]),
      })
      .strict(),
  })
  .strict();

// Create Vehicle Schema
export const createVehicleSchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        plateNumberUrl: z.string().url('Vehicle plate URL must be a valid URL'),
        driverLicenseUrl: z.string().url('Driver license URL must be a valid URL'),
        vehicleRoadLicenseUrl: z.string().url('Vehicle road license URL must be a valid URL'),
        documentType: z.enum([
          'NIN',
          'INTERNATIONAL_PASSPORT',
          'VOTER_CARD',
          'DRIVING_LICENCE',
          'RESIDENCE_PERMIT',
          'CAC',
          'SAFETY_CERTIFICATE',
          'COMPLIANCE_CERTIFICATE',
          'PLATE_NUMBER',
          'VEHICLE_ROAD_LICENSE',
        ]),
        plateNumber: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// Create Service Verification Schema
export const createServiceVerificationSchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        documentUrls: z.array(z.string().url('Document URL must be a valid URL')),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// Update Service Verification Schema
export const updateServiceVerificationSchema = z
  .object({
    id: z.string().uuid('Invalid verification ID'),
    body: z
      .object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// Create Service Review Schema
export const createServiceReviewSchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
        comment: z.string().optional(),
        reviewerName: z.string().min(1, 'Reviewer name is required'),
        reviewerId: z.string().uuid('Reviewer ID must be a valid UUID'),
      })
      .strict(),
  })
  .strict();

// Create Service Zone Schema
export const createServiceZoneSchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        name: z.string().min(1, 'Name is required'),
        minDeliveryDays: z
          .string()
          .regex(/^\d+$/, 'Minimum delivery days must be a valid integer')
          .transform((val) => parseInt(val))
          .refine((val) => val >= 0, 'Minimum delivery days must be a non-negative integer'),
        maxDeliveryDays: z
          .string()
          .regex(/^\d+$/, 'Maximum delivery days must be a valid integer')
          .transform((val) => parseInt(val))
          .refine((val) => val >= 0, 'Maximum delivery days must be a non-negative integer'),
        orderCutoffTime: z.string().min(1, 'Order cutoff time is required'),
        latitude: z
          .string()
          .regex(/^-?\d+(\.\d+)?$/, 'Latitude must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= -90 && val <= 90, 'Latitude must be between -90 and 90'),
        longitude: z
          .string()
          .regex(/^-?\d+(\.\d+)?$/, 'Longitude must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= -180 && val <= 180, 'Longitude must be between -180 and 180'),
        serviceRadius: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Service radius must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val > 0, 'Service radius must be a positive number')
          .optional(),
        priceMultiplier: z
          .string()
          .regex(/^\d+(\.\d+)?$/, 'Price multiplier must be a valid number')
          .transform((val) => parseFloat(val))
          .refine((val) => val >= 0, 'Price multiplier must be a non-negative number'),
        address: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// Add Service to Locality Schema
export const addServiceToLocalitySchema = z
  .object({
    serviceId: z.string().uuid('Invalid service ID'),
    body: z
      .object({
        lgaId: z
          .string()
          .regex(/^\d+$/, 'LGA ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        cityId: z
          .string()
          .regex(/^\d+$/, 'City ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        stateId: z
          .string()
          .regex(/^\d+$/, 'State ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        countryId: z
          .string()
          .regex(/^\d+$/, 'Country ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
      })
      .strict()
      .refine(
        (data) => data.lgaId || data.cityId || data.stateId || data.countryId,
        { message: 'At least one locality ID (lgaId, cityId, stateId, or countryId) is required' }
      ),
  })
  .strict();

// Schema for GET /api/services/available-services
export const getAllServicesSchema = z
  .object({
    query: z
      .object({
        providerId: z.string().uuid('Invalid provider ID').optional(),
        providerRole: z.enum(['ADMIN', 'VENDOR', 'DELIVERY_REP']).optional(),
        status: ServiceStatusEnum.optional(),
        serviceTypeId: z
          .string()
          .uuid('Service type ID must be a valid UUID')
          .refine(
            async (id) => {
              if (!id) return true; // Allow undefined for optional field
              const validIds = await getValidServiceTypeIds();
              return validIds.includes(id);
            },
            { message: 'Invalid service type ID' }
          )
          .optional(),
        verified: z.enum(['true', 'false']).optional(),
        page: z
          .string()
          .regex(/^\d+$/, 'Page must be a valid integer')
          .transform((val) => parseInt(val))
          .optional()
          .default('1'),
        pageSize: z
          .string()
          .regex(/^\d+$/, 'Page size must be a valid integer')
          .transform((val) => parseInt(val))
          .optional()
          .default('20'),
        lgaId: z
          .string()
          .regex(/^\d+$/, 'LGA ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        cityId: z
          .string()
          .regex(/^\d+$/, 'City ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        stateId: z
          .string()
          .regex(/^\d+$/, 'State ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
        countryId: z
          .string()
          .regex(/^\d+$/, 'Country ID must be a valid integer')
          .transform((val) => parseInt(val))
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// Schema for GET /api/services/nearby
export const getNearbyServicesSchema = z
  .object({
    latitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, 'Latitude must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= -90 && val <= 90, 'Latitude must be between -90 and 90'),
    longitude: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, 'Longitude must be a valid number')
      .transform((val) => parseFloat(val))
      .refine((val) => val >= -180 && val <= 180, 'Longitude must be between -180 and 180'),
    radius: z
      .string()
      .regex(/^\d+$/, 'Radius must be a valid integer')
      .transform((val) => parseInt(val))
      .optional()
      .default('30'),
    serviceTypeId: z
      .string()
      .uuid('Service type ID must be a valid UUID')
      .refine(
        async (id) => {
          if (!id) return true; // Allow undefined for optional field
          const validIds = await getValidServiceTypeIds();
          return validIds.includes(id);
        },
        { message: 'Invalid service type ID' }
      )
      .optional(),
    providerId: z.string().uuid('Invalid provider ID').optional(),
    providerRole: z.enum(['ADMIN', 'VENDOR', 'DELIVERY_REP']).optional(),
    status: ServiceStatusEnum.optional(),
    verified: z.enum(['true', 'false']).optional(),
    isOpen: z.enum(['true', 'false']).optional(),
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a valid integer')
      .transform((val) => parseInt(val))
      .optional()
      .default('1'),
    pageSize: z
      .string()
      .regex(/^\d+$/, 'Page size must be a valid integer')
      .transform((val) => parseInt(val))
      .optional()
      .default('20'),
  })
  .strict();