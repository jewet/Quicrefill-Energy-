// src/services/storageServiceClient.ts
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { ENV } from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';
import util from 'util';

const API_GATEWAY_URL = ENV.API_GATEWAY_URL || 'http://localhost:4000';

export interface UploadDocumentResponse {
  success: boolean;
  message: string;
  data: {
    documentId?: number;
    filePath: string;
    [key: string]: any;
  };
}

export interface IdentityDocumentResponse {
  success: boolean;
  message: string;
  data: {
    documentId: number;
    frontImagePath: string;
    backImagePath?: string | null;
    selfieImagePath?: string | null;
    homeAddressProofPath?: string | null;
    businessAddressProofPath?: string | null;
  };
}
export interface VehicleDocumentResponse {
  success: boolean;
  message: string;
  data: {
    filePathDriverLicense: string;
    filePathVehicleRoadLicense: string;
    filePathVehiclePlateNumber: string;
  };
}
export interface BusinessDocumentResponse {
  success: boolean;
  message: string;
  data: {
    cacDocumentPath: string;
    proofOfAddressPath: string;
    tinDocumentPath?: string | null;
  };
}
    

export interface DocumentStatusResponse {
  success: boolean;
  data: {
    status: string;
    reviewedAt?: Date;
  } | null;
}

export class StorageServiceClient {
  /**
   * Upload a single file to the storage service
   */
  static async uploadFile(
    filePath: string,
    originalName: string,
    token: string
  ): Promise<string> {
    try {
      console.log(`Token: ${token}`); 
      console.log(`API Gateway URL: ${API_GATEWAY_URL}`);
      console.log(`Full request URL: ${API_GATEWAY_URL}/api/storage/upload`);
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename: originalName,
      });
      const getLength =  util.promisify(formData.getLength.bind(formData));
      const contentLength = await getLength();

      const response = await axios.post<UploadDocumentResponse>(
        `${API_GATEWAY_URL}/api/storage/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`,
            'Content-Length': contentLength,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      if (!response.data.success) {
        throw ApiError.badRequest(
          response.data.message || 'File upload failed'
        );
      }
      const baseUrl = ENV.API_GATEWAY_URL || 'http://localhost:4000';
      const fileURLToPath = `${baseUrl}/api/storage/upload/${response.data.data.filePath}`;
      console.log(`File URL: ${fileURLToPath}`);
      logger.info(`File uploaded successfully: ${fileURLToPath}`);
      return fileURLToPath;
    } catch (error: any) {
      logger.error(`Failed to upload file to storage service: ${error.message}`);
      throw ApiError.badRequest(
        error.message || 'File upload failed'
      ); 
    }
  }

  /**
   * Upload identity document with optional back image and selfie
   */
  static async uploadIdentityDocument(
    frontImage: string,
    documentType: string,
    token: string,
    selfieImage: string,
    backImage?: string,
  ): Promise<IdentityDocumentResponse['data']> {
    try {
      const formData = new FormData();
      formData.append('frontImage', fs.createReadStream(frontImage));
      formData.append('selfieImage', fs.createReadStream(selfieImage));
      formData.append('documentType', documentType);
      if (backImage) {
        formData.append('backImage', fs.createReadStream(backImage));
      }

  

  

      const response = await axios.post<IdentityDocumentResponse>(
        `${API_GATEWAY_URL}/api/storage/upload-identity`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.data.success) {
        // throw new Error(response.data.message || 'Failed to upload identity document');
        throw ApiError.badRequest(
          response.data.message || 'Failed to upload identity document'
        );
      }
      const frontImagePath = response.data.data.frontImagePath;
      const backImagePath = response.data.data.backImagePath;
      const selfieImagePath = response.data.data.selfieImagePath;

      if(!frontImagePath || !selfieImagePath){
        throw ApiError.badRequest(
          'One or more document paths missing in response'
        );
      }
      const baseUrl = ENV.API_GATEWAY_URL || 'http://localhost:4000';
      const frontImageURL = `${baseUrl}/api/storage/upload-identity/${frontImagePath}`;
      const selfieImageURL = `${baseUrl}/api/storage/upload-identity/${selfieImagePath}`;

      let backImageURL = null;
      if (backImagePath) {
        backImageURL = `${baseUrl}/api/storage/upload-identity/${backImagePath}`;
      }

      logger.info(`Identity document uploaded successfully: ${frontImageURL}, ${backImageURL}, ${selfieImageURL}`);

      return {
        documentId: response.data.data.documentId,
        frontImagePath: frontImageURL,
        backImagePath: backImageURL,
        selfieImagePath: selfieImageURL,
      };
    } catch (error: any) {
      logger.error(`Failed to upload identity document: ${error.message}`);
      // throw new Error(`Identity document upload failed: ${error.message}`);
      throw ApiError.badRequest(
        error.message || 'Identity document upload failed'
      );
    }
  }

  /**
   * Upload business verification document
   */
  static async uploadBusinessDocument(
    proofOfAddress: string,
    cacDocument: string,
    token: string,
    tinDocument?: string,
  ): Promise<BusinessDocumentResponse['data']> {
    try {
      const formData = new FormData();
      formData.append('cacDocument', fs.createReadStream(cacDocument));
      formData.append('proofOfAddress', fs.createReadStream(proofOfAddress));
      if (tinDocument) {
        formData.append('tinDocument', fs.createReadStream(tinDocument));
      }
      

      const response = await axios.post<BusinessDocumentResponse>(
        `${API_GATEWAY_URL}/api/storage/upload-business-documents`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log('Response from storage service:', response);

      if (!response.data.success) {
        throw ApiError.badRequest(
          response.data.message || 'Business document upload failed'
        );
      }
      const cacDocumentPath = response.data.data.cacDocumentPath;
      const proofOfAddressPath = response.data.data.proofOfAddressPath;
      const tinDocumentPath = response.data.data.tinDocumentPath;

      if (!cacDocumentPath || !proofOfAddressPath) {
        throw ApiError.badRequest(
          'One or more document paths missing in response'
        );
      }
      const baseUrl = ENV.API_GATEWAY_URL || 'http://localhost:4000';
      const cacDocumentURL = `${baseUrl}/api/storage/upload-business-doc/${cacDocumentPath}`;
      const proofOfAddressURL = `${baseUrl}/api/storage/upload-business-doc/${proofOfAddressPath}`;
      let tinDocumentURL = null;
      if (tinDocumentPath) {
        tinDocumentURL = `${API_GATEWAY_URL}/api/storage/upload-business-doc/${tinDocumentPath}`;
      }
      logger.info(`Business document uploaded successfully: ${cacDocumentURL}, ${proofOfAddressURL}`);

      return {
        cacDocumentPath: cacDocumentURL,
        proofOfAddressPath: proofOfAddressURL,
        tinDocumentPath: tinDocumentURL,
      };
    } catch (error: any) {
      logger.error(`Failed to upload business document: ${error.message}`);
      throw ApiError.badRequest(
        error.message || 'Business document upload failed'
      );
    }
  }

  /**
   * Upload vehicle verification document
   */
  static async uploadVehicleDocument(
    driverLicense: string,
    vehicleRoadLicense: string,
    vehiclePlateNumber: string,
    token: string
  ): Promise<string[]> {
    try {
      const formData = new FormData();
      formData.append('driverLicense', fs.createReadStream(driverLicense));
      formData.append('vehicleRoadLicense', fs.createReadStream(vehicleRoadLicense));
      formData.append('vehiclePlateNumber', fs.createReadStream(vehiclePlateNumber));
      const response = await axios.post<UploadDocumentResponse>(
        `${API_GATEWAY_URL}/api/storage/vehicle-documents`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      console.log('Response from storage service:', JSON.stringify(response.data, null, 2));
      if (!response.data.success) {
        throw ApiError.badRequest(
          response.data.message || 'Vehicle document upload failed'
        );
      }
      const driverLicensePath = response.data.data.filePathDriverLicense;
      const vehicleRoadLicensePath = response.data.data.filePathVehicleRoadLicense;
      const vehiclePlateNumberPath = response.data.data.filePathVehiclePlateNumber;

      if (!driverLicensePath || !vehicleRoadLicensePath || !vehiclePlateNumberPath) {
        throw ApiError.badRequest(
          'One or more document paths missing in response'
        );
      }
      const baseUrl =ENV.API_GATEWAY_URL || 'http://localhost:4000';
      const driverLicenseURL = `${baseUrl}/api/storage/vehicle-documents/${driverLicensePath}`;
      const vehicleRoadLicenseURL = `${baseUrl}/api/storage/vehicle-documents/${vehicleRoadLicensePath}`;
      const vehiclePlateNumberURL = `${baseUrl}/api/storage/vehicle-documents/${vehiclePlateNumberPath}`;
      logger.info(`Vehicle document uploaded successfully: ${driverLicenseURL}, ${vehicleRoadLicenseURL}, ${vehiclePlateNumberURL}`);
      
      return [driverLicenseURL, vehicleRoadLicenseURL, vehiclePlateNumberURL];
      }catch (error: any) {
        logger.error(`Failed to upload vehicle document: ${error.message}`);
        throw ApiError.badRequest(
          error.message || 'Vehicle document upload failed'
        );
      }
  }
        



  /**
   * Get document verification status
   */
  static async getDocumentStatus(userId: string, token: string): Promise<{ status: string; reviewedAt?: Date }> {
    try {
      const response = await axios.get<DocumentStatusResponse>(
        `${API_GATEWAY_URL}/api/storage/identity-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.data.success) {
        throw ApiError.badRequest(
           'Failed to get document status'
        );
      }

      return response.data.data || { status: 'NOT_FOUND' };
    } catch (error: any) {
      logger.error(`Failed to get document status: ${error.message}`);
      throw ApiError.badRequest(
        error.message || 'Failed to get document status'
      );
    }
  }
}