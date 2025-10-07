import crypto from 'crypto';
import { Request } from 'express';
import logger  from '../config/logger'; // Use singleton instance
import { ENV } from '../config/env';

export function validateFlutterwaveSignature(req: Request): boolean {
  try {
    const signature = req.headers['verif-hash'] as string;
    if (!signature) {
      logger.error('No verif-hash header in webhook request', {
        headers: req.headers,
        eventType: req.body['event.type'],
      });
      return false;
    }

    const webhookSecret = ENV.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('FLUTTERWAVE_WEBHOOK_SECRET is not set in environment');
      return false;
    }

    const payload = (req as any).rawBody;
    if (!payload || !Buffer.isBuffer(payload)) {
      logger.error('Raw body not available or not a Buffer for signature verification', {
        bodyType: typeof req.body,
        body: req.body,
        rawBodyType: typeof payload,
        rawBodyLength: payload?.length || 0,
        headers: req.headers,
        eventType: req.body['event.type'],
      });
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    const isValid = expectedSignature === signature;
    logger.info('Webhook signature verification', {
      isValid,
      expectedSignature,
      receivedSignature: signature,
      payloadLength: payload.length,
      payloadPreview: payload.toString('utf8').slice(0, 100), // First 100 chars for debugging
      eventType: req.body['event.type'],
      webhookSecretLength: webhookSecret.length, // Debug secret config
    });

    if (!isValid) {
      logger.error('Webhook signature validation failed', {
        expectedSignature,
        receivedSignature: signature,
        payload: payload.toString('utf8'),
        eventType: req.body['event.type'],
      });
    }

    return isValid;
  } catch (error: any) {
    logger.error('Error validating Flutterwave signature', {
      message: error.message,
      stack: error.stack,
      headers: req.headers,
      eventType: req.body['event.type'],
    });
    return false;
  }
}