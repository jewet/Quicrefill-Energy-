declare module "flutterwave-node-v3" {
    class Flutterwave {
      constructor(publicKey: string, secretKey: string);
      Charge: {
        card(payload: any): Promise<any>;
      };
    }
    export = Flutterwave;
  }