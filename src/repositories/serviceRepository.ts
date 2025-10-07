import { PrismaClient, Services, ServiceReview, Prisma, ServiceStatus } from '@prisma/client';
import logger from '../config/logger';
import { ApiError } from '../errors/ApiError';
import { ErrorCodes } from '../errors/errorCodes';
import { GasUtility } from '../utils/service_Utility/gas_utility';
import { PetrolUtility } from '../utils/service_Utility/petrol_utility';
import { DieselUtility } from '../utils/service_Utility/diesel_utility';
import { KeroseneUtility } from '../utils/service_Utility/kerosene_utility';
import { ElectricVehicleUtility } from '../utils/service_Utility/electric_vehicle_utility';
import { SolarUtility } from '../utils/service_Utility/solar_utility';

export interface CreateServiceData {
  name: string;
  description?: string;
  businessName: string;
  serviceTypeId: string;
  pricePerUnit: number;
  deliveryCostPerKm: number;
  minimumOrder?: number;
  businessHours: Prisma.InputJsonValue;
  expectedDeliveryTime: number;
  address: string;
  longitude: number;
  latitude: number;
  serviceRadius: number;
  providerId: string;
  status?: ServiceStatus;
  verified?: boolean;
  licenseIds?: string[];
  vehicleIds?: string[];
  businessVerificationId?: string;
  Contact?: string;
  baseServicePrice?: number;
  lgaId?: number;
  cityId?: number;
  stateId?: number;
  countryId?: number;
}

export interface UpdateServiceData {
  name?: string;
  description?: string;
  businessName?: string;
  serviceTypeId?: string;
  pricePerUnit?: number;
  deliveryCostPerKm?: number;
  minimumOrder?: number;
  businessHours?: Prisma.InputJsonValue;
  expectedDeliveryTime?: number;
  address?: string;
  longitude?: number;
  latitude?: number;
  serviceRadius?: number;
  status?: ServiceStatus;
  verified?: boolean;
  Contact?: string;
  baseServicePrice?: number;
  lgaId?: number;
  cityId?: number;
  stateId?: number;
  countryId?: number;
}

export interface ReviewData {
  rating: number;
  comment?: string;
  reviewerName: string;
  reviewerId: string;
}

const prisma = new PrismaClient();

export class ServiceRepository {
  private gasUtility = new GasUtility();
  private petrolUtility = new PetrolUtility();
  private dieselUtility = new DieselUtility();
  private keroseneUtility = new KeroseneUtility();
  private electricVehicleUtility = new ElectricVehicleUtility();
  private solarUtility = new SolarUtility();

  /**
   * Validate utility-specific requirements for service creation or update
   */
  private async validateUtilityRequirements(serviceData: CreateServiceData): Promise<void> {
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceData.serviceTypeId },
    });
    if (!serviceType) {
      throw ApiError.badRequest('Invalid serviceTypeId', ErrorCodes.SERVICE_NOT_FOUND, { serviceTypeId: serviceData.serviceTypeId });
    }

    const businessVerification = await prisma.businessVerification.findFirst({
      where: { userId: serviceData.providerId, status: 'APPROVED' },
    });
    if (!businessVerification) {
      throw ApiError.badRequest('Business verification must be approved', ErrorCodes.BUSINESS_VERIFICATION_FAILED, {
        providerId: serviceData.providerId,
      });
    }

    switch (serviceType.name) {
      case 'GAS_SUPPLY':
        await this.gasUtility.validateServiceData(serviceData);
        break;
      case 'PETROL_SUPPLY':
        await this.petrolUtility.validateServiceData(serviceData);
        break;
      case 'DIESEL_SUPPLY':
        await this.dieselUtility.validateServiceData(serviceData);
        break;
      case 'KEROSENE_SUPPLY':
        await this.keroseneUtility.validateServiceData(serviceData);
        break;
      case 'EV_CHARGING_STATION':
      case 'EV_BATTERY_REPLACEMENT':
      case 'EV_MAINTENANCE':
        await this.electricVehicleUtility.validateServiceData(serviceData);
        break;
      case 'SOLAR_PANEL_INSTALLATION':
      case 'SOLAR_BATTERY_MAINTENANCE':
      case 'SOLAR_INVERTER_REPAIR':
      case 'SOLAR_SYSTEM_DESIGN':
        await this.solarUtility.validateServiceData(serviceData);
        break;
      default:
        throw ApiError.badRequest('Unsupported service type', ErrorCodes.VALIDATION_ERROR, { serviceType: serviceType.name });
    }
  }

  /**
   * Verify required documents before service creation
   */
  async verifyDocuments(providerId: string): Promise<boolean> {
    try {
      const license = await prisma.license.findFirst({
        where: { userId: providerId, status: 'APPROVED' },
      });

      const vehicle = await prisma.vehicle.findFirst({
        where: { userId: providerId, status: 'APPROVED' },
      });

      const businessVerification = await prisma.businessVerification.findFirst({
        where: { userId: providerId, status: 'APPROVED' },
      });

      if (!license || !vehicle || !businessVerification) {
        logger.error(`Document verification failed for provider ${providerId}`);
        throw ApiError.badRequest(
          'Required documents (license, vehicle, business verification) must be verified before creating a service',
          ErrorCodes.BUSINESS_VERIFICATION_FAILED,
          { providerId }
        );
      }

      return true;
    } catch (error: unknown) {
      logger.error(`Error verifying documents for provider ${providerId}: ${error}`);
      throw ApiError.internal('Failed to verify documents', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Create a new service with document linking
   */
  async createService(serviceData: CreateServiceData): Promise<Services> {
    try {
      // Validate utility-specific requirements
      await this.validateUtilityRequirements(serviceData);

      // Fetch provider role from User table
      const provider = await prisma.user.findUnique({
        where: { id: serviceData.providerId },
        include: { role: true },
      });
      if (!provider || !provider.role) {
        throw ApiError.badRequest('Provider not found or role not assigned', ErrorCodes.NOT_FOUND, { providerId: serviceData.providerId });
      }
      const providerRole = provider.role.name;
      if (!['VENDOR', 'ADMIN'].includes(providerRole)) {
        throw ApiError.unauthorized('Only VENDOR or ADMIN roles can create services', ErrorCodes.UNAUTHORIZED, { role: providerRole });
      }

      // Fetch business verification to get businessName
      let businessName = serviceData.businessName;
      if (serviceData.businessVerificationId) {
        const businessVerification = await prisma.businessVerification.findUnique({
          where: { id: serviceData.businessVerificationId },
        });
        if (!businessVerification) {
          throw ApiError.badRequest('Invalid businessVerificationId', ErrorCodes.NOT_FOUND, { businessVerificationId: serviceData.businessVerificationId });
        }
        businessName = businessVerification.businessName; // Override with businessVerification businessName
      }

      // Fetch service type to determine utility
      const serviceType = await prisma.serviceType.findUnique({
        where: { id: serviceData.serviceTypeId },
      });
      if (!serviceType) {
        throw ApiError.badRequest('Invalid serviceTypeId', ErrorCodes.SERVICE_NOT_FOUND, { serviceTypeId: serviceData.serviceTypeId });
      }

      // Route to appropriate utility for data preparation
      let processedServiceData: CreateServiceData = { ...serviceData, businessName };
      if (serviceType.name === 'GAS_SUPPLY') {
        processedServiceData = await this.gasUtility.prepareGasServiceData(processedServiceData);
      } else if (serviceType.name === 'PETROL_SUPPLY') {
        processedServiceData = await this.petrolUtility.preparePetrolServiceData(processedServiceData);
      } else if (serviceType.name === 'DIESEL_SUPPLY') {
        processedServiceData = await this.dieselUtility.prepareDieselServiceData(processedServiceData);
      } else if (serviceType.name === 'KEROSENE_SUPPLY') {
        processedServiceData = await this.keroseneUtility.prepareKeroseneServiceData(processedServiceData);
      } else if (['EV_CHARGING_STATION', 'EV_BATTERY_REPLACEMENT', 'EV_MAINTENANCE'].includes(serviceType.name)) {
        processedServiceData = await this.electricVehicleUtility.prepareEVServiceData(processedServiceData);
      } else if (['SOLAR_PANEL_INSTALLATION', 'SOLAR_BATTERY_MAINTENANCE', 'SOLAR_INVERTER_REPAIR', 'SOLAR_SYSTEM_DESIGN'].includes(serviceType.name)) {
        processedServiceData = await this.solarUtility.prepareSolarServiceData(processedServiceData);
      }

      // Validate status
      if (processedServiceData.status && !Object.values(ServiceStatus).includes(processedServiceData.status)) {
        throw ApiError.badRequest('Invalid status', ErrorCodes.VALIDATION_ERROR, { status: processedServiceData.status });
      }

      // Create service using Prisma ORM
      const service = await prisma.services.create({
        data: {
          name: processedServiceData.name,
          description: processedServiceData.description || null,
          serviceTypeId: processedServiceData.serviceTypeId,
          status: processedServiceData.status || ServiceStatus.PENDING_VERIFICATION,
          isActive: false,
          pricePerUnit: new Prisma.Decimal(processedServiceData.pricePerUnit),
          deliveryCost: new Prisma.Decimal(processedServiceData.deliveryCostPerKm),
          minimumOrder: processedServiceData.minimumOrder ?? 1,
          businessHours: processedServiceData.businessHours,
          expectedDeliveryTime: processedServiceData.expectedDeliveryTime,
          address: processedServiceData.address,
          longitude: processedServiceData.longitude,
          latitude: processedServiceData.latitude,
          serviceRadius: processedServiceData.serviceRadius,
          providerId: processedServiceData.providerId,
          providerRole,
          verified: false,
          businessVerificationId: processedServiceData.businessVerificationId || null,
          Contact: processedServiceData.Contact || null,
          businessName,
          lgaId: processedServiceData.lgaId ?? null,
          cityId: processedServiceData.cityId ?? null,
          stateId: processedServiceData.stateId ?? null,
          countryId: processedServiceData.countryId ?? null,
          licenses: processedServiceData.licenseIds && processedServiceData.licenseIds.length > 0
            ? { connect: processedServiceData.licenseIds.map(id => ({ id })) }
            : undefined,
          vehicles: processedServiceData.vehicleIds && processedServiceData.vehicleIds.length > 0
            ? { connect: processedServiceData.vehicleIds.map(id => ({ id })) }
            : undefined,
        },
        include: {
          licenses: true,
          vehicles: true,
          businessVerification: true,
        },
      });

      // Set location using raw SQL for PostGIS compatibility
      if (processedServiceData.latitude && processedServiceData.longitude) {
        await prisma.$executeRaw`
          UPDATE "Services"
          SET location = ST_SetSRID(ST_MakePoint(${processedServiceData.longitude}, ${processedServiceData.latitude}), 4326)::geography
          WHERE id = ${service.id}
        `;
      }

      return service;
    } catch (error: unknown) {
      logger.error(`Error creating service: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to create service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Edit a service
   */
  async editService(id: string, updateData: UpdateServiceData): Promise<Services> {
    try {
      // Validate input
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'id' });
      }
      if (!updateData || Object.keys(updateData).length === 0) {
        throw ApiError.badRequest('Update data is required', ErrorCodes.MISSING_FIELDS);
      }

      // Validate utility-specific requirements if serviceTypeId is updated
      if (updateData.serviceTypeId) {
        const existingService = await this.getServiceById(id);
        if (!existingService) {
          throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
        }
        await this.validateUtilityRequirements({ ...updateData, providerId: existingService.providerId } as CreateServiceData);
      }

      // Validate status if provided
      if (updateData.status && !Object.values(ServiceStatus).includes(updateData.status)) {
        throw ApiError.badRequest('Invalid status', ErrorCodes.VALIDATION_ERROR, { status: updateData.status });
      }

      // Prepare update data with Prisma.Decimal conversion
      const updatePayload: any = {
        name: updateData.name,
        description: updateData.description,
        serviceTypeId: updateData.serviceTypeId,
        pricePerUnit: updateData.pricePerUnit !== undefined ? new Prisma.Decimal(updateData.pricePerUnit) : undefined,
        deliveryCost: updateData.deliveryCostPerKm !== undefined ? new Prisma.Decimal(updateData.deliveryCostPerKm) : undefined,
        minimumOrder: updateData.minimumOrder,
        businessHours: updateData.businessHours,
        expectedDeliveryTime: updateData.expectedDeliveryTime,
        address: updateData.address,
        longitude: updateData.longitude,
        latitude: updateData.latitude,
        serviceRadius: updateData.serviceRadius,
        Contact: updateData.Contact,
        businessName: updateData.businessName,
        lgaId: updateData.lgaId,
        cityId: updateData.cityId,
        stateId: updateData.stateId,
        countryId: updateData.countryId,
        verified: updateData.status === ServiceStatus.APPROVED ? true : undefined,
      };

      // Remove undefined fields to prevent overwriting with null
      Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);

      // Perform the update operation
      const service = await prisma.services.update({
        where: { id },
        data: updatePayload,
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      // Update location using raw SQL if latitude and longitude are provided
      if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Services"
          SET location = ST_SetSRID(ST_MakePoint(${updateData.longitude}, ${updateData.latitude}), 4326)::geography
          WHERE id = ${id}
        `;
      }

      return service;
    } catch (error: unknown) {
      logger.error(`Error editing service ${id}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to edit service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get all services with filtering and pagination
   */
  async getAllServices(filters?: any, page = 1, pageSize = 20): Promise<{ data: Services[]; total: number; page: number; pageSize: number }> {
    try {
      const where: Prisma.ServicesWhereInput = {};
      if (filters) {
        if (filters.providerId) where.providerId = filters.providerId;
        if (filters.providerRole) where.providerRole = filters.providerRole;
        if (filters.status && Object.values(ServiceStatus).includes(filters.status)) {
          where.status = filters.status;
        }
        if (filters.serviceTypeId) where.serviceTypeId = filters.serviceTypeId;
        if (filters.verified !== undefined) where.verified = filters.verified === 'true';
        if (filters.lgaId) where.lgaId = Number(filters.lgaId);
        if (filters.cityId) where.cityId = Number(filters.cityId);
        if (filters.stateId) where.stateId = Number(filters.stateId);
        if (filters.countryId) where.countryId = Number(filters.countryId);
      }

      const total = await prisma.services.count({ where });
      const services = await prisma.services.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      return { data: services, total, page, pageSize };
    } catch (error: unknown) {
      logger.error(`Error getting services: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(serviceId: string): Promise<Services | null> {
    try {
      if (!serviceId) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      const service = await prisma.services.findUnique({
        where: { id: serviceId },
        include: {
          licenses: true,
          vehicles: true,
          serviceReviews: { orderBy: { createdAt: 'desc' } },
          serviceType: true,
          businessVerification: true,
        },
      });

      return service;
    } catch (error: unknown) {
      logger.error(`Error getting service by id ${serviceId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Update service status
   */
  async updateServiceStatus(id: string, status: ServiceStatus, userRole: string): Promise<Services> {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'id' });
      }
      if (!Object.values(ServiceStatus).includes(status)) {
        throw ApiError.badRequest('Invalid status', ErrorCodes.VALIDATION_ERROR, { status });
      }
      if (userRole !== 'ADMIN') {
        logger.error('Unauthorized status update attempt');
        throw ApiError.unauthorized('Only admins can update service status', ErrorCodes.UNAUTHORIZED, { role: userRole });
      }

      const service = await prisma.services.update({
        where: { id },
        data: {
          status,
          verified: status === ServiceStatus.APPROVED ? true : undefined,
        },
        include: { serviceType: true },
      });

      return service;
    } catch (error: unknown) {
      logger.error(`Error updating service status ${id}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to update service status', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Toggle service active status
   */
  async toggleServiceActiveStatus(id: string, isActive: boolean, userId: string, userRole: string): Promise<Services> {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'id' });
      }
      if (typeof isActive !== 'boolean') {
        throw ApiError.badRequest('isActive must be a boolean', ErrorCodes.VALIDATION_ERROR, { isActive });
      }

      const service = await prisma.services.findUnique({
        where: { id },
      });
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId: id });
      }

      if (userRole !== 'ADMIN' && service.providerId !== userId) {
        logger.error('Unauthorized attempt to toggle service active status');
        throw ApiError.unauthorized('You do not have permission to modify this service', ErrorCodes.UNAUTHORIZED, {
          userId,
          serviceId: id,
        });
      }

      if (service.status !== ServiceStatus.APPROVED) {
        throw ApiError.badRequest('Service must be APPROVED to toggle active status', ErrorCodes.VALIDATION_ERROR, { status: service.status });
      }

      const updatedService = await prisma.services.update({
        where: { id },
        data: { isActive },
        include: { serviceType: true },
      });

      return updatedService;
    } catch (error: unknown) {
      logger.error(`Error toggling service active status ${id}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to toggle service active status', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Delete service
   */
  async deleteService(id: string): Promise<Services> {
    try {
      if (!id) {
        logger.error('Service ID is required');
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'id' });
      }
      const service = await prisma.services.delete({
        where: { id },
        include: { serviceType: true },
      });

      return service;
    } catch (error: unknown) {
      logger.error(`Error deleting service ${id}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to delete service', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get services by provider
   */
  async getServicesByProvider(providerId: string, page = 1, pageSize = 20): Promise<{ data: Services[]; total: number; page: number; pageSize: number }> {
    try {
      if (!providerId) {
        logger.error('Provider ID is required');
        throw ApiError.badRequest('Provider ID is required', ErrorCodes.MISSING_FIELDS, { field: 'providerId' });
      }
      const total = await prisma.services.count({ where: { providerId } });
      const services = await prisma.services.findMany({
        where: { providerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      return { data: services, total, page, pageSize };
    } catch (error: unknown) {
      logger.error(`Error getting services by provider ${providerId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Add review to service and update avgRating and ratingCount
   */
  async addReview(serviceId: string, reviewData: ReviewData): Promise<ServiceReview> {
    try {
      if (!serviceId) throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      if (!reviewData) throw ApiError.badRequest('Review data is required', ErrorCodes.MISSING_FIELDS);
      const result = await prisma.$transaction(async (tx) => {
        const review = await tx.serviceReview.create({ data: { ...reviewData, serviceId } });
        const reviews = await tx.serviceReview.findMany({ where: { serviceId } });
        const ratingCount = reviews.length;
        const avgRating = ratingCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount : 0;
        await tx.services.update({
          where: { id: serviceId },
          data: { avgRating, ratingCount },
        });
        return review;
      });
      return result;
    } catch (error: unknown) {
      logger.error(`Error adding review to service ${serviceId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to add review', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get services near location using PostGIS
   */
  async getNearbyServices(
    latitude: number,
    longitude: number,
    radius: number,
    serviceTypeId?: string,
    isOpen?: boolean,
    page = 1,
    pageSize = 20
  ): Promise<{ data: Services[]; total: number; page: number; pageSize: number }> {
    try {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw ApiError.badRequest('Latitude and longitude are required and must be numbers', ErrorCodes.MISSING_FIELDS, {
          latitude,
          longitude,
        });
      }
      if (!radius || radius <= 0) {
        throw ApiError.badRequest('Radius must be greater than 0', ErrorCodes.VALIDATION_ERROR, { radius });
      }

      if (serviceTypeId) {
        const serviceType = await prisma.serviceType.findUnique({
          where: { id: serviceTypeId },
        });
        if (!serviceType) {
          throw ApiError.badRequest('Invalid serviceTypeId', ErrorCodes.SERVICE_NOT_FOUND, { serviceTypeId });
        }
      }

      const point = `POINT(${longitude} ${latitude})`;
      const serviceTypeFilter = serviceTypeId ? `AND "serviceTypeId" = '${serviceTypeId}'::uuid` : '';

      let openFilter = '';
      if (isOpen) {
        const now = new Date();
        const currentDay = now.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        const currentTime = now.toTimeString().slice(0, 5);
        openFilter = `
          AND "businessHours"->>'${currentDay}' != 'closed'
          AND (
            "businessHours"->>'${currentDay}' IS NULL
            OR (
              CAST(SPLIT_PART("businessHours"->>'${currentDay}', '-', 1) AS TIME) <= '${currentTime}'::TIME
              AND CAST(SPLIT_PART("businessHours"->>'${currentDay}', '-', 2) AS TIME) >= '${currentTime}'::TIME
            )
          )
        `;
      }

      const totalResult = await prisma.$queryRaw`
        SELECT COUNT(*) as total
        FROM "Services"
        WHERE ST_DWithin(
          location,
          ST_SetSRID(ST_GeomFromText(${point}), 4326)::geography,
          ${radius * 1000}
        )
        AND status = 'APPROVED'
        AND "isActive" = true
        ${Prisma.raw(serviceTypeFilter)}
        ${Prisma.raw(openFilter)}
      `;
      const total = Number((totalResult as any)[0].total) || 0;

      const services = await prisma.$queryRaw`
        SELECT 
          s.*,
          ST_AsText(s.location) AS location,
          ST_Distance(
            s.location,
            ST_SetSRID(ST_GeomFromText(${point}), 4326)::geography
          ) AS distance
        FROM "Services" s
        WHERE ST_DWithin(
          s.location,
          ST_SetSRID(ST_GeomFromText(${point}), 4326)::geography,
          ${radius * 1000}
        )
        AND s.status = 'APPROVED'
        AND s."isActive" = true
        ${Prisma.raw(serviceTypeFilter)}
        ${Prisma.raw(openFilter)}
        ORDER BY s."avgRating" DESC NULLS LAST, distance ASC
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `;

      const serviceIds = (services as any[]).map(s => s.id);
      const enrichedServices = await prisma.services.findMany({
        where: { id: { in: serviceIds } },
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      const data = enrichedServices.map(service => ({
        ...service,
        distance: (services as any[]).find(s => s.id === service.id)?.distance || 0,
      }));

      return { data: data as Services[], total, page, pageSize };
    } catch (error: unknown) {
      logger.error(`Error getting nearby services: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get nearby services', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get services by locality (LGA, City, State, or Country)
   */
  async getServicesByLocality(
    localityType: 'lga' | 'city' | 'state' | 'country',
    localityId: number,
    page = 1,
    pageSize = 20
  ): Promise<{ data: Services[]; total: number; page: number; pageSize: number }> {
    try {
      if (!localityId) {
        throw ApiError.badRequest('Locality ID is required', ErrorCodes.MISSING_FIELDS, { field: 'localityId' });
      }

      const where: Prisma.ServicesWhereInput = {
        status: ServiceStatus.APPROVED,
        isActive: true,
      };
      if (localityType === 'lga') where.lgaId = localityId;
      else if (localityType === 'city') where.cityId = localityId;
      else if (localityType === 'state') where.stateId = localityId;
      else if (localityType === 'country') where.countryId = localityId;
      else throw ApiError.badRequest('Invalid locality type', ErrorCodes.VALIDATION_ERROR, { localityType });

      const total = await prisma.services.count({ where });
      const services = await prisma.services.findMany({
        where,
        orderBy: { avgRating: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          serviceType: true,
          licenses: true,
          vehicles: true,
        },
      });

      return { data: services, total, page, pageSize };
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
      providerId: string;
      providerRole: string;
      address?: string;
      latitude: number;
      longitude: number;
      serviceRadius?: number;
      priceMultiplier: number;
    }
  ): Promise<any> {
    try {
      if (!serviceId) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }
      if (!zoneData) {
        throw ApiError.badRequest('Zone data is required', ErrorCodes.MISSING_FIELDS);
      }
      if (typeof zoneData.priceMultiplier !== 'number' || isNaN(zoneData.priceMultiplier)) {
        throw ApiError.badRequest('Price multiplier must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'priceMultiplier' });
      }
      if (typeof zoneData.latitude !== 'number' || isNaN(zoneData.latitude)) {
        throw ApiError.badRequest('Latitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'latitude' });
      }
      if (typeof zoneData.longitude !== 'number' || isNaN(zoneData.longitude)) {
        throw ApiError.badRequest('Longitude must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'longitude' });
      }
      if (zoneData.serviceRadius && (typeof zoneData.serviceRadius !== 'number' || isNaN(zoneData.serviceRadius))) {
        throw ApiError.badRequest('Service radius must be a valid number', ErrorCodes.VALIDATION_ERROR, { field: 'serviceRadius' });
      }
      if (zoneData.minDeliveryDays < 0 || zoneData.maxDeliveryDays < zoneData.minDeliveryDays) {
        throw ApiError.badRequest('Invalid delivery days range', ErrorCodes.VALIDATION_ERROR, {
          minDeliveryDays: zoneData.minDeliveryDays,
          maxDeliveryDays: zoneData.maxDeliveryDays,
        });
      }

      // Verify service exists and belongs to the provider
      const service = await this.getServiceById(serviceId);
      if (!service) {
        throw ApiError.notFound('Service not found', ErrorCodes.NOT_FOUND, { serviceId });
      }
      if (service.providerId !== zoneData.providerId) {
        throw ApiError.unauthorized('Service does not belong to the provided provider', ErrorCodes.UNAUTHORIZED, {
          providerId: zoneData.providerId,
          serviceId,
        });
      }

      // Create the zone
      const zone = await prisma.zone.create({
        data: {
          serviceId,
          name: zoneData.name,
          minDeliveryDays: zoneData.minDeliveryDays,
          maxDeliveryDays: zoneData.maxDeliveryDays,
          orderCutoffTime: zoneData.orderCutoffTime,
          providerId: zoneData.providerId,
          providerRole: zoneData.providerRole,
          address: zoneData.address,
          latitude: zoneData.latitude,
          longitude: zoneData.longitude,
          serviceRadius: zoneData.serviceRadius,
          priceMultiplier: zoneData.priceMultiplier,
        },
        include: {
          service: {
            include: {
              serviceType: true,
            },
          },
        },
      });

      return zone;
    } catch (error: unknown) {
      logger.error(`Error creating service zone for service ${serviceId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to create service zone', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }

  /**
   * Get service zones
   */
  async getServiceZones(serviceId: string, page = 1, pageSize = 20): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    try {
      if (!serviceId) {
        throw ApiError.badRequest('Service ID is required', ErrorCodes.MISSING_FIELDS, { field: 'serviceId' });
      }

      const total = await prisma.zone.count({ where: { serviceId } });
      const zones = await prisma.zone.findMany({
        where: { serviceId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          service: {
            include: {
              serviceType: true,
            },
          },
        },
      });

      return { data: zones, total, page, pageSize };
    } catch (error: unknown) {
      logger.error(`Error getting service zones for service ${serviceId}: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get service zones', ErrorCodes.INTERNAL_SERVER_ERROR, { originalError: error });
    }
  }
}