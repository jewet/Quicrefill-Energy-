import { Request } from "express";

export type RequestUser = {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
};

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
    }
  }
}