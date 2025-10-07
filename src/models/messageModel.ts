import { Role } from "@prisma/client";

// Define a restrictive metadata type for use in services
export interface Metadata {
  [key: string]: string | number | boolean | undefined;
}

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  roles: Role[];
  eventTypeId: string | null;
  updatedBy: string;
  updatedAt: Date;
  isActive: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  roles: Role[];
  eventTypeId: string | null | undefined;
  updatedBy: string;
  updatedAt: Date;
  isActive: boolean;
}

export interface PushTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  roles: Role[];
  eventTypeId: string | null;
  updatedBy: string;
  updatedAt: Date;
  isActive: boolean;
}

export interface SMSPayload {
  content: string;
  to: string | string[];
}

export interface EmailPayload {
  subject: string;
  htmlContent: string;
  to: string | string[];
}

export interface BulkSMSRequest {
  templateId?: string;
  eventType?: string;
  roles?: string[];
  customPayload?: SMSPayload;
  userIds?: string[];
  metadata?: Metadata;
}

export interface BulkEmailRequest {
  templateId?: string;
  eventType?: string;
  roles?: string[];
  customPayload?: {
    to: string | string[];
    subject: string;
    htmlContent: string;
    from?: string;
  };
  userIds?: string[];
  metadata?: Metadata;
}

export interface SMSTemplateRequest {
  name: string;
  content: string;
  roles?: string[];
  eventTypeId?: string | null;
  isActive?: boolean;
}

export interface EmailTemplateRequest {
  name: string;
  subject: string;
  htmlContent: string;
  roles?: string[];
  eventTypeId?: string | null;
  isActive?: boolean;
}

// Alias for Metadata to maintain compatibility
export type JsonSerializableMetadata = Metadata;