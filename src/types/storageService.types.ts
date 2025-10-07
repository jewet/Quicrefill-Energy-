// src/interfaces/storageService.interfaces.ts

// Extended interfaces to match your StorageServiceClient
export interface StorageUploadResult {
  url?: string;
  path: string;
  filePath?: string;
}

export interface IdentityDocumentUploadResult {
  documentId: number;
  frontImagePath: string;
  backImagePath?: string | null;
  selfieImagePath: string;
  homeAddressProofPath?: string | null;
  businessAddressProofPath?: string | null;
}

// Adapter interface for IdentityService to work with StorageServiceClient
export interface IdentityDocumentUrls {
  frontImageUrl: string;
  selfieImageUrl: string;
  backImageUrl?: string | null;
}

// Utility function to convert StorageServiceClient response to IdentityService format
export function adaptStorageResponse(
  storageResponse: IdentityDocumentUploadResult
): IdentityDocumentUrls {
  return {
    frontImageUrl: storageResponse.frontImagePath,
    selfieImageUrl: storageResponse.selfieImagePath || '',
    backImageUrl: storageResponse.backImagePath
  };
}

// Interface for file upload parameters
export interface FileUploadParams {
  filePath: string;
  fileName: string;
  token: string;
}

// Enhanced StorageServiceClient interface methods
export interface IStorageServiceClient {
  uploadFile(filePath: string, originalName: string, token: string): Promise<string>;
  uploadIdentityDocument(
    frontImage: string,
    documentType: string,
    token: string,
    selfieImage: string,
    backImage?: string
  ): Promise<IdentityDocumentUploadResult>;
  uploadBusinessDocument(
    proofOfAddress: string,
    cacDocument: string,
    token: string,
    tinDocument?: string
  ): Promise<any>;
  uploadVehicleDocument(
    driverLicense: string,
    vehicleRoadLicense: string,
    vehiclePlateNumber: string,
    token: string
  ): Promise<string[]>;
  getDocumentStatus(userId: string, token: string): Promise<{ status: string; reviewedAt?: Date }>;
}