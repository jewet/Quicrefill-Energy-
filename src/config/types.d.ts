// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; // Align with Prisma User.id (String)
        name: string;
        email: string; // Align with Prisma User.email (String, non-optional)
        role: {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          name: string;
          description: string | null;
          isActive: boolean;
          createdById: string | null;
        };
      };
    }
  }
}

// Ensure the module is exported to avoid TypeScript errors
export {};