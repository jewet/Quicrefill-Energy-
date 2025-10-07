import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache for valid role IDs to avoid repeated DB calls
let cachedRoleIds: Promise<string[]> | null = null;

// Helper function to fetch valid Role IDs
async function getValidRoleIds(): Promise<string[]> {
  if (cachedRoleIds) {
    return cachedRoleIds; // Return cached promise if available
  }

  cachedRoleIds = prisma.role
    .findMany({
      select: { id: true },
    })
    .then((roles) => roles.map((role) => role.id))
    .catch((error) => {
      console.error('Error fetching role IDs:', error);
      return []; // Return empty array on error to prevent validation failure
    });

  return cachedRoleIds;
}

// Zod schemas
export const userSchema = z.object({
  id: z.string().uuid().optional(),
  roleId: z
    .string()
    .uuid()
    .optional()
    .refine(
      async (val) => {
        if (!val) return true; // Optional field, so undefined is valid
        const validRoleIds = await getValidRoleIds();
        return validRoleIds.includes(val);
      },
      {
        message: 'Invalid role ID. Must correspond to an existing role.',
      },
    ),
  email: z.string().email('Invalid email address'),
  username: z.string().min(1, 'Username is required').max(50, 'Username must be 50 characters or less').optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
  phoneVerified: z.boolean().default(false),
  identityVerified: z.boolean().default(false),
  bvnVerified: z.boolean().default(false),
  businessVerified: z.boolean().default(false),
  webAccessGranted: z.boolean().default(false),
  webAccessGrantedAt: z.date().optional(),
  migratedToVendor: z.boolean().default(false),
  migrationDate: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  inviteCode: z.string().optional(),
  publicKey: z.string().optional(),
  address: z.string().optional(),
  avatar: z.string().optional(),
  emailVerified: z.boolean().default(false),
  password: z.string().optional(),
  isSocialAccount: z.boolean().default(false),
  socialAccountProvider: z.enum(['FACEBOOK', 'GOOGLE']).optional(),
  notificationsEnabled: z.boolean().default(true),
  twoFactorEnabled: z.boolean().default(false),
  twoFactorSecret: z.string().max(255).optional(),
  notificationPreference: z.enum(['NEW_ORDER', 'ORDER_UPDATE', 'ORDER_CANCELLED', 'FEEDBACK_SUBMITTED', 'EMAIL', 'SMS', 'PUSH', 'WEBHOOK', 'ALL', 'DISCOUNT', 'PASSWORD_CHANGE', 'WALLET_EVENT', 'PREFERENCE_UPDATE', 'VENDOR_LINKING']).optional(),
  isSuspended: z.boolean().default(false),
  suspendedAt: z.date().optional(),
  deletionRequestedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  isWithdrawalSuspended: z.boolean().default(false),
  withdrawalSuspendedAt: z.date().optional(),
  withdrawalSuspensionReason: z.string().max(255).optional(),
  withdrawalSuspensionDuration: z.number().optional(),
  gender: z.string().max(20).optional(),
  dateOfBirth: z.date().optional(),
  pushToken: z.string().max(255).optional(),
  isWithdrawalAllowed: z.boolean().default(false),
  isDeliveryAgent: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isVendor: z.boolean().default(false),
  status: z.string().max(50).optional(),
  banReason: z.string().max(255).optional(),
  blocked: z.boolean().default(false),
  isPenalized: z.boolean().default(false),
});

export const userUpdateSchema = userSchema.partial();

export type UserInput = z.infer<typeof userSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;