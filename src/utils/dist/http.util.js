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
exports.HttpResponse = exports.BaseHttpException = void 0;
var BaseHttpException = /** @class */ (function (_super) {
    __extends(BaseHttpException, _super);
    function BaseHttpException(message, errorCode, statusCode, errors) {
        var _this = _super.call(this, message) || this;
        _this.message = message;
        _this.errorCode = errorCode;
        _this.statusCode = statusCode;
        _this.errors = errors;
        _this.name = _this.constructor.name;
        return _this;
    }
    return BaseHttpException;
}(Error));
exports.BaseHttpException = BaseHttpException;
var HttpResponse = /** @class */ (function () {
    function HttpResponse() {
    }
    HttpResponse.success = function (res, data, message, statusCode) {
        if (message === void 0) { message = 'Success'; }
        if (statusCode === void 0) { statusCode = 200; }
        return res.status(statusCode).json({
            success: true,
            message: message,
            data: data
        });
    };
    HttpResponse.error = function (res, message, statusCode, details) {
        if (statusCode === void 0) { statusCode = 400; }
        return res.status(statusCode).json({
            success: false,
            message: message,
            details: details
        });
    };
    return HttpResponse;
}());
exports.HttpResponse = HttpResponse;
