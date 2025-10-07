"use strict";
var _a, _b;
exports.__esModule = true;
exports.RoleEventApplicability = exports.EventTypeToCategory = exports.mapToEventType = exports.EventTypeMapping = exports.NotificationCategory = exports.KnownEventTypes = void 0;
var client_1 = require("@prisma/client");
var KnownEventTypes;
(function (KnownEventTypes) {
    KnownEventTypes["NEW_ORDER"] = "NEW_ORDER";
    KnownEventTypes["ORDER_UPDATE"] = "ORDER_UPDATE";
    KnownEventTypes["ORDER_CANCELLED"] = "ORDER_CANCELLED";
    KnownEventTypes["FEEDBACK_SUBMITTED"] = "FEEDBACK_SUBMITTED";
    KnownEventTypes["PASSWORD_CHANGE"] = "PASSWORD_CHANGE";
    KnownEventTypes["WALLET_EVENT"] = "WALLET_EVENT";
    KnownEventTypes["PREFERENCE_UPDATE"] = "PREFERENCE_UPDATE";
    KnownEventTypes["DISCOUNT"] = "DISCOUNT";
    KnownEventTypes["USER_REGISTRATION"] = "USER_REGISTRATION";
    KnownEventTypes["PURCHASE"] = "PURCHASE";
    KnownEventTypes["OTP_VERIFICATION"] = "OTP_VERIFICATION";
    KnownEventTypes["ACCOUNT_VERIFICATION"] = "ACCOUNT_VERIFICATION";
    KnownEventTypes["PHONE_VERIFICATION"] = "PHONE_VERIFICATION";
    KnownEventTypes["MIGRATION_VERIFICATION"] = "MIGRATION_VERIFICATION";
    KnownEventTypes["PROFILE_UPDATE"] = "PROFILE_UPDATE";
    KnownEventTypes["ORDER_CONFIRMED"] = "ORDER_CONFIRMED";
    KnownEventTypes["DELIVERY_ASSIGNED"] = "DELIVERY_ASSIGNED";
    KnownEventTypes["DELIVERY_STARTED"] = "DELIVERY_STARTED";
    KnownEventTypes["DELIVERY_COMPLETED"] = "DELIVERY_COMPLETED";
    KnownEventTypes["PAYMENT_SUCCESS"] = "PAYMENT_SUCCESS";
    KnownEventTypes["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    KnownEventTypes["PROMO_OFFER"] = "PROMO_OFFER";
    KnownEventTypes["FLASH_SALE"] = "FLASH_SALE";
    KnownEventTypes["REFERRAL_INVITE"] = "REFERRAL_INVITE";
    KnownEventTypes["VENDOR_PROMOTION"] = "VENDOR_PROMOTION";
    KnownEventTypes["APP_UPDATE"] = "APP_UPDATE";
    KnownEventTypes["MAINTENANCE_SCHEDULED"] = "MAINTENANCE_SCHEDULED";
    KnownEventTypes["MAINTENANCE_COMPLETED"] = "MAINTENANCE_COMPLETED";
    KnownEventTypes["PRIVACY_POLICY_UPDATE"] = "PRIVACY_POLICY_UPDATE";
    KnownEventTypes["SECURITY_ALERT"] = "SECURITY_ALERT";
    KnownEventTypes["PRICE_UPDATE"] = "PRICE_UPDATE";
    KnownEventTypes["REGULATORY_NEWS"] = "REGULATORY_NEWS";
    KnownEventTypes["AREA_SPECIFIC_ALERT"] = "AREA_SPECIFIC_ALERT";
    KnownEventTypes["GENERAL_ANNOUNCEMENT"] = "GENERAL_ANNOUNCEMENT";
    KnownEventTypes["VENDOR_STATUS_UPDATE"] = "VENDOR_STATUS_UPDATE";
    KnownEventTypes["WALLET_TRANSACTION"] = "WALLET_TRANSACTION";
    KnownEventTypes["ACCOUNT_DELETION_REQUEST"] = "ACCOUNT_DELETION_REQUEST";
    KnownEventTypes["PASSWORD_RESET"] = "PASSWORD_RESET";
    KnownEventTypes["REGISTRATION_SUCCESS"] = "REGISTRATION_SUCCESS";
    KnownEventTypes["REGISTRATION_FAILED"] = "REGISTRATION_FAILED";
    KnownEventTypes["LOGIN_SUCCESS"] = "LOGIN_SUCCESS";
    KnownEventTypes["OTHERS"] = "OTHERS";
})(KnownEventTypes = exports.KnownEventTypes || (exports.KnownEventTypes = {}));
var NotificationCategory;
(function (NotificationCategory) {
    NotificationCategory["TRANSACTIONAL"] = "TRANSACTIONAL";
    NotificationCategory["MARKETING"] = "MARKETING";
    NotificationCategory["OPERATIONAL"] = "OPERATIONAL";
    NotificationCategory["INFORMATIONAL"] = "INFORMATIONAL";
})(NotificationCategory = exports.NotificationCategory || (exports.NotificationCategory = {}));
exports.EventTypeMapping = {
    "password change": KnownEventTypes.PASSWORD_CHANGE,
    "wallet transaction": KnownEventTypes.WALLET_TRANSACTION,
    "deposit": KnownEventTypes.WALLET_TRANSACTION,
    "deduction": KnownEventTypes.WALLET_TRANSACTION,
    "refund": KnownEventTypes.WALLET_TRANSACTION,
    "user registration": KnownEventTypes.USER_REGISTRATION,
    "account deletion": KnownEventTypes.ACCOUNT_DELETION_REQUEST,
    "account deletion request": KnownEventTypes.ACCOUNT_DELETION_REQUEST,
    "purchase": KnownEventTypes.PURCHASE,
    "order": KnownEventTypes.PURCHASE,
    "otp": KnownEventTypes.OTP_VERIFICATION,
    "otp verification": KnownEventTypes.OTP_VERIFICATION,
    "otp_verification": KnownEventTypes.OTP_VERIFICATION,
    "account verification": KnownEventTypes.ACCOUNT_VERIFICATION,
    "phone verification": KnownEventTypes.PHONE_VERIFICATION,
    "migration verification": KnownEventTypes.MIGRATION_VERIFICATION,
    "profile update": KnownEventTypes.PROFILE_UPDATE,
    "order confirmed": KnownEventTypes.ORDER_CONFIRMED,
    "order cancelled": KnownEventTypes.ORDER_CANCELLED,
    "delivery assigned": KnownEventTypes.DELIVERY_ASSIGNED,
    "delivery started": KnownEventTypes.DELIVERY_STARTED,
    "delivery completed": KnownEventTypes.DELIVERY_COMPLETED,
    "payment success": KnownEventTypes.PAYMENT_SUCCESS,
    "payment failed": KnownEventTypes.PAYMENT_FAILED,
    "promo offer": KnownEventTypes.PROMO_OFFER,
    "flash sale": KnownEventTypes.FLASH_SALE,
    "referral invite": KnownEventTypes.REFERRAL_INVITE,
    "vendor promotion": KnownEventTypes.VENDOR_PROMOTION,
    "app update": KnownEventTypes.APP_UPDATE,
    "maintenance scheduled": KnownEventTypes.MAINTENANCE_SCHEDULED,
    "maintenance completed": KnownEventTypes.MAINTENANCE_COMPLETED,
    "privacy policy update": KnownEventTypes.PRIVACY_POLICY_UPDATE,
    "security alert": KnownEventTypes.SECURITY_ALERT,
    "price update": KnownEventTypes.PRICE_UPDATE,
    "regulatory news": KnownEventTypes.REGULATORY_NEWS,
    "area specific alert": KnownEventTypes.AREA_SPECIFIC_ALERT,
    "general announcement": KnownEventTypes.GENERAL_ANNOUNCEMENT,
    "vendor status update": KnownEventTypes.VENDOR_STATUS_UPDATE,
    "password reset": KnownEventTypes.PASSWORD_RESET,
    "registration success": KnownEventTypes.REGISTRATION_SUCCESS,
    "registration_success": KnownEventTypes.REGISTRATION_SUCCESS,
    "registration failed": KnownEventTypes.REGISTRATION_FAILED,
    "login success": KnownEventTypes.LOGIN_SUCCESS,
    "login_success": KnownEventTypes.LOGIN_SUCCESS,
    "ACCOUNT_DELETION_REQUEST": KnownEventTypes.ACCOUNT_DELETION_REQUEST,
    "MIGRATION_VERIFICATION": KnownEventTypes.MIGRATION_VERIFICATION
};
exports.mapToEventType = function (event) {
    console.log("Mapping event: " + event);
    for (var _i = 0, _a = Object.entries(exports.EventTypeMapping); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (event.toLowerCase() === key.toLowerCase()) {
            console.log("Matched key: " + key + ", value: " + value);
            return value;
        }
    }
    console.log("No exact match, returning: " + KnownEventTypes.OTHERS);
    return KnownEventTypes.OTHERS;
};
// EventTypeToCategory and RoleEventApplicability remain unchanged
exports.EventTypeToCategory = (_a = {},
    _a[KnownEventTypes.NEW_ORDER] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.ORDER_UPDATE] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.ORDER_CANCELLED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.FEEDBACK_SUBMITTED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PASSWORD_CHANGE] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.WALLET_EVENT] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PREFERENCE_UPDATE] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.DISCOUNT] = NotificationCategory.MARKETING,
    _a[KnownEventTypes.USER_REGISTRATION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PURCHASE] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.OTP_VERIFICATION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.ACCOUNT_VERIFICATION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PHONE_VERIFICATION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.MIGRATION_VERIFICATION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PROFILE_UPDATE] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.ORDER_CONFIRMED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.DELIVERY_ASSIGNED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.DELIVERY_STARTED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.DELIVERY_COMPLETED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PAYMENT_SUCCESS] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PAYMENT_FAILED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PROMO_OFFER] = NotificationCategory.MARKETING,
    _a[KnownEventTypes.FLASH_SALE] = NotificationCategory.MARKETING,
    _a[KnownEventTypes.REFERRAL_INVITE] = NotificationCategory.MARKETING,
    _a[KnownEventTypes.VENDOR_PROMOTION] = NotificationCategory.MARKETING,
    _a[KnownEventTypes.APP_UPDATE] = NotificationCategory.OPERATIONAL,
    _a[KnownEventTypes.MAINTENANCE_SCHEDULED] = NotificationCategory.OPERATIONAL,
    _a[KnownEventTypes.MAINTENANCE_COMPLETED] = NotificationCategory.OPERATIONAL,
    _a[KnownEventTypes.PRIVACY_POLICY_UPDATE] = NotificationCategory.OPERATIONAL,
    _a[KnownEventTypes.SECURITY_ALERT] = NotificationCategory.OPERATIONAL,
    _a[KnownEventTypes.PRICE_UPDATE] = NotificationCategory.INFORMATIONAL,
    _a[KnownEventTypes.REGULATORY_NEWS] = NotificationCategory.INFORMATIONAL,
    _a[KnownEventTypes.AREA_SPECIFIC_ALERT] = NotificationCategory.INFORMATIONAL,
    _a[KnownEventTypes.GENERAL_ANNOUNCEMENT] = NotificationCategory.INFORMATIONAL,
    _a[KnownEventTypes.VENDOR_STATUS_UPDATE] = NotificationCategory.INFORMATIONAL,
    _a[KnownEventTypes.WALLET_TRANSACTION] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.ACCOUNT_DELETION_REQUEST] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.PASSWORD_RESET] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.REGISTRATION_SUCCESS] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.REGISTRATION_FAILED] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.LOGIN_SUCCESS] = NotificationCategory.TRANSACTIONAL,
    _a[KnownEventTypes.OTHERS] = NotificationCategory.INFORMATIONAL,
    _a);
exports.RoleEventApplicability = (_b = {},
    _b[KnownEventTypes.NEW_ORDER] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.ORDER_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.ORDER_CANCELLED] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.FEEDBACK_SUBMITTED] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.PASSWORD_CHANGE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.WALLET_EVENT] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.FINANCE_MANAGER,
    ],
    _b[KnownEventTypes.PREFERENCE_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.DISCOUNT] = [
        client_1.Role.CUSTOMER,
    ],
    _b[KnownEventTypes.USER_REGISTRATION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.PURCHASE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.FINANCE_MANAGER,
    ],
    _b[KnownEventTypes.OTP_VERIFICATION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.ACCOUNT_VERIFICATION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.PHONE_VERIFICATION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.MIGRATION_VERIFICATION] = [
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.PROFILE_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.ORDER_CONFIRMED] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.DELIVERY_ASSIGNED] = [
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.CUSTOMER,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.DELIVERY_STARTED] = [
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.CUSTOMER,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.DELIVERY_COMPLETED] = [
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.PAYMENT_SUCCESS] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.PAYMENT_FAILED] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.PROMO_OFFER] = [
        client_1.Role.CUSTOMER,
    ],
    _b[KnownEventTypes.FLASH_SALE] = [
        client_1.Role.CUSTOMER,
    ],
    _b[KnownEventTypes.REFERRAL_INVITE] = [
        client_1.Role.CUSTOMER,
    ],
    _b[KnownEventTypes.VENDOR_PROMOTION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
    ],
    _b[KnownEventTypes.APP_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.MAINTENANCE_SCHEDULED] = [
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.MAINTENANCE_COMPLETED] = [
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.PRIVACY_POLICY_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.SECURITY_ALERT] = [
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.PRICE_UPDATE] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
    ],
    _b[KnownEventTypes.REGULATORY_NEWS] = [
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
    ],
    _b[KnownEventTypes.AREA_SPECIFIC_ALERT] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.GENERAL_ANNOUNCEMENT] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.VENDOR_STATUS_UPDATE] = [
        client_1.Role.VENDOR,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SERVICE_REP,
    ],
    _b[KnownEventTypes.WALLET_TRANSACTION] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.FINANCE_MANAGER,
    ],
    _b[KnownEventTypes.ACCOUNT_DELETION_REQUEST] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
    ],
    _b[KnownEventTypes.PASSWORD_RESET] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.REGISTRATION_SUCCESS] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.REGISTRATION_FAILED] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    _b[KnownEventTypes.LOGIN_SUCCESS] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
        client_1.Role.ADMIN,
    ],
    _b[KnownEventTypes.OTHERS] = [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.DELIVERY_REP,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
    ],
    _b);
