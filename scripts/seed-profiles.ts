// scripts/seed-profiles.ts
import { PrismaClient, AgentStatus, DocumentStatus, VerificationStatus } from '@prisma/client';
import logger from '../src/config/logger'; // Adjust path to your logger configuration
import { v4 as uuidv4 } from 'uuid'; // Use uuid for consistency with your schema

const prisma = new PrismaClient();

async function seedProfiles() {
  const requestId = uuidv4(); // Generate a unique request ID for logging
  try {
    console.log(`[${requestId}] Starting profile seeding process...`);

    // Fetch the fallback role (e.g., "CUSTOMER")
    const fallbackRole = await prisma.role.findFirst({
      where: { name: 'CUSTOMER' }, // Use CUSTOMER as the fallback role
    });

    if (!fallbackRole) {
      throw new Error('No CUSTOMER role found. Please ensure the CUSTOMER role exists in the Role table.');
    }

    // Fetch all users without a profile, including their roleId
    const usersWithoutProfiles = await prisma.user.findMany({
      where: {
        profile: null, // Users with no associated profile
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roleId: true, // Include roleId to use the user's assigned role
      },
    });

    console.log(`[${requestId}] Found ${usersWithoutProfiles.length} users without profiles.`);

    if (usersWithoutProfiles.length === 0) {
      console.log(`[${requestId}] No users without profiles found. Exiting.`);
      return;
    }

    // Create profiles for each user
    let createdCount = 0;
    for (const user of usersWithoutProfiles) {
      try {
        // Validate the user's roleId
        let roleId: string | undefined = user.roleId ?? undefined; // Convert null to undefined
        if (!roleId) {
          logger.warn(`[${requestId}] User ${user.id} (Email: ${user.email}) has no roleId. Using fallback CUSTOMER role.`);
          roleId = fallbackRole.id;
        } else {
          // Verify the roleId exists in the Role table
          const roleExists = await prisma.role.findUnique({
            where: { id: roleId }, // Now roleId is string | undefined
          });
          if (!roleExists) {
            logger.warn(`[${requestId}] Role ${user.roleId} for user ${user.id} (Email: ${user.email}) does not exist. Using fallback CUSTOMER role.`);
            roleId = fallbackRole.id;
          }
        }

        await prisma.profile.create({
          data: {
            id: uuidv4(), // Generate UUID for profile
            userId: user.id,
            roleId: roleId, // Use the user's roleId or fallback
            status: AgentStatus.PENDING, // Default status, adjust as needed
            isWebEnabled: false,
            identityVerificationStatus: DocumentStatus.PENDING, // Default verification status
            businessVerificationStatus: VerificationStatus.PENDING,
            serviceVerificationStatus: VerificationStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            walletBalance: 0.00, // Default wallet balance
            deliveries: 0, // Default number of deliveries
            rating: 0.0, // Default rating
            yearsOnPlatform: 0.0, // Default years on platform
            fiveStarRatingsCount: 0, // Default five-star ratings count
          },
        });

        createdCount++;
        logger.info(`[${requestId}] Created profile for user ${user.id} (Email: ${user.email}) with roleId ${roleId}`);
      } catch (error) {
        logger.error(`[${requestId}] Failed to create profile for user ${user.id} (Email: ${user.email}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`[${requestId}] Successfully created ${createdCount} profiles for ${usersWithoutProfiles.length} users.`);
  } catch (error) {
    logger.error(`[${requestId}] Error during profile seeding: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding script
seedProfiles()
  .then(() => {
    console.log('Profile seeding completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Profile seeding failed:', error);
    process.exit(1);
  });