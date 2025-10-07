export interface AuditLogRequest {
    userId: string;
    action: string;
    details: Record<string, any>;
    entityType?: string;
    entityId?: string;
    notes?: string;
    investigationStatus?: string;
    investigatedBy?: string;
  }
  
  export interface AuditLogFilter {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    investigationStatus?: string;
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
  }