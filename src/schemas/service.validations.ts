import { body, param, query } from 'express-validator';
import { z } from 'zod';

// Validation middleware for createService
export const createServiceValidation = [
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('businessName').optional().isString().notEmpty().withMessage('Business name must be a non-empty string'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('serviceTypeId').isUUID().withMessage('Service type ID must be a valid UUID'),
  body('pricePerUnit')
    .isFloat({ min: 0.01 })
    .withMessage('Price per unit must be a positive number'),
  body('deliveryCostPerKm')
    .isFloat({ min: 0 })
    .withMessage('Delivery cost per km must be a non-negative number'),
  body('minimumOrder')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order must be a positive integer'),
  body('businessHours')
    .isString()
    .notEmpty()
    .withMessage('Business hours must be provided')
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          days.every(
            (day) =>
              parsed[day] === 'closed' ||
              /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(parsed[day])
          )
        );
      } catch (error) {
        throw new Error('Business hours must be a valid JSON object');
      }
    })
    .withMessage('Business hours must have valid time ranges (HH:mm-HH:mm) or "closed" for each day'),
  body('expectedDeliveryTime')
    .isInt({ min: 1 })
    .withMessage('Expected delivery time must be a positive integer'),
  body('address').isString().notEmpty().withMessage('Address is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('serviceRadius').isFloat({ min: 0.01 }).withMessage('Service radius must be a positive number'),
  body('providerId').isUUID().withMessage('Provider ID must be a valid UUID'),
  body('businessVerificationId')
    .optional()
    .isUUID()
    .withMessage('Business verification ID must be a valid UUID'),
  body('licenseIds')
    .optional()
    .isString()
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((id: string) => z.string().uuid().safeParse(id).success);
      } catch (error) {
        throw new Error('License IDs must be a valid JSON array');
      }
    })
    .withMessage('License IDs must be a JSON array of valid UUIDs'),
  body('vehicleIds')
    .optional()
    .isString()
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((id: string) => z.string().uuid().safeParse(id).success);
      } catch (error) {
        throw new Error('Vehicle IDs must be a valid JSON array');
      }
    })
    .withMessage('Vehicle IDs must be a JSON array of valid UUIDs'),
  body('status')
    .optional()
    .isIn(['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISCONTINUED'])
    .withMessage('Invalid status'),
  body('Contact').optional().isString().withMessage('Contact must be a string'),
  body('baseServicePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base service price must be a non-negative number'),
  body('lgaId').optional().isInt().withMessage('LGA ID must be an integer'),
  body('cityId').optional().isInt().withMessage('City ID must be an integer'),
  body('stateId').optional().isInt().withMessage('State ID must be an integer'),
  body('countryId').optional().isInt().withMessage('Country ID must be an integer'),
];

// Validation middleware for updateService
export const updateServiceValidation = [
  param('id').isUUID().withMessage('Invalid service ID'),
  body('name').optional().isString().notEmpty().withMessage('Name must be a non-empty string'),
  body('businessName')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('Business name must be a non-empty string'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('serviceTypeId').optional().isUUID().withMessage('Service type ID must be a valid UUID'),
  body('pricePerUnit')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Price per unit must be a positive number'),
  body('deliveryCostPerKm')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery cost per km must be a non-negative number'),
  body('minimumOrder')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order must be a positive integer'),
  body('businessHours')
    .optional()
    .isString()
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          days.every(
            (day) =>
              parsed[day] === 'closed' ||
              /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(parsed[day])
          )
        );
      } catch (error) {
        throw new Error('Business hours must be a valid JSON object');
      }
    })
    .withMessage('Business hours must have valid time ranges (HH:mm-HH:mm) or "closed" for each day'),
  body('expectedDeliveryTime')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Expected delivery time must be a positive integer'),
  body('address').optional().isString().notEmpty().withMessage('Address must be a non-empty string'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('serviceRadius')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Service radius must be a positive number'),
  body('status')
    .optional()
    .isIn(['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISCONTINUED'])
    .withMessage('Invalid status'),
  body('Contact').optional().isString().withMessage('Contact must be a string'),
  body('baseServicePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base service price must be a non-negative number'),
  body('lgaId').optional().isInt().withMessage('LGA ID must be an integer'),
  body('cityId').optional().isInt().withMessage('City ID must be an integer'),
  body('stateId').optional().isInt().withMessage('State ID must be an integer'),
  body('countryId').optional().isInt().withMessage('Country ID must be an integer'),
];

// Validation middleware for updateServiceStatus
export const updateServiceStatusValidation = [
  param('id').isUUID().withMessage('Invalid service ID'),
  body('status')
    .isIn(['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISCONTINUED'])
    .withMessage('Invalid status'),
];

// Validation middleware for toggleServiceActiveStatus
export const toggleServiceActiveStatusValidation = [
  param('id').isUUID().withMessage('Invalid service ID'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

// Validation middleware for createServiceReview
export const createServiceReviewValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isString().withMessage('Comment must be a string'),
  body('reviewerName').isString().notEmpty().withMessage('Reviewer name is required'),
  body('reviewerId').isUUID().withMessage('Reviewer ID must be a valid UUID'),
];

// Validation middleware for createServiceVerification
export const createServiceVerificationValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  body('documentUrls')
    .isArray()
    .withMessage('Document URLs must be an array')
    .custom((value) => value.every((url: string) => z.string().url().safeParse(url).success))
    .withMessage('Document URLs must be valid URLs'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

// Validation middleware for getAllServices
export const getAllServicesValidation = [
  query('providerId').optional().isUUID().withMessage('Invalid provider ID'),
  query('providerRole')
    .optional()
    .isIn(['ADMIN', 'VENDOR', 'DELIVERY_REP'])
    .withMessage('Invalid provider role'),
  query('status')
    .optional()
    .isIn(['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISCONTINUED'])
    .withMessage('Invalid status'),
  query('serviceTypeId').optional().isUUID().withMessage('Invalid service type ID'),
  query('verified').optional().isIn(['true', 'false']).withMessage('Verified must be true or false'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .default('1'),
  query('pageSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page size must be a positive integer')
    .default('20'),
  query('lgaId').optional().isInt().withMessage('LGA ID must be an integer'),
  query('cityId').optional().isInt().withMessage('City ID must be an integer'),
  query('stateId').optional().isInt().withMessage('State ID must be an integer'),
  query('countryId').optional().isInt().withMessage('Country ID must be an integer'),
];

// Validation middleware for getNearbyServices
export const getNearbyServicesValidation = [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Radius must be a positive integer')
    .default('30'),
  query('serviceTypeId').optional().isUUID().withMessage('Invalid service type ID'),
  query('providerId').optional().isUUID().withMessage('Invalid provider ID'),
  query('providerRole')
    .optional()
    .isIn(['ADMIN', 'VENDOR', 'DELIVERY_REP'])
    .withMessage('Invalid provider role'),
  query('status')
    .optional()
    .isIn(['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISCONTINUED'])
    .withMessage('Invalid status'),
  query('verified').optional().isIn(['true', 'false']).withMessage('Verified must be true or false'),
  query('isOpen').optional().isBoolean().withMessage('isOpen must be a boolean'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .default('1'),
  query('pageSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page size must be a positive integer')
    .default('20'),
];

// Validation middleware for createServiceZone
export const createServiceZoneValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('minDeliveryDays')
    .isInt({ min: 0 })
    .withMessage('Minimum delivery days must be a non-negative integer'),
  body('maxDeliveryDays')
    .isInt({ min: 0 })
    .withMessage('Maximum delivery days must be a non-negative integer'),
  body('orderCutoffTime').isString().notEmpty().withMessage('Order cutoff time is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('serviceRadius')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Service radius must be a positive number'),
  body('priceMultiplier')
    .isFloat({ min: 0 })
    .withMessage('Price multiplier must be a non-negative number'),
  body('address').optional().isString().withMessage('Address must be a string'),
];

// Validation middleware for addServiceToLocality
export const addServiceToLocalityValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  body('lgaId').optional().isInt().withMessage('LGA ID must be an integer'),
  body('cityId').optional().isInt().withMessage('City ID must be an integer'),
  body('stateId').optional().isInt().withMessage('State ID must be an integer'),
  body('countryId').optional().isInt().withMessage('Country ID must be an integer'),
  body().custom((value) => {
    if (!value.lgaId && !value.cityId && !value.stateId && !value.countryId) {
      throw new Error('At least one locality ID is required');
    }
    return true;
  }),
];

// Validation middleware for getServiceZones
export const getServiceZonesValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('pageSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page size must be a positive integer'),
];

// Validation middleware for addServiceToZone
export const addServiceToZoneValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  param('zoneId').isUUID().withMessage('Invalid zone ID'),
];

// Validation middleware for getServiceById
export const getServiceByIdValidation = [
  param('id').isUUID().withMessage('Invalid service ID'),
];

// Validation middleware for getProviderServices
export const getProviderServicesValidation = [
  param('providerId').isUUID().withMessage('Invalid provider ID'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('pageSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page size must be a positive integer'),
];

// Validation middleware for checkVerificationStatus
export const checkVerificationStatusValidation = [
  param('serviceId').isUUID().withMessage('Invalid service ID'),
];

// Validation middleware for getServicesByLocality
export const getServicesByLocalityValidation = [
  param('localityType')
    .isIn(['lga', 'city', 'state', 'country'])
    .withMessage('Invalid locality type'),
  param('localityId').isInt().withMessage('Locality ID must be an integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('pageSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page size must be a positive integer'),
];

// Validation middleware for deleteService
export const deleteServiceValidation = [
  param('id').isUUID().withMessage('Invalid service ID'),
];