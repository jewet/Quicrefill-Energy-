export interface NotificationRequest {
  userId?: string;
  vendorId?: string;
  title: string;
  message: string;
  type: string;
  channel?: "EMAIL" | "SMS" | "PUSH";
  metadata?: Record<string, any>;
}

export interface ResendNotificationRequest {
  notificationId: string;
}

export interface NotificationLogFilter {
  userId?: string;
  vendorId?: string;
  type?: string;
  status?: "SUCCESS" | "FAILED" | "PARTIAL";
  startDate?: string;
  endDate?: string;
}