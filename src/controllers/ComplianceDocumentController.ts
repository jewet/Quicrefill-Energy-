import { Request, Response, NextFunction } from 'express';
import { VerificationStatus, LicenseType, DocumentType } from '@prisma/client';
import { ComplianceDocumentService } from '../services/ComplianceDocumentService';
import { successResponse } from '../config/responseFormatter';
import { ApiError } from '../lib/utils/errors/appError';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { ErrorCodes } from '../errors/errorCodes';
import { isValidUrl } from '../lib/utils/urlUtils';
import { prismaClient } from '../config/db';
import { UrlStatuses } from '../services/ComplianceDocumentService'; 

interface BusinessVerificationData {
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber: string;
  businessLogoUrl?: string;
  handles?: Record<string, string> | Prisma.InputJsonValue;
  documentType: DocumentType; // Add documentType
}

interface BusinessVerificationResponse {
  id: string;
  status: VerificationStatus;
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber: string | null;
  cacDocumentUrl: string;
  proofOfAddressUrl: string;
  tinDocumentUrl: string | null;
  logoUrl: string | null;
  handles?: Prisma.JsonValue | null;
  documentType: DocumentType; 
  submittedAt: Date;
  processedAt?: Date | null;
  rejectionReason?: string | null;
  urlStatuses: UrlStatuses | null; 
}

interface LicenseData {
  licenseType: LicenseType;
  licenseNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  documentType: DocumentType; 
}

interface LicenseResponse {
  id: string;
  status: VerificationStatus;
  licenseType: LicenseType;
  licenseNumber: string;
  issuedBy: string | null;
  issuedDate: Date | null;
  expiryDate: Date | null;
  documentUrl: string;
  documentBackUrl: string | null;
  documentType: DocumentType;
  submittedAt: Date;
  rejectionReason?: string | null;
  verified?: boolean;
  verifiedAt?: Date | null;
  verifiedById?: string | null;
  urlStatuses: UrlStatuses | null; // Added
}

interface VehicleData {
  plateNumber: string;
}



interface VehicleResponse {
  id: string;
  status: VerificationStatus;
  driverLicenseUrl: string;
  vehicleRoadLicenseUrl: string;
  plateNumberUrl: string;
  plateNumber: string | null;
  documentType: DocumentType; // Added documentType
  submittedAt: Date;
  rejectionReason?: string | null;
  verified?: boolean;
  verifiedAt?: Date | null;
  verifiedById?: string | null;
  urlStatuses: UrlStatuses | null; 
}

const complianceDocumentService = new ComplianceDocumentService();

export class ComplianceDocumentController {
async handleBusinessSubmissionFromGateway(data: {
  userId: string;
  documentId: string;
  cacDocumentUrl: string;
  proofOfAddressUrl: string;
  tinDocumentUrl: string;
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber: string;
  businessLogoUrl?: string;
  handles?: Record<string, string> | Prisma.InputJsonValue;
  documentType: DocumentType;
}): Promise<BusinessVerificationResponse> {
  const requestId = uuidv4();
  try {
    logger.info(`[${requestId}] Handling business submission from API Gateway`, {
      userId: data.userId,
      documentId: data.documentId,
      businessName: data.businessName,
    });

    // Validate required fields
    const missingFields = [];
    if (!data.userId) missingFields.push('userId');
    if (!data.documentId) missingFields.push('documentId');
    if (!data.cacDocumentUrl) missingFields.push('cacDocumentUrl');
    if (!data.proofOfAddressUrl) missingFields.push('proofOfAddressUrl');
    if (!data.tinDocumentUrl) missingFields.push('tinDocumentUrl');
    if (!data.businessName) missingFields.push('businessName');
    if (!data.rcNumber) missingFields.push('rcNumber');
    if (!data.businessAddress) missingFields.push('businessAddress');
    if (!data.tinNumber) missingFields.push('tinNumber');
    if (!data.documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, { missingFields, data });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate documentType
    if (!Object.values(DocumentType).includes(data.documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, { data });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    if (data.handles && (typeof data.handles !== 'object' || Array.isArray(data.handles))) {
      throw ApiError.badRequest('handles must be a non-array object', ErrorCodes.BAD_REQUEST);
    }

    const businessData: BusinessVerificationData = {
      businessName: data.businessName,
      rcNumber: data.rcNumber,
      businessAddress: data.businessAddress,
      tinNumber: data.tinNumber,
      businessLogoUrl: data.businessLogoUrl,
      handles: data.handles,
      documentType: data.documentType,
    };

    const verification = await complianceDocumentService.submitBusinessVerification(
      data.userId,
      businessData,
      data.cacDocumentUrl,
      data.proofOfAddressUrl,
      data.tinDocumentUrl
    );

    logger.info(`[${requestId}] Business verification submitted successfully from gateway`, {
      userId: data.userId,
      verificationId: verification.id,
      businessName: verification.businessName,
      documentType: data.documentType,
    });

    return {
      id: verification.id,
      status: verification.status,
      businessName: verification.businessName,
      rcNumber: verification.rcNumber,
      businessAddress: verification.businessAddress,
      tinNumber: verification.tinNumber,
      cacDocumentUrl: verification.cacDocumentUrl,
      proofOfAddressUrl: verification.proofOfAddressUrl,
      tinDocumentUrl: verification.tinDocumentUrl,
      logoUrl: verification.logoUrl,
      handles: verification.handles,
      documentType: verification.documentType,
      submittedAt: verification.submittedAt,
      processedAt: verification.processedAt,
      rejectionReason: verification.rejectionReason,
      urlStatuses: verification.urlStatuses as UrlStatuses | null, // Include urlStatuses from database
    };
  } catch (error) {
    logger.error(`[${requestId}] Error handling business submission from gateway`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
      stack: error instanceof Error ? error.stack : undefined,
      requestData: data,
    });
    throw error;
  }
}

async handleLicenseSubmissionFromGateway(data: {
  userId: string;
  documentId: string;
  frontImageUrl: string;
  backImageUrl: string;
  licenseType: LicenseType;
  licenseNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  documentType: DocumentType;
}): Promise<LicenseResponse> {
  const requestId = uuidv4();
  try {
    logger.info(`[${requestId}] Handling license submission from API Gateway`, {
      userId: data.userId,
      documentId: data.documentId,
    });

    // Validate required fields
    const missingFields = [];
    if (!data.userId) missingFields.push('userId');
    if (!data.documentId) missingFields.push('documentId');
    if (!data.frontImageUrl) missingFields.push('frontImageUrl');
    if (!data.backImageUrl) missingFields.push('backImageUrl');
    if (!data.licenseType) missingFields.push('licenseType');
    if (!data.licenseNumber) missingFields.push('licenseNumber');
    if (!data.issuedBy) missingFields.push('issuedBy');
    if (!data.issuedDate) missingFields.push('issuedDate');
    if (!data.expiryDate) missingFields.push('expiryDate');
    if (!data.documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, { missingFields, data });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate licenseType and documentType
    if (!Object.values(LicenseType).includes(data.licenseType)) {
      logger.error(`[${requestId}] Invalid license type: ${data.licenseType}`);
      throw ApiError.badRequest(
        `Invalid license type: must be one of ${Object.values(LicenseType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    if (!Object.values(DocumentType).includes(data.documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, { data });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const licenseData: LicenseData = {
      licenseType: data.licenseType,
      licenseNumber: data.licenseNumber,
      issuedBy: data.issuedBy,
      issuedDate: data.issuedDate,
      expiryDate: data.expiryDate,
      documentType: data.documentType,
    };

    const license = await complianceDocumentService.submitLicense(
      data.userId,
      licenseData,
      data.frontImageUrl,
      data.backImageUrl
    );

    logger.info(`[${requestId}] License submitted successfully from gateway`, {
      userId: data.userId,
      licenseId: license.id,
      licenseNumber: license.licenseNumber,
      documentType: data.documentType,
    });

    return {
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
      rejectionReason: license.rejectionReason,
      verified: license.verified,
      verifiedAt: license.verifiedAt,
      verifiedById: license.verifiedById,
      urlStatuses: license.urlStatuses as UrlStatuses | null, // Include urlStatuses from database
    };
  } catch (error) {
    logger.error(`[${requestId}] Error handling license submission from gateway`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
      stack: error instanceof Error ? error.stack : undefined,
      requestData: data,
    });
    throw error;
  }
}


async handleVehicleSubmissionFromGateway(data: {
  userId: string;
  documentId: string;
  driverLicenseUrl: string;
  vehicleRoadLicenseUrl: string;
  plateNumberUrl: string;
  plateNumber: string;
  documentType: DocumentType;
}): Promise<VehicleResponse> {
  const requestId = uuidv4();
  try {
    logger.info(`[${requestId}] Handling vehicle submission from API Gateway`, {
      userId: data.userId,
      documentId: data.documentId,
    });

    // Validate required fields
    const missingFields = [];
    if (!data.userId) missingFields.push('userId');
    if (!data.documentId) missingFields.push('documentId');
    if (!data.driverLicenseUrl) missingFields.push('driverLicenseUrl');
    if (!data.vehicleRoadLicenseUrl) missingFields.push('vehicleRoadLicenseUrl');
    if (!data.plateNumberUrl) missingFields.push('plateNumberUrl');
    if (!data.plateNumber) missingFields.push('plateNumber');
    if (!data.documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, { missingFields, data });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (!Object.values(DocumentType).includes(data.documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, { data });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    const vehicleData: VehicleData = {
      plateNumber: data.plateNumber,
    };

    const vehicle = await complianceDocumentService.submitVehicle(
      data.userId,
      vehicleData,
      data.driverLicenseUrl,
      data.vehicleRoadLicenseUrl,
      data.plateNumberUrl,
      data.documentType
    );

    logger.info(`[${requestId}] Vehicle submitted successfully from gateway`, {
      userId: data.userId,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      documentType: data.documentType,
    });

    return {
      id: vehicle.id,
      status: vehicle.status,
      driverLicenseUrl: vehicle.driverLicenseUrl,
      vehicleRoadLicenseUrl: vehicle.vehicleRoadLicenseUrl,
      plateNumberUrl: vehicle.plateNumberUrl,
      plateNumber: vehicle.plateNumber,
      documentType: vehicle.documentType,
      submittedAt: vehicle.createdAt,
      rejectionReason: vehicle.rejectionReason,
      verified: vehicle.verified,
      verifiedAt: vehicle.verifiedAt,
      verifiedById: vehicle.verifiedById,
      urlStatuses: vehicle.urlStatuses as UrlStatuses | null, // Ensure urlStatuses is included
    };
  } catch (error) {
    logger.error(`[${requestId}] Error handling vehicle submission from gateway`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
      stack: error instanceof Error ? error.stack : undefined,
      requestData: data,
    });
    throw error;
  }
}

async submitBusinessVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { businessName, rcNumber, businessAddress, tinNumber, businessLogoUrl, handles: rawHandles, documentType } = req.body;
    const missingFields = [];
    if (!businessName) missingFields.push('businessName');
    if (!rcNumber) missingFields.push('rcNumber');
    if (!businessAddress) missingFields.push('businessAddress');
    if (!tinNumber) missingFields.push('tinNumber');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate documentType
    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const { cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl } = req.body;
    const hasFileUrls = cacDocumentUrl && proofOfAddressUrl && tinDocumentUrl;

    let cacDocumentPath: string | undefined;
    let proofOfAddressPath: string | undefined;
    let tinDocumentPath: string | undefined;
    let businessLogoPath: string | undefined;

    if (hasFileUrls) {
      // Validate URLs
      const invalidUrls = [];
      if (!isValidUrl(cacDocumentUrl)) invalidUrls.push('cacDocumentUrl');
      if (!isValidUrl(proofOfAddressUrl)) invalidUrls.push('proofOfAddressUrl');
      if (!isValidUrl(tinDocumentUrl)) invalidUrls.push('tinDocumentUrl');

      if (invalidUrls.length > 0) {
        logger.error(`[${requestId}] Invalid file URLs provided`, {
          userId: req.user.id,
          invalidUrls,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Invalid file URLs: ${invalidUrls.join(', ')}`,
          ErrorCodes.BAD_REQUEST,
          { invalidUrls }
        );
      }

      cacDocumentPath = cacDocumentUrl;
      proofOfAddressPath = proofOfAddressUrl;
      tinDocumentPath = tinDocumentUrl;
      businessLogoPath = businessLogoUrl;
      logger.info(`[${requestId}] Valid file URLs provided for business submission`, {
        userId: req.user.id,
        cacDocumentUrl,
        proofOfAddressUrl,
        tinDocumentUrl,
        businessLogoUrl,
      });
    } else {
      // Handle Multer file uploads for direct submissions
      if (!req.files) {
        logger.error(`[${requestId}] No files uploaded and no file URLs provided`, {
          userId: req.user.id,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          'No files uploaded or file URLs provided. Required: cacDocument, proofOfAddress, tinDocument',
          ErrorCodes.MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS,
          { body: req.body, headers: req.headers }
        );
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const cacDocument = files['cacDocument']?.[0];
      const proofOfAddress = files['proofOfAddress']?.[0];
      const tinDocument = files['tinDocument']?.[0];
      const businessLogo = files['businessLogo']?.[0];

      const missingFiles = [];
      if (!cacDocument) missingFiles.push('cacDocument');
      if (!proofOfAddress) missingFiles.push('proofOfAddress');
      if (!tinDocument) missingFiles.push('tinDocument');

      if (missingFiles.length > 0) {
        logger.error(`[${requestId}] Missing required file uploads`, {
          userId: req.user.id,
          missingFiles,
          uploadedFiles: Object.keys(files),
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required file uploads: ${missingFiles.join(', ')}`,
          ErrorCodes.MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS,
          { missingFiles, uploadedFiles: Object.keys(files) }
        );
      }

      cacDocumentPath = cacDocument.path;
      proofOfAddressPath = proofOfAddress.path;
      tinDocumentPath = tinDocument.path;
      businessLogoPath = businessLogo?.path;
      logger.info(`[${requestId}] Using uploaded files for business submission`, {
        userId: req.user.id,
        uploadedFiles: Object.keys(files),
      });
    }

    // Ensure file paths are defined
    if (!cacDocumentPath || !proofOfAddressPath || !tinDocumentPath) {
      const missingPaths = [];
      if (!cacDocumentPath) missingPaths.push('cacDocumentPath');
      if (!proofOfAddressPath) missingPaths.push('proofOfAddressPath');
      if (!tinDocumentPath) missingPaths.push('tinDocumentPath');

      logger.error(`[${requestId}] Missing required file paths`, {
        userId: req.user.id,
        missingPaths,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required file paths: ${missingPaths.join(', ')}`,
        ErrorCodes.MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS,
        { missingPaths }
      );
    }

    const businessData: BusinessVerificationData = {
      businessName,
      rcNumber,
      businessAddress,
      tinNumber,
      businessLogoUrl: businessLogoPath,
      handles: rawHandles ? JSON.parse(rawHandles) : undefined,
      documentType,
    };

    const verification = await complianceDocumentService.submitBusinessVerification(
      req.user.id,
      businessData,
      cacDocumentPath,
      proofOfAddressPath,
      tinDocumentPath
    );

    logger.info(`[${requestId}] Business verification submitted successfully`, {
      userId: req.user.id,
      verificationId: verification.id,
      businessName: verification.businessName,
      documentType,
    });

    successResponse(
      res,
      {
        id: verification.id,
        status: verification.status,
        businessName: verification.businessName,
        rcNumber: verification.rcNumber,
        businessAddress: verification.businessAddress,
        tinNumber: verification.tinNumber,
        cacDocumentUrl: verification.cacDocumentUrl,
        proofOfAddressUrl: verification.proofOfAddressUrl,
        tinDocumentUrl: verification.tinDocumentUrl,
        logoUrl: verification.logoUrl,
        handles: verification.handles,
        documentType: verification.documentType,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt,
        rejectionReason: verification.rejectionReason,
        urlStatuses: verification.urlStatuses as UrlStatuses | null, // Use database value
      },
      'Business verification submitted successfully',
      201
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in submitBusinessVerification`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

async resubmitBusinessVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { businessVerificationId, businessName, rcNumber, businessAddress, tinNumber, businessLogoUrl, handles: rawHandles, documentType } = req.body;
    const missingFields = [];
    if (!businessVerificationId) missingFields.push('businessVerificationId');
    if (!businessName) missingFields.push('businessName');
    if (!rcNumber) missingFields.push('rcNumber');
    if (!businessAddress) missingFields.push('businessAddress');
    if (!tinNumber) missingFields.push('tinNumber');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate documentType
    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const { cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl } = req.body;
    const providedUrls = [];
    if (cacDocumentUrl) providedUrls.push('cacDocumentUrl');
    if (proofOfAddressUrl) providedUrls.push('proofOfAddressUrl');
    if (tinDocumentUrl) providedUrls.push('tinDocumentUrl');
    if (businessLogoUrl) providedUrls.push('businessLogoUrl');

    // Validate that at least one URL is provided
    if (providedUrls.length === 0) {
      logger.error(`[${requestId}] No file URLs provided for resubmission`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        'At least one file URL (cacDocumentUrl, proofOfAddressUrl, tinDocumentUrl, or businessLogoUrl) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    // Validate provided URLs
    const invalidUrls = [];
    if (cacDocumentUrl && !isValidUrl(cacDocumentUrl)) invalidUrls.push('cacDocumentUrl');
    if (proofOfAddressUrl && !isValidUrl(proofOfAddressUrl)) invalidUrls.push('proofOfAddressUrl');
    if (tinDocumentUrl && !isValidUrl(tinDocumentUrl)) invalidUrls.push('tinDocumentUrl');
    if (businessLogoUrl && !isValidUrl(businessLogoUrl)) invalidUrls.push('businessLogoUrl');

    if (invalidUrls.length > 0) {
      logger.error(`[${requestId}] Invalid file URLs provided`, {
        userId: req.user.id,
        invalidUrls,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid file URLs: ${invalidUrls.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidUrls }
      );
    }

    const businessData: BusinessVerificationData = {
      businessName,
      rcNumber,
      businessAddress,
      tinNumber,
      businessLogoUrl: businessLogoUrl || undefined,
      handles: rawHandles ? JSON.parse(rawHandles) : undefined,
      documentType,
    };

    const verification = await complianceDocumentService.resubmitBusinessVerification(
      req.user.id,
      businessVerificationId,
      businessData,
      cacDocumentUrl,
      proofOfAddressUrl,
      tinDocumentUrl
    );

    logger.info(`[${requestId}] Business verification resubmitted successfully`, {
      userId: req.user.id,
      verificationId: verification.id,
      businessName: verification.businessName,
      documentType,
      providedUrls,
    });

    successResponse(
      res,
      {
        id: verification.id,
        status: verification.status,
        businessName: verification.businessName,
        rcNumber: verification.rcNumber,
        businessAddress: verification.businessAddress,
        tinNumber: verification.tinNumber,
        cacDocumentUrl: verification.cacDocumentUrl,
        proofOfAddressUrl: verification.proofOfAddressUrl,
        tinDocumentUrl: verification.tinDocumentUrl,
        businessLogoUrl: verification.logoUrl,
        handles: verification.handles,
        documentType: verification.documentType,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt,
        rejectionReason: verification.rejectionReason,
        urlStatuses: verification.urlStatuses as UrlStatuses | null,
      },
      'Business verification resubmitted successfully',
      200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in resubmitBusinessVerification`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

async submitLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { licenseType, licenseNumber, issuedBy, issuedDate, expiryDate, documentType } = req.body;
    const missingFields = [];
    if (!licenseType) missingFields.push('licenseType');
    if (!licenseNumber) missingFields.push('licenseNumber');
    if (!issuedBy) missingFields.push('issuedBy');
    if (!issuedDate) missingFields.push('issuedDate');
    if (!expiryDate) missingFields.push('expiryDate');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate licenseType and documentType
    if (!Object.values(LicenseType).includes(licenseType)) {
      logger.error(`[${requestId}] Invalid licenseType: ${licenseType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid licenseType: must be one of ${Object.values(LicenseType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const { frontImageUrl, backImageUrl } = req.body;
    const hasFileUrls = frontImageUrl && backImageUrl;

    let frontImagePath: string | undefined;
    let backImagePath: string | undefined;

    if (hasFileUrls) {
      frontImagePath = frontImageUrl;
      backImagePath = backImageUrl;
    } else {
      // Handle Multer file uploads for direct submissions
      if (!req.files) {
        logger.error(`[${requestId}] No files uploaded and no file URLs provided`, {
          userId: req.user.id,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          'No files uploaded or file URLs provided. Required: frontImage, backImage',
          ErrorCodes.MISSING_REQUIRED_FIELDS,
          { body: req.body, headers: req.headers }
        );
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const frontImage = files['frontImage']?.[0];
      const backImage = files['backImage']?.[0];

      const missingFiles = [];
      if (!frontImage) missingFiles.push('frontImage');
      if (!backImage) missingFiles.push('backImage');

      if (missingFiles.length > 0) {
        logger.error(`[${requestId}] Missing required file uploads`, {
          userId: req.user.id,
          missingFiles,
          uploadedFiles: Object.keys(files),
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required file uploads: ${missingFiles.join(', ')}`,
          ErrorCodes.MISSING_REQUIRED_FIELDS,
          { missingFiles, uploadedFiles: Object.keys(files) }
        );
      }

      frontImagePath = frontImage.path;
      backImagePath = backImage.path;
    }

    // Ensure file paths are defined
    if (!frontImagePath || !backImagePath) {
      const missingPaths = [];
      if (!frontImagePath) missingPaths.push('frontImagePath');
      if (!backImagePath) missingPaths.push('backImagePath');

      logger.error(`[${requestId}] Missing required file paths`, {
        userId: req.user.id,
        missingPaths,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required file paths: ${missingPaths.join(', ')}`,
        ErrorCodes.MISSING_REQUIRED_FIELDS,
        { missingPaths }
      );
    }

    const licenseData: LicenseData = {
      licenseType,
      licenseNumber,
      issuedBy,
      issuedDate,
      expiryDate,
      documentType,
    };

    const license = await complianceDocumentService.submitLicense(
      req.user.id,
      licenseData,
      frontImagePath,
      backImagePath
    );

    logger.info(`[${requestId}] License submitted successfully`, {
      userId: req.user.id,
      licenseId: license.id,
      licenseNumber: license.licenseNumber,
      documentType,
    });

    successResponse(
      res,
      {
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
        rejectionReason: license.rejectionReason,
        verified: license.verified,
        verifiedAt: license.verifiedAt,
        verifiedById: license.verifiedById,
        urlStatuses: license.urlStatuses as UrlStatuses | null, // Use database value
      },
      'License submitted successfully',
      201
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in submitLicense`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

// File: ComplianceDocumentController.ts
async resubmitLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { licenseId, licenseType, licenseNumber, issuedBy, issuedDate, expiryDate, documentType } = req.body;
    const missingFields = [];
    if (!licenseId) missingFields.push('licenseId');
    if (!licenseType) missingFields.push('licenseType');
    if (!licenseNumber) missingFields.push('licenseNumber');
    if (!issuedBy) missingFields.push('issuedBy');
    if (!issuedDate) missingFields.push('issuedDate');
    if (!expiryDate) missingFields.push('expiryDate');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    // Validate licenseType and documentType
    if (!Object.values(LicenseType).includes(licenseType)) {
      logger.error(`[${requestId}] Invalid licenseType: ${licenseType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid licenseType: must be one of ${Object.values(LicenseType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const { frontImageUrl, backImageUrl } = req.body;
    const providedUrls = [];
    if (frontImageUrl) providedUrls.push('frontImageUrl');
    if (backImageUrl) providedUrls.push('backImageUrl');

    let frontImagePath: string | undefined;
    let backImagePath: string | undefined;

    if (providedUrls.length > 0) {
      // Validate provided URLs
      const invalidUrls = [];
      if (frontImageUrl && !isValidUrl(frontImageUrl)) invalidUrls.push('frontImageUrl');
      if (backImageUrl && !isValidUrl(backImageUrl)) invalidUrls.push('backImageUrl');

      if (invalidUrls.length > 0) {
        logger.error(`[${requestId}] Invalid file URLs provided`, {
          userId: req.user.id,
          invalidUrls,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Invalid file URLs: ${invalidUrls.join(', ')}`,
          ErrorCodes.BAD_REQUEST,
          { invalidUrls }
        );
      }

      frontImagePath = frontImageUrl;
      backImagePath = backImageUrl;
      logger.info(`[${requestId}] Valid file URLs provided for license resubmission`, {
        userId: req.user.id,
        providedUrls,
      });
    } else if (req.files) {
      // Handle Multer file uploads for direct submissions
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const frontImage = files['frontImage']?.[0];
      const backImage = files['backImage']?.[0];

      frontImagePath = frontImage?.path;
      backImagePath = backImage?.path;

      logger.info(`[${requestId}] Using uploaded files for license resubmission`, {
        userId: req.user.id,
        uploadedFiles: Object.keys(files),
      });
    }

    // Ensure at least one document is provided for resubmission
    if (!frontImagePath && !backImagePath) {
      logger.error(`[${requestId}] No documents provided for resubmission`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        'At least one document (frontImage, backImage) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    const licenseData: LicenseData = {
      licenseType,
      licenseNumber,
      issuedBy,
      issuedDate,
      expiryDate,
      documentType,
    };

    const license = await complianceDocumentService.resubmitLicense(
      req.user.id,
      licenseId,
      licenseData,
      frontImagePath,
      backImagePath
    );

    logger.info(`[${requestId}] License resubmitted successfully`, {
      userId: req.user.id,
      inputLicenseId: licenseId,
      responseLicenseId: license.id,
      licenseNumber: license.licenseNumber,
      documentType,
    });

    successResponse(
      res,
      {
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
        rejectionReason: license.rejectionReason,
        verified: license.verified,
        verifiedAt: license.verifiedAt,
        verifiedById: license.verifiedById,
        urlStatuses: license.urlStatuses as UrlStatuses | null,
      },
      'License resubmitted successfully',
      200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in resubmitLicense`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

async submitVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { plateNumber, documentType } = req.body;
    const missingFields = [];
    if (!plateNumber) missingFields.push('plateNumber');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const { driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl } = req.body;
    const hasFileUrls = driverLicenseUrl && vehicleRoadLicenseUrl && plateNumberUrl;

    let driverLicensePath: string | undefined;
    let vehicleRoadLicensePath: string | undefined;
    let plateNumberDocPath: string | undefined;

    if (hasFileUrls) {
      driverLicensePath = driverLicenseUrl;
      vehicleRoadLicensePath = vehicleRoadLicenseUrl;
      plateNumberDocPath = plateNumberUrl;
    } else {
      // Handle Multer file uploads for direct submissions
      if (!req.files) {
        logger.error(`[${requestId}] No files uploaded and no file URLs provided`, {
          userId: req.user.id,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          'No files uploaded or file URLs provided. Required: driverLicense, vehicleRoadLicense, plateNumberDoc',
          ErrorCodes.MISSING_REQUIRED_FIELDS,
          { body: req.body, headers: req.headers }
        );
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const driverLicense = files['driverLicense']?.[0];
      const vehicleRoadLicense = files['vehicleRoadLicense']?.[0];
      const plateNumberDoc = files['plateNumberDoc']?.[0];

      const missingFiles = [];
      if (!driverLicense) missingFiles.push('driverLicense');
      if (!vehicleRoadLicense) missingFiles.push('vehicleRoadLicense');
      if (!plateNumberDoc) missingFiles.push('plateNumberDoc');

      if (missingFiles.length > 0) {
        logger.error(`[${requestId}] Missing required file uploads`, {
          userId: req.user.id,
          missingFiles,
          uploadedFiles: Object.keys(files),
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required file uploads: ${missingFiles.join(', ')}`,
          ErrorCodes.MISSING_REQUIRED_FIELDS,
          { missingFiles, uploadedFiles: Object.keys(files) }
        );
      }

      driverLicensePath = driverLicense.path;
      vehicleRoadLicensePath = vehicleRoadLicense.path;
      plateNumberDocPath = plateNumberDoc.path;
    }

    // Ensure file paths are defined
    if (!driverLicensePath || !vehicleRoadLicensePath || !plateNumberDocPath) {
      const missingPaths = [];
      if (!driverLicensePath) missingPaths.push('driverLicensePath');
      if (!vehicleRoadLicensePath) missingPaths.push('vehicleRoadLicensePath');
      if (!plateNumberDocPath) missingPaths.push('plateNumberDocPath');

      logger.error(`[${requestId}] Missing required file paths`, {
        userId: req.user.id,
        missingPaths,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required file paths: ${missingPaths.join(', ')}`,
        ErrorCodes.MISSING_REQUIRED_FIELDS,
        { missingPaths }
      );
    }

    const vehicleData: VehicleData = {
      plateNumber,
    };

    const vehicle = await complianceDocumentService.submitVehicle(
      req.user.id,
      vehicleData,
      driverLicensePath,
      vehicleRoadLicensePath,
      plateNumberDocPath,
      documentType
    );

    logger.info(`[${requestId}] Vehicle submitted successfully`, {
      userId: req.user.id,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      documentType,
    });

    successResponse(
      res,
      {
        id: vehicle.id,
        status: vehicle.status,
        driverLicenseUrl: vehicle.driverLicenseUrl,
        vehicleRoadLicenseUrl: vehicle.vehicleRoadLicenseUrl,
        plateNumberUrl: vehicle.plateNumberUrl,
        plateNumber: vehicle.plateNumber,
        documentType: vehicle.documentType,
        submittedAt: vehicle.createdAt,
        rejectionReason: vehicle.rejectionReason,
        verified: vehicle.verified,
        verifiedAt: vehicle.verifiedAt,
        verifiedById: vehicle.verifiedById,
        urlStatuses: vehicle.urlStatuses as UrlStatuses | null, // Ensure urlStatuses is included
      },
      'Vehicle submitted successfully',
      201
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in submitVehicle`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

// File: ComplianceDocumentController.ts
async resubmitVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    // Validate required fields
    const { vehicleId, plateNumber, documentType, driverLicenseUrl, vehicleRoadLicenseUrl, plateNumberUrl } = req.body;
    const missingFields = [];
    if (!vehicleId) missingFields.push('vehicleId');
    if (!plateNumber) missingFields.push('plateNumber');
    if (!documentType) missingFields.push('documentType');

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      logger.error(`[${requestId}] Invalid documentType: ${documentType}`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Check if file URLs are provided (from API Gateway)
    const providedUrls = [];
    if (driverLicenseUrl) providedUrls.push('driverLicenseUrl');
    if (vehicleRoadLicenseUrl) providedUrls.push('vehicleRoadLicenseUrl');
    if (plateNumberUrl) providedUrls.push('plateNumberUrl');

    let driverLicensePath: string | undefined;
    let vehicleRoadLicensePath: string | undefined;
    let plateNumberDocPath: string | undefined;

    if (providedUrls.length > 0) {
      // Validate provided URLs
      const invalidUrls = [];
      if (driverLicenseUrl && !isValidUrl(driverLicenseUrl)) invalidUrls.push('driverLicenseUrl');
      if (vehicleRoadLicenseUrl && !isValidUrl(vehicleRoadLicenseUrl)) invalidUrls.push('vehicleRoadLicenseUrl');
      if (plateNumberUrl && !isValidUrl(plateNumberUrl)) invalidUrls.push('plateNumberUrl');

      if (invalidUrls.length > 0) {
        logger.error(`[${requestId}] Invalid file URLs provided`, {
          userId: req.user.id,
          invalidUrls,
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Invalid file URLs: ${invalidUrls.join(', ')}`,
          ErrorCodes.BAD_REQUEST,
          { invalidUrls }
        );
      }

      driverLicensePath = driverLicenseUrl;
      vehicleRoadLicensePath = vehicleRoadLicenseUrl;
      plateNumberDocPath = plateNumberUrl;
      logger.info(`[${requestId}] Valid file URLs provided for vehicle resubmission`, {
        userId: req.user.id,
        providedUrls,
      });
    } else if (req.files) {
      // Handle Multer file uploads for direct submissions
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const driverLicense = files['driverLicense']?.[0];
      const vehicleRoadLicense = files['vehicleRoadLicense']?.[0];
      const plateNumberDoc = files['plateNumberDoc']?.[0];

      driverLicensePath = driverLicense?.path;
      vehicleRoadLicensePath = vehicleRoadLicense?.path;
      plateNumberDocPath = plateNumberDoc?.path;

      logger.info(`[${requestId}] Using uploaded files for vehicle resubmission`, {
        userId: req.user.id,
        uploadedFiles: Object.keys(files),
      });
    }

    // Ensure at least one document is provided for resubmission
    if (!driverLicensePath && !vehicleRoadLicensePath && !plateNumberDocPath) {
      logger.error(`[${requestId}] No documents provided for resubmission`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        'At least one document (driverLicense, vehicleRoadLicense, plateNumberDoc) must be provided for resubmission',
        ErrorCodes.MISSING_FIELDS
      );
    }

    const vehicleData: VehicleData = {
      plateNumber,
    };

    const vehicle = await complianceDocumentService.resubmitVehicle(
      req.user.id,
      vehicleId,
      vehicleData,
      documentType,
      driverLicensePath,
      vehicleRoadLicensePath,
      plateNumberDocPath
      
    );

    logger.info(`[${requestId}] Vehicle resubmitted successfully`, {
      userId: req.user.id,
      inputVehicleId: vehicleId,
      responseVehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      documentType,
    });

    successResponse(
      res,
      {
        id: vehicle.id,
        status: vehicle.status,
        driverLicenseUrl: vehicle.driverLicenseUrl,
        vehicleRoadLicenseUrl: vehicle.vehicleRoadLicenseUrl,
        plateNumberUrl: vehicle.plateNumberUrl,
        plateNumber: vehicle.plateNumber,
        documentType: vehicle.documentType,
        submittedAt: vehicle.createdAt,
        rejectionReason: vehicle.rejectionReason,
        verified: vehicle.verified,
        verifiedAt: vehicle.verifiedAt,
        verifiedById: vehicle.verifiedById,
        urlStatuses: vehicle.urlStatuses as UrlStatuses | null,
      },
      'Vehicle resubmitted successfully',
      200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in resubmitVehicle`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      files: req.files ? Object.keys(req.files) : null,
      headers: req.headers,
    });
    next(error);
  }
}

async checkBusinessVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    const result = await complianceDocumentService.checkBusinessVerificationStatus(req.user.id);

    type BusinessVerificationStatusResponse = {
      status: string;
      message: string;
      verifications?: Array<BusinessVerificationResponse>;
    };

    const responseData: BusinessVerificationStatusResponse = {
      status: Array.isArray(result) && result.length > 0 ? 'SUBMITTED' : 'NOT_SUBMITTED',
      message: Array.isArray(result) ? 'Business verification status retrieved' : result.message,
    };

    if (Array.isArray(result)) {
      responseData.verifications = result.map((verification) => ({
        id: verification.id,
        status: verification.status,
        businessName: verification.businessName,
        rcNumber: verification.rcNumber,
        businessAddress: verification.businessAddress,
        tinNumber: verification.tinNumber,
        cacDocumentUrl: verification.cacDocumentUrl,
        proofOfAddressUrl: verification.proofOfAddressUrl,
        tinDocumentUrl: verification.tinDocumentUrl,
        logoUrl: verification.logoUrl,
        handles: verification.handles,
        documentType: verification.documentType,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt,
        rejectionReason: verification.rejectionReason,
        urlStatuses: verification.urlStatuses, // Directly use urlStatuses (now typed as UrlStatuses | null)
      }));
    }

    logger.info(`[${requestId}] Business verification status retrieved`, {
      userId: req.user.id,
      status: responseData.status,
    });

    successResponse(res, responseData, 'Business verification status retrieved successfully');
  } catch (error) {
    logger.error(`[${requestId}] Error in checkBusinessVerificationStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      headers: req.headers,
    });
    next(error);
  }
}

async checkLicenseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    const result = await complianceDocumentService.checkLicenseStatus(req.user.id);

    const responseData = Array.isArray(result)
      ? result.map((item) => ({
          id: item.id,
          status: item.status,
          licenseType: item.licenseType,
          licenseNumber: item.licenseNumber,
          issuedBy: item.issuedBy,
          issuedDate: item.issuedDate,
          expiryDate: item.expiryDate,
          documentUrl: item.documentUrl,
          documentBackUrl: item.documentBackUrl,
          documentType: item.documentType,
          submittedAt: item.submittedAt,
          verifiedAt: item.verifiedAt,
          rejectionReason: item.rejectionReason,
          verified: item.verified,
          verifiedById: item.verifiedById,
          urlStatuses: item.urlStatuses, // Directly use urlStatuses (now typed as UrlStatuses | null)
        }))
      : result;

    logger.info(`[${requestId}] License status retrieved`, {
      userId: req.user.id,
      licenses: Array.isArray(result) ? result.map((item) => item.id) : result.status,
    });

    successResponse(res, responseData, 'License verification status retrieved successfully');
  } catch (error) {
    logger.error(`[${requestId}] Error in checkLicenseStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      headers: req.headers,
    });
    next(error);
  }
}

async checkVehicleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    const result = await complianceDocumentService.checkVehicleStatus(req.user.id);

    const responseData = Array.isArray(result)
      ? result.map((item) => ({
          id: item.id,
          status: item.status,
          driverLicenseUrl: item.driverLicenseUrl,
          vehicleRoadLicenseUrl: item.vehicleRoadLicenseUrl,
          plateNumberUrl: item.plateNumberUrl,
          plateNumber: item.plateNumber,
          documentType: item.documentType,
          submittedAt: item.submittedAt,
          verifiedAt: item.verifiedAt,
          rejectionReason: item.rejectionReason,
          verified: item.verified,
          verifiedById: item.verifiedById,
          urlStatuses: item.urlStatuses, // Directly use urlStatuses (now typed as UrlStatuses | null)
        }))
      : result;

    logger.info(`[${requestId}] Vehicle status retrieved`, {
      userId: req.user.id,
      vehicles: Array.isArray(result) ? result.map((item) => item.id) : result.status,
    });

    successResponse(res, responseData, 'Vehicle verification status retrieved successfully');
  } catch (error) {
    logger.error(`[${requestId}] Error in checkVehicleStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      headers: req.headers,
    });
    next(error);
  }
}

async updateBusinessVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    if (!req.user.isAdmin) {
      throw ApiError.unauthorized('Admin permission required', ErrorCodes.UNAUTHORIZED_ADMIN);
    }

    // Validate required fields
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      logger.error(`[${requestId}] Updates must be a non-empty array`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest('Updates must be a non-empty array', ErrorCodes.BAD_REQUEST);
    }

    const missingFields: string[] = [];
    const invalidStatuses: string[] = [];
    const invalidIds: string[] = [];
    const missingRejectionReasons: string[] = [];
    const invalidUrlFields: string[] = [];
    const invalidStatusCombinations: string[] = [];

    // Validate each update object
    updates.forEach((update: any, index: number) => {
      if (!update.id) missingFields.push(`updates[${index}].id`);
      if (!update.verificationStatus) missingFields.push(`updates[${index}].verificationStatus`);
      if (
        update.verificationStatus &&
        !Object.values(VerificationStatus).includes(update.verificationStatus)
      ) {
        invalidStatuses.push(`updates[${index}].verificationStatus: ${update.verificationStatus}`);
      }
      if (
        update.id &&
        !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          update.id
        )
      ) {
        invalidIds.push(`updates[${index}].id: ${update.id}`);
      }
      if (
        update.verificationStatus === VerificationStatus.REJECTED &&
        !update.rejectionReason
      ) {
        missingRejectionReasons.push(
          `updates[${index}].rejectionReason: Required when verificationStatus is REJECTED`
        );
      }

      // Validate URLs object and check for status combinations
      if (update.urls) {
        const validUrlFields = ['cacDocumentUrl', 'proofOfAddressUrl', 'tinDocumentUrl'];
        const urlKeys = Object.keys(update.urls);
        urlKeys.forEach((key) => {
          if (!validUrlFields.includes(key)) {
            invalidUrlFields.push(`updates[${index}].urls.${key}: Invalid URL field`);
          } else {
            if (
              !update.urls[key].status ||
              !Object.values(VerificationStatus).includes(update.urls[key].status)
            ) {
              invalidStatuses.push(`updates[${index}].urls.${key}.status: ${update.urls[key].status}`);
            }
            if (
              update.urls[key].status === VerificationStatus.REJECTED &&
              !update.urls[key].rejectionReason
            ) {
              missingRejectionReasons.push(
                `updates[${index}].urls.${key}.rejectionReason: Required when status is REJECTED`
              );
            }
          }
        });

        // Validate status combinations
        const urlStatuses = Object.values(update.urls || {}).map((u: any) => u.status);
        if (
          update.verificationStatus === VerificationStatus.REJECTED &&
          urlStatuses.includes(VerificationStatus.APPROVED) &&
          urlStatuses.includes(VerificationStatus.REJECTED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to REJECTED when URLs have mixed APPROVED and REJECTED statuses; use INCOMPLETE`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.INCOMPLETE &&
          !(urlStatuses.includes(VerificationStatus.APPROVED) && urlStatuses.includes(VerificationStatus.REJECTED))
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: verificationStatus INCOMPLETE requires a mix of APPROVED and REJECTED document statuses`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.APPROVED &&
          !urlStatuses.every((s: VerificationStatus) => s === VerificationStatus.APPROVED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to APPROVED unless all URLs are APPROVED`
          );
        }
      } else if (
        update.verificationStatus === VerificationStatus.INCOMPLETE
      ) {
        invalidStatusCombinations.push(
          `updates[${index}]: verificationStatus INCOMPLETE requires a urls object with a mix of APPROVED and REJECTED statuses`
        );
      }
    });

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required body fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (invalidStatuses.length > 0) {
      logger.error(`[${requestId}] Invalid verification statuses`, {
        userId: req.user.id,
        invalidStatuses,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid verificationStatus values: ${invalidStatuses.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatuses }
      );
    }

    if (invalidIds.length > 0) {
      logger.error(`[${requestId}] Invalid UUIDs`, {
        userId: req.user.id,
        invalidIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid UUIDs: ${invalidIds.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidIds }
      );
    }

    if (missingRejectionReasons.length > 0) {
      logger.error(`[${requestId}] Missing rejection reasons`, {
        userId: req.user.id,
        missingRejectionReasons,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing rejection reasons: ${missingRejectionReasons.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingRejectionReasons }
      );
    }

    if (invalidUrlFields.length > 0) {
      logger.error(`[${requestId}] Invalid URL fields`, {
        userId: req.user.id,
        invalidUrlFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid URL fields: ${invalidUrlFields.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidUrlFields }
      );
    }

    if (invalidStatusCombinations.length > 0) {
      logger.error(`[${requestId}] Invalid status combinations`, {
        userId: req.user.id,
        invalidStatusCombinations,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid status combinations: ${invalidStatusCombinations.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatusCombinations }
      );
    }

    // Pre-check if verification records exist
    const verificationIds = updates.map((update: any) => update.id);
    const existingVerifications = await prismaClient.businessVerification.findMany({
      where: { id: { in: verificationIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingVerifications.map((v: { id: string }) => v.id));
    const nonExistentIds = verificationIds.filter((id: string) => !existingIds.has(id));

    if (nonExistentIds.length > 0) {
      logger.error(`[${requestId}] Some business verification IDs do not exist`, {
        userId: req.user.id,
        nonExistentIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Business verification IDs not found: ${nonExistentIds.join(', ')}`,
        ErrorCodes.NOT_FOUND,
        { nonExistentIds }
      );
    }

    // Process updates in batches
    const results: BusinessVerificationResponse[] = [];
    const errors: { id: string; error: string; details?: string }[] = [];

    for (const update of updates) {
      try {
        const result = await complianceDocumentService.updateBusinessVerificationStatus(
          update.id,
          update.verificationStatus,
          req.user.id,
          update.rejectionReason,
          update.urls,
          req
        );
        results.push({
          id: result.id,
          status: result.status,
          businessName: result.businessName,
          rcNumber: result.rcNumber,
          businessAddress: result.businessAddress,
          tinNumber: result.tinNumber,
          cacDocumentUrl: result.cacDocumentUrl,
          proofOfAddressUrl: result.proofOfAddressUrl,
          tinDocumentUrl: result.tinDocumentUrl,
          logoUrl: result.logoUrl,
          handles: result.handles,
          documentType: result.documentType,
          submittedAt: result.submittedAt,
          processedAt: result.processedAt,
          rejectionReason: result.rejectionReason,
          urlStatuses: result.urlStatuses, // Include urlStatuses
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error updating business verification';
        const errorDetails = error.details || errorMessage;
        logger.error(`[${requestId}] Error updating business verification for ID ${update.id}`, {
          error: errorMessage,
          details: errorDetails,
          stack: error.stack,
          userId: req.user.id,
          update,
        });
        errors.push({ id: update.id, error: errorMessage, details: errorDetails });
      }
    }

    logger.info(`[${requestId}] Batch business verification status updated`, {
      userId: req.user.id,
      updatedCount: results.length,
      errorCount: errors.length,
    });

    successResponse(
      res,
      { results, errors },
      `Processed ${updates.length} business verification updates: ${results.length} successful, ${errors.length} failed`,
      errors.length > 0 ? 207 : 200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in updateBusinessVerificationStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      headers: req.headers,
    });
    next(error);
  }
}

async updateLicenseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    if (!req.user.isAdmin) {
      throw ApiError.unauthorized('Admin permission required', ErrorCodes.UNAUTHORIZED_ADMIN);
    }

    // Validate required fields
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      logger.error(`[${requestId}] Updates must be a non-empty array`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest('Updates must be a non-empty array', ErrorCodes.BAD_REQUEST);
    }

    const missingFields: string[] = [];
    const invalidStatuses: string[] = [];
    const invalidIds: string[] = [];
    const missingRejectionReasons: string[] = [];
    const invalidUrlFields: string[] = [];
    const invalidStatusCombinations: string[] = [];

    // Validate each update object
    updates.forEach((update: any, index: number) => {
      if (!update.id) missingFields.push(`updates[${index}].id`);
      if (!update.verificationStatus) missingFields.push(`updates[${index}].verificationStatus`);
      if (
        update.verificationStatus &&
        !Object.values(VerificationStatus).includes(update.verificationStatus)
      ) {
        invalidStatuses.push(`updates[${index}].verificationStatus: ${update.verificationStatus}`);
      }
      if (
        update.id &&
        !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          update.id
        )
      ) {
        invalidIds.push(`updates[${index}].id: ${update.id}`);
      }
      if (
        update.verificationStatus === VerificationStatus.REJECTED &&
        !update.rejectionReason
      ) {
        missingRejectionReasons.push(
          `updates[${index}].rejectionReason: Required when verificationStatus is REJECTED`
        );
      }

      // Validate URLs object and check for status combinations
      if (update.urls) {
        const validUrlFields = ['documentUrl', 'documentBackUrl'];
        const urlKeys = Object.keys(update.urls);
        urlKeys.forEach((key) => {
          if (!validUrlFields.includes(key)) {
            invalidUrlFields.push(`updates[${index}].urls.${key}: Invalid URL field`);
          } else {
            if (
              !update.urls[key].status ||
              !Object.values(VerificationStatus).includes(update.urls[key].status)
            ) {
              invalidStatuses.push(`updates[${index}].urls.${key}.status: ${update.urls[key].status}`);
            }
            if (
              update.urls[key].status === VerificationStatus.REJECTED &&
              !update.urls[key].rejectionReason
            ) {
              missingRejectionReasons.push(
                `updates[${index}].urls.${key}.rejectionReason: Required when status is REJECTED`
              );
            }
          }
        });

        // Validate status combinations
        const urlStatuses = Object.values(update.urls || {}).map((u: any) => u.status);
        if (
          update.verificationStatus === VerificationStatus.REJECTED &&
          urlStatuses.includes(VerificationStatus.APPROVED) &&
          urlStatuses.includes(VerificationStatus.REJECTED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to REJECTED when URLs have mixed APPROVED and REJECTED statuses; use INCOMPLETE`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.INCOMPLETE &&
          !(urlStatuses.includes(VerificationStatus.APPROVED) && urlStatuses.includes(VerificationStatus.REJECTED))
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: verificationStatus INCOMPLETE requires a mix of APPROVED and REJECTED document statuses`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.APPROVED &&
          !urlStatuses.every((s: VerificationStatus) => s === VerificationStatus.APPROVED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to APPROVED unless all URLs are APPROVED`
          );
        }
      } else if (
        update.verificationStatus === VerificationStatus.INCOMPLETE
      ) {
        invalidStatusCombinations.push(
          `updates[${index}]: verificationStatus INCOMPLETE requires a urls object with a mix of APPROVED and REJECTED statuses`
        );
      }
    });

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required body fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (invalidStatuses.length > 0) {
      logger.error(`[${requestId}] Invalid verification statuses`, {
        userId: req.user.id,
        invalidStatuses,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid verificationStatus values: ${invalidStatuses.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatuses }
      );
    }

    if (invalidIds.length > 0) {
      logger.error(`[${requestId}] Invalid UUIDs`, {
        userId: req.user.id,
        invalidIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid UUIDs: ${invalidIds.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidIds }
      );
    }

    if (missingRejectionReasons.length > 0) {
      logger.error(`[${requestId}] Missing rejection reasons`, {
        userId: req.user.id,
        missingRejectionReasons,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing rejection reasons: ${missingRejectionReasons.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingRejectionReasons }
      );
    }

    if (invalidUrlFields.length > 0) {
      logger.error(`[${requestId}] Invalid URL fields`, {
        userId: req.user.id,
        invalidUrlFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid URL fields: ${invalidUrlFields.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidUrlFields }
      );
    }

    if (invalidStatusCombinations.length > 0) {
      logger.error(`[${requestId}] Invalid status combinations`, {
        userId: req.user.id,
        invalidStatusCombinations,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid status combinations: ${invalidStatusCombinations.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatusCombinations }
      );
    }

    // Pre-check if license records exist
    const licenseIds = updates.map((update: any) => update.id);
    const existingLicenses = await prismaClient.license.findMany({
      where: { id: { in: licenseIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingLicenses.map((v: { id: string }) => v.id));
    const nonExistentIds = licenseIds.filter((id: string) => !existingIds.has(id));

    if (nonExistentIds.length > 0) {
      logger.error(`[${requestId}] Some license IDs do not exist`, {
        userId: req.user.id,
        nonExistentIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `License IDs not found: ${nonExistentIds.join(', ')}`,
        ErrorCodes.NOT_FOUND,
        { nonExistentIds }
      );
    }

    // Process updates in batches
    const results: LicenseResponse[] = [];
    const errors: { id: string; error: string; details?: string }[] = [];

    for (const update of updates) {
      try {
        const result = await complianceDocumentService.updateLicenseStatus(
          update.id,
          update.verificationStatus,
          req.user.id,
          update.rejectionReason,
          update.urls,
          req
        );
        results.push({
          id: result.id,
          status: result.status,
          licenseType: result.licenseType,
          licenseNumber: result.licenseNumber,
          issuedBy: result.issuedBy,
          issuedDate: result.issuedDate,
          expiryDate: result.expiryDate,
          documentUrl: result.documentUrl,
          documentBackUrl: result.documentBackUrl,
          documentType: result.documentType,
          submittedAt: result.createdAt,
          rejectionReason: result.rejectionReason,
          verified: result.verified,
          verifiedAt: result.verifiedAt,
          verifiedById: result.verifiedById,
          urlStatuses: result.urlStatuses, // Include urlStatuses
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error updating license';
        const errorDetails = error.details || errorMessage;
        logger.error(`[${requestId}] Error updating license for ID ${update.id}`, {
          error: errorMessage,
          details: errorDetails,
          stack: error.stack,
          userId: req.user.id,
          update,
        });
        errors.push({ id: update.id, error: errorMessage, details: errorDetails });
      }
    }

    logger.info(`[${requestId}] Batch license status updated`, {
      userId: req.user.id,
      updatedCount: results.length,
      errorCount: errors.length,
    });

    successResponse(
      res,
      { results, errors },
      `Processed ${updates.length} license updates: ${results.length} successful, ${errors.length} failed`,
      errors.length > 0 ? 207 : 200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in updateLicenseStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      headers: req.headers,
    });
    next(error);
  }
}

async updateVehicleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    if (!req.user.isAdmin) {
      throw ApiError.unauthorized('Admin permission required', ErrorCodes.UNAUTHORIZED_ADMIN);
    }

    // Validate required fields
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      logger.error(`[${requestId}] Updates must be a non-empty array`, {
        userId: req.user.id,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest('Updates must be a non-empty array', ErrorCodes.BAD_REQUEST);
    }

    const missingFields: string[] = [];
    const invalidStatuses: string[] = [];
    const invalidIds: string[] = [];
    const missingRejectionReasons: string[] = [];
    const invalidUrlFields: string[] = [];
    const invalidStatusCombinations: string[] = [];

    // Validate each update object
    updates.forEach((update: any, index: number) => {
      if (!update.id) missingFields.push(`updates[${index}].id`);
      if (!update.verificationStatus) missingFields.push(`updates[${index}].verificationStatus`);
      if (
        update.verificationStatus &&
        !Object.values(VerificationStatus).includes(update.verificationStatus)
      ) {
        invalidStatuses.push(`updates[${index}].verificationStatus: ${update.verificationStatus}`);
      }
      if (
        update.id &&
        !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          update.id
        )
      ) {
        invalidIds.push(`updates[${index}].id: ${update.id}`);
      }
      if (
        update.verificationStatus === VerificationStatus.REJECTED &&
        !update.rejectionReason
      ) {
        missingRejectionReasons.push(
          `updates[${index}].rejectionReason: Required when verificationStatus is REJECTED`
        );
      }

      // Validate URLs object and check for status combinations
      if (update.urls) {
        const validUrlFields = ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl'];
        const urlKeys = Object.keys(update.urls);
        urlKeys.forEach((key) => {
          if (!validUrlFields.includes(key)) {
            invalidUrlFields.push(`updates[${index}].urls.${key}: Invalid URL field`);
          } else {
            if (
              !update.urls[key].status ||
              !Object.values(VerificationStatus).includes(update.urls[key].status)
            ) {
              invalidStatuses.push(`updates[${index}].urls.${key}.status: ${update.urls[key].status}`);
            }
            if (
              update.urls[key].status === VerificationStatus.REJECTED &&
              !update.urls[key].rejectionReason
            ) {
              missingRejectionReasons.push(
                `updates[${index}].urls.${key}.rejectionReason: Required when status is REJECTED`
              );
            }
          }
        });

        // Validate status combinations
        const urlStatuses = Object.values(update.urls || {}).map((u: any) => u.status);
        if (
          update.verificationStatus === VerificationStatus.REJECTED &&
          urlStatuses.includes(VerificationStatus.APPROVED) &&
          urlStatuses.includes(VerificationStatus.REJECTED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to REJECTED when URLs have mixed APPROVED and REJECTED statuses; use INCOMPLETE`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.INCOMPLETE &&
          !(urlStatuses.includes(VerificationStatus.APPROVED) && urlStatuses.includes(VerificationStatus.REJECTED))
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: verificationStatus INCOMPLETE requires a mix of APPROVED and REJECTED document statuses`
          );
        }
        if (
          update.verificationStatus === VerificationStatus.APPROVED &&
          !urlStatuses.every((s: VerificationStatus) => s === VerificationStatus.APPROVED)
        ) {
          invalidStatusCombinations.push(
            `updates[${index}]: Cannot set verificationStatus to APPROVED unless all URLs are APPROVED`
          );
        }
      } else if (
        update.verificationStatus === VerificationStatus.INCOMPLETE
      ) {
        invalidStatusCombinations.push(
          `updates[${index}]: verificationStatus INCOMPLETE requires a urls object with a mix of APPROVED and REJECTED statuses`
        );
      }
    });

    if (missingFields.length > 0) {
      logger.error(`[${requestId}] Missing required body fields`, {
        userId: req.user.id,
        missingFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingFields }
      );
    }

    if (invalidStatuses.length > 0) {
      logger.error(`[${requestId}] Invalid verification statuses`, {
        userId: req.user.id,
        invalidStatuses,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid verificationStatus values: ${invalidStatuses.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatuses }
      );
    }

    if (invalidIds.length > 0) {
      logger.error(`[${requestId}] Invalid UUIDs`, {
        userId: req.user.id,
        invalidIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid UUIDs: ${invalidIds.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidIds }
      );
    }

    if (missingRejectionReasons.length > 0) {
      logger.error(`[${requestId}] Missing rejection reasons`, {
        userId: req.user.id,
        missingRejectionReasons,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Missing rejection reasons: ${missingRejectionReasons.join(', ')}`,
        ErrorCodes.MISSING_FIELDS,
        { missingRejectionReasons }
      );
    }

    if (invalidUrlFields.length > 0) {
      logger.error(`[${requestId}] Invalid URL fields`, {
        userId: req.user.id,
        invalidUrlFields,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid URL fields: ${invalidUrlFields.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidUrlFields }
      );
    }

    if (invalidStatusCombinations.length > 0) {
      logger.error(`[${requestId}] Invalid status combinations`, {
        userId: req.user.id,
        invalidStatusCombinations,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Invalid status combinations: ${invalidStatusCombinations.join(', ')}`,
        ErrorCodes.BAD_REQUEST,
        { invalidStatusCombinations }
      );
    }

    // Pre-check if vehicle records exist
    const vehicleIds = updates.map((update: any) => update.id);
    const existingVehicles = await prismaClient.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingVehicles.map((v: { id: string }) => v.id));
    const nonExistentIds = vehicleIds.filter((id: string) => !existingIds.has(id));

    if (nonExistentIds.length > 0) {
      logger.error(`[${requestId}] Some vehicle IDs do not exist`, {
        userId: req.user.id,
        nonExistentIds,
        body: req.body,
        headers: req.headers,
      });
      throw ApiError.badRequest(
        `Vehicle IDs not found: ${nonExistentIds.join(', ')}`,
        ErrorCodes.NOT_FOUND,
        { nonExistentIds }
      );
    }

    // Process updates in batches
    const results: VehicleResponse[] = [];
    const errors: { id: string; error: string; details?: string }[] = [];

    for (const update of updates) {
      try {
        const result = await complianceDocumentService.updateVehicleStatus(
          update.id,
          update.verificationStatus,
          req.user.id,
          update.rejectionReason,
          update.urls,
          req
        );
        results.push({
          id: result.id,
          status: result.status,
          driverLicenseUrl: result.driverLicenseUrl,
          vehicleRoadLicenseUrl: result.vehicleRoadLicenseUrl,
          plateNumberUrl: result.plateNumberUrl,
          plateNumber: result.plateNumber,
          documentType: result.documentType,
          submittedAt: result.createdAt,
          rejectionReason: result.rejectionReason,
          verified: result.verified,
          verifiedAt: result.verifiedAt,
          verifiedById: result.verifiedById,
          urlStatuses: result.urlStatuses, // Include urlStatuses
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error updating vehicle';
        const errorDetails = error.details || errorMessage;
        logger.error(`[${requestId}] Error updating vehicle for ID ${update.id}`, {
          error: errorMessage,
          details: errorDetails,
          stack: error.stack,
          userId: req.user.id,
          update,
        });
        errors.push({ id: update.id, error: errorMessage, details: errorDetails });
      }
    }

    logger.info(`[${requestId}] Batch vehicle status updated`, {
      userId: req.user.id,
      updatedCount: results.length,
      errorCount: errors.length,
    });

    successResponse(
      res,
      { results, errors },
      `Processed ${updates.length} vehicle verification updates: ${results.length} successful, ${errors.length} failed`,
      errors.length > 0 ? 207 : 200
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in updateVehicleStatus`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      body: req.body,
      headers: req.headers,
    });
    next(error);
  }
}
  
}