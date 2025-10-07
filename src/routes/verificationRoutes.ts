import { Router, Request, Response, NextFunction } from 'express';
import { ComplianceDocumentController } from '../controllers/ComplianceDocumentController';
import { authorize } from '../middlewares/permissions';
import { authenticationMiddleware } from '../middlewares/authentication';
import { validateRequest } from '../middlewares/validateRequest';
import multer from 'multer';
import { asyncHandler, AsyncRequestHandler } from '../utils/asyncHandler';
import {
  businessVerificationSchema,
  licenseSchema,
  vehicleSchema,
  updateVerificationStatusSchema,
  resubmitBusinessVerificationSchema,
  resubmitLicenseSchema,
  resubmitVehicleSchema,
} from '../schemas/compliance.schema';
import { successResponse } from '../config/responseFormatter';
import { ApiError } from '../lib/utils/errors/appError';
import { ErrorCodes } from '../errors/errorCodes';
import logger from '../config/logger';
import { randomUUID } from 'crypto';
import { DocumentType } from '@prisma/client';
import { isValidUrl } from '../lib/utils/urlUtils';
// Align RequestUser with AuthUser from authenticationMiddleware
interface RequestUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

interface CustomRequest extends Request {
  user?: RequestUser;
}

const complianceDocumentController = new ComplianceDocumentController();
const upload = multer({ dest: 'uploads/' });

// Middleware to validate file uploads for direct multipart/form-data submissions
const validateFileUploads = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    try {
      if (!req.files) {
        logger.error(`[${requestId}] No files uploaded in request`, {
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `No files uploaded. Required: ${requiredFields.join(', ')}`,
          ErrorCodes.MISSING_REQUIRED_FIELDS,
          { body: req.body, headers: req.headers }
        );
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (!files[field] || !files[field][0]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        logger.error(`[${requestId}] Missing required file uploads`, {
          missingFields,
          uploadedFiles: Object.keys(files),
          body: req.body,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required file uploads: ${missingFields.join(', ')}`,
          ErrorCodes.MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS,
          {
            missingFields,
            uploadedFiles: Object.keys(files),
            body: req.body,
            headers: req.headers,
          }
        );
      }

      logger.info(`[${requestId}] File uploads validated successfully`, {
        uploadedFiles: Object.keys(files),
      });
      next();
    } catch (error) {
      logger.error(`[${requestId}] Error in validateFileUploads`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        headers: req.headers,
      });
      next(error);
    }
  };
};

// Middleware to conditionally validate file uploads for resubmission routes
const conditionalValidateFileUploads = (requiredFields: string[], urlFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    try {
      // Check if the request is JSON with file URLs (API Gateway)
      const isJsonRequest = req.headers['content-type']?.includes('application/json');
      const providedUrls = urlFields.filter((field) => req.body[field] && typeof req.body[field] === 'string');

      if (isJsonRequest && providedUrls.length > 0) {
        // Validate provided URLs
        const invalidUrls = providedUrls.filter((field) => !isValidUrl(req.body[field]));
        if (invalidUrls.length > 0) {
          logger.error(`[${requestId}] Invalid file URLs provided`, {
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
        logger.info(`[${requestId}] Valid JSON request with file URLs`, {
          providedUrls,
          body: req.body,
          headers: req.headers,
        });
        next();
      } else {
        // Handle multipart/form-data requests
        logger.info(`[${requestId}] Processing multipart/form-data request, validating provided file uploads`, {
          body: req.body,
          headers: req.headers,
        });
        if (!req.files) {
          logger.info(`[${requestId}] No files uploaded, proceeding with body data`, {
            body: req.body,
            headers: req.headers,
          });
          next();
          return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const providedFields = requiredFields.filter((field) => files[field]?.[0]);
        const invalidFields = providedFields.filter((field) => !files[field]?.[0]?.path);

        if (invalidFields.length > 0) {
          logger.error(`[${requestId}] Invalid file uploads provided`, {
            invalidFields,
            uploadedFiles: Object.keys(files),
            body: req.body,
            headers: req.headers,
          });
          throw ApiError.badRequest(
            `Invalid file uploads: ${invalidFields.join(', ')}`,
            ErrorCodes.MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS,
            { invalidFields, uploadedFiles: Object.keys(files) }
          );
        }

        logger.info(`[${requestId}] File uploads validated successfully`, {
          uploadedFiles: Object.keys(files),
        });
        next();
      }
    } catch (error) {
      logger.error(`[${requestId}] Error in conditionalValidateFileUploads`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        headers: req.headers,
      });
      next(error);
    }
  };
};

const verificationRoute = Router();

// Proxy routes for API Gateway
verificationRoute.post(
  '/compliance/business-verification-from-gateway',
  authorize(['VENDOR']),
  asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = randomUUID();
    try {
      const data = req.body;
      // Validate required fields for business verification
      const missingFields = [];
      if (!data.tinDocumentUrl) missingFields.push('tinDocumentUrl');
      if (!data.tinNumber) missingFields.push('tinNumber');
      if (!data.cacDocumentUrl) missingFields.push('cacDocumentUrl');
      if (!data.proofOfAddressUrl) missingFields.push('proofOfAddressUrl');
      if (!data.businessName) missingFields.push('businessName');
      if (!data.rcNumber) missingFields.push('rcNumber');
      if (!data.businessAddress) missingFields.push('businessAddress');
      if (!data.documentType) missingFields.push('documentType');

      if (missingFields.length > 0) {
        logger.error(`[${requestId}] Missing required fields in gateway submission`, {
          body: data,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required fields: ${missingFields.join(', ')}`,
          ErrorCodes.MISSING_FIELDS,
          { body: data, headers: req.headers }
        );
      }

      // Validate documentType
      try {
        if (!Object.values(DocumentType).includes(data.documentType)) {
          logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, {
            body: data,
            headers: req.headers,
          });
          throw ApiError.badRequest(
            `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
            ErrorCodes.BAD_REQUEST
          );
        }
      } catch (enumError) {
        logger.error(`[${requestId}] Error accessing DocumentType enum`, {
          error: enumError instanceof Error ? enumError.message : 'Unknown error',
          body: data,
          headers: req.headers,
        });
        throw ApiError.internal('DocumentType validation failed', ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      const result = await complianceDocumentController.handleBusinessSubmissionFromGateway(data);
      logger.info(`[${requestId}] Business verification submitted via gateway`, {
        userId: data.userId,
        documentId: data.documentId,
        documentType: data.documentType,
      });
      successResponse(res, result, 'Business verification submitted successfully from gateway', 201);
    } catch (error) {
      logger.error(`[${requestId}] Error in business-verification-from-gateway`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        headers: req.headers,
      });
      next(error);
    }
  })
);

verificationRoute.post(
  '/compliance/licenses-from-gateway',
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = randomUUID();
    try {
      const data = req.body;
      // Validate required fields for license submission
      const missingFields = [];
      if (!data.backImageUrl) missingFields.push('backImageUrl');
      if (!data.issuedBy) missingFields.push('issuedBy');
      if (!data.issuedDate) missingFields.push('issuedDate');
      if (!data.expiryDate) missingFields.push('expiryDate');
      if (!data.frontImageUrl) missingFields.push('frontImageUrl');
      if (!data.licenseType) missingFields.push('licenseType');
      if (!data.licenseNumber) missingFields.push('licenseNumber');
      if (!data.documentType) missingFields.push('documentType');

      if (missingFields.length > 0) {
        logger.error(`[${requestId}] Missing required fields in gateway submission`, {
          body: data,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required fields: ${missingFields.join(', ')}`,
          ErrorCodes.MISSING_FIELDS,
          { body: data, headers: req.headers }
        );
      }

      // Validate documentType
      try {
        if (!Object.values(DocumentType).includes(data.documentType)) {
          logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, {
            body: data,
            headers: req.headers,
          });
          throw ApiError.badRequest(
            `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
            ErrorCodes.BAD_REQUEST
          );
        }
      } catch (enumError) {
        logger.error(`[${requestId}] Error accessing DocumentType enum`, {
          error: enumError instanceof Error ? enumError.message : 'Unknown error',
          body: data,
          headers: req.headers,
        });
        throw ApiError.internal('DocumentType validation failed', ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      const result = await complianceDocumentController.handleLicenseSubmissionFromGateway(data);
      logger.info(`[${requestId}] License submitted via gateway`, {
        userId: data.userId,
        documentId: data.documentId,
        documentType: data.documentType,
      });
      successResponse(res, result, 'License submitted successfully from gateway', 201);
    } catch (error) {
      logger.error(`[${requestId}] Error in licenses-from-gateway`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        headers: req.headers,
      });
      next(error);
    }
  })
);

verificationRoute.post(
  '/compliance/vehicles-from-gateway',
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = randomUUID();
    try {
      const data = req.body;
      // Validate required fields for vehicle submission
      const missingFields = [];
      if (!data.plateNumber) missingFields.push('plateNumber');
      if (!data.driverLicenseUrl) missingFields.push('driverLicenseUrl');
      if (!data.vehicleRoadLicenseUrl) missingFields.push('vehicleRoadLicenseUrl');
      if (!data.plateNumberUrl) missingFields.push('plateNumberUrl');
      if (!data.documentType) missingFields.push('documentType');

      if (missingFields.length > 0) {
        logger.error(`[${requestId}] Missing required fields in gateway submission`, {
          body: data,
          headers: req.headers,
        });
        throw ApiError.badRequest(
          `Missing required fields: ${missingFields.join(', ')}`,
          ErrorCodes.MISSING_FIELDS,
          { body: data, headers: req.headers }
        );
      }

      // Validate documentType
      try {
        if (!Object.values(DocumentType).includes(data.documentType)) {
          logger.error(`[${requestId}] Invalid documentType: ${data.documentType}`, {
            body: data,
            headers: req.headers,
          });
          throw ApiError.badRequest(
            `Invalid documentType: must be one of ${Object.values(DocumentType).join(', ')}`,
            ErrorCodes.BAD_REQUEST
          );
        }
      } catch (enumError) {
        logger.error(`[${requestId}] Error accessing DocumentType enum`, {
          error: enumError instanceof Error ? enumError.message : 'Unknown error',
          body: data,
          headers: req.headers,
        });
        throw ApiError.internal('DocumentType validation failed', ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      const result = await complianceDocumentController.handleVehicleSubmissionFromGateway(data);
      logger.info(`[${requestId}] Vehicle submitted via gateway`, {
        userId: data.userId,
        documentId: data.documentId,
        documentType: data.documentType,
      });
      successResponse(res, result, 'Vehicle submitted successfully from gateway', 201);
    } catch (error) {
      logger.error(`[${requestId}] Error in vehicles-from-gateway`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        headers: req.headers,
      });
      next(error);
    }
  })
);

// Authenticated routes for compliance documents
verificationRoute.post(
  '/compliance/business-verification',
  authenticationMiddleware,
  authorize(['VENDOR']),
  upload.fields([
    { name: 'cacDocument', maxCount: 1 },
    { name: 'tinDocument', maxCount: 1 },
    { name: 'proofOfAddress', maxCount: 1 },
    { name: 'businessLogo', maxCount: 1 },
  ]),
  validateFileUploads(['cacDocument', 'tinDocument', 'proofOfAddress']),
  validateRequest(businessVerificationSchema),
  asyncHandler(complianceDocumentController.submitBusinessVerification.bind(complianceDocumentController) as AsyncRequestHandler)
);



verificationRoute.post(
  '/compliance/business-verification/resubmit',
  authenticationMiddleware,
  authorize(['VENDOR']),
  upload.fields([
    { name: 'cacDocument', maxCount: 1 },
    { name: 'tinDocument', maxCount: 1 },
    { name: 'proofOfAddress', maxCount: 1 },
    { name: 'businessLogo', maxCount: 1 },
  ]),
  conditionalValidateFileUploads(
    ['cacDocument', 'tinDocument', 'proofOfAddress'],
    ['cacDocumentUrl', 'tinDocumentUrl', 'proofOfAddressUrl']
  ),
  validateRequest(resubmitBusinessVerificationSchema),
  asyncHandler(complianceDocumentController.resubmitBusinessVerification.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.post(
  '/compliance/licenses',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ]),
  validateFileUploads(['frontImage', 'backImage']),
  validateRequest(licenseSchema),
  asyncHandler(complianceDocumentController.submitLicense.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.post(
  '/compliance/licenses/resubmit',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ]),
  conditionalValidateFileUploads(['frontImage', 'backImage'], ['frontImageUrl', 'backImageUrl']),
  validateRequest(resubmitLicenseSchema),
  asyncHandler(complianceDocumentController.resubmitLicense.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.post(
  '/compliance/vehicles',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  upload.fields([
    { name: 'driverLicense', maxCount: 1 },
    { name: 'vehicleRoadLicense', maxCount: 1 },
    { name: 'plateNumberDoc', maxCount: 1 },
  ]),
  conditionalValidateFileUploads(
    ['driverLicense', 'vehicleRoadLicense', 'plateNumberDoc'],
    ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl']
  ),
  validateRequest(vehicleSchema),
  asyncHandler(complianceDocumentController.submitVehicle.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.post(
  '/compliance/vehicles/resubmit',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  upload.fields([
    { name: 'driverLicense', maxCount: 1 },
    { name: 'vehicleRoadLicense', maxCount: 1 },
    { name: 'plateNumberDoc', maxCount: 1 },
  ]),
  conditionalValidateFileUploads(
    ['driverLicense', 'vehicleRoadLicense', 'plateNumberDoc'],
    ['driverLicenseUrl', 'vehicleRoadLicenseUrl', 'plateNumberUrl']
  ),
  validateRequest(resubmitVehicleSchema),
  asyncHandler(complianceDocumentController.resubmitVehicle.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.get(
  '/compliance/business/status',
  authenticationMiddleware,
  authorize(['VENDOR']),
  asyncHandler(complianceDocumentController.checkBusinessVerificationStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.get(
  '/compliance/licenses/status',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(complianceDocumentController.checkLicenseStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.get(
  '/compliance/vehicles/status',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(complianceDocumentController.checkVehicleStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.patch(
  '/compliance/business-verification/status',
  authenticationMiddleware,
  authorize(['ADMIN']),
  validateRequest(updateVerificationStatusSchema),
  asyncHandler(complianceDocumentController.updateBusinessVerificationStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.patch(
  '/compliance/licenses/status',
  authenticationMiddleware,
  authorize(['ADMIN']),
  validateRequest(updateVerificationStatusSchema),
  asyncHandler(complianceDocumentController.updateLicenseStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

verificationRoute.patch(
  '/compliance/vehicles/status',
  authenticationMiddleware,
  authorize(['ADMIN']),
  validateRequest(updateVerificationStatusSchema),
  asyncHandler(complianceDocumentController.updateVehicleStatus.bind(complianceDocumentController) as AsyncRequestHandler)
);

export default verificationRoute;