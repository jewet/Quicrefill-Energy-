"use strict";
exports.__esModule = true;
exports.validateFlutterwaveSignature = void 0;
var crypto_1 = require("crypto");
var logger_1 = require("../config/logger"); // Use singleton instance
var env_1 = require("../config/env");
function validateFlutterwaveSignature(req) {
    try {
        var signature = req.headers['verif-hash'];
        if (!signature) {
            logger_1["default"].error('No verif-hash header in webhook request', {
                headers: req.headers,
                eventType: req.body['event.type']
            });
            return false;
        }
        var webhookSecret = env_1.ENV.FLUTTERWAVE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            logger_1["default"].error('FLUTTERWAVE_WEBHOOK_SECRET is not set in environment');
            return false;
        }
        var payload = req.rawBody;
        if (!payload || !Buffer.isBuffer(payload)) {
            logger_1["default"].error('Raw body not available or not a Buffer for signature verification', {
                bodyType: typeof req.body,
                body: req.body,
                rawBodyType: typeof payload,
                rawBodyLength: (payload === null || payload === void 0 ? void 0 : payload.length) || 0,
                headers: req.headers,
                eventType: req.body['event.type']
            });
            return false;
        }
        var expectedSignature = crypto_1["default"]
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');
        var isValid = expectedSignature === signature;
        logger_1["default"].info('Webhook signature verification', {
            isValid: isValid,
            expectedSignature: expectedSignature,
            receivedSignature: signature,
            payloadLength: payload.length,
            payloadPreview: payload.toString('utf8').slice(0, 100),
            eventType: req.body['event.type'],
            webhookSecretLength: webhookSecret.length
        });
        if (!isValid) {
            logger_1["default"].error('Webhook signature validation failed', {
                expectedSignature: expectedSignature,
                receivedSignature: signature,
                payload: payload.toString('utf8'),
                eventType: req.body['event.type']
            });
        }
        return isValid;
    }
    catch (error) {
        logger_1["default"].error('Error validating Flutterwave signature', {
            message: error.message,
            stack: error.stack,
            headers: req.headers,
            eventType: req.body['event.type']
        });
        return false;
    }
}
exports.validateFlutterwaveSignature = validateFlutterwaveSignature;
