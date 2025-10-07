import { Request, Response, NextFunction } from 'express';
import { ServiceService } from '../services/serviceService';
import { CreateServiceData, UpdateServiceData, ReviewData } from '../repositories/serviceRepository';
import { ApiError } from '../errors/ApiError';
import { ErrorCodes } from '../errors/errorCodes';
import logger from '../config/logger';
import { validationResult } from 'express-validator';

export class ServiceController {
  private readonly serviceService: ServiceService;

  constructor() {
    this.serviceService = new ServiceService();
  }

  /**
   * Generic error response handler
   */
  private handleError(error: unknown, res: Response, next: NextFunction) {
    logger.error(`Error in ServiceController: ${error}`);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.errorCode,
          details: error.details,
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        details: error instanceof Error ? { message: error.message } : null,
      },
    });
  }

  /**
   * Validate request and throw error if invalid
   */
  private validateRequest(req: Request) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', ErrorCodes.VALIDATION_ERROR, errors.array());
    }
  }

  /**
   * Create a new service
   */
  async createService(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const serviceData: CreateServiceData = req.body;
      const user = req.user as { id: string; role: string };
      
      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const result = await this.serviceService.createService(serviceData, user.id, user.role, req);

      return res.status(201).json({
        success: true,
        data: result.service,
        message: result.message,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Edit a service
   */
  async editService(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { id } = req.params;
      const updateData: UpdateServiceData = req.body;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const service = await this.serviceService.editService(id, updateData, user);

      return res.status(200).json({
        success: true,
        data: service,
        message: 'Service updated successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get all services with filtering
   */
  async getAllServices(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', pageSize = '20', ...filters } = req.query;
      
      const parsedPage = parseInt(page as string, 10);
      const parsedPageSize = parseInt(pageSize as string, 10);

      if (isNaN(parsedPage) || isNaN(parsedPageSize)) {
        throw ApiError.badRequest('Invalid pagination parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const result = await this.serviceService.getAllServices(filters, parsedPage, parsedPageSize);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        message: 'Services retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get services for a specific provider
   */
  async getProviderServices(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      const { page = '1', pageSize = '20' } = req.query;
      
      const parsedPage = parseInt(page as string, 10);
      const parsedPageSize = parseInt(pageSize as string, 10);

      if (isNaN(parsedPage) || isNaN(parsedPageSize)) {
        throw ApiError.badRequest('Invalid pagination parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const result = await this.serviceService.getProviderServices(providerId, parsedPage, parsedPageSize);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        message: 'Provider services retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get service details by ID
   */
  async getServiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS);
      }

      const service = await this.serviceService.getServiceById(id);

      return res.status(200).json({
        success: true,
        data: service,
        message: 'Service retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Update service status
   */
  async updateServiceStatus(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { id } = req.params;
      const { status } = req.body;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const updatedService = await this.serviceService.updateServiceStatus(id, status, user, req);

      return res.status(200).json({
        success: true,
        data: updatedService,
        message: `Service status updated to ${status}`,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Toggle service active status
   */
  async toggleServiceActiveStatus(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { id } = req.params;
      const { isActive } = req.body;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const updatedService = await this.serviceService.toggleServiceActiveStatus(id, isActive, user, req);

      return res.status(200).json({
        success: true,
        data: updatedService,
        message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Delete service
   */
  async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const deletedService = await this.serviceService.deleteService(id, user);

      return res.status(200).json({
        success: true,
        data: deletedService,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Add review to service
   */
  async addReview(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { serviceId } = req.params;
      const reviewData: ReviewData = req.body;

      const review = await this.serviceService.addReview(serviceId, reviewData);

      return res.status(201).json({
        success: true,
        data: review,
        message: 'Review added successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Submit service for verification
   */
  async submitVerification(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { serviceId } = req.params;
      const verificationData = req.body;

      const verification = await this.serviceService.submitVerification(serviceId, verificationData);

      return res.status(201).json({
        success: true,
        data: verification,
        message: 'Verification submitted successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Check verification status
   */
  async checkVerificationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { serviceId } = req.params;

      const verificationStatus = await this.serviceService.checkVerificationStatus(serviceId);

      return res.status(200).json({
        success: true,
        data: verificationStatus,
        message: 'Verification status retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get nearby services
   */
  async getNearbyServices(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { latitude, longitude, radius, serviceTypeId, isOpen, page = '1', pageSize = '20' } = req.query;

      const parsedLatitude = parseFloat(latitude as string);
      const parsedLongitude = parseFloat(longitude as string);
      const parsedRadius = parseFloat(radius as string);
      
      if (isNaN(parsedLatitude) || isNaN(parsedLongitude) || isNaN(parsedRadius)) {
        throw ApiError.badRequest('Invalid geographic parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const parsedPage = parseInt(page as string, 10);
      const parsedPageSize = parseInt(pageSize as string, 10);

      if (isNaN(parsedPage) || isNaN(parsedPageSize)) {
        throw ApiError.badRequest('Invalid pagination parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const result = await this.serviceService.getNearbyServices(
        parsedLatitude,
        parsedLongitude,
        parsedRadius,
        serviceTypeId as string | undefined,
        isOpen === 'true' ? true : isOpen === 'false' ? false : undefined,
        parsedPage,
        parsedPageSize
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        message: 'Nearby services retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get services by locality
   */
  async getServicesByLocality(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { localityType, localityId, page = '1', pageSize = '20' } = req.params;
      
      const parsedLocalityId = parseInt(localityId as string, 10);
      const parsedPage = parseInt(page as string, 10);
      const parsedPageSize = parseInt(pageSize as string, 10);

      if (isNaN(parsedLocalityId) || isNaN(parsedPage) || isNaN(parsedPageSize)) {
        throw ApiError.badRequest('Invalid parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const validLocalityTypes = ['lga', 'city', 'state', 'country'];
      if (!validLocalityTypes.includes(localityType)) {
        throw ApiError.badRequest('Invalid locality type', ErrorCodes.VALIDATION_ERROR);
      }

      const result = await this.serviceService.getServicesByLocality(
        localityType as 'lga' | 'city' | 'state' | 'country',
        parsedLocalityId,
        parsedPage,
        parsedPageSize
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        message: 'Services by locality retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Create a service zone
   */
  async createServiceZone(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { serviceId } = req.params;
      const zoneData = req.body;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const zone = await this.serviceService.createServiceZone(serviceId, zoneData, user);

      return res.status(201).json({
        success: true,
        data: zone,
        message: 'Service zone created successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get service zones
   */
  async getServiceZones(req: Request, res: Response, next: NextFunction) {
    try {
      const { serviceId } = req.params;
      const { page = '1', pageSize = '20' } = req.query;
      
      const parsedPage = parseInt(page as string, 10);
      const parsedPageSize = parseInt(pageSize as string, 10);

      if (isNaN(parsedPage) || isNaN(parsedPageSize)) {
        throw ApiError.badRequest('Invalid pagination parameters', ErrorCodes.VALIDATION_ERROR);
      }

      const result = await this.serviceService.getServiceZones(serviceId, parsedPage, parsedPageSize);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
        message: 'Service zones retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Add existing service to a zone
   */
  async addServiceToZone(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { serviceId, zoneId } = req.params;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const updatedZone = await this.serviceService.addServiceToZone(serviceId, zoneId, user);

      return res.status(200).json({
        success: true,
        data: updatedZone,
        message: 'Service added to zone successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Add existing service to a locality
   */
  async addServiceToLocality(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateRequest(req);

      const { serviceId } = req.params;
      const locality = req.body;
      const user = req.user as { id: string; role: string };

      if (!user) {
        throw ApiError.unauthorized('User authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const updatedService = await this.serviceService.addServiceToLocality(serviceId, locality, user);

      return res.status(200).json({
        success: true,
        data: updatedService,
        message: 'Service added to locality successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }

  /**
   * Get all service types
   */
  async getServiceTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const serviceTypes = await this.serviceService.getServiceTypes();

      return res.status(200).json({
        success: true,
        data: serviceTypes,
        message: 'Service types retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  }
}