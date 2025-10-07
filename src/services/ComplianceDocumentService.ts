import { Request, Response } from 'express';
import { prismaClient } from '../config/db';
import { ApiError } from '../lib/utils/errors/appError';
import logger from '../config/logger';
import { VerificationStatus, LicenseType, DocumentType } from '@prisma/client';
import { dispatchNotification, NotificationPayload } from './notificationServices';
import { KnownEventTypes } from '../utils/EventTypeDictionary';
import { Prisma } from '@prisma/client';
import { ErrorCodes } from '../errors/errorCodes';



export interface UrlStatus {
  status: VerificationStatus;
  rejectionReason?: string | null; 
}



export interface UrlStatuses {
  [key: string]: UrlStatus;
}

interface BusinessVerificationData {
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber: string;
  businessLogoUrl?: string;
  handles?: Record<string, string> | Prisma.InputJsonValue;
  documentType: DocumentType; 
}

interface LicenseData {
  licenseType: LicenseType;
  licenseNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  documentType: DocumentType; 
}


interface VehicleData {
  plateNumber: string;
}

export class ComplianceDocumentService {

// Type guard for UrlStatuses
  private isValidUrlStatuses(json: unknown): json is UrlStatuses {
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

  /**
   * Submit business verification documents (new submissions only)
   */
async submitBusinessVerification(
  userId: string,
  businessData: BusinessVerificationData,
  cacDocumentUrl: string,
  proofOfAddressUrl: string,
  tinDocumentUrl: string
) {
  try {
    // Validate document type
    if (!Object.values(DocumentType).includes(businessData.documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${businessData.documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check for existing verification by userId and rcNumber
    const existingVerification = await prismaClient.businessVerification.findFirst({
      where: { userId, rcNumber: businessData.rcNumber },
    });

    if (existingVerification) {
      throw ApiError.conflict(
        `Business verification with RC number ${businessData.rcNumber} already exists. Use resubmit endpoint to update.`,
        ErrorCodes.CONFLICT
      );
    }

    // Initialize urlStatuses with PENDING status for all document URLs
    const urlStatuses: UrlStatuses = {
      cacDocumentUrl: { status: VerificationStatus.PENDING },
      proofOfAddressUrl: { status: VerificationStatus.PENDING },
      tinDocumentUrl: { status: VerificationStatus.PENDING },
    };

    // Create new verification
    const verification = await prismaClient.businessVerification.create({
      data: {
        userId,
        businessName: businessData.businessName,
        rcNumber: businessData.rcNumber,
        businessAddress: businessData.businessAddress,
        tinNumber: businessData.tinNumber,
        cacDocumentUrl,
        proofOfAddressUrl,
        tinDocumentUrl,
        logoUrl: businessData.businessLogoUrl ?? undefined,
        handles: businessData.handles ?? undefined,
        documentType: businessData.documentType,
        status: VerificationStatus.PENDING,
        submittedAt: new Date(),
        urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue, // Save urlStatuses
      },
    });

    return verification;
  } catch (error: any) {
    logger.error(`Failed to submit business verification: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Business document submission failed', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}

  /**
   * Resubmit business verification documents
   */
/**
 * Resubmit business verification documents
 */
async resubmitBusinessVerification(
  userId: string,
  businessVerificationId: string,
  businessData: BusinessVerificationData,
  cacDocumentUrl?: string,
  proofOfAddressUrl?: string,
  tinDocumentUrl?: string
) {
  try {
    // Validate document type
    if (!Object.values(DocumentType).includes(businessData.documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${businessData.documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Find existing verification
    const existingVerification = await prismaClient.businessVerification.findFirst({
      where: { id: businessVerificationId, userId },
    });

    if (!existingVerification) {
      throw ApiError.notFound(
        `Business verification with ID ${businessVerificationId} not found for user`,
        ErrorCodes.NOT_FOUND
      );
    }

    // Safely cast and validate existing urlStatuses
    let existingUrlStatuses: UrlStatuses = {};
    const rawUrlStatuses = existingVerification.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      existingUrlStatuses = rawUrlStatuses;
    }

    // Initialize urlStatuses for provided URLs only
    const urlStatuses: UrlStatuses = { ...existingUrlStatuses };
    if (cacDocumentUrl) urlStatuses.cacDocumentUrl = { status: VerificationStatus.PENDING };
    if (proofOfAddressUrl) urlStatuses.proofOfAddressUrl = { status: VerificationStatus.PENDING };
    if (tinDocumentUrl) urlStatuses.tinDocumentUrl = { status: VerificationStatus.PENDING };
    if (businessData.businessLogoUrl) urlStatuses.businessLogoUrl = { status: VerificationStatus.PENDING };

    // Prevent resubmission of approved documents
    const approvedDocuments: string[] = [];
    if (cacDocumentUrl && existingUrlStatuses.cacDocumentUrl?.status === VerificationStatus.APPROVED) {
      approvedDocuments.push('cacDocumentUrl');
    }
    if (proofOfAddressUrl && existingUrlStatuses.proofOfAddressUrl?.status === VerificationStatus.APPROVED) {
      approvedDocuments.push('proofOfAddressUrl');
    }
    if (tinDocumentUrl && existingUrlStatuses.tinDocumentUrl?.status === VerificationStatus.APPROVED) {
      approvedDocuments.push('tinDocumentUrl');
    }
    if (businessData.businessLogoUrl && existingUrlStatuses.businessLogoUrl?.status === VerificationStatus.APPROVED) {
      approvedDocuments.push('businessLogoUrl');
    }

    if (approvedDocuments.length > 0) {
      throw ApiError.badRequest(
        `Cannot resubmit approved documents: ${approvedDocuments.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { approvedDocuments }
      );
    }

    // Ensure at least one document is provided for resubmission
    if (!cacDocumentUrl && !proofOfAddressUrl && !tinDocumentUrl && !businessData.businessLogoUrl) {
      throw ApiError.badRequest(
        'At least one document (cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl, or businessLogoUrl) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    // Handle null for handles field explicitly
    const handlesValue = businessData.handles !== undefined
      ? businessData.handles
      : existingVerification.handles === null
      ? Prisma.JsonNull
      : existingVerification.handles;

    // Update verification with provided URLs only
    const updatedVerification = await prismaClient.businessVerification.update({
      where: { id: businessVerificationId },
      data: {
        businessName: businessData.businessName,
        rcNumber: businessData.rcNumber,
        businessAddress: businessData.businessAddress,
        tinNumber: businessData.tinNumber,
        cacDocumentUrl: cacDocumentUrl ?? existingVerification.cacDocumentUrl,
        proofOfAddressUrl: proofOfAddressUrl ?? existingVerification.proofOfAddressUrl,
        tinDocumentUrl: tinDocumentUrl ?? existingVerification.tinDocumentUrl,
        logoUrl: businessData.businessLogoUrl ?? existingVerification.logoUrl,
        handles: handlesValue,
        documentType: businessData.documentType,
        status: VerificationStatus.PENDING,
        submittedAt: new Date(),
        processedAt: null,
        rejectionReason: null,
        urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue,
      },
    });

    return updatedVerification;
  } catch (error: any) {
    logger.error(`Failed to resubmit business verification: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Business document resubmission failed', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}
  /**
   * Submit license documents (new submissions only)
   */
async submitLicense(
  userId: string,
  licenseData: LicenseData,
  frontImageUrl: string,
  backImageUrl: string
) {
  try {
    // Validate license type
    if (!Object.values(LicenseType).includes(licenseData.licenseType)) {
      throw ApiError.badRequest(`Invalid license type: ${licenseData.licenseType}`, ErrorCodes.BAD_REQUEST);
    }

    // Validate document type
    if (!Object.values(DocumentType).includes(licenseData.documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${licenseData.documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Validate dates
    if (isNaN(new Date(licenseData.issuedDate).getTime())) {
      throw ApiError.badRequest('Invalid issuedDate format', ErrorCodes.BAD_REQUEST);
    }
    if (isNaN(new Date(licenseData.expiryDate).getTime())) {
      throw ApiError.badRequest('Invalid expiryDate format', ErrorCodes.BAD_REQUEST);
    }

    // Check for existing license with the same licenseNumber
    const existingLicense = await prismaClient.license.findFirst({
      where: { userId, licenseNumber: licenseData.licenseNumber },
    });

    if (existingLicense) {
      throw ApiError.conflict(
        `License with number ${licenseData.licenseNumber} already exists. Use resubmit endpoint to update.`,
        ErrorCodes.CONFLICT
      );
    }

    // Initialize urlStatuses with PENDING status for both document URLs
    const urlStatuses: UrlStatuses = {
      documentUrl: { status: VerificationStatus.PENDING },
      documentBackUrl: { status: VerificationStatus.PENDING },
    };

    // Create new license
    const license = await prismaClient.license.create({
      data: {
        userId,
        licenseType: licenseData.licenseType,
        licenseNumber: licenseData.licenseNumber,
        issuedBy: licenseData.issuedBy,
        issuedDate: new Date(licenseData.issuedDate),
        expiryDate: new Date(licenseData.expiryDate),
        documentUrl: frontImageUrl,
        documentBackUrl: backImageUrl,
        documentType: licenseData.documentType,
        status: VerificationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue, // Save urlStatuses
      },
    });

    return license;
  } catch (error: any) {
    logger.error(`Error submitting license: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Failed to submit license', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}
  /**
   * Resubmit license documents
   */
/**
 * Resubmit license documents
 */
async resubmitLicense(
  userId: string,
  licenseId: string,
  licenseData: LicenseData,
  frontImageUrl?: string,
  backImageUrl?: string
) {
  try {
    const existingLicense = await prismaClient.license.findUnique({
      where: { id: licenseId, userId },
      select: {
        id: true,
        userId: true,
        status: true,
        urlStatuses: true,
        licenseType: true,
        licenseNumber: true,
        issuedBy: true,
        issuedDate: true,
        expiryDate: true,
        documentUrl: true,
        documentBackUrl: true,
        documentType: true,
        rejectionReason: true,
        verifiedAt: true,
        verifiedById: true,
      },
    });

    if (!existingLicense) {
      throw ApiError.notFound(
        'License not found. Use submit endpoint to create a new record.',
        ErrorCodes.NOT_FOUND
      );
    }

    if (existingLicense.status === VerificationStatus.APPROVED) {
      throw ApiError.conflict('License is already approved and cannot be resubmitted', ErrorCodes.CONFLICT);
    }

    // Validate license type
    if (!Object.values(LicenseType).includes(licenseData.licenseType)) {
      throw ApiError.badRequest(`Invalid license type: ${licenseData.licenseType}`, ErrorCodes.BAD_REQUEST);
    }

    // Validate document type
    if (!Object.values(DocumentType).includes(licenseData.documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${licenseData.documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Validate dates
    if (isNaN(new Date(licenseData.issuedDate).getTime())) {
      throw ApiError.badRequest('Invalid issuedDate format', ErrorCodes.BAD_REQUEST);
    }
    if (isNaN(new Date(licenseData.expiryDate).getTime())) {
      throw ApiError.badRequest('Invalid expiryDate format', ErrorCodes.BAD_REQUEST);
    }

    // Safely cast and validate urlStatuses
    let urlStatuses: UrlStatuses;
    const rawUrlStatuses = existingLicense.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      urlStatuses = rawUrlStatuses;
    } else {
      urlStatuses = {
        documentUrl: { status: VerificationStatus.PENDING },
        documentBackUrl: { status: VerificationStatus.PENDING },
      };
    }

    // Check if any provided URLs correspond to APPROVED documents
    const approvedDocuments: string[] = [];
    if (urlStatuses.documentUrl?.status === VerificationStatus.APPROVED && frontImageUrl) {
      approvedDocuments.push('documentUrl');
    }
    if (urlStatuses.documentBackUrl?.status === VerificationStatus.APPROVED && backImageUrl) {
      approvedDocuments.push('documentBackUrl');
    }

    if (approvedDocuments.length > 0) {
      throw ApiError.badRequest(
        `Cannot resubmit approved documents: ${approvedDocuments.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { approvedDocuments }
      );
    }

    // Ensure at least one document is provided for resubmission
    if (!frontImageUrl && !backImageUrl) {
      throw ApiError.badRequest(
        'At least one document (frontImageUrl, backImageUrl) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    // Update only the provided URLs that are not APPROVED
    const updatedUrlStatuses: UrlStatuses = { ...urlStatuses };
    const updateData: any = {
      licenseType: licenseData.licenseType,
      licenseNumber: licenseData.licenseNumber,
      issuedBy: licenseData.issuedBy,
      issuedDate: new Date(licenseData.issuedDate),
      expiryDate: new Date(licenseData.expiryDate),
      documentType: licenseData.documentType,
      status: VerificationStatus.PENDING,
      rejectionReason: null,
      verifiedAt: null,
      verifiedById: null,
      updatedAt: new Date(),
    };

    if (frontImageUrl && urlStatuses.documentUrl?.status !== VerificationStatus.APPROVED) {
      updateData.documentUrl = frontImageUrl;
      updatedUrlStatuses.documentUrl = { status: VerificationStatus.PENDING };
    }
    if (backImageUrl && urlStatuses.documentBackUrl?.status !== VerificationStatus.APPROVED) {
      updateData.documentBackUrl = backImageUrl;
      updatedUrlStatuses.documentBackUrl = { status: VerificationStatus.PENDING };
    }

    updateData.urlStatuses = updatedUrlStatuses as unknown as Prisma.InputJsonValue;

    // Perform the update
    const license = await prismaClient.license.update({
      where: { id: licenseId },
      data: updateData,
    });

    return license;
  } catch (error: any) {
    logger.error(`Error resubmitting license: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Failed to resubmit license', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}
  /**
   * Submit vehicle documents (new submissions only)
   */
async submitVehicle(
  userId: string,
  vehicleData: VehicleData,
  driverLicenseUrl: string,
  vehicleRoadLicenseUrl: string,
  plateNumberUrl: string,
  documentType: DocumentType
) {
  try {
    // Validate document type
    if (!Object.values(DocumentType).includes(documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check for existing vehicle with the same plateNumber
    const existingVehicle = await prismaClient.vehicle.findFirst({
      where: { userId, plateNumber: vehicleData.plateNumber },
    });

    if (existingVehicle) {
      throw ApiError.conflict(
        `Vehicle with plate number ${vehicleData.plateNumber} already exists. Use resubmit endpoint to update.`,
        ErrorCodes.CONFLICT
      );
    }

    // Initialize urlStatuses with PENDING status for all document URLs
    const urlStatuses: UrlStatuses = {
      driverLicenseUrl: { status: VerificationStatus.PENDING },
      vehicleRoadLicenseUrl: { status: VerificationStatus.PENDING },
      plateNumberUrl: { status: VerificationStatus.PENDING },
    };

    // Create new vehicle
    const vehicle = await prismaClient.vehicle.create({
      data: {
        userId,
        plateNumber: vehicleData.plateNumber,
        driverLicenseUrl,
        vehicleRoadLicenseUrl,
        plateNumberUrl,
        documentType,
        status: VerificationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue, // Save urlStatuses
      },
    });

    return vehicle;
  } catch (error: any) {
    logger.error(`Error submitting vehicle: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Failed to submit vehicle', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}

  /**
   * Resubmit vehicle documents
   */
/**
 * Resubmit vehicle documents
 */
async resubmitVehicle(
  userId: string,
  vehicleId: string,
  vehicleData: VehicleData,
  documentType: DocumentType,
  driverLicenseUrl?: string,
  vehicleRoadLicenseUrl?: string,
  plateNumberUrl?: string
) {
  try {
    const existingVehicle = await prismaClient.vehicle.findUnique({
      where: { id: vehicleId, userId },
      select: {
        id: true,
        userId: true,
        status: true,
        urlStatuses: true,
        plateNumber: true,
        driverLicenseUrl: true,
        vehicleRoadLicenseUrl: true,
        plateNumberUrl: true,
        documentType: true,
        rejectionReason: true,
        verifiedAt: true,
        verifiedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!existingVehicle) {
      throw ApiError.notFound(
        'Vehicle not found. Use submit endpoint to create a new record.',
        ErrorCodes.NOT_FOUND
      );
    }

    if (existingVehicle.status === VerificationStatus.APPROVED) {
      throw ApiError.conflict('Vehicle is already approved and cannot be resubmitted', ErrorCodes.CONFLICT);
    }

    // Validate document type
    if (!Object.values(DocumentType).includes(documentType)) {
      throw ApiError.badRequest(
        `Invalid document type: ${documentType}. Must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Safely cast and validate urlStatuses
    let urlStatuses: UrlStatuses;
    const rawUrlStatuses = existingVehicle.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      urlStatuses = rawUrlStatuses;
    } else {
      urlStatuses = {
        driverLicenseUrl: { status: VerificationStatus.PENDING },
        vehicleRoadLicenseUrl: { status: VerificationStatus.PENDING },
        plateNumberUrl: { status: VerificationStatus.PENDING },
      };
    }

    // Check if any provided URLs correspond to APPROVED documents
    const approvedDocuments: string[] = [];
    if (urlStatuses.driverLicenseUrl?.status === VerificationStatus.APPROVED && driverLicenseUrl) {
      approvedDocuments.push('driverLicenseUrl');
    }
    if (urlStatuses.vehicleRoadLicenseUrl?.status === VerificationStatus.APPROVED && vehicleRoadLicenseUrl) {
      approvedDocuments.push('vehicleRoadLicenseUrl');
    }
    if (urlStatuses.plateNumberUrl?.status === VerificationStatus.APPROVED && plateNumberUrl) {
      approvedDocuments.push('plateNumberUrl');
    }

    if (approvedDocuments.length > 0) {
      throw ApiError.badRequest(
        `Cannot resubmit approved documents: ${approvedDocuments.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { approvedDocuments }
      );
    }

    // Ensure at least one document is provided for resubmission
    if (!driverLicenseUrl && !vehicleRoadLicenseUrl && !plateNumberUrl) {
      throw ApiError.badRequest(
        'At least one document (driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    // Update only the provided URLs that are not APPROVED
    const updatedUrlStatuses: UrlStatuses = { ...urlStatuses };
    const updateData: any = {
      plateNumber: vehicleData.plateNumber,
      documentType,
      status: VerificationStatus.PENDING,
      rejectionReason: null,
      verifiedAt: null,
      verifiedById: null,
      updatedAt: new Date(),
    };

    if (driverLicenseUrl && urlStatuses.driverLicenseUrl?.status !== VerificationStatus.APPROVED) {
      updateData.driverLicenseUrl = driverLicenseUrl;
      updatedUrlStatuses.driverLicenseUrl = { status: VerificationStatus.PENDING };
    }
    if (vehicleRoadLicenseUrl && urlStatuses.vehicleRoadLicenseUrl?.status !== VerificationStatus.APPROVED) {
      updateData.vehicleRoadLicenseUrl = vehicleRoadLicenseUrl;
      updatedUrlStatuses.vehicleRoadLicenseUrl = { status: VerificationStatus.PENDING };
    }
    if (plateNumberUrl && urlStatuses.plateNumberUrl?.status !== VerificationStatus.APPROVED) {
      updateData.plateNumberUrl = plateNumberUrl;
      updatedUrlStatuses.plateNumberUrl = { status: VerificationStatus.PENDING };
    }

    updateData.urlStatuses = updatedUrlStatuses as unknown as Prisma.InputJsonValue;

    // Perform the update
    const vehicle = await prismaClient.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });

    return vehicle;
  } catch (error: any) {
    logger.error(`Error resubmitting vehicle: ${error.message}`);
    throw ApiError.badRequest(error.message || 'Failed to resubmit vehicle', ErrorCodes.BAD_REQUEST, {
      details: error.message,
    });
  }
}
  /**
   * Check business verification status
   */
/**
 * Check business verification status
 */
async checkBusinessVerificationStatus(userId: string) {
  try {
    const verifications = await prismaClient.businessVerification.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        businessName: true,
        rcNumber: true,
        businessAddress: true,
        tinNumber: true,
        cacDocumentUrl: true,
        documentType: true,
        proofOfAddressUrl: true,
        tinDocumentUrl: true,
        logoUrl: true,
        handles: true,
        submittedAt: true,
        processedAt: true,
        rejectionReason: true,
        urlStatuses: true,
      },
    });

    if (!verifications || verifications.length === 0) {
      return {
        status: 'NOT_SUBMITTED',
        message: 'Business verification has not been submitted',
      };
    }

    return verifications.map((verification) => ({
      id: verification.id,
      status: verification.status,
      businessName: verification.businessName,
      rcNumber: verification.rcNumber,
      businessAddress: verification.businessAddress,
      tinNumber: verification.tinNumber,
      cacDocumentUrl: verification.cacDocumentUrl,
      documentType: verification.documentType,
      proofOfAddressUrl: verification.proofOfAddressUrl,
      tinDocumentUrl: verification.tinDocumentUrl,
      logoUrl: verification.logoUrl,
      handles: verification.handles,
      submittedAt: verification.submittedAt,
      processedAt: verification.processedAt,
      rejectionReason: verification.rejectionReason,
      urlStatuses: verification.urlStatuses as UrlStatuses | null, // Cast directly since saved in DB
    }));
  } catch (error: any) {
    logger.error(`Error checking business verification status: ${error.message}`);
    throw ApiError.internal('Failed to check business verification status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
/**
 * Check vehicle verification status
 */
async checkVehicleStatus(userId: string) {
  try {
    const vehicles = await prismaClient.vehicle.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        driverLicenseUrl: true,
        vehicleRoadLicenseUrl: true,
        plateNumberUrl: true,
        plateNumber: true,
        documentType: true,
        createdAt: true,
        verifiedAt: true,
        rejectionReason: true,
        verified: true,
        verifiedById: true,
        urlStatuses: true,
      },
    });

    if (!vehicles || vehicles.length === 0) {
      return {
        status: 'NOT_SUBMITTED',
        message: 'No vehicle verification has been submitted',
      };
    }

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      status: vehicle.status,
      driverLicenseUrl: vehicle.driverLicenseUrl,
      vehicleRoadLicenseUrl: vehicle.vehicleRoadLicenseUrl,
      plateNumberUrl: vehicle.plateNumberUrl,
      plateNumber: vehicle.plateNumber,
      documentType: vehicle.documentType,
      submittedAt: vehicle.createdAt,
      verifiedAt: vehicle.verifiedAt,
      rejectionReason: vehicle.rejectionReason,
      verified: vehicle.verified,
      verifiedById: vehicle.verifiedById,
      urlStatuses: vehicle.urlStatuses as UrlStatuses | null, // Cast directly
    }));
  } catch (error: any) {
    logger.error(`Error checking vehicle status: ${error.message}`);
    throw ApiError.internal('Failed to check vehicle status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
/**
 * Check license verification status
 */
async checkLicenseStatus(userId: string) {
  try {
    const licenses = await prismaClient.license.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        licenseType: true,
        licenseNumber: true,
        issuedBy: true,
        issuedDate: true,
        expiryDate: true,
        documentUrl: true,
        documentType: true,
        documentBackUrl: true,
        createdAt: true,
        verifiedAt: true,
        rejectionReason: true,
        verified: true,
        verifiedById: true,
        urlStatuses: true,
      },
    });

    if (!licenses || licenses.length === 0) {
      return {
        status: 'NOT_SUBMITTED',
        message: 'No license verification has been submitted',
      };
    }

    return licenses.map((license) => ({
      id: license.id,
      status: license.status,
      licenseType: license.licenseType,
      licenseNumber: license.licenseNumber,
      issuedBy: license.issuedBy,
      issuedDate: license.issuedDate,
      expiryDate: license.expiryDate,
      documentUrl: license.documentUrl,
      documentBackUrl: license.documentBackUrl,
      documentType: license.documentType,
      submittedAt: license.createdAt,
      verifiedAt: license.verifiedAt,
      rejectionReason: license.rejectionReason,
      verified: license.verified,
      verifiedById: license.verifiedById,
      urlStatuses: license.urlStatuses as UrlStatuses | null, // Cast directly
    }));
  } catch (error: any) {
    logger.error(`Error checking license status: ${error.message}`);
    throw ApiError.internal('Failed to check license status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
 /**
   * Update business verification status and notify user
   */
async updateBusinessVerificationStatus(
  id: string,
  status: VerificationStatus,
  adminId: string,
  rejectionReason?: string,
  urls?: { [key: string]: { status: VerificationStatus; rejectionReason?: string } },
  req?: Request
) {
  try {
    const verification = await prismaClient.businessVerification.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification) {
      throw ApiError.notFound('Business verification not found', ErrorCodes.NOT_FOUND);
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw ApiError.conflict(
        `Business verification has already been ${verification.status.toLowerCase()}`,
        ErrorCodes.CONFLICT
      );
    }

    // Safely cast and validate urlStatuses
    let urlStatuses: UrlStatuses;
    const rawUrlStatuses = verification.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      urlStatuses = rawUrlStatuses;
    } else {
      // Initialize with default PENDING statuses if invalid or null
      urlStatuses = {
        cacDocumentUrl: { status: VerificationStatus.PENDING },
        proofOfAddressUrl: { status: VerificationStatus.PENDING },
        tinDocumentUrl: { status: VerificationStatus.PENDING },
      };
    }

    if (urls) {
      const validUrlFields = ['cacDocumentUrl', 'proofOfAddressUrl', 'tinDocumentUrl'];
      for (const [key, value] of Object.entries(urls)) {
        if (!validUrlFields.includes(key)) {
          throw ApiError.badRequest(`Invalid URL field: ${key}`, ErrorCodes.BAD_REQUEST);
        }
        if (!Object.values(VerificationStatus).includes(value.status)) {
          throw ApiError.badRequest(`Invalid status for ${key}: ${value.status}`, ErrorCodes.BAD_REQUEST);
        }
        if (value.status === VerificationStatus.REJECTED && !value.rejectionReason) {
          throw ApiError.badRequest(
            `Rejection reason required for ${key} when status is REJECTED`,
            ErrorCodes.MISSING_FIELDS
          );
        }
        urlStatuses[key] = {
          status: value.status,
          rejectionReason: value.status === VerificationStatus.REJECTED ? value.rejectionReason : undefined,
        };
      }
    }

    // Determine overall status based on urlStatuses
    const urlStatusValues = Object.values(urlStatuses).map((u) => u.status);
    let finalStatus: VerificationStatus;

    if (urlStatusValues.every((s) => s === VerificationStatus.APPROVED)) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (urlStatusValues.every((s) => s === VerificationStatus.REJECTED)) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (
      urlStatusValues.includes(VerificationStatus.APPROVED) &&
      urlStatusValues.includes(VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else {
      finalStatus = VerificationStatus.PENDING;
    }

    // Validate input status against computed finalStatus
    if (status === VerificationStatus.REJECTED && finalStatus === VerificationStatus.INCOMPLETE) {
      throw ApiError.badRequest(
        'Cannot set overall status to REJECTED when some documents are approved and others are rejected. Use INCOMPLETE instead.',
        ErrorCodes.BAD_REQUEST
      );
    }

    // Override finalStatus with input status if it aligns with business rules
    if (
      status === VerificationStatus.APPROVED &&
      urlStatusValues.every((s) => s === VerificationStatus.APPROVED)
    ) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (
      status === VerificationStatus.REJECTED &&
      urlStatusValues.every((s) => s === VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (status === VerificationStatus.INCOMPLETE && finalStatus === VerificationStatus.INCOMPLETE) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else if (status !== finalStatus) {
      throw ApiError.badRequest(
        `Input status ${status} does not align with document statuses: ${urlStatusValues.join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Update verification in a transaction
    const updatedVerification = await prismaClient.$transaction(async (tx) => {
      const verificationUpdate = await tx.businessVerification.update({
        where: { id },
        data: {
          status: finalStatus,
          adminId,
          rejectionReason: finalStatus === VerificationStatus.REJECTED || finalStatus === VerificationStatus.INCOMPLETE ? rejectionReason : null,
          processedAt: new Date(),
          urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue,
        },
      });

      return verificationUpdate;
    });

    // Prepare notifications
    const notifications: NotificationPayload[] = [];
    if (verification.user) {
      let eventType: KnownEventTypes;
      let message: string;

      if (finalStatus === VerificationStatus.APPROVED) {
        eventType = 'BUSINESS_VERIFICATION_APPROVED' as KnownEventTypes;
        message = `Your business "${updatedVerification.businessName}" has been approved.`;
      } else if (finalStatus === VerificationStatus.REJECTED) {
        eventType = 'BUSINESS_VERIFICATION_REJECTED' as KnownEventTypes;
        message = `Your business "${updatedVerification.businessName}" verification was rejected.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else if (finalStatus === VerificationStatus.INCOMPLETE) {
        eventType = 'BUSINESS_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your business "${updatedVerification.businessName}" verification is incomplete. Please address rejected documents.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else {
        eventType = 'BUSINESS_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your business "${updatedVerification.businessName}" verification status has been updated.`;
      }

      notifications.push({
        eventTypeName: eventType,
        dynamicData: {
          userName: `${verification.user.firstName} ${verification.user.lastName}`,
          userEmail: verification.user.email,
          businessName: updatedVerification.businessName,
          status: finalStatus,
          message,
          rejectionReason: rejectionReason ?? '',
          processedAt: new Date().toISOString(),
          logoUrl: updatedVerification.logoUrl ?? '',
        },
        userIds: [verification.user.id],
      });

      if (urls) {
        for (const [urlField, urlData] of Object.entries(urlStatuses)) {
          let urlEventType: KnownEventTypes;
          let urlMessage: string;

          if (urlData.status === VerificationStatus.APPROVED) {
            urlEventType = `BUSINESS_${urlField.toUpperCase()}_APPROVED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for business "${updatedVerification.businessName}" has been approved.`;
          } else if (urlData.status === VerificationStatus.REJECTED) {
            urlEventType = `BUSINESS_${urlField.toUpperCase()}_REJECTED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for business "${updatedVerification.businessName}" was rejected.${
              urlData.rejectionReason ? ' Reason: ' + urlData.rejectionReason : ''
            }`;
          } else {
            urlEventType = `BUSINESS_${urlField.toUpperCase()}_UPDATED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for business "${updatedVerification.businessName}" verification status has been updated.`;
          }

          notifications.push({
            eventTypeName: urlEventType,
            dynamicData: {
              userName: `${verification.user.firstName} ${verification.user.lastName}`,
              userEmail: verification.user.email,
              businessName: updatedVerification.businessName,
              urlField,
              status: urlData.status,
              message: urlMessage,
              rejectionReason: urlData.rejectionReason ?? '',
              processedAt: new Date().toISOString(),
            },
            userIds: [verification.user.id],
          });
        }
      }
    }

    // Batch dispatch notifications
    try {
      const mockRes = {} as Response;
      await Promise.all(
        notifications.map((notification) =>
          dispatchNotification(notification, req || ({} as Request), mockRes)
        )
      );
    } catch (notifyError) {
      logger.error('Error sending business verification notifications', {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        verificationId: id,
      });
    }

    return {
      ...updatedVerification,
      urlStatuses,
    };
  } catch (error: any) {
    logger.error(`Error updating business verification status: ${error.message}`);
    throw ApiError.internal('Failed to update business verification status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
/**
   * Update license verification status and notify user
   */
async updateLicenseStatus(
  id: string,
  status: VerificationStatus,
  adminId: string,
  rejectionReason?: string,
  urls?: { [key: string]: { status: VerificationStatus; rejectionReason?: string } },
  req?: Request
) {
  try {
    const license = await prismaClient.license.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!license) {
      throw ApiError.notFound('License not found', ErrorCodes.NOT_FOUND);
    }

    if (license.status !== VerificationStatus.PENDING) {
      throw ApiError.conflict(`License has already been ${license.status.toLowerCase()}`, ErrorCodes.CONFLICT);
    }

    // Safely cast and validate urlStatuses
    let urlStatuses: UrlStatuses;
    const rawUrlStatuses = license.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      urlStatuses = rawUrlStatuses;
    } else {
      // Initialize with default PENDING statuses if invalid or null
      urlStatuses = {
        documentUrl: { status: VerificationStatus.PENDING },
        documentBackUrl: { status: VerificationStatus.PENDING },
      };
    }

    if (urls) {
      const validUrlFields = ['documentUrl', 'documentBackUrl'];
      for (const [key, value] of Object.entries(urls)) {
        if (!validUrlFields.includes(key)) {
          throw ApiError.badRequest(`Invalid URL field: ${key}`, ErrorCodes.BAD_REQUEST);
        }
        if (!Object.values(VerificationStatus).includes(value.status)) {
          throw ApiError.badRequest(`Invalid status for ${key}: ${value.status}`, ErrorCodes.BAD_REQUEST);
        }
        if (value.status === VerificationStatus.REJECTED && !value.rejectionReason) {
          throw ApiError.badRequest(
            `Rejection reason required for ${key} when status is REJECTED`,
            ErrorCodes.MISSING_FIELDS
          );
        }
        urlStatuses[key] = {
          status: value.status,
          rejectionReason: value.status === VerificationStatus.REJECTED ? value.rejectionReason : undefined,
        };
      }
    }

    // Determine overall status
    const urlStatusValues = Object.values(urlStatuses).map((u) => u.status);
    let finalStatus: VerificationStatus;

    if (urlStatusValues.every((s) => s === VerificationStatus.APPROVED)) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (urlStatusValues.every((s) => s === VerificationStatus.REJECTED)) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (
      urlStatusValues.includes(VerificationStatus.APPROVED) &&
      urlStatusValues.includes(VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else {
      finalStatus = VerificationStatus.PENDING;
    }

    // Validate input status against computed finalStatus
    if (status === VerificationStatus.REJECTED && finalStatus === VerificationStatus.INCOMPLETE) {
      throw ApiError.badRequest(
        'Cannot set overall status to REJECTED when some documents are approved and others are rejected. Use INCOMPLETE instead.',
        ErrorCodes.BAD_REQUEST
      );
    }

    // Override finalStatus with input status if it aligns with business rules
    if (
      status === VerificationStatus.APPROVED &&
      urlStatusValues.every((s) => s === VerificationStatus.APPROVED)
    ) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (
      status === VerificationStatus.REJECTED &&
      urlStatusValues.every((s) => s === VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (status === VerificationStatus.INCOMPLETE && finalStatus === VerificationStatus.INCOMPLETE) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else if (status !== finalStatus) {
      throw ApiError.badRequest(
        `Input status ${status} does not align with document statuses: ${urlStatusValues.join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Update license in a transaction
    const updatedLicense = await prismaClient.$transaction(async (tx) => {
      const licenseUpdate = await tx.license.update({
        where: { id },
        data: {
          status: finalStatus,
          verifiedById: adminId,
          rejectionReason: finalStatus === VerificationStatus.REJECTED || finalStatus === VerificationStatus.INCOMPLETE ? rejectionReason : null,
          verifiedAt: new Date(),
          verified: finalStatus === VerificationStatus.APPROVED,
          urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue,
        },
      });

      return licenseUpdate;
    });

    // Prepare notifications
    const notifications: NotificationPayload[] = [];
    if (license.user) {
      let eventType: KnownEventTypes;
      let message: string;

      if (finalStatus === VerificationStatus.APPROVED) {
        eventType = 'LICENSE_VERIFICATION_APPROVED' as KnownEventTypes;
        message = `Your license "${updatedLicense.licenseNumber}" has been approved.`;
      } else if (finalStatus === VerificationStatus.REJECTED) {
        eventType = 'LICENSE_VERIFICATION_REJECTED' as KnownEventTypes;
        message = `Your license "${updatedLicense.licenseNumber}" verification was rejected.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else if (finalStatus === VerificationStatus.INCOMPLETE) {
        eventType = 'LICENSE_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your license "${updatedLicense.licenseNumber}" verification is incomplete. Please address rejected documents.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else {
        eventType = 'LICENSE_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your license "${updatedLicense.licenseNumber}" verification status has been updated.`;
      }

      notifications.push({
        eventTypeName: eventType,
        dynamicData: {
          userName: `${license.user.firstName} ${license.user.lastName}`,
          userEmail: license.user.email,
          licenseNumber: updatedLicense.licenseNumber,
          status: finalStatus,
          message,
          rejectionReason: rejectionReason ?? '',
          processedAt: new Date().toISOString(),
        },
        userIds: [license.user.id],
      });

      if (urls) {
        for (const [urlField, urlData] of Object.entries(urlStatuses)) {
          let urlEventType: KnownEventTypes;
          let urlMessage: string;

          if (urlData.status === VerificationStatus.APPROVED) {
            urlEventType = `LICENSE_${urlField.toUpperCase()}_APPROVED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for license "${updatedLicense.licenseNumber}" has been approved.`;
          } else if (urlData.status === VerificationStatus.REJECTED) {
            urlEventType = `LICENSE_${urlField.toUpperCase()}_REJECTED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for license "${updatedLicense.licenseNumber}" was rejected.${
              urlData.rejectionReason ? ' Reason: ' + urlData.rejectionReason : ''
            }`;
          } else {
            urlEventType = `LICENSE_${urlField.toUpperCase()}_UPDATED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for license "${updatedLicense.licenseNumber}" verification status has been updated.`;
          }

          notifications.push({
            eventTypeName: urlEventType,
            dynamicData: {
              userName: `${license.user.firstName} ${license.user.lastName}`,
              userEmail: license.user.email,
              licenseNumber: updatedLicense.licenseNumber,
              urlField,
              status: urlData.status,
              message: urlMessage,
              rejectionReason: urlData.rejectionReason ?? '',
              processedAt: new Date().toISOString(),
            },
            userIds: [license.user.id],
          });
        }
      }
    }

    // Batch dispatch notifications
    try {
      const mockRes = {} as Response;
      await Promise.all(
        notifications.map((notification) =>
          dispatchNotification(notification, req || ({} as Request), mockRes)
        )
      );
    } catch (notifyError) {
      logger.error('Error sending license verification notifications', {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        licenseId: id,
      });
    }

    return {
      ...updatedLicense,
      urlStatuses,
    };
  } catch (error: any) {
    logger.error(`Error updating license status: ${error.message}`);
    throw ApiError.internal('Failed to update license status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
 /**
   * Update vehicle verification status and notify user
   */
async updateVehicleStatus(
  id: string,
  status: VerificationStatus,
  adminId: string,
  rejectionReason?: string,
  urls?: { [key: string]: { status: VerificationStatus; rejectionReason?: string } },
  req?: Request
) {
  try {
    const vehicle = await prismaClient.vehicle.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!vehicle) {
      throw ApiError.notFound('Vehicle not found', ErrorCodes.NOT_FOUND);
    }

    if (vehicle.status !== VerificationStatus.PENDING) {
      throw ApiError.conflict(`Vehicle has already been ${vehicle.status.toLowerCase()}`, ErrorCodes.CONFLICT);
    }

    // Safely cast and validate urlStatuses
    let urlStatuses: UrlStatuses;
    const rawUrlStatuses = vehicle.urlStatuses as unknown;
    if (this.isValidUrlStatuses(rawUrlStatuses)) {
      urlStatuses = rawUrlStatuses;
    } else {
      // Initialize with default PENDING statuses if invalid or null
      urlStatuses = {
        driverLicenseUrl: { status: VerificationStatus.PENDING },
        vehicleRoadLicenseUrl: { status: VerificationStatus.PENDING },
        plateNumberUrl: { status: VerificationStatus.PENDING },
      };
    }

    if (urls) {
      const validUrlFields = ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl'];
      for (const [key, value] of Object.entries(urls)) {
        if (!validUrlFields.includes(key)) {
          throw ApiError.badRequest(`Invalid URL field: ${key}`, ErrorCodes.BAD_REQUEST);
        }
        if (!Object.values(VerificationStatus).includes(value.status)) {
          throw ApiError.badRequest(`Invalid status for ${key}: ${value.status}`, ErrorCodes.BAD_REQUEST);
        }
        if (value.status === VerificationStatus.REJECTED && !value.rejectionReason) {
          throw ApiError.badRequest(
            `Rejection reason required for ${key} when status is REJECTED`,
            ErrorCodes.MISSING_FIELDS
          );
        }
        urlStatuses[key] = {
          status: value.status,
          rejectionReason: value.status === VerificationStatus.REJECTED ? value.rejectionReason : undefined,
        };
      }
    }

    // Determine overall status
    const urlStatusValues = Object.values(urlStatuses).map((u) => u.status);
    let finalStatus: VerificationStatus;

    if (urlStatusValues.every((s) => s === VerificationStatus.APPROVED)) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (urlStatusValues.every((s) => s === VerificationStatus.REJECTED)) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (
      urlStatusValues.includes(VerificationStatus.APPROVED) &&
      urlStatusValues.includes(VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else {
      finalStatus = VerificationStatus.PENDING;
    }

    // Validate input status against computed finalStatus
    if (status === VerificationStatus.REJECTED && finalStatus === VerificationStatus.INCOMPLETE) {
      throw ApiError.badRequest(
        'Cannot set overall status to REJECTED when some documents are approved and others are rejected. Use INCOMPLETE instead.',
        ErrorCodes.BAD_REQUEST
      );
    }

    // Override finalStatus with input status if it aligns with business rules
    if (
      status === VerificationStatus.APPROVED &&
      urlStatusValues.every((s) => s === VerificationStatus.APPROVED)
    ) {
      finalStatus = VerificationStatus.APPROVED;
    } else if (
      status === VerificationStatus.REJECTED &&
      urlStatusValues.every((s) => s === VerificationStatus.REJECTED)
    ) {
      finalStatus = VerificationStatus.REJECTED;
    } else if (status === VerificationStatus.INCOMPLETE && finalStatus === VerificationStatus.INCOMPLETE) {
      finalStatus = VerificationStatus.INCOMPLETE;
    } else if (status !== finalStatus) {
      throw ApiError.badRequest(
        `Input status ${status} does not align with document statuses: ${urlStatusValues.join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Update vehicle in a transaction
    const updatedVehicle = await prismaClient.$transaction(async (tx) => {
      const vehicleUpdate = await tx.vehicle.update({
        where: { id },
        data: {
          status: finalStatus,
          verifiedById: adminId,
          rejectionReason: finalStatus === VerificationStatus.REJECTED || finalStatus === VerificationStatus.INCOMPLETE ? rejectionReason : null,
          verifiedAt: new Date(),
          verified: finalStatus === VerificationStatus.APPROVED,
          urlStatuses: urlStatuses as unknown as Prisma.InputJsonValue,
        },
      });

      return vehicleUpdate;
    });

    // Prepare notifications
    const notifications: NotificationPayload[] = [];
    if (vehicle.user) {
      let eventType: KnownEventTypes;
      let message: string;

      if (finalStatus === VerificationStatus.APPROVED) {
        eventType = 'VEHICLE_VERIFICATION_APPROVED' as KnownEventTypes;
        message = `Your vehicle with plate number ${updatedVehicle.plateNumber} has been approved.`;
      } else if (finalStatus === VerificationStatus.REJECTED) {
        eventType = 'VEHICLE_VERIFICATION_REJECTED' as KnownEventTypes;
        message = `Your vehicle with plate number ${updatedVehicle.plateNumber} verification was rejected.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else if (finalStatus === VerificationStatus.INCOMPLETE) {
        eventType = 'VEHICLE_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your vehicle with plate number ${updatedVehicle.plateNumber} verification is incomplete. Please address rejected documents.${
          rejectionReason ? ' Reason: ' + rejectionReason : ''
        }`;
      } else {
        eventType = 'VEHICLE_VERIFICATION_UPDATED' as KnownEventTypes;
        message = `Your vehicle with plate number ${updatedVehicle.plateNumber} verification status has been updated.`;
      }

      notifications.push({
        eventTypeName: eventType,
        dynamicData: {
          userName: `${vehicle.user.firstName} ${vehicle.user.lastName}`,
          userEmail: vehicle.user.email,
          plateNumber: updatedVehicle.plateNumber!,
          status: finalStatus,
          message,
          rejectionReason: rejectionReason ?? '',
          processedAt: new Date().toISOString(),
        },
        userIds: [vehicle.user.id],
      });

      if (urls) {
        for (const [urlField, urlData] of Object.entries(urlStatuses)) {
          let urlEventType: KnownEventTypes;
          let urlMessage: string;

          if (urlData.status === VerificationStatus.APPROVED) {
            urlEventType = `VEHICLE_${urlField.toUpperCase()}_APPROVED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for vehicle with plate number "${updatedVehicle.plateNumber}" has been approved.`;
          } else if (urlData.status === VerificationStatus.REJECTED) {
            urlEventType = `VEHICLE_${urlField.toUpperCase()}_REJECTED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for vehicle with plate number "${updatedVehicle.plateNumber}" was rejected.${
              urlData.rejectionReason ? ' Reason: ' + urlData.rejectionReason : ''
            }`;
          } else {
            urlEventType = `VEHICLE_${urlField.toUpperCase()}_UPDATED` as KnownEventTypes;
            urlMessage = `Your ${urlField} for vehicle with plate number "${updatedVehicle.plateNumber}" verification status has been updated.`;
          }

          notifications.push({
            eventTypeName: urlEventType,
            dynamicData: {
              userName: `${vehicle.user.firstName} ${vehicle.user.lastName}`,
              userEmail: vehicle.user.email,
              plateNumber: updatedVehicle.plateNumber!,
              urlField,
              status: urlData.status,
              message: urlMessage,
              rejectionReason: urlData.rejectionReason ?? '',
              processedAt: new Date().toISOString(),
            },
            userIds: [vehicle.user.id],
          });
        }
      }
    }

    // Batch dispatch notifications
    try {
      const mockRes = {} as Response;
      await Promise.all(
        notifications.map((notification) =>
          dispatchNotification(notification, req || ({} as Request), mockRes)
        )
      );
    } catch (notifyError) {
      logger.error('Error sending vehicle verification notifications', {
        error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        vehicleId: id,
      });
    }

    return {
      ...updatedVehicle,
      urlStatuses,
    };
  } catch (error: any) {
    logger.error(`Error updating vehicle status: ${error.message}`);
    throw ApiError.internal('Failed to update vehicle status', ErrorCodes.INTERNAL_SERVER_ERROR, {
      details: error.message,
    });
  }
}
}