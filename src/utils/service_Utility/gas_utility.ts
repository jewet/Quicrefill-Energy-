import { PrismaClient, ServiceStatus } from '@prisma/client';
import logger from '../../config/logger';
import { ApiError } from '../../errors/ApiError';
import { CreateServiceData } from '../../repositories/serviceRepository';
import { ErrorCodes } from '../../errors/errorCodes';

const prisma = new PrismaClient();

export class GasUtility {
  /**
   * Validate data for creating or updating a gas utility service
   */
  async validateServiceData(serviceData: CreateServiceData): Promise<void> {
    try {
      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for gas utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.licenseIds || serviceData.licenseIds.length === 0) {
        throw ApiError.badRequest('At least one valid gas handling license is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.vehicleIds || serviceData.vehicleIds.length === 0) {
        throw ApiError.badRequest('At least one approved vehicle is required for gas transportation', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.pricePerUnit || typeof serviceData.pricePerUnit !== 'number') {
        throw ApiError.badRequest('Price per unit is required and must be a number', ErrorCodes.VALIDATION_ERROR);
      }

      // Verify documents (business verification, licenses, vehicles)
      const businessVerification = await prisma.businessVerification.findFirst({
        where: { id: serviceData.businessVerificationId, status: 'APPROVED' },
      });
      if (!businessVerification) {
        throw ApiError.badRequest('Business verification must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      const licenses = await prisma.license.findMany({
        where: { id: { in: serviceData.licenseIds }, status: 'APPROVED' },
      });
      if (licenses.length !== serviceData.licenseIds.length) {
        throw ApiError.badRequest('All provided licenses must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      const vehicles = await prisma.vehicle.findMany({
        where: { id: { in: serviceData.vehicleIds }, status: 'APPROVED' },
      });
      if (vehicles.length !== serviceData.vehicleIds.length) {
        throw ApiError.badRequest('All provided vehicles must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }
    } catch (error) {
      logger.error(`Error validating gas utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to validate gas utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Prepare data for creating a gas utility service
   */
  async prepareGasServiceData(serviceData: CreateServiceData): Promise<CreateServiceData> {
    try {
      // Fetch the GAS_SUPPLY service type dynamically
      const serviceType = await prisma.serviceType.findFirst({
        where: { name: 'GAS_SUPPLY' },
      });

      if (!serviceType) {
        logger.error('GAS_SUPPLY service type not found');
        throw ApiError.badRequest('GAS_SUPPLY service type not found', ErrorCodes.SERVICE_NOT_FOUND);
      }

      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for gas utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.licenseIds || serviceData.licenseIds.length === 0) {
        throw ApiError.badRequest('At least one valid gas handling license is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.vehicleIds || serviceData.vehicleIds.length === 0) {
        throw ApiError.badRequest('At least one approved vehicle is required for gas transportation', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.pricePerUnit || typeof serviceData.pricePerUnit !== 'number') {
        throw ApiError.badRequest('Price per unit is required and must be a number', ErrorCodes.VALIDATION_ERROR);
      }

      // Verify documents (business verification, licenses, vehicles)
      const businessVerification = await prisma.businessVerification.findFirst({
        where: { id: serviceData.businessVerificationId, status: 'APPROVED' },
      });
      if (!businessVerification) {
        throw ApiError.badRequest('Business verification must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      const licenses = await prisma.license.findMany({
        where: { id: { in: serviceData.licenseIds }, status: 'APPROVED' },
      });
      if (licenses.length !== serviceData.licenseIds.length) {
        throw ApiError.badRequest('All provided licenses must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      const vehicles = await prisma.vehicle.findMany({
        where: { id: { in: serviceData.vehicleIds }, status: 'APPROVED' },
      });
      if (vehicles.length !== serviceData.vehicleIds.length) {
        throw ApiError.badRequest('All provided vehicles must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED);
      }

      // Apply VAT (mandatory for gas utility)
      const adminSettings = await prisma.adminSettings.findFirst();
      const vatRate = adminSettings?.defaultVatRate || 0.075; // Default to 7.5% if not set
      const totalPriceWithVat = Number(serviceData.pricePerUnit) * (1 + vatRate);

      // Prepare service data
      const gasServiceData: CreateServiceData = {
        ...serviceData,
        serviceTypeId: serviceType.id,
        pricePerUnit: totalPriceWithVat, // Include VAT in price
        status: serviceData.status || ServiceStatus.PENDING_VERIFICATION,
        verified: serviceData.verified || false,
      };

      return gasServiceData;
    } catch (error) {
      logger.error(`Error preparing gas utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to prepare gas utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }
}