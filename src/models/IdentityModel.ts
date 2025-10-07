// src/models/IdentityModel.ts
import { DocumentType, DocumentStatus } from '@prisma/client';

export interface DocumentSubmissionRequest {
  documentType: DocumentType;
  documentNumber?: string;
  country: string;
  frontImage: string;
  backImage?: string;
  selfieImage: string; // Added selfieImage
}

export interface DocumentResponse {
  success: boolean;
  message: string;
  data?: {
    id: number;
    userId: string;
    documentType: DocumentType;
    documentNumber: string | null;
    country: string;
    frontImage: string;
    backImage: string | null;
    selfieImage: string | null; // Added selfieImage
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
  };
}