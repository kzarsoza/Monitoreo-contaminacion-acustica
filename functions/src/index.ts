// functions/src/index.ts
import * as admin from "firebase-admin";
import * as https from "https"; // Importa el módulo https de Node.js
import { onValueWritten } from "firebase-functions/v2/database";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.database();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// const NOISE_THRESHOLD_DB = 85.0; // Umbral para estado "Rojo" - Unused
// const DURATION_MINUTES = 1; // Unused
// const DURATION_SECONDS = DURATION_MINUTES * 60; // Unused

/**
* Interface for the structure of a single measurement in the database.
*/
interface Measurement {
    estado: string;
    fecha: string;
    nivel_dB: string;
    vibracion_ms2: string;
}

/**
* This Cloud Function triggers whenever new data is written to /mediciones/{deviceId}.
* It checks if the noise level has been consistently high for a specified duration
* and sends a Telegram alert if the condition is met.
*/
export const checkNoiseLevel = onValueWritten("/mediciones/{deviceId}/{timestamp}", async (event) => {
    const change = event.data;
    if (!change.after.exists()) {
        return null;
    }

    const { deviceId } = event.params;
    const newMeasurement = change.after.val() as Measurement;
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
    } else {
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
async function sendTelegramAlert(deviceId: string, measurement: Measurement) {
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

    return new Promise<void>((resolve, reject) => {
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
                } else {
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