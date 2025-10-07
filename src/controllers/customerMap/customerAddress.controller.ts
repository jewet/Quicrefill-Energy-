import { Request, Response } from 'express';
import { z } from 'zod';
import CustomerAddressService, { ServiceFilters } from '../../services/CustomerService'; // Import ServiceFilters
import { ApiError } from '../../lib/utils/errors/appError';
import { addressSchema, addressUpdateSchema, nearbyServicesSchema } from '../../schemas/customerAddressSchema';

class CustomerAddressController {
  /**
   * Create a new address
   * @route POST /accounts/user/addresses
   */
  static async create(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      const validatedData = addressSchema.parse(req.body);

      const newAddress = await CustomerAddressService.create(req.user.id, validatedData);

      res.status(201).json({
        success: true,
        data: newAddress,
        message: 'Address created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get all addresses for a customer
   * @route GET /api/addresses
   */
  static async findAll(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      const addresses = await CustomerAddressService.findAll(req.user.id);

      res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a specific address by ID
   * @route GET /api/addresses/:id
   */
  static async findOne(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      const address = await CustomerAddressService.findOne(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        data: address,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update an address
   * @route PUT /api/addresses/:id
   */
  static async update(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      const validatedData = addressUpdateSchema.parse(req.body);

      const updatedAddress = await CustomerAddressService.update(
        req.user.id,
        req.params.id,
        validatedData,
      );

      res.status(200).json({
        success: true,
        data: updatedAddress,
        message: 'Address updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete an address
   * @route DELETE /api/addresses/:id
   */
  static async remove(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      await CustomerAddressService.remove(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Address deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Set an address as default
   * @route PUT /api/addresses/:id/default
   */
  static async setDefault(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      await CustomerAddressService.setDefault(req.user.id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Default address updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get nearby services
   * @route GET /api/user/services/nearby
   */
  static async getNearbyServices(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, 'Unauthorized');
      }

      // Log raw query parameters for debugging
      console.log(`[CustomerAddressController.getNearbyServices] Raw query:`, req.query);

      // Safely handle query parameters
      const rawServiceType = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : undefined;

      const validatedFilters = nearbyServicesSchema.parse({
        radius: req.query.radius ? Number(req.query.radius) : undefined,
        serviceType: rawServiceType,
        latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
        longitude: req.query.longitude ? Number(req.query.longitude) : undefined,
      });

      // Log validated filters
      console.log(`[CustomerAddressController.getNearbyServices] Validated filters:`, validatedFilters);

      // Cast to ServiceFilters
      const filters: ServiceFilters = {
        radius: validatedFilters.radius,
        serviceType: validatedFilters.serviceType,
        latitude: validatedFilters.latitude,
        longitude: validatedFilters.longitude,
      };

      const services = await CustomerAddressService.getNearbyServices(req.user.id, filters);

      res.status(200).json({
        success: true,
        data: services,
        message: 'Nearby services retrieved successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private static handleError(error: unknown, res: Response) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default CustomerAddressController;