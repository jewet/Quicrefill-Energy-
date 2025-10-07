export interface EmailPayload {
  subject: string;
  htmlContent: string;
  to: string | string[];
}

export interface BulkEmailRequest {
  templateId?: string;
  eventType?: string;
  roles?: string[]; // Array of role IDs or names
  customPayload?: EmailPayload;
  userIds?: string[];
  metadata?: { [key: string]: string | number | boolean | undefined };
}

export interface EmailTemplateRequest {
  name: string;
  subject: string;
  htmlContent: string;
  roles?: string[]; // Array of role IDs or names
  eventType?: string;
  isActive?: boolean;
}