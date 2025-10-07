"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.AppErrorCode = exports.BaseHttpException = void 0;
var BaseHttpException = /** @class */ (function (_super) {
    __extends(BaseHttpException, _super);
    function BaseHttpException(message, errorCode, statusCode, errors) {
        var _this = _super.call(this, message) || this;
        _this.message = message;
        _this.errorCode = errorCode;
        _this.statusCode = statusCode;
        _this.errors = errors;
        return _this;
    }
    return BaseHttpException;
}(Error));
exports.BaseHttpException = BaseHttpException;
var AppErrorCode;
(function (AppErrorCode) {
    AppErrorCode[AppErrorCode["USER_NOT_FOUND"] = 1001] = "USER_NOT_FOUND";
    AppErrorCode[AppErrorCode["USER_ALREADY_EXIST"] = 1002] = "USER_ALREADY_EXIST";
    AppErrorCode[AppErrorCode["INCORRECT_CREDENTIALS"] = 1003] = "INCORRECT_CREDENTIALS";
    AppErrorCode[AppErrorCode["USER_DOES_NOT_EXIST"] = 1004] = "USER_DOES_NOT_EXIST";
    AppErrorCode[AppErrorCode["EMAIL_ALREADY_VERIFIED"] = 1005] = "EMAIL_ALREADY_VERIFIED";
    AppErrorCode[AppErrorCode["PERMISSION_DENIED"] = 2001] = "PERMISSION_DENIED";
    AppErrorCode[AppErrorCode["UNAUTHENTICATED"] = 3001] = "UNAUTHENTICATED";
    AppErrorCode[AppErrorCode["INVALID_TOKEN"] = 4001] = "INVALID_TOKEN";
    AppErrorCode[AppErrorCode["INVALID_OTP"] = 4002] = "INVALID_OTP";
    AppErrorCode[AppErrorCode["UNPROCESSABLE_ENTITY"] = 5001] = "UNPROCESSABLE_ENTITY";
    AppErrorCode[AppErrorCode["NOT_FOUND"] = 6001] = "NOT_FOUND";
    AppErrorCode[AppErrorCode["INTERNAL_EXCEPTION"] = 10001] = "INTERNAL_EXCEPTION";
    AppErrorCode[AppErrorCode["INVALID_INPUT"] = 7001] = "INVALID_INPUT";
    AppErrorCode[AppErrorCode["INVALID_CREDENTIALS"] = 8001] = "INVALID_CREDENTIALS";
    AppErrorCode[AppErrorCode["TOKEN_EXPIRED"] = 8002] = "TOKEN_EXPIRED";
    AppErrorCode[AppErrorCode["UNAUTHORIZED"] = 8003] = "UNAUTHORIZED";
    AppErrorCode[AppErrorCode["INVALID_REQUEST"] = 8004] = "INVALID_REQUEST";
    AppErrorCode[AppErrorCode["PHONE_ALREADY_EXIST"] = 9001] = "PHONE_ALREADY_EXIST";
    AppErrorCode[AppErrorCode["BAD_REQUEST"] = 8005] = "BAD_REQUEST";
    AppErrorCode[AppErrorCode["DUPLICATE_DELETION_REQUEST"] = 9002] = "DUPLICATE_DELETION_REQUEST";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_NOT_FOUND"] = 9003] = "ACCOUNT_DELETION_REQUEST_NOT_FOUND";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_ALREADY_EXISTS"] = 9004] = "ACCOUNT_DELETION_REQUEST_ALREADY_EXISTS";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_UNDER_REVIEW"] = 9005] = "ACCOUNT_DELETION_REQUEST_UNDER_REVIEW";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_REJECTED"] = 9006] = "ACCOUNT_DELETION_REQUEST_REJECTED";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_APPROVED"] = 9007] = "ACCOUNT_DELETION_REQUEST_APPROVED";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_PENDING"] = 9008] = "ACCOUNT_DELETION_REQUEST_PENDING";
    AppErrorCode[AppErrorCode["ACCOUNT_DELETION_REQUEST_EXPIRED"] = 9009] = "ACCOUNT_DELETION_REQUEST_EXPIRED";
})(AppErrorCode = exports.AppErrorCode || (exports.AppErrorCode = {}));
