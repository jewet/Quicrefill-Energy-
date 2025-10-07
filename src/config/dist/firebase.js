"use strict";
exports.__esModule = true;
exports.messaging = void 0;
// src/config/firebase.ts
var firebase_admin_1 = require("firebase-admin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
var quicrefill_energy_firebase_adminsdk_fbsvc_b33a855020_json_1 = require("../middlewares/quicrefill-energy-firebase-adminsdk-fbsvc-b33a855020.json"); // Fixed path (addressed below)
if (!firebase_admin_1["default"].apps.length) {
    firebase_admin_1["default"].initializeApp({
        credential: firebase_admin_1["default"].credential.cert(quicrefill_energy_firebase_adminsdk_fbsvc_b33a855020_json_1["default"])
    });
}
exports.messaging = firebase_admin_1["default"].messaging();
