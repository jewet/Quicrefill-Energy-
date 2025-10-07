import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/utils/errors/appError';
import { validate as isUuid } from 'uuid';
import axios from 'axios';
import { addressSchema, addressUpdateSchema } from '../schemas/customerAddressSchema';

interface AddressInput {
  address: string;
  latitude: number;
  longitude: number;
  state?: string;
}

interface AddressUpdateInput {
  address?: string;
  latitude?: number;
  longitude?: number;
  state?: string;
}

export interface ServiceFilters {
  radius?: number;
  serviceType?: string;
  latitude?: number;
  longitude?: number;
}

interface DistanceMatrixResult {
  distance: number; // in kilometers
  duration: number; // in minutes
}

interface ServiceResult {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  serviceType: string; // Name of the ServiceType
  distance: number; // in kilometers
}

class CustomerAddressService {
  private static readonly prisma = new PrismaClient();
  private static readonly GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

  /**
   * Create a new address for a customer
   */
  static async create(userId: string, addressData: AddressInput) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      // Validate addressData with Zod schema
      const validatedData = addressSchema.parse(addressData);

      if (!this.isValidCoordinates(validatedData.latitude, validatedData.longitude)) {
        throw new ApiError(400, 'Invalid coordinates');
      }

      const addressCount = await this.prisma.customerAddress.count({
        where: { userId },
      });

      const isDefault = addressCount === 0;

      return await this.prisma.customerAddress.create({
        data: {
          userId,
          address: validatedData.address,
          latitude: validatedData.latitude,
          longitude: validatedData.longitude,
          state: validatedData.state,
          isDefault,
        },
      });
    } catch (error) {
      console.error('Error adding address:', error);
      if (error instanceof z.ZodError) {
        throw new ApiError(400, `Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to add address');
    }
  }

  /**
   * Get all addresses for a customer
   */
  static async findAll(userId: string) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      return await this.prisma.customerAddress.findMany({
        where: { userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          address: true,
          latitude: true,
          longitude: true,
          state: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error('Error fetching addresses:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch addresses');
    }
  }

  /**
   * Get a specific address by ID
   */
  static async findOne(userId: string, addressId: string) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      if (!addressId?.trim() || !this.isValidUuid(addressId)) {
        throw new ApiError(400, 'Invalid address ID');
      }

      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
        select: {
          id: true,
          address: true,
          latitude: true,
          longitude: true,
          state: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!address) {
        throw new ApiError(404, 'Address not found');
      }

      return address;
    } catch (error) {
      console.error('Error fetching address:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch address');
    }
  }

  /**
   * Update an address
   */
  static async update(userId: string, addressId: string, updateData: AddressUpdateInput) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      if (!addressId?.trim() || !this.isValidUuid(addressId)) {
        throw new ApiError(400, 'Invalid address ID');
      }

      // Validate updateData with Zod schema
      const validatedData = addressUpdateSchema.parse(updateData);

      const existingAddress = await this.prisma.customerAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });

      if (!existingAddress) {
        throw new ApiError(404, 'Address not found');
      }

      // Check for unique constraint violation if address is being updated
      if (validatedData.address) {
        const conflictingAddress = await this.prisma.customerAddress.findFirst({
          where: {
            userId,
            address: validatedData.address,
            id: { not: addressId }, // Exclude the current address
          },
        });

        if (conflictingAddress) {
          throw new ApiError(400, 'An address with this value already exists for the user');
        }
      }

      // Validate coordinates if provided
      if (
        (validatedData.latitude !== undefined || validatedData.longitude !== undefined) &&
        !this.isValidCoordinates(
          validatedData.latitude ?? existingAddress.latitude,
          validatedData.longitude ?? existingAddress.longitude,
        )
      ) {
        throw new ApiError(400, 'Invalid coordinates');
      }

      return await this.prisma.customerAddress.update({
        where: {
          id: addressId,
        },
        data: validatedData,
        select: {
          id: true,
          address: true,
          latitude: true,
          longitude: true,
          state: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      console.error('Error updating address:', error);
      if (error instanceof z.ZodError) {
        throw new ApiError(400, `Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to update address');
    }
  }

  /**
   * Delete an address
   */
  static async remove(userId: string, addressId: string) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      if (!addressId?.trim() || !this.isValidUuid(addressId)) {
        throw new ApiError(400, 'Invalid address ID');
      }

      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });

      if (!address) {
        throw new ApiError(404, 'Address not found');
      }

      if (address.isDefault) {
        const remainingAddresses = await this.prisma.customerAddress.findMany({
          where: {
            userId,
            id: { not: addressId },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        if (remainingAddresses.length > 0) {
          await this.prisma.customerAddress.update({
            where: { id: remainingAddresses[0].id },
            data: { isDefault: true },
          });
        }
      }

      await this.prisma.customerAddress.delete({
        where: {
          id: addressId,
        },
      });

      return true;
    } catch (error) {
      console.error('Error deleting address:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to delete address');
    }
  }

  /**
   * Set an address as default
   */
  static async setDefault(userId: string, addressId: string) {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      if (!addressId?.trim() || !this.isValidUuid(addressId)) {
        throw new ApiError(400, 'Invalid address ID');
      }

      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });

      if (!address) {
        throw new ApiError(404, 'Address not found');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });

        await tx.customerAddress.update({
          where: {
            id: addressId,
          },
          data: { isDefault: true },
        });
      });

      return true;
    } catch (error) {
      console.error('Error setting default address:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to set default address');
    }
  }

  /**
   * Calculate distance and duration using Google Maps Distance Matrix API
   */
  static async getDistanceMatrix(
    origin: { latitude: number; longitude: number },
    customerAddressId: string,
  ): Promise<DistanceMatrixResult> {
    try {
      if (!this.isValidCoordinates(origin.latitude, origin.longitude)) {
        throw new ApiError(400, 'Invalid origin coordinates');
      }

      if (!customerAddressId?.trim() || !this.isValidUuid(customerAddressId)) {
        throw new ApiError(400, 'Invalid customer address ID');
      }

      const customerAddress = await this.prisma.customerAddress.findUnique({
        where: { id: customerAddressId },
        select: { latitude: true, longitude: true },
      });

      if (!customerAddress) {
        throw new ApiError(404, 'Customer address not found');
      }

      const origins = `${origin.latitude},${origin.longitude}`;
      const destinations = `${customerAddress.latitude},${customerAddress.longitude}`;

      const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins,
          destinations,
          key: this.GOOGLE_MAPS_API_KEY,
          units: 'metric',
          mode: 'driving',
        },
      });

      const data = response.data;

      if (data.status !== 'OK' || data.rows[0]?.elements[0]?.status !== 'OK') {
        throw new ApiError(500, 'Failed to fetch distance matrix from Google Maps');
      }

      const element = data.rows[0].elements[0];
      const distance = element.distance.value / 1000; // Convert meters to kilometers
      const duration = element.duration.value / 60; // Convert seconds to minutes

      return { distance, duration };
    } catch (error) {
      console.error('Error fetching distance matrix:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to calculate distance and duration');
    }
  }

  /**
   * Get nearby services based on filters
   */
  static async getNearbyServices(userId: string, filters: ServiceFilters): Promise<ServiceResult[]> {
    try {
      if (!userId?.trim() || !this.isValidUuid(userId)) {
        throw new ApiError(401, 'Invalid user ID');
      }

      // If latitude and longitude are not provided, use the user's default address
      let { latitude, longitude } = filters;
      if (!latitude || !longitude) {
        const defaultAddress = await this.prisma.customerAddress.findFirst({
          where: { userId, isDefault: true },
          select: { latitude: true, longitude: true },
        });

        if (!defaultAddress) {
          throw new ApiError(400, 'No default address found and coordinates not provided');
        }

        latitude = defaultAddress.latitude;
        longitude = defaultAddress.longitude;
      }

      if (!this.isValidCoordinates(latitude, longitude)) {
        throw new ApiError(400, 'Invalid coordinates');
      }

      // Build Prisma query conditions
      const where: any = {};
      if (filters.serviceType) {
        where.serviceType = { name: filters.serviceType };
      }

      // Fetch services with their serviceType
      const services = await this.prisma.service.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          serviceType: { select: { name: true } },
        },
      });

      // Calculate distances and filter by radius
      const radius = filters.radius || 10; // Default radius of 10km
      const nearbyServices: ServiceResult[] = services
        .filter((service) => service.latitude !== null && service.longitude !== null)
        .map((service) => {
          const distance = this.calculateHaversineDistance(
            { latitude, longitude },
            { latitude: service.latitude!, longitude: service.longitude! },
          );
          return {
            id: service.id,
            name: service.name,
            address: service.address,
            latitude: service.latitude,
            longitude: service.longitude,
            serviceType: service.serviceType.name,
            distance,
          };
        })
        .filter((service) => service.distance <= radius)
        .sort((a, b) => a.distance - b.distance); // Sort by distance ascending

      return nearbyServices;
    } catch (error) {
      console.error('Error fetching nearby services:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch nearby services');
    }
  }

  /**
   * Calculate distance between two coordinates using the Haversine formula
   * @returns Distance in kilometers
   */
  private static calculateHaversineDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number },
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * (Math.PI / 180);
    const dLon = (point2.longitude - point1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * (Math.PI / 180)) *
        Math.cos(point2.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  /**
   * Validate coordinates
   */
  private static isValidCoordinates(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Validate UUID
   */
  private static isValidUuid(id: string): boolean {
    try {
      return isUuid(id);
    } catch (error) {
      return false;
    }
  }
}

export default CustomerAddressService;