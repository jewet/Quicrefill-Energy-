// src/services/MonnifyService.ts
import axios from "axios";
import { logger } from "../utils/logger";
import retry from "async-retry";
import { v4 as uuidv4 } from "uuid";

export interface MonnifyVirtualAccountResponse {
  responseCode: string;
  responseMessage: string;
  responseBody: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    accountReference: string;
    customerName: string;
    customerEmail: string;
    bvn: string;
  };
}

export interface MonnifyTransactionResponse {
  responseCode: string;
  responseMessage: string;
  responseBody: {
    transactionReference: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdOn: string;
  };
}

export interface MonnifyBanksResponse {
  responseCode: string;
  responseMessage: string;
  responseBody: Array<{
    code: string;
    name: string;
  }>;
}

interface MonnifyTransferResponse {
  responseCode: string;
  responseMessage: string;
  responseBody: {
    transferReference: string;
    amount: number;
    status: string;
  };
}

export class MonnifyService {
  private baseUrl = "https://api.monnify.com/api/v1";
  private apiKey = process.env.MONNIFY_API_KEY;
  private clientSecret = process.env.MONNIFY_CLIENT_SECRET;
  private contractCode = process.env.MONNIFY_CONTRACT_CODE;

  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/login`,
        {
          apiKey: this.apiKey,
          clientSecret: this.clientSecret,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      return response.data.responseBody.accessToken;
    } catch (error) {
      logger.error("Failed to get Monnify access token", { error });
      throw new Error("Monnify authentication failed");
    }
  }

  /**
   * Fetches the list of supported banks from Monnify API.
   * @returns List of banks with code and name.
   */
  async getBanks(): Promise<MonnifyBanksResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await retry(
        async () => {
          return await axios.get(`${this.baseUrl}/bank-accounts/banks`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying Monnify banks fetch", { attempt, error });
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Error fetching banks from Monnify", { error });
      throw new Error("Failed to fetch banks");
    }
  }

  async createVirtualAccount(
    customerName: string,
    customerEmail: string,
    bvn: string,
    isVendorMain: boolean,
    preferredBankCode?: string
  ): Promise<MonnifyVirtualAccountResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const accountReference = `VA-${uuidv4()}-${Date.now()}`;
      const payload: any = {
        accountReference,
        accountName: `${customerName} - ${isVendorMain ? "Main" : "Sub"} Account`,
        currencyCode: "NGN",
        contractCode: this.contractCode,
        customerEmail,
        customerName,
        bvn,
      };

      if (preferredBankCode) {
        payload.preferredBanks = [preferredBankCode, "035"]; // 035 is Moniepoint's bank code
      } else {
        payload.preferredBanks = ["035"]; // Default to Moniepoint
      }

      const response = await retry(
        async () => {
          return await axios.post(
            `${this.baseUrl}/bank-accounts`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying Monnify virtual account creation", { attempt, error });
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error("Error creating Monnify virtual account", { error });
      throw new Error("Failed to create virtual account");
    }
  }

  async verifyBVN(bvn: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseUrl}/bvn/verify`,
        { bvn },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.responseCode === "0";
    } catch (error) {
      logger.error("Error verifying BVN with Monnify", { error });
      throw new Error("BVN verification failed");
    }
  }

  async validateVirtualAccountPayment(transactionRef: string): Promise<MonnifyTransactionResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await retry(
        async () => {
          return await axios.get(
            `${this.baseUrl}/transactions/${transactionRef}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying Monnify transaction validation", { transactionRef, attempt, error });
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Error validating Monnify transaction", { transactionRef, error });
      throw new Error("Transaction validation failed");
    }
  }

  async initiateTransfer(
    amount: number,
    destinationAccountNumber: string,
    destinationBankCode: string,
    narration: string,
    reference: string
  ): Promise<MonnifyTransferResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await retry(
        async () => {
          return await axios.post(
            `${this.baseUrl}/disbursements/single`,
            {
              amount,
              destinationAccountNumber,
              destinationBankCode,
              narration,
              reference,
              currency: "NGN",
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying Monnify transfer", { reference, attempt, error });
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Error initiating Monnify transfer", { reference, error });
      throw new Error("Transfer initiation failed");
    }
  }
}

export default new MonnifyService();