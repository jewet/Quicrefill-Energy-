import { Router, Request, Response, NextFunction } from 'express';
import { ServiceController } from '../controllers/serviceController';
import { authenticationMiddleware } from '../middlewares/authentication';
import { authorize } from '../middlewares/permissions';
import multer from 'multer';
import {
  createServiceValidation,
  updateServiceValidation,
  updateServiceStatusValidation,
  toggleServiceActiveStatusValidation,
  createServiceReviewValidation,
  createServiceVerificationValidation,
  getAllServicesValidation,
  getNearbyServicesValidation,
  createServiceZoneValidation,
  addServiceToLocalityValidation,
  getServiceZonesValidation,
  addServiceToZoneValidation,
  getServiceByIdValidation,
  getProviderServicesValidation,
  checkVerificationStatusValidation,
  getServicesByLocalityValidation,
  deleteServiceValidation,
} from '../schemas/service.validations';

const upload = multer();
const serviceRoute = Router();
const serviceController = new ServiceController();

// Public routes (no authentication required)
serviceRoute.get(
  '/nearby',
  getNearbyServicesValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getNearbyServices(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

serviceRoute.get(
  '/locality/:localityType/:localityId',
  getServicesByLocalityValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getServicesByLocality(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

serviceRoute.get(
  '/available-services',
  getAllServicesValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getAllServices(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

serviceRoute.get(
  '/types',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getServiceTypes(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Authenticated routes
serviceRoute.use(authenticationMiddleware);

// Create service
serviceRoute.post(
  '/create',
  upload.none(),
  authorize(['DELIVERY_REP', 'VENDOR', 'ADMIN']),
  createServiceValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.createService(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get provider services
serviceRoute.get(
  '/provider/:providerId',
  authorize(['DELIVERY_REP', 'VENDOR', 'ADMIN']),
  getProviderServicesValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getProviderServices(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Service verification
serviceRoute.post(
  '/:serviceId/verification',
  authorize(['DELIVERY_REP', 'ADMIN']),
  createServiceVerificationValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.submitVerification(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

serviceRoute.get(
  '/:serviceId/verification/status',
  authorize(['DELIVERY_REP', 'ADMIN']),
  checkVerificationStatusValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.checkVerificationStatus(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Service details
serviceRoute.get(
  '/:id',
  authorize(['CUSTOMER', 'ADMIN', 'DELIVERY_REP', 'VENDOR', 'MANAGER']),
  getServiceByIdValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getServiceById(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Update service
serviceRoute.put(
  '/:id',
  authorize(['DELIVERY_REP', 'VENDOR', 'ADMIN']),
  updateServiceValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.editService(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Update service status
serviceRoute.patch(
  '/:id/status',
  authorize(['ADMIN']),
  updateServiceStatusValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.updateServiceStatus(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Toggle service active status
serviceRoute.patch(
  '/:id/active',
  authorize(['VENDOR', 'ADMIN']),
  toggleServiceActiveStatusValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.toggleServiceActiveStatus(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Delete service
serviceRoute.delete(
  '/:id',
  authorize(['ADMIN']),
  deleteServiceValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.deleteService(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Reviews
serviceRoute.post(
  '/:serviceId/reviews',
  authorize(['CUSTOMER']),
  createServiceReviewValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.addReview(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Create service zone
serviceRoute.post(
  '/:serviceId/zones',
  authorize(['VENDOR', 'ADMIN']),
  createServiceZoneValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.createServiceZone(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get service zones
serviceRoute.get(
  '/:serviceId/zones',
  authorize(['VENDOR', 'ADMIN']),
  getServiceZonesValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.getServiceZones(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Add service to zone
serviceRoute.post(
  '/:serviceId/zones/:zoneId',
  authorize(['VENDOR', 'ADMIN']),
  addServiceToZoneValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.addServiceToZone(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Add service to locality
serviceRoute.post(
  '/:serviceId/locality',
  authorize(['VENDOR', 'ADMIN']),
  addServiceToLocalityValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await serviceController.addServiceToLocality(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export default serviceRoute;