import { PrismaClient, Category } from '@prisma/client';
import { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema';
import { ApiError } from '../lib/utils/errors/appError';
import { Prisma } from '@prisma/client';
import { validate } from 'uuid';

const prisma = new PrismaClient();

export class CategoryService {
  /**
   * Create a new category
   * @param data - Category data
   * @returns Created category
   */
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    try {
      // Check if category with same name already exists
      const existingCategory = await prisma.category.findUnique({
        where: { name: data.name },
      });

      if (existingCategory) {
        throw new ApiError(409, 'Category with this name already exists');
      }

      // Map image to imageUrl for Prisma
      const prismaData = {
        ...data,
        imageUrl: data.image ?? 'https://via.placeholder.com/150', // Use default if image is not provided
      };
      delete prismaData.image; // Remove image field to avoid Prisma error

      return await prisma.category.create({
        data: prismaData,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      console.error('Error in createCategory service:', error);
      throw new ApiError(500, `Failed to create category: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  /**
   * Get all categories
   * @param includeProducts - Include products in response
   * @returns List of categories
   */
  async getAllCategories(includeProducts: boolean = false): Promise<Category[]> {
    try {
      return await prisma.category.findMany({
        include: {
          products: includeProducts,
        },
      });
    } catch (error: unknown) {
      console.error('Error in getAllCategories service:', error);
      throw new ApiError(500, `Failed to fetch categories: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  /**
   * Get category by ID
   * @param id - Category ID
   * @param includeProducts - Include products in response
   * @returns Category
   */
  async getCategoryById(id: string, includeProducts: boolean = false): Promise<Category> {
    try {
      // Validate ID format
      if (!id || typeof id !== 'string') {
        throw new ApiError(400, 'Invalid category ID: must be a non-empty string');
      }
      if (!validate(id)) {
        throw new ApiError(400, `Invalid category ID: must be a valid UUID (got ${id})`);
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: includeProducts,
        },
      });

      if (!category) {
        throw new ApiError(404, 'Category not found');
      }

      return category;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1001') {
        throw new ApiError(500, 'Database connection failed');
      }
      console.error(`Error fetching category with ID ${id}:`, error);
      throw new ApiError(500, `Failed to fetch category: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  /**
   * Update category
   * @param id - Category ID
   * @param data - Updated category data
   * @returns Updated category
   */
  async updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
    try {
      // Validate ID format
      if (!id || typeof id !== 'string') {
        throw new ApiError(400, 'Invalid category ID: must be a non-empty string');
      }
      if (!validate(id)) {
        throw new ApiError(400, `Invalid category ID: must be a valid UUID (got ${id})`);
      }

      const category = await prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new ApiError(404, 'Category not found');
      }

      // If name is being updated, check if it's already taken
      if (data.name && data.name !== category.name) {
        const existingCategory = await prisma.category.findUnique({
          where: { name: data.name },
        });

        if (existingCategory) {
          throw new ApiError(409, 'Category with this name already exists');
        }
      }

      // Map image to imageUrl for Prisma
      const prismaData = {
        ...data,
        imageUrl: data.image, // Map image to imageUrl
      };
      delete prismaData.image; // Remove image field to avoid Prisma error

      return await prisma.category.update({
        where: { id },
        data: prismaData,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P1001') {
          throw new ApiError(500, 'Database connection failed');
        }
        if (error.code === 'P2002') {
          throw new ApiError(409, 'Category with this name already exists');
        }
      }
      console.error(`Error updating category with ID ${id}:`, error);
      throw new ApiError(500, `Failed to update category: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  /**
   * Delete category
   * @param id - Category ID
   * @returns Deleted category
   */
  async deleteCategory(id: string): Promise<Category> {
    try {
      // Validate ID format
      if (!id || typeof id !== 'string') {
        throw new ApiError(400, 'Invalid category ID: must be a non-empty string');
      }
      if (!validate(id)) {
        throw new ApiError(400, `Invalid category ID: must be a valid UUID (got ${id})`);
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: true,
        },
      });

      if (!category) {
        throw new ApiError(404, 'Category not found');
      }

      if (category.products.length > 0) {
        throw new ApiError(400, 'Cannot delete category with associated products');
      }

      return await prisma.category.delete({
        where: { id },
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1001') {
        throw new ApiError(500, 'Database connection failed');
      }
      console.error(`Error deleting category with ID ${id}:`, error);
      throw new ApiError(500, `Failed to delete category: ${(error as Error).message || 'Unknown error'}`);
    }
  }
}