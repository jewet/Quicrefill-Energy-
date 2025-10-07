import { PrismaClient, Services, ServiceReview, ServiceStatus, ServiceType, VerificationStatus } from '@prisma/client';
import { ServiceRepository, CreateServiceData, UpdateServiceData, ReviewData } from '../repositories/serviceRepository';
import { ApiError } from '../errors/ApiError';
import { ErrorCodes } from '../errors/errorCodes';
import logger from '../config/logger';
import { dispatchNotification } from './notificationServices';
import { KnownEventTypes } from '../utils/EventTypeDictionary';
import { getRedisClient } from '../config/redis';
import { Response } from 'express';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL,
    },
  },
});

export class ServiceService {
  private readonly serviceRepository: ServiceRepository;

  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  /**
   * Create a new service
   */
  async createService(serviceData: CreateServiceData, userId: string, userRole: string, req?: any): Promise<{ service: Services; message: string }> {
    try {
      // Check role
      if (!['ADMIN', 'VENDOR'].includes(userRole)) {
        logger.error('Unauthorized role for creating service');
        throw ApiError.unauthorized('No permission to create service', ErrorCodes.UNAUTHORIZED, { role: userRole });
      }
      if (!serviceData) {
        logger.error('Service data is required');
        throw ApiError.badRequest('Service data is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!userId) {
        logger.error('User ID is required');
        throw ApiError.badRequest('User ID is required', ErrorCodes.MISSING_FIELDS);
      }

      // Parse and validate numeric fields
      const pricePerUnit = typeof serviceData.pricePerUnit === 'string' ? parseFloat(serviceData.pricePerUnit) : serviceData.pricePerUnit;
      if (pricePerUnit === undefined || isNaN(pricePerUnit)) {
        throw ApiError.badRequest('Price per unit must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'pricePerUnit' });
      }
      const deliveryCostPerKm = typeof serviceData.deliveryCostPerKm === 'string' ? parseFloat(serviceData.deliveryCostPerKm) : serviceData.deliveryCostPerKm;
      if (deliveryCostPerKm === undefined || isNaN(deliveryCostPerKm)) {
        throw ApiError.badRequest('Delivery cost per km must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'deliveryCostPerKm' });
      }
      const serviceRadius = typeof serviceData.serviceRadius === 'string' ? parseFloat(serviceData.serviceRadius) : serviceData.serviceRadius;
      if (serviceRadius === undefined || isNaN(serviceRadius)) {
        throw ApiError.badRequest('Service radius must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'serviceRadius' });
      }
      const latitude = typeof serviceData.latitude === 'string' ? parseFloat(serviceData.latitude) : serviceData.latitude;
      if (latitude === undefined || isNaN(latitude)) {
        throw ApiError.badRequest('Latitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'latitude' });
      }
      const longitude = typeof serviceData.longitude === 'string' ? parseFloat(serviceData.longitude) : serviceData.longitude;
      if (longitude === undefined || isNaN(longitude)) {
        throw ApiError.badRequest('Longitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'longitude' });
      }
      const expectedDeliveryTime = typeof serviceData.expectedDeliveryTime === 'string' ? parseInt(serviceData.expectedDeliveryTime, 10) : serviceData.expectedDeliveryTime;
      if (expectedDeliveryTime === undefined || isNaN(expectedDeliveryTime)) {
        throw ApiError.badRequest('Expected delivery time must be a valid integer', ErrorCodes.VALIDATION_ERROR, { field: 'expectedDeliveryTime' });
      }
      const minimumOrder = serviceData.minimumOrder !== undefined
        ? typeof serviceData.minimumOrder === 'string' ? parseInt(serviceData.minimumOrder, 10) : serviceData.minimumOrder
        : undefined;
      if (minimumOrder !== undefined && isNaN(Number(minimumOrder))) {
        throw ApiError.badRequest('Minimum order must be a valid integer', ErrorCodes.VALIDATION_ERROR, { field: 'minimumOrder' });
      }
      const baseServicePrice = serviceData.baseServicePrice !== undefined
        ? typeof serviceData.baseServicePrice === 'string' ? parseFloat(serviceData.baseServicePrice) : serviceData.baseServicePrice
        : undefined;
      if (baseServicePrice !== undefined && isNaN(baseServicePrice)) {
        throw ApiError.badRequest('Base service price must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'baseServicePrice' });
      }
      const lgaId = serviceData.lgaId && typeof serviceData.lgaId === 'string' ? parseInt(serviceData.lgaId, 10) : serviceData.lgaId;
      if (lgaId !== undefined && isNaN(Number(lgaId))) {
        throw ApiError.badRequest('LGA ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'lgaId' });
      }
      const cityId = serviceData.cityId && typeof serviceData.cityId === 'string' ? parseInt(serviceData.cityId, 10) : serviceData.cityId;
      if (cityId !== undefined && isNaN(Number(cityId))) {
        throw ApiError.badRequest('City ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'cityId' });
      }
      const stateId = serviceData.stateId && typeof serviceData.stateId === 'string' ? parseInt(serviceData.stateId, 10) : serviceData.stateId;
      if (stateId !== undefined && isNaN(Number(stateId))) {
        throw ApiError.badRequest('State ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'stateId' });
      }
      const countryId = serviceData.countryId && typeof serviceData.countryId === 'string' ? parseInt(serviceData.countryId, 10) : serviceData.countryId;
      if (countryId !== undefined && isNaN(Number(countryId))) {
        throw ApiError.badRequest('Country ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'countryId' });
      }

      // Construct parsedServiceData with validated numbers
      const parsedServiceData: CreateServiceData = {
        ...serviceData,
        pricePerUnit,
        deliveryCostPerKm,
        serviceRadius,
        latitude,
        longitude,
        expectedDeliveryTime,
        minimumOrder,
        businessHours: typeof serviceData.businessHours === 'string' ? JSON.parse(serviceData.businessHours) : serviceData.businessHours,
        licenseIds: serviceData.licenseIds && typeof serviceData.licenseIds === 'string' ? JSON.parse(serviceData.licenseIds) : serviceData.licenseIds,
        vehicleIds: serviceData.vehicleIds && typeof serviceData.vehicleIds === 'string' ? JSON.parse(serviceData.vehicleIds) : serviceData.vehicleIds,
        baseServicePrice,
        lgaId,
        cityId,
        stateId,
        countryId,
        verified: false, // System-controlled
      };

      // Use input providerId, falling back to userId
      const providerId = parsedServiceData.providerId || userId;

      // Fetch provider role from User table
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        include: { role: true },
      });
      if (!provider || !provider.role) {
        logger.error(`Provider not found or role not assigned for providerId: ${providerId}`);
        throw ApiError.badRequest('Invalid providerId: Provider not found or role not assigned', ErrorCodes.NOT_FOUND, { providerId });
      }
      const providerRole = provider.role.name;
      if (!['VENDOR', 'ADMIN'].includes(providerRole)) {
        logger.error(`Invalid provider role: ${providerRole}`);
        throw ApiError.unauthorized('Only VENDOR or ADMIN roles can create services', ErrorCodes.UNAUTHORIZED, { role: providerRole });
      }

      // Check profile
      const profile = await prisma.profile.findFirst({ where: { userId: providerId } });
      if (!profile) {
        logger.error(`Profile not found for providerId: ${providerId}`);
        throw ApiError.badRequest('Invalid providerId: Profile does not exist for this user', ErrorCodes.NOT_FOUND, { providerId });
      }

      // Delegate service creation to repository
      const service = await this.serviceRepository.createService(parsedServiceData);

      let message = 'Service successfully created and is pending admin approval';
      if (parsedServiceData.licenseIds?.length || parsedServiceData.vehicleIds?.length || parsedServiceData.businessVerificationId) {
        message += ' with documents linked for verification';
      }

      // Send notification
      try {
        const mockRes = {} as Response;
        await dispatchNotification(
          {
            eventTypeName: KnownEventTypes.VENDOR_STATUS_UPDATE,
            dynamicData: {
              serviceName: service.name,
              serviceId: service.id,
              message: `Your service "${service.name}" has been created and is pending admin approval. Documents linked: ${parsedServiceData.licenseIds?.length || 0} licenses, ${parsedServiceData.vehicleIds?.length || 0} vehicles, business verification ${parsedServiceData.businessVerificationId ? 'included' : 'not included'}.`,
            },
            userIds: [provider.id],
          },
          req,
          mockRes
        );
      } catch (notifyErr: unknown) {
        logger.error(`Failed to dispatch service creation notification: ${notifyErr}`);
      }

      return { service, message };
    } catch (error: unknown) {
      logger.error(`Error in service creation: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to create service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Edit a service
   */
  async editService(id: string, updateData: UpdateServiceData, user: { id: string; role: string }): Promise<Services> {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS);
      }
      if (!updateData) {
        throw ApiError.badRequest('Update data is required', ErrorCodes.MISSING_FIELDS);
      }

      // Parse and validate numeric fields
      const pricePerUnit = updateData.pricePerUnit !== undefined
        ? typeof updateData.pricePerUnit === 'string' ? parseFloat(updateData.pricePerUnit) : updateData.pricePerUnit
        : undefined;
      if (pricePerUnit !== undefined && isNaN(pricePerUnit)) {
        throw ApiError.badRequest('Price per unit must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'pricePerUnit' });
      }
      const deliveryCostPerKm = updateData.deliveryCostPerKm !== undefined
        ? typeof updateData.deliveryCostPerKm === 'string' ? parseFloat(updateData.deliveryCostPerKm) : updateData.deliveryCostPerKm
        : undefined;
      if (deliveryCostPerKm !== undefined && isNaN(deliveryCostPerKm)) {
        throw ApiError.badRequest('Delivery cost per km must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'deliveryCostPerKm' });
      }
      const serviceRadius = updateData.serviceRadius !== undefined
        ? typeof updateData.serviceRadius === 'string' ? parseFloat(updateData.serviceRadius) : updateData.serviceRadius
        : undefined;
      if (serviceRadius !== undefined && isNaN(serviceRadius)) {
        throw ApiError.badRequest('Service radius must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'serviceRadius' });
      }
      const latitude = updateData.latitude !== undefined
        ? typeof updateData.latitude === 'string' ? parseFloat(updateData.latitude) : updateData.latitude
        : undefined;
      if (latitude !== undefined && isNaN(latitude)) {
        throw ApiError.badRequest('Latitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'latitude' });
      }
      const longitude = updateData.longitude !== undefined
        ? typeof updateData.longitude === 'string' ? parseFloat(updateData.longitude) : updateData.longitude
        : undefined;
      if (longitude !== undefined && isNaN(longitude)) {
        throw ApiError.badRequest('Longitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'longitude' });
      }
      const expectedDeliveryTime = updateData.expectedDeliveryTime !== undefined
        ? typeof updateData.expectedDeliveryTime === 'string' ? parseInt(updateData.expectedDeliveryTime, 10) : updateData.expectedDeliveryTime
        : undefined;
      if (expectedDeliveryTime !== undefined && isNaN(expectedDeliveryTime)) {
        throw ApiError.badRequest('Expected delivery time must be a valid integer', ErrorCodes.VALIDATION_ERROR, { field: 'expectedDeliveryTime' });
      }
      const minimumOrder = updateData.minimumOrder !== undefined
        ? typeof updateData.minimumOrder === 'string' ? parseInt(updateData.minimumOrder, 10) : updateData.minimumOrder
        : undefined;
      if (minimumOrder !== undefined && isNaN(minimumOrder)) {
        throw ApiError.badRequest('Minimum order must be a valid integer', ErrorCodes.VALIDATION_ERROR, { field: 'minimumOrder' });
      }
      const baseServicePrice = updateData.baseServicePrice !== undefined
        ? typeof updateData.baseServicePrice === 'string' ? parseFloat(updateData.baseServicePrice) : updateData.baseServicePrice
        : undefined;
      if (baseServicePrice !== undefined && isNaN(baseServicePrice)) {
        throw ApiError.badRequest('Base service price must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'baseServicePrice' });
      }
      const lgaId = updateData.lgaId !== undefined
        ? typeof updateData.lgaId === 'string' ? parseInt(updateData.lgaId, 10) : updateData.lgaId
        : undefined;
      if (lgaId !== undefined && isNaN(lgaId)) {
        throw ApiError.badRequest('LGA ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'lgaId' });
      }
      const cityId = updateData.cityId !== undefined
        ? typeof updateData.cityId === 'string' ? parseInt(updateData.cityId, 10) : updateData.cityId
        : undefined;
      if (cityId !== undefined && isNaN(cityId)) {
        throw ApiError.badRequest('City ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'cityId' });
      }
      const stateId = updateData.stateId !== undefined
        ? typeof updateData.stateId === 'string' ? parseInt(updateData.stateId, 10) : updateData.stateId
        : undefined;
      if (stateId !== undefined && isNaN(stateId)) {
        throw ApiError.badRequest('State ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'stateId' });
      }
      const countryId = updateData.countryId !== undefined
        ? typeof updateData.countryId === 'string' ? parseInt(updateData.countryId, 10) : updateData.countryId
        : undefined;
      if (countryId !== undefined && isNaN(countryId)) {
        throw ApiError.badRequest('Country ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'countryId' });
      }

      // Construct parsedUpdateData with validated numbers
      const parsedUpdateData: UpdateServiceData = {
        ...updateData,
        pricePerUnit,
        deliveryCostPerKm,
        serviceRadius,
        latitude,
        longitude,
        expectedDeliveryTime,
        minimumOrder,
        businessHours: updateData.businessHours !== undefined
          ? typeof updateData.businessHours === 'string' ? JSON.parse(updateData.businessHours) : updateData.businessHours
          : undefined,
        baseServicePrice,
        lgaId,
        cityId,
        stateId,
        countryId,
        verified: undefined, // System-controlled
      };

      const service = await this.serviceRepository.getServiceById(id);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
      }

      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw ApiError.badRequest('Invalid role', ErrorCodes.VALIDATION_ERROR, { role: user.role });
      }

      if (user.role !== 'ADMIN' && service.providerId !== user.id) {
        logger.error('Unauthorized edit attempt');
        throw ApiError.unauthorized('You do not have permission to edit this service', ErrorCodes.UNAUTHORIZED, {
          userId: user.id,
          serviceId: id,
        });
      }

      return await this.serviceRepository.editService(id, parsedUpdateData);
    } catch (error: unknown) {
      logger.error(`Error editing service: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to edit service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get all services with filtering and Redis caching
   */
  async getAllServices(filters?: any, page = 1, pageSize = 20) {
    const cacheKey = `services:${JSON.stringify(filters || {})}:${page}:${pageSize}`;
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }

      const result = await this.serviceRepository.getAllServices(filters, page, pageSize);

      await redis.set(cacheKey, JSON.stringify(result), { EX: 60 });
      logger.info(`Cache set for key: ${cacheKey}`);

      if (!result.data || result.data.length === 0) {
        logger.error('No services found');
        throw ApiError.notFound('No services found', ErrorCodes.NOT_FOUND, { filters });
      }

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting services: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get services for a specific provider
   */
  async getProviderServices(providerId: string, page = 1, pageSize = 20) {
    try {
      if (!providerId) {
        throw ApiError.badRequest('Provider ID is required', ErrorCodes.MISSING_FIELDS, { field: 'providerId' });
      }

      const result = await this.serviceRepository.getServicesByProvider(providerId, page, pageSize);

      if (!result.data || result.data.length === 0) {
        logger.error(`No services found for provider: ${providerId}`);
        throw ApiError.notFound('No services found for this provider', ErrorCodes.NOT_FOUND, { providerId });
      }

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting provider services: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get provider services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get service details by ID with Redis caching
   */
  async getServiceById(id: string) {
    const cacheKey = `service:${id}`;
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }

      const service = await this.serviceRepository.getServiceById(id);

      if (!service) {
        logger.error(`Service not found: ${id}`);
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
      }

      await redis.set(cacheKey, JSON.stringify(service), { EX: 60 });
      logger.info(`Cache set for key: ${cacheKey}`);
      return service;
    } catch (error: unknown) {
      logger.error(`Error getting service details: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get service details', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Update service status
   */
  async updateServiceStatus(id: string, status: string, user: { id: string; role: string }, req?: any) {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      if (!status) {
        throw ApiError.badRequest('Status is required', ErrorCodes.MISSING_FIELDS, { field: 'status' });
      }

      const service = await this.serviceRepository.getServiceById(id);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
      }

      const validStatuses = Object.values(ServiceStatus);
      if (!validStatuses.includes(status as ServiceStatus)) {
        throw ApiError.badRequest('Invalid status', ErrorCodes.VALIDATION_ERROR, { status });
      }

      const updatedService = await this.serviceRepository.updateServiceStatus(id, status as ServiceStatus, user.role);

      try {
        const provider = await prisma.user.findUnique({ where: { id: updatedService.providerId } });
        if (provider) {
          const mockRes = {} as Response;
          await dispatchNotification(
            {
              eventTypeName: KnownEventTypes.VENDOR_STATUS_UPDATE,
              dynamicData: {
                serviceName: updatedService.name,
                serviceId: updatedService.id,
                status: updatedService.status,
                message: `Your service "${updatedService.name}" status is now "${updatedService.status}". ${
                  updatedService.status === 'APPROVED' ? 'You can now activate the service to make it visible to customers.' : ''
                }`,
              },
              userIds: [provider.id],
            },
            req,
            mockRes
          );
        }
      } catch (notifyErr: unknown) {
        logger.error(`Failed to dispatch service status update notification: ${notifyErr}`);
      }

      return updatedService;
    } catch (error: unknown) {
      logger.error(`Error updating service status: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to update service status', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Toggle service active status
   */
  async toggleServiceActiveStatus(id: string, isActive: boolean, user: { id: string; role: string }, req?: any) {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      if (typeof isActive !== 'boolean') {
        throw ApiError.badRequest('isActive must be a boolean', ErrorCodes.VALIDATION_ERROR, { field: 'isActive' });
      }

      const updatedService = await this.serviceRepository.toggleServiceActiveStatus(id, isActive, user.id, user.role);

      try {
        const provider = await prisma.user.findUnique({ where: { id: updatedService.providerId } });
        if (provider) {
          const mockRes = {} as Response;
          await dispatchNotification(
            {
              eventTypeName: KnownEventTypes.VENDOR_STATUS_UPDATE,
              dynamicData: {
                serviceName: updatedService.name,
                serviceId: updatedService.id,
                message: `Your service "${updatedService.name}" has been ${
                  isActive ? 'activated' : 'deactivated'
                } and is now ${isActive ? 'visible' : 'hidden'} to customers.`,
              },
              userIds: [provider.id],
            },
            req,
            mockRes
          );
        }
      } catch (notifyErr: unknown) {
        logger.error(`Failed to dispatch service active status notification: ${notifyErr}`);
      }

      return updatedService;
    } catch (error: unknown) {
      logger.error(`Error toggling service active status: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to toggle service active status', ErrorCodes.INTERNAL_SERVER_ERROR, {
        originalError: error,
      });
    }
  }

  /**
   * Delete service
   */
  async deleteService(id: string, user: { id: string; role: string }) {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }

      const service = await this.serviceRepository.getServiceById(id);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
      }

      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw ApiError.badRequest('Invalid role', ErrorCodes.VALIDATION_ERROR, { role: user.role });
      }

      if (user.role !== 'ADMIN' && service.providerId !== user.id) {
        logger.error('Unauthorized delete attempt');
        throw ApiError.unauthorized('You do not have permission to delete this service', ErrorCodes.UNAUTHORIZED, {
          userId: user.id,
          serviceId: id,
        });
      }

      return await this.serviceRepository.deleteService(id);
    } catch (error: unknown) {
      logger.error(`Error deleting service: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to delete service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Add review to service
   */
  async addReview(serviceId: string, reviewData: ReviewData): Promise<ServiceReview> {
    try {
      return await this.serviceRepository.addReview(serviceId, reviewData);
    } catch (error: unknown) {
      logger.error(`Error adding review: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to add review', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Submit service for verification
   */
  async submitVerification(serviceId: string, verificationData: { notes?: string }) {
    try {
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }

      // Find the profile associated with the provider
      const profile = await prisma.profile.findFirst({ where: { userId: service.providerId } });
      if (!profile) {
        throw ApiError.badRequest('Profile not found for provider', ErrorCodes.NOT_FOUND, { providerId: service.providerId });
      }

      const data = {
        serviceId,
        profileId: profile.id,
        notes: verificationData.notes,
        userId: service.providerId,
        status: VerificationStatus.PENDING,
      };

      const verification = await prisma.serviceVerification.create({ data });
      return verification;
    } catch (error: unknown) {
      logger.error(`Error submitting verification: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to submit verification', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Check verification status
   */
  async checkVerificationStatus(serviceId: string) {
    try {
      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }

      const verification = await prisma.serviceVerification.findFirst({ where: { serviceId } });

      if (!verification) {
        return {
          status: 'NOT_SUBMITTED',
          message: 'Verification has not been submitted for this service',
        };
      }

      return {
        status: verification.status,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt,
        notes: verification.notes,
      };
    } catch (error: unknown) {
      logger.error(`Error checking verification status: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to check verification status', ErrorCodes.INTERNAL_SERVER_ERROR, {
        originalError: error,
      });
    }
  }

  /**
   * Get nearby services
   */
  async getNearbyServices(
    latitude: number,
    longitude: number,
    radius: number,
    serviceTypeId?: string,
    isOpen?: boolean,
    page = 1,
    pageSize = 20
  ) {
    const cacheKey = `nearby:${latitude}:${longitude}:${radius}:${serviceTypeId || 'all'}:${isOpen || 'all'}:${page}:${pageSize}`;
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }

      const result = await this.serviceRepository.getNearbyServices(latitude, longitude, radius, serviceTypeId, isOpen, page, pageSize);

      if (!result.data || result.data.length === 0) {
        logger.error('No nearby services found');
        throw ApiError.notFound('No nearby services found', ErrorCodes.NOT_FOUND, { latitude, longitude, radius });
      }

      await redis.set(cacheKey, JSON.stringify(result), { EX: 60 });
      logger.info(`Cache set for key: ${cacheKey}`);

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting nearby services: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get nearby services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get services by locality
   */
  async getServicesByLocality(localityType: 'lga' | 'city' | 'state' | 'country', localityId: number, page = 1, pageSize = 20) {
    try {
      if (!localityId) {
        throw ApiError.badRequest('Locality ID is required', ErrorCodes.MISSING_FIELDS, { field: 'localityId' });
      }

      const result = await this.serviceRepository.getServicesByLocality(localityType, localityId, page, pageSize);

      if (!result.data || result.data.length === 0) {
        logger.error(`No services found for ${localityType} ${localityId}`);
        throw ApiError.notFound(`No services found for ${localityType} ${localityId}`, ErrorCodes.NOT_FOUND, {
          localityType,
          localityId,
        });
      }

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting services by ${localityType} ${localityId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get services by locality', ErrorCodes.INTERNAL_SERVER_ERROR, {
        originalError: error,
      });
    }
  }

  /**
   * Create a service zone
   */
  async createServiceZone(
    serviceId: string,
    zoneData: {
      name: string;
      minDeliveryDays: number;
      maxDeliveryDays: number;
      orderCutoffTime: string;
      latitude: number;
      longitude: number;
      serviceRadius?: number;
      priceMultiplier: number | string;
      address?: string;
    },
    user: { id: string; role: string }
  ) {
    try {
      if (!serviceId) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      if (!zoneData) {
        throw ApiError.badRequest('Zone data is required', ErrorCodes.MISSING_FIELDS);
      }

      // Parse priceMultiplier to number
      const priceMultiplier =
        typeof zoneData.priceMultiplier === 'string' ? parseFloat(zoneData.priceMultiplier) : zoneData.priceMultiplier;
      if (isNaN(priceMultiplier)) {
        throw ApiError.badRequest('Price multiplier must be a valid number', ErrorCodes.VALIDATION_ERROR, {
          field: 'priceMultiplier',
        });
      }

      // Validate numeric fields
      if (typeof zoneData.latitude === 'number' && isNaN(zoneData.latitude)) {
        throw ApiError.badRequest('Latitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'latitude' });
      }
      if (typeof zoneData.longitude === 'number' && isNaN(zoneData.longitude)) {
        throw ApiError.badRequest('Longitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'longitude' });
      }
      if (zoneData.serviceRadius && isNaN(zoneData.serviceRadius)) {
        throw ApiError.badRequest('Service radius must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'serviceRadius' });
      }

      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }

      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw ApiError.badRequest('Invalid role', ErrorCodes.VALIDATION_ERROR, { role: user.role });
      }

      if (user.role !== 'ADMIN' && service.providerId !== user.id) {
        logger.error('Unauthorized zone creation attempt');
        throw ApiError.unauthorized('You do not have permission to create a zone for this service', ErrorCodes.UNAUTHORIZED, {
          userId: user.id,
          serviceId,
        });
      }

      return await this.serviceRepository.createServiceZone(serviceId, {
        ...zoneData,
        priceMultiplier, // Use parsed number
        providerId: service.providerId,
        providerRole: service.providerRole,
      });
    } catch (error: unknown) {
      logger.error(`Error creating service zone: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to create service zone', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get service zones
   */
  async getServiceZones(serviceId: string, page = 1, pageSize = 20) {
    try {
      if (!serviceId) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }

      const result = await this.serviceRepository.getServiceZones(serviceId, page, pageSize);

      if (!result.data || result.data.length === 0) {
        logger.error(`No zones found for service: ${serviceId}`);
        throw ApiError.notFound('No zones found for this service', ErrorCodes.NOT_FOUND, { serviceId });
      }

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting service zones: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get service zones', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Add existing service to a zone
   */
  async addServiceToZone(serviceId: string, zoneId: string, user: { id: string; role: string }) {
    try {
      if (!serviceId || !zoneId) {
        throw ApiError.badRequest('Service ID and Zone ID are required', ErrorCodes.MISSING_FIELDS, { serviceId, zoneId });
      }

      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) {
        throw ApiError.notFound('Zone not found', ErrorCodes.NOT_FOUND, { zoneId });
      }

      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw ApiError.badRequest('Invalid role', ErrorCodes.VALIDATION_ERROR, { role: user.role });
      }

      if (user.role !== 'ADMIN' && service.providerId !== user.id) {
        logger.error('Unauthorized attempt to add service to zone');
        throw ApiError.unauthorized('You do not have permission to modify this service', ErrorCodes.UNAUTHORIZED, {
          userId: user.id,
          serviceId,
        });
      }

      const updatedZone = await prisma.zone.update({
        where: { id: zoneId },
        data: { serviceId },
      });

      return updatedZone;
    } catch (error: unknown) {
      logger.error(`Error adding service to zone: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to add service to zone', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Add existing service to a locality
   */
  async addServiceToLocality(
    serviceId: string,
    locality: { lgaId?: number | string; cityId?: number | string; stateId?: number | string; countryId?: number | string },
    user: { id: string; role: string }
  ) {
    try {
      if (!serviceId) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      if (!locality.lgaId && !locality.cityId && !locality.stateId && !locality.countryId) {
        throw ApiError.badRequest('At least one locality ID (lgaId, cityId, stateId, or countryId) is required', ErrorCodes.MISSING_FIELDS);
      }

      // Parse locality IDs if they are strings
      const parsedLocality = {
        lgaId: locality.lgaId ? (typeof locality.lgaId === 'string' ? parseInt(locality.lgaId, 10) : locality.lgaId) : undefined,
        cityId: locality.cityId ? (typeof locality.cityId === 'string' ? parseInt(locality.cityId, 10) : locality.cityId) : undefined,
        stateId: locality.stateId ? (typeof locality.stateId === 'string' ? parseInt(locality.stateId, 10) : locality.stateId) : undefined,
        countryId: locality.countryId
          ? (typeof locality.countryId === 'string' ? parseInt(locality.countryId, 10) : locality.countryId)
          : undefined,
      };

      // Validate parsed locality IDs
      if (parsedLocality.lgaId !== undefined && isNaN(parsedLocality.lgaId)) {
        throw ApiError.badRequest('LGA ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'lgaId' });
      }
      if (parsedLocality.cityId !== undefined && isNaN(parsedLocality.cityId)) {
        throw ApiError.badRequest('City ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'cityId' });
      }
      if (parsedLocality.stateId !== undefined && isNaN(parsedLocality.stateId)) {
        throw ApiError.badRequest('State ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'stateId' });
      }
      if (parsedLocality.countryId !== undefined && isNaN(parsedLocality.countryId)) {
        throw ApiError.badRequest('Country ID must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'countryId' });
      }

      const service = await this.serviceRepository.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }

      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw ApiError.badRequest('Invalid role', ErrorCodes.VALIDATION_ERROR, { role: user.role });
      }

      if (user.role !== 'ADMIN' && service.providerId !== user.id) {
        logger.error('Unauthorized attempt to add service to locality');
        throw ApiError.unauthorized('You do not have permission to modify this service', ErrorCodes.UNAUTHORIZED, {
          userId: user.id,
          serviceId,
        });
      }

      const updatedService = await prisma.services.update({
        where: { id: serviceId },
        data: {
          lgaId: parsedLocality.lgaId,
          cityId: parsedLocality.cityId,
          stateId: parsedLocality.stateId,
          countryId: parsedLocality.countryId,
        },
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      return updatedService;
    } catch (error: unknown) {
      logger.error(`Error adding service to locality: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to add service to locality', ErrorCodes.INTERNAL_SERVER_ERROR, {
        originalError: error,
      });
    }
  }

  /**
   * Get all service types for frontend use
   */
  async getServiceTypes(): Promise<ServiceType[]> {
    try {
      const serviceTypes = await prisma.serviceType.findMany({
        orderBy: { name: 'asc' },
      });

      if (!serviceTypes || serviceTypes.length === 0) {
        logger.error('No service types found');
        throw ApiError.notFound('No service types found', ErrorCodes.NOT_FOUND);
      }

      return serviceTypes;
    } catch (error: unknown) {
      logger.error(`Error getting service types: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get service types', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }
}