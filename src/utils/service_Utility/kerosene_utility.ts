import { PrismaClient, ServiceStatus } from '@prisma/client';
import logger from '../../config/logger';
import { ApiError } from '../../errors/ApiError';
import { CreateServiceData } from '../../repositories/serviceRepository';
import { ErrorCodes } from '../../errors/errorCodes';

const prisma = new PrismaClient();

export class KeroseneUtility {
  /**
   * Validate data for creating or updating a kerosene utility service
   */
  async validateServiceData(serviceData: CreateServiceData): Promise<void> {
    try {
      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for kerosene utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.licenseIds || serviceData.licenseIds.length === 0) {
        throw ApiError.badRequest('At least one valid kerosene handling license is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.vehicleIds || serviceData.vehicleIds.length === 0) {
        throw ApiError.badRequest('At least one approved vehicle is required for kerosene transportation', ErrorCodes.MISSING_FIELDS);
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
      logger.error(`Error validating kerosene utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to validate kerosene utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Prepare data for creating a kerosene utility service
   */
  async prepareKeroseneServiceData(serviceData: CreateServiceData): Promise<CreateServiceData> {
    try {
      // Fetch the KEROSENE_SUPPLY service type dynamically
      const serviceType = await prisma.serviceType.findFirst({
        where: { name: 'KEROSENE_SUPPLY' },
      });

      if (!serviceType) {
        logger.error('KEROSENE_SUPPLY service type not found');
        throw ApiError.badRequest('KEROSENE_SUPPLY service type not found', ErrorCodes.SERVICE_NOT_FOUND);
      }

      // Validate required fields
      if (!serviceData.businessVerificationId) {
        throw ApiError.badRequest('Business verification ID is required for kerosene utility', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.licenseIds || serviceData.licenseIds.length === 0) {
        throw ApiError.badRequest('At least one valid kerosene handling license is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!serviceData.vehicleIds || serviceData.vehicleIds.length === 0) {
        throw ApiError.badRequest('At least one approved vehicle is required for kerosene transportation', ErrorCodes.MISSING_FIELDS);
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

      // Apply VAT and Fossil Fuel Tax (5%)
      const adminSettings = await prisma.adminSettings.findFirst();
      const vatRate = adminSettings?.defaultVatRate || 0.075; // Default to 7.5% if not set
      const fossilFuelTaxRate = adminSettings?.defaultPetroleumTaxRate || 0.05; // Default to 5%
      const totalPriceWithTaxes = Number(serviceData.pricePerUnit) * (1 + vatRate + fossilFuelTaxRate);

      // Prepare service data
      const keroseneServiceData: CreateServiceData = {
        ...serviceData,
        serviceTypeId: serviceType.id,
        pricePerUnit: totalPriceWithTaxes, // Include VAT and Fossil Fuel Tax in price
        status: serviceData.status || ServiceStatus.PENDING_VERIFICATION,
        verified: serviceData.verified || false,
      };

      return keroseneServiceData;
    } catch (error) {
      logger.error(`Error preparing kerosene utility service data: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to prepare kerosene utility service data', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }
}