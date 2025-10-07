import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../../services/category.service';
import { createCategorySchema, updateCategorySchema } from '../../schemas/category.schema';

const categoryService = new CategoryService();

// Explicitly export the CategoryController class
export class CategoryController {
  constructor() {
    this.createCategory = this.createCategory.bind(this);
    this.getAllCategories = this.getAllCategories.bind(this);
    this.getCategoryById = this.getCategoryById.bind(this);
    this.updateCategory = this.updateCategory.bind(this);
    this.deleteCategory = this.deleteCategory.bind(this);
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createCategorySchema.parse(req.body);
      const category = await categoryService.createCategory(validatedData);
      res.status(201).json({
        status: 'success',
        data: category,
      });
    } catch (error) {
      console.error('Error in createCategory controller:', error);
      next(error);
    }
  }

  async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeProducts = req.query.includeProducts === 'true';
      const categories = await categoryService.getAllCategories(includeProducts);
      res.status(200).json({
        status: 'success',
        results: categories.length,
        data: categories,
      });
    } catch (error) {
      console.error('Error in getAllCategories controller:', error);
      next(error);
    }
  }

  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const includeProducts = req.query.includeProducts === 'true';
      const category = await categoryService.getCategoryById(id, includeProducts);
      res.status(200).json({
        status: 'success',
        data: category,
      });
    } catch (error) {
      console.error(`Error in getCategoryById controller with ID ${req.params.id}:`, error);
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateCategorySchema.parse(req.body);
      const category = await categoryService.updateCategory(id, validatedData);
      res.status(200).json({
        status: 'success',
        data: category,
      });
    } catch (error) {
      console.error(`Error in updateCategory controller with ID ${req.params.id}:`, error);
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await categoryService.deleteCategory(id);
      res.status(200).json({
        status: 'success',
        message: 'Category successfully deleted',
      });
    } catch (error) {
      console.error(`Error in deleteCategory controller with ID ${req.params.id}:`, error);
      next(error);
    }
  }
}