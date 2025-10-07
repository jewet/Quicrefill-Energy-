export enum ErrorCodes {
  // Auth errors
  INVALID_TOKEN = 'auth/invalid-token',
  MISSING_TOKEN = 'auth/missing-token',
  EXPIRED_TOKEN = 'auth/expired-token',
  UNAUTHORIZED = 'auth/unauthorized',
  FORBIDDEN = 'auth/forbidden',
  UNAUTHORIZED_ADMIN = 'auth/unauthorized-admin', // Added for admin-specific authentication
  ELECTRICITY_SERVICE_ERROR = 'auth/electricity-service-error', // Added for electricity service communication errors
  // API Gateway errors
  RATE_LIMIT_EXCEEDED = 'gateway/rate-limit-exceeded',
  SERVICE_UNAVAILABLE = 'gateway/service-unavailable',
  INVALID_METER_NUMBER = 'gateway/invalid-meter-number', // Added for meter number validation
  TIMEOUT = 'gateway/timeout',
  INVALID_REQUEST = 'gateway/invalid-request',
  INVALID_PAYMENT_AMOUNT = 'gateway/invalid-payment-amount', // Added for payment amount validation
  INVALID_PAYMENT_METHOD = 'gateway/invalid-payment-method', // Added for unsupported payment methods
  ELECTRICITY_NETWORK_ERROR = 'gateway/electricity-network-error', // Added for network-related errors in electricity service
  // General errors
  INTERNAL_ERROR = 'server/internal-error',
  NOT_FOUND = 'server/not-found',
  BAD_REQUEST = 'server/bad-request',
  VALIDATION_ERROR = 'server/validation-error',
  RESOURCE_NOT_FOUND = 'server/resource-not-found',
  INVALID_BOOLEAN = 'server/invalid-boolean', // Added for isEnabled validation
  INVALID_PROVIDER_ID = 'server/invalid-provider-id', // Added for electricity provider ID validation
  INVALID_SERVICE_FEE = 'server/invalid-service-fee', // Added for service fee validation
  MISSING_FIELDS = 'server/missing-fields', // Added for missing required fields
  CONFIG_HANDLER_ERROR = 'server/config-handler-error', // Added for config handler errors
  ERROR_SERVICE_FEE = 'server/error-service-fee', // Added for service fee errors,
  // Admin Service errors
  ADMIN_SERVICE_ERROR = 'admin/service-error', // Added for admin service communication errors
  NETWORK_ERROR = 'admin/network-error', // Added for network-related errors in admin service
  REQUEST_ABORTED = 'admin/request-aborted', // Added for request abort errors in admin service
  // Proxy errors
  PROXY_ERROR = 'proxy/error',
  CONNECTION_REFUSED = 'proxy/connection-refused',
  CONFLICT= 'verification/conflict',
  SERVICE_ERROR = 'proxy/service-error',
  // Wallet & Payment related error codes
  WALLET_NOT_FOUND = 'wallet/not-found',
  INSUFFICIENT_BALANCE = 'wallet/insufficient-balance',
  WITHDRAWAL_REQUEST_INVALID = 'wallet/withdrawal-request-invalid',
  WITHDRAWAL_CONFLICT = 'wallet/withdrawal-conflict',
  BANK_ACCOUNT_NOT_FOUND = 'wallet/bank-account-not-found',
  BANK_ACCOUNT_ALREADY_EXISTS = 'wallet/bank-account-already-exists',
  BANK_ACCOUNT_HAS_PENDING_TRANSACTIONS = 'wallet/bank-account-has-pending-transactions',
  TRANSACTION_NOT_FOUND = 'wallet/transaction-not-found',
  PAYMENT_SERVICE_ERROR = 'wallet/payment-service-error',
  // Storage related error codes
  MISSING_DRIVER_LICENSE = 'storage/missing-driver-license',
  VEHICLE_DOCUMENT_UPLOAD_FAILED = 'storage/vehicle-document-upload-failed',
  IDENTITY_UPLOAD_FAILED = 'storage/identity-upload-failed',
  MISSING_REQUIRED_FIELDS = 'storage/missing-required-fields',
  // Business related error codes
  BUSINESS_VERIFICATION_FAILED = 'business/verification-failed',
  BUSINESS_DOCUMENT_UPLOAD_FAILED = 'business/document-upload-failed',
  MISSING_CAC_DOCUMENT_OR_PROOF_OF_ADDRESS = 'business/missing-cac-document-or-proof-of-address',
  INVALID_ORDER_STATUS = 'order/invalid-order-status',
  ORDER_NOT_FOUND = 'order/not-found',
  SERVICE_NOT_CONFIGURED = 'service/not-configured',
  ORDER_CANCELLATION_FAILED = 'order/cancellation-failed',
  SERVICE_NOT_FOUND = 'service/not-found',
  INTERNAL_SERVER_ERROR = 'service/internal-server-error',
  ORDER_CREATION_FAILED = 'order/creation-failed',
  CALCULATION_FAILED = 'order/calculation-failed',
  INVALId_REQUEST = 'voucher/invalid-request',
  INVALID_INPUT = 'voucher/invalid-input',
  USER_NOT_FOUND = 'user/not-found',
  ADDRESS_NOT_FOUND = 'user/address-not-found',
  SERVICE_INVALID_STATUS = 'service/invalid-status',
  SERVICE_LOCATION_NOT_FOUND = 'service/location-not-found',
  ADDRESS_LOCATION_NOT_FOUND = 'user/address-location-not-found',
  GEOSPATIAL_CALCULATION_FAILED = 'service/geospatial-calculation-failed',
  INSUFFICIENT_FUNDS = 'payment/insufficient-funds',
  PAYMENT_PROCESSING_FAILED = 'payment/processing-failed',
  INVALID_CONFIRMATION_CODE = 'payment/invalid-confirmation-code',
  PAYMENT_METHOD_UNAVAILABLE = 'payment/method-unavailable',
  PAYMENT_METHOD_NOT_AVAILABLE = 'payment/method-not-available',
   DOCUMENT_ALREADY_SUBMITTED = 'document/already-submitted',
   INVALID_ROLE = 'auth/invalid-role',
}