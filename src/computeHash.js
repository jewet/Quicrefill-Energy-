require('dotenv').config({ path: './.env.customer' });
const crypto = require('crypto');
const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

if (!secret) {
  console.error('Error: FLUTTERWAVE_WEBHOOK_SECRET is not defined in .env.customer');
  process.exit(1);
}

const payload = JSON.stringify({
  "event": "charge.completed",
  "data": {
    "id": 9394977,
    "tx_ref": "TOPUP-d17493f3-5a6d-415a-9684-a5f48cdfcf6c-1748636657350",
    "flw_ref": "7360448661871748636681600",
    "device_fingerprint": "N/A",
    "amount": 107.5,
    "currency": "NGN",
    "charged_amount": 107.5,
    "app_fee": 1.51,
    "merchant_fee": 0,
    "processor_response": "success",
    "auth_model": "AUTH",
    "ip": "54.75.161.64",
    "narration": "Astralearnia",
    "status": "successful",
    "payment_type": "bank_transfer",
    "created_at": "2025-05-30T20:24:49.000Z",
    "account_id": 2590629,
    "customer": {
      "id": 3301029,
      "name": "Astralearnia",
      "phone_number": "08012345678",
      "email": "ravesb_b45df03f7ade9d3d7c32_astralearnia@gmail.com",
      "created_at": "2025-05-27T03:16:59.000Z"
    }
  },
  "meta_data": {
    "__CheckoutInitAddress": "https://checkout-v2.dev-flutterwave.com/v3/hosted/pay",
    "isWalletTopUp": "1",
    "paymentType": "wallet_topup",
    "originatoraccountnumber": "123*******90",
    "originatorname": "JOHN DOE",
    "bankname": "Access Bank",
    "originatoramount": "N/A"
  },
  "event.type": "BANK_TRANSFER_TRANSACTION"
});

console.log('Payload:', payload);
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Computed Signature:', signature);