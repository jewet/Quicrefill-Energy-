import { DocumentType, DocumentStatus } from '@prisma/client';

export interface DocumentStatusRequest {
  userId: string;
  documentId: number;
  status: DocumentStatus;
}

export interface DocumentStatusResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: number;
    userId: string;
    documentType: DocumentType;
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
  }> | [];
}

export interface DocumentStatusUpdateResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    userId: string;
    documentType: DocumentType;
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
  };
}