import { Router, Request, Response, NextFunction } from "express";
import { CategoryController } from "../../controllers/category/category.controller";
import { validateUuid } from "../../middlewares/validateUuid";
import { authenticationMiddleware, authorizeRoles } from "../../middlewares/authentication";

// Initialize the category controller
const categoryController = new CategoryController();
const router: Router = Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Debug route to confirm router is mounted (no auth required)
router.get("/test", (req: Request, res: Response) => {
  console.log("[CategoryRouter] Test route hit");
  res.json({ message: "Category router is working" });
});

// Create a new category (ADMIN only)
router.post(
  "/create",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authorizeRoles(["ADMIN"])),
  (req: Request, res: Response, next: NextFunction) => {
    console.log("[CategoryRouter] POST /create hit");
    categoryController.createCategory(req, res, next);
  }
);

// Get all categories (authenticated users)
router.get(
  "/categories",
  asyncHandler(authenticationMiddleware),
  (req: Request, res: Response, next: NextFunction) => {
    console.log("[CategoryRouter] GET /categories hit");
    categoryController.getAllCategories(req, res, next);
  }
);

// Get category by ID (authenticated users)
router.get(
  "/categories/:id",
  asyncHandler(authenticationMiddleware),
  validateUuid("id"),
  (req: Request, res: Response, next: NextFunction) => {
    console.log(`[CategoryRouter] GET /categories/:id hit, ID: ${req.params.id}`);
    categoryController.getCategoryById(req, res, next);
  }
);

// Update category (ADMIN only, support both PATCH and PUT)
router.patch(
  "/categories/:id",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authorizeRoles(["ADMIN"])),
  validateUuid("id"),
  (req: Request, res: Response, next: NextFunction) => {
    console.log(`[CategoryRouter] PATCH /categories/:id hit, ID: ${req.params.id}`);
    categoryController.updateCategory(req, res, next);
  }
);

// Add PUT route for compatibility
router.put(
  "/categories/:id",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authorizeRoles(["ADMIN"])),
  validateUuid("id"),
  (req: Request, res: Response, next: NextFunction) => {
    console.log(`[CategoryRouter] PUT /categories/:id hit, ID: ${req.params.id}`);
    categoryController.updateCategory(req, res, next);
  }
);

// Delete category (ADMIN only)
router.delete(
  "/categories/:id",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authorizeRoles(["ADMIN"])),
  validateUuid("id"),
  (req: Request, res: Response, next: NextFunction) => {
    console.log(`[CategoryRouter] DELETE /categories/:id hit, ID: ${req.params.id}`);
    categoryController.deleteCategory(req, res, next);
  }
);

export default router;