import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache for valid service types to avoid repeated DB calls
let cachedServiceTypes: Promise<string[]> | null = null;

// Helper function to fetch valid ServiceType names
async function getValidServiceTypes(): Promise<string[]> {
  if (cachedServiceTypes) {
    return cachedServiceTypes; // Return cached promise if available
  }

  // Fetch service types and cache the promise
  cachedServiceTypes = prisma.serviceType
    .findMany({
      select: { name: true },
    })
    .then((serviceTypes) => serviceTypes.map((st) => st.name))
    .catch((error) => {
      console.error('Error fetching service types:', error);
      return []; // Return empty array on error to prevent validation failure
    });

  return cachedServiceTypes;
}

// Zod schemas
export const addressSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  state: z.string().optional(),
});

export const addressUpdateSchema = addressSchema.partial();

export const nearbyServicesSchema = z.object({
  radius: z.number().min(0, 'Radius must be non-negative').optional(),
  serviceType: z
    .string()
    .optional()
    .refine(
      async (val) => {
        if (!val) return true; // Optional field, so undefined is valid
        const validTypes = await getValidServiceTypes();
        return validTypes.includes(val);
      },
      {
        message: `Invalid service type. Must be one of the valid service types.`,
      },
    ),
  isOpen: z.boolean().optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
export type NearbyServicesFilters = z.infer<typeof nearbyServicesSchema>;