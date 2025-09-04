"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkNoiseLevel = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("https")); // Importa el módulo https de Node.js
const database_1 = require("firebase-functions/v2/database");
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.database();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
/**
* This Cloud Function triggers whenever new data is written to /mediciones/{deviceId}.
* It checks if the noise level has been consistently high for a specified duration
* and sends a Telegram alert if the condition is met.
*/
exports.checkNoiseLevel = (0, database_1.onValueWritten)("/mediciones/{deviceId}/{timestamp}", async (event) => {
    const change = event.data;
    if (!change.after.exists()) {
        return null;
    }
    const { deviceId } = event.params;
    const newMeasurement = change.after.val();
    const alertStatusRef = db.ref(`/alert_status/${deviceId}`);
    if (newMeasurement.estado.toLowerCase() === "rojo") {
        const alertStatusSnapshot = await alertStatusRef.once("value");
        if (alertStatusSnapshot.val()?.alerted === true) {
            console.log(`[${deviceId}] Ya se ha enviado una alerta. No se necesita acción.`);
            return null;
        }
        console.log(`[${deviceId}] Estado 'Rojo' detectado. Enviando alerta...`);
        await sendTelegramAlert(deviceId, newMeasurement);
        await alertStatusRef.set({ alerted: true });
    }
    else {
        await alertStatusRef.set({ alerted: false });
        console.log(`[${deviceId}] El estado no es 'Rojo'. Se reinicia el estado de la alerta.`);
    }
    return null;
});
/**
* Sends an alert message to a Telegram chat using the Telegram Bot API.
* @param {string} deviceId The ID of the device that triggered the alert.
* @param {Measurement} measurement The latest measurement data.
*/
async function sendTelegramAlert(deviceId, measurement) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("Error: El token del bot de Telegram o el ID del chat no están configurados en las variables de entorno.");
        return;
    }
    const message = `Alerta de Ruido: ${deviceId} - Nivel: ${measurement.nivel_dB} - Fecha: ${measurement.fecha}`;
    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
    });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                console.log(`[${deviceId}] Telegram API response:`, responseBody);
                if (res.statusCode === 200) {
                    console.log(`[${deviceId}] Alerta de Telegram enviada con éxito.`);
                    resolve();
                }
                else {
                    console.error(`[${deviceId}] Error al enviar la alerta de Telegram: ${res.statusCode}`, responseBody);
                    reject(new Error(`Telegram API responded with status code ${res.statusCode}`));
                }
            });
        });
        req.on('error', (error) => {
            console.error(`[${deviceId}] Error en la solicitud a la API de Telegram:`, error);
            reject(error);
        });
        req.write(data);
        req.end();
    });
}
//# sourceMappingURL=index.js.map