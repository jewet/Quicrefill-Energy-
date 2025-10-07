import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { ENV } from '../config/env';
import { Logger } from './logger';
import { UnauthorizedRequest } from '../exceptions/unauthorizedRequests';
import { AppErrorCode } from '../exceptions/root';

interface ServiceResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export class ServiceClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ServiceClient');
    if (!ENV.API_GATEWAY_URL) {
      this.logger.error('API_GATEWAY_URL is not defined');
      throw new Error('API_GATEWAY_URL is not defined');
    }
    this.client = axios.create({
      baseURL: `${ENV.API_GATEWAY_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Log requests and responses
    this.client.interceptors.request.use((config) => {
      this.logger.info(`Making request to ${config.url}`, {
        method: config.method,
        headers: { ...config.headers, Authorization: '[REDACTED]' },
      });
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        this.logger.info(`Response from ${response.config.url}`, { status: response.status });
        return response;
      },
      (error) => {
        this.logger.error(`Request failed for ${error.config?.url}`, {
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  async uploadFile(
    service: string,
    path: string,
    files: { field: string; file: Express.Multer.File }[],
    token: string,
    extraData?: Record<string, any>
  ): Promise<ServiceResponse<{ filePath: string }>> {
    try {
      const form = new FormData();
      files.forEach(({ field, file }) => {
        form.append(field, file.buffer, file.originalname);
      });
      if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
          form.append(key, value);
        });
      }

      const response = await this.client.post<ServiceResponse<{ filePath: string }>>(
        `/${service}${path}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...form.getHeaders(),
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'File upload failed');
      }

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new UnauthorizedRequest('Invalid or expired token', AppErrorCode.INVALID_TOKEN);
        }
        throw new Error(`Failed to upload file: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async request<T>(
    service: string,
    method: string,
    path: string,
    data?: any,
    token?: string
  ): Promise<ServiceResponse<T>> {
    try {
      const response = await this.client.request<ServiceResponse<T>>({
        method,
        url: `/${service}${path}`,
        data,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Request failed');
      }

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new UnauthorizedRequest('Invalid or expired token', AppErrorCode.INVALID_TOKEN);
        }
        throw new Error(`Failed to make request: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}

export const serviceClient = new ServiceClient();