import { PrismaClient, ServiceStatus } from '@prisma/client';
import logger from '../../config/logger';
import { ApiError } from '../../errors/ApiError';
import { CreateServiceData } from '../../repositories/serviceRepository';
import { ErrorCodes } from '../../errors/errorCodes';

const prisma = new PrismaClient();

export class ElectricVehicleUtility {
  /**
   * Validate data for creating or updating an electric vehicle utility service
   */
  async validateServiceData(serviceData: CreateServiceData): Promise<void> {
    try {
      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for EV utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.pricePerUnit || typeof serviceData.pricePerUnit !== 'number') {
        throw ApiError.badRequest('Price per unit is required and must be a number', ErrorCodes.VALIDATION_ERROR);
      }

      // Verify business verification
      const businessVerification = await prisma.businessVerification.findFirst({
        where: { id: serviceData.businessVerificationId, status: 'APPROVED' },
      });
      if (!businessVerification) {
        throw ApiError.badRequest('Business verification must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      // Vehicle approval is not required for EV services, but if provided, verify them
      if (serviceData.vehicleIds && serviceData.vehicleIds.length > 0) {
        const vehicles = await prisma.vehicle.findMany({
          where: { id: { in: serviceData.vehicleIds }, status: 'APPROVED' },
        });
        if (vehicles.length !== serviceData.vehicleIds.length) {
          throw ApiError.badRequest('All provided vehicles must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
        }
      }
    } catch (error) {
      logger.error(`Error validating EV utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to validate EV utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Prepare data for creating an electric vehicle utility service
   */
  async prepareEVServiceData(serviceData: CreateServiceData): Promise<CreateServiceData> {
    try {
      // Fetch relevant service types dynamically (EV_CHARGING_STATION, EV_BATTERY_REPLACEMENT, EV_MAINTENANCE)
      const serviceType = await prisma.serviceType.findFirst({
        where: {
          name: {
            in: ['EV_CHARGING_STATION', 'EV_BATTERY_REPLACEMENT', 'EV_MAINTENANCE'],
          },
        },
      });

      if (!serviceType) {
        logger.error('No valid EV-related service type found');
        throw ApiError.badRequest('No valid EV-related service type found', ErrorCodes.SERVICE_NOT_FOUND);
      }

      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for EV utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.pricePerUnit || typeof serviceData.pricePerUnit !== 'number') {
        throw ApiError.badRequest('Price per unit is required and must be a number', ErrorCodes.VALIDATION_ERROR);
      }

      // Verify business verification
      const businessVerification = await prisma.businessVerification.findFirst({
        where: { id: serviceData.businessVerificationId, status: 'APPROVED' },
      });
      if (!businessVerification) {
        throw ApiError.badRequest('Business verification must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      // Vehicle approval is not required for EV services, but if provided, verify them
      if (serviceData.vehicleIds && serviceData.vehicleIds.length > 0) {
        const vehicles = await prisma.vehicle.findMany({
          where: { id: { in: serviceData.vehicleIds }, status: 'APPROVED' },
        });
        if (vehicles.length !== serviceData.vehicleIds.length) {
          throw ApiError.badRequest('All provided vehicles must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
        }
      }

      // Apply VAT (mandatory for EV utility)
      const adminSettings = await prisma.adminSettings.findFirst();
      const vatRate = adminSettings?.defaultVatRate || 0.075; // Default to 7.5% if not set
      const totalPriceWithVat = Number(serviceData.pricePerUnit) * (1 + vatRate);

      // Prepare service data
      const evServiceData: CreateServiceData = {
        ...serviceData,
        serviceTypeId: serviceType.id,
        pricePerUnit: totalPriceWithVat, // Include VAT in price
        status: serviceData.status || ServiceStatus.PENDING_VERIFICATION,
        verified: serviceData.verified || false,
      };

      return evServiceData;
    } catch (error) {
      logger.error(`Error preparing EV utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to prepare EV utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }
}