declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; // Align with Prisma User.id (String)
        name: string;
        email: string; // Align with Prisma User.email (String, non-optional)
        role: string; // Changed from Role object to string to align with AuthUser
      };
    }
  }
}

// Ensure the module is exported to avoid TypeScript errors
export {};