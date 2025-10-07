// src/config/firebase.ts
import admin from "firebase-admin";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import serviceAccount from "../middlewares/quicrefill-energy-firebase-adminsdk-fbsvc-b33a855020.json"; // Fixed path (addressed below)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const messaging = admin.messaging();