import { Request, Response, NextFunction } from 'express';
import { DocumentType } from '@prisma/client';
import { successResponse } from '../config/responseFormatter';
import { ApiError } from '../lib/utils/errors/appError';
import { ErrorCodes } from '../errors/errorCodes';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

// Define response interface for type safety
interface DocumentTypeResponse {
  documentTypes: DocumentType[];
}

export class DocumentTypeController {
  /**
   * Exposes the business-related document type (CAC only)
   * Route: GET /api/document-types/business
   */
  async getBusinessDocumentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = uuidv4();
    try {
      logger.info(`[${requestId}] Fetching business document types`);

      // Attempt to access DocumentType enum to ensure it's available
      if (!Object.values(DocumentType).includes(DocumentType.CAC)) {
        logger.error(`[${requestId}] DocumentType.CAC not found in enum`, {
          availableTypes: Object.values(DocumentType),
        });
        throw ApiError.internal(
          'Business document type (CAC) not found',
          ErrorCodes.INTERNAL_SERVER_ERROR,
          { availableTypes: Object.values(DocumentType) }
        );
      }

      // Filter for business document type (only CAC)
      const businessDocumentTypes: DocumentType[] = [DocumentType.CAC];

      const response: DocumentTypeResponse = {
        documentTypes: businessDocumentTypes,
      };

      logger.info(`[${requestId}] Business document types retrieved successfully`, {
        documentTypes: businessDocumentTypes,
      });

      successResponse(res, response, 'Business document types retrieved successfully', 200);
    } catch (error) {
      logger.error(`[${requestId}] Error fetching business document types`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as any).user?.id,
        headers: req.headers,
      });
      next(error);
    }
  }

  /**
   * Exposes vehicle-related document types (all except CAC)
   * Route: GET /api/document-types/vehicle
   */
  async getVehicleDocumentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = uuidv4();
    try {
      logger.info(`[${requestId}] Fetching vehicle document types`);

      // Attempt to access DocumentType enum to ensure it's available
      if (Object.values(DocumentType).length === 0) {
        logger.error(`[${requestId}] DocumentType enum is empty`, {
          availableTypes: Object.values(DocumentType),
        });
        throw ApiError.internal(
          'DocumentType enum is empty',
          ErrorCodes.INTERNAL_SERVER_ERROR,
          { availableTypes: Object.values(DocumentType) }
        );
      }

      // Filter for vehicle document types (all DocumentType values except CAC)
      const vehicleDocumentTypes: DocumentType[] = Object.values(DocumentType).filter(
        (type) => type !== DocumentType.CAC
      );

      if (vehicleDocumentTypes.length === 0) {
        logger.warn(`[${requestId}] No vehicle document types found after filtering`, {
          availableTypes: Object.values(DocumentType),
        });
        throw ApiError.notFound(
          'No vehicle document types available',
          ErrorCodes.NOT_FOUND,
          { availableTypes: Object.values(DocumentType) }
        );
      }

      const response: DocumentTypeResponse = {
        documentTypes: vehicleDocumentTypes,
      };

      logger.info(`[${requestId}] Vehicle document types retrieved successfully`, {
        documentTypes: vehicleDocumentTypes,
      });

      successResponse(res, response, 'Vehicle document types retrieved successfully', 200);
    } catch (error) {
      logger.error(`[${requestId}] Error fetching vehicle document types`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as any).user?.id,
        headers: req.headers,
      });
      next(error);
    }
  }
}