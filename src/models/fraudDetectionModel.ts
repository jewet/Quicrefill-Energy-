export interface FraudCheckRequest {
    userId: string;
    amount: number;
    type: string;
    entityType: string;
    entityId: string;
    vendorId?: string;
  }
  
  export interface FraudAlertFilter {
    userId?: string;
    vendorId?: string;
    type?: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
  }