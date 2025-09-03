"use strict";
// functions/src/index.ts
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
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("https")); // Importa el módulo https de Node.js
const firebase_functions_1 = require("firebase-functions");
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.database();
// Obtén las credenciales de Telegram desde la configuración de Firebase
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DURATION_MINUTES = 1;
const DURATION_SECONDS = DURATION_MINUTES * 60;
/**
 * This Cloud Function triggers whenever new data is written to /mediciones/{deviceId}.
 * It checks if the noise level has been consistently high for a specified duration
 * and sends a Telegram alert if the condition is met.
 */
exports.checkNoiseLevel = v2_1.database.onValueWritten("/mediciones/{deviceId}/{timestamp}", async (event) => {
    if (!event.data.after.exists()) {
        return null;
    }
    const { deviceId } = event.params;
    const newMeasurement = event.data.after.val();
    const alertStatusRef = db.ref(`/alert_status/${deviceId}`);
    // Si el estado es "Rojo", se procede con la lógica de alerta.
    if (newMeasurement.estado.toLowerCase() !== "rojo") {
        await alertStatusRef.set({ alerted: false });
        firebase_functions_1.logger.log(`[${deviceId}] El estado no es 'Rojo'. Se reinicia el estado de la alerta.`);
        return null;
    }
    firebase_functions_1.logger.log(`[${deviceId}] Estado 'Rojo' detectado. Verificando condiciones...`);
    const alertStatusSnapshot = await alertStatusRef.once("value");
    if (alertStatusSnapshot.val()?.alerted === true) {
        firebase_functions_1.logger.log(`[${deviceId}] Ya se ha enviado una alerta. No se necesita acción.`);
        return null;
    }
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - DURATION_SECONDS;
    const recentDataRef = db.ref(`/mediciones/${deviceId}`)
        .orderByKey()
        .startAt(String(oneMinuteAgo));
    const recentDataSnapshot = await recentDataRef.once("value");
    const recentMeasurements = recentDataSnapshot.val();
    if (!recentMeasurements) {
        firebase_functions_1.logger.log(`[${deviceId}] No hay suficientes datos en el último minuto.`);
        return null;
    }
    const allRecordsAreRed = Object.values(recentMeasurements).every((m) => m.estado.toLowerCase() === "rojo");
    if (allRecordsAreRed) {
        firebase_functions_1.logger.log(`[${deviceId}] Condición cumplida: Estado 'Rojo' sostenido por ${DURATION_MINUTES} minuto(s).`);
        // Enviar la alerta de Telegram
        await sendTelegramAlert(deviceId, newMeasurement);
        await alertStatusRef.set({ alerted: true });
    }
    else {
        firebase_functions_1.logger.log(`[${deviceId}] Estado 'Rojo' detectado, pero no sostenido durante el tiempo requerido.`);
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
        firebase_functions_1.logger.error("Error: El token del bot de Telegram o el ID del chat no están configurados en las variables de entorno.");
        return;
    }
    const message = `🚨 *¡Alerta de Exposición a Ruido Elevado!* 🚨\n\nSe ha detectado un nivel de ruido que supera el umbral establecido de forma sostenida.\n\n*Sensor ID:* \
${deviceId}
*Nivel de Ruido:* ${measurement.nivel_dB}
*Fecha:* ${measurement.fecha}

Se recomienda tomar precauciones en la zona monitoreada.`;
    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
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
                if (res.statusCode === 200) {
                    firebase_functions_1.logger.log(`[${deviceId}] Alerta de Telegram enviada con éxito.`);
                    resolve();
                }
                else {
                    firebase_functions_1.logger.error(`[${deviceId}] Error al enviar la alerta de Telegram: ${res.statusCode}`, responseBody);
                    reject(new Error(`Telegram API responded with status code ${res.statusCode}`));
                }
            });
        });
        req.on('error', (error) => {
            firebase_functions_1.logger.error(`[${deviceId}] Error en la solicitud a la API de Telegram:`, error);
            reject(error);
        });
        req.write(data);
        req.end();
    });
}
//# sourceMappingURL=index.js.map