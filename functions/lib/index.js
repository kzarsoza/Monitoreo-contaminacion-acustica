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
const https = __importStar(require("https"));
const database_1 = require("firebase-functions/v2/database");
// --- Configuración de la Lógica de Alerta ---
const HIGH_NOISE_THRESHOLD_DB = 85.0; // Límite para considerar "ruido alto" (de tu tabla)
const HIGH_PERSISTENCE_THRESHOLD = 3; // N° de lecturas altas seguidas para ENVIAR alerta
const LOW_PERSISTENCE_THRESHOLD = 10; // N° de lecturas bajas seguidas para RESETEAR alerta
// ----------------------------------------------
admin.initializeApp();
const db = admin.database();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
/**
 * Parsea el string de dB (ej. "87.5 dB") a un número (ej. 87.5)
 */
function parseDbLevel(dbString) {
    if (!dbString)
        return 0;
    // parseFloat ignora texto al final como " dB" o " dBA"
    return parseFloat(dbString) || 0;
}
/**
 * Devuelve el nivel de riesgo y el mensaje según la tabla de exposición.
 */
function getRiskInfo(noiseLevel) {
    if (noiseLevel >= 115) {
        return { level: "NIVEL_115", message: "¡PELIGRO INMINENTE! Exposición máxima: 7 minutos. Evacúe el área." };
    }
    if (noiseLevel >= 110) {
        return { level: "NIVEL_110", message: "¡RIESGO CRÍTICO! Exposición máxima: 15 minutos. Use doble protección auditiva." };
    }
    if (noiseLevel >= 105) {
        return { level: "NIVEL_105", message: "¡RIESGO MUY ALTO! Exposición máxima: 30 minutos. Use doble protección auditiva." };
    }
    if (noiseLevel >= 100) {
        return { level: "NIVEL_100", message: "¡RIESGO ALTO! Exposición máxima: 1 hora. Use doble protección auditiva." };
    }
    if (noiseLevel >= 95) {
        return { level: "NIVEL_095", message: "¡RIESGO! Exposición máxima: 2 horas. Asegure su protección auditiva." };
    }
    if (noiseLevel >= 90) {
        return { level: "NIVEL_090", message: "¡RIESGO! Exposición máxima: 4 horas. Asegure su protección auditiva." };
    }
    if (noiseLevel >= 85) {
        return { level: "NIVEL_085", message: "PRECAUCIÓN: Ruido elevado. Exposición máxima: 8 horas. Utilice su protección auditiva." };
    }
    // Si es menor a 85, no se considera un nivel de riesgo
    return { level: "NINGUNO", message: "" };
}
/**
 * Función principal que se activa con cada nuevo dato en la base de datos.
 * Implementa la lógica de histéresis para evitar spam de alertas.
 */
exports.checkNoiseLevel = (0, database_1.onValueWritten)("/mediciones/{deviceId}/{timestamp}", async (event) => {
    if (!event.data.after.exists()) {
        return null; // El dato fue borrado, no hacer nada
    }
    const { deviceId } = event.params;
    const newMeasurement = event.data.after.val();
    const noiseLevel = parseDbLevel(newMeasurement.nivel_dB);
    const alertStatusRef = db.ref(`/alert_status/${deviceId}`);
    const statusSnapshot = await alertStatusRef.once("value");
    // Carga el estado actual o crea uno nuevo si no existe
    const currentStatus = statusSnapshot.val() || {
        consecutiveHighCount: 0,
        consecutiveLowCount: 0,
        lastAlertLevel: "NINGUNO", // Nivel de la última alerta enviada
    };
    if (noiseLevel >= HIGH_NOISE_THRESHOLD_DB) {
        // --- LÓGICA DE RUIDO ALTO ---
        const newHighCount = (currentStatus.consecutiveHighCount || 0) + 1;
        const { level: newRiskLevel, message: riskMessage } = getRiskInfo(noiseLevel);
        // ¿Debemos enviar una alerta?
        // Condición 1: El ruido ha sido persistentemente alto (ej. 3 lecturas)
        // Condición 2: El nuevo nivel de riesgo es MÁS ALTO que el último que notificamos
        // (Comparamos "NIVEL_090" > "NIVEL_085", lo cual funciona alfabéticamente)
        if (newHighCount >= HIGH_PERSISTENCE_THRESHOLD && newRiskLevel > currentStatus.lastAlertLevel) {
            console.log(`[${deviceId}] Alerta escalada a ${newRiskLevel}. Enviando notificación...`);
            await sendTelegramAlert(deviceId, newMeasurement, riskMessage);
            // Guardar el nuevo estado de alerta
            await alertStatusRef.set({
                consecutiveHighCount: newHighCount,
                consecutiveLowCount: 0, // Resetear el contador de lecturas bajas
                lastAlertLevel: newRiskLevel,
            });
        }
        else {
            // El ruido es alto, pero no es persistente O no es un nivel de riesgo nuevo.
            // Solo actualizamos el contador.
            await alertStatusRef.update({
                consecutiveHighCount: newHighCount,
                consecutiveLowCount: 0,
            });
        }
    }
    else {
        // --- LÓGICA DE RUIDO BAJO (SEGURO) ---
        const newLowCount = (currentStatus.consecutiveLowCount || 0) + 1;
        // ¿Debemos resetear el sistema?
        // Condición 1: El ruido ha sido persistentemente bajo (ej. 10 lecturas)
        // Condición 2: El sistema estaba en un estado de alerta (lastAlertLevel no era "NINGUNO")
        if (newLowCount >= LOW_PERSISTENCE_THRESHOLD && currentStatus.lastAlertLevel !== "NINGUNO") {
            console.log(`[${deviceId}] Ambiente seguro detectado. Reseteando estado de alerta.`);
            // Reseteamos el sistema, listo para la próxima alerta
            await alertStatusRef.set({
                consecutiveHighCount: 0,
                consecutiveLowCount: newLowCount,
                lastAlertLevel: "NINGUNO",
            });
            // (Opcional: se podría enviar un mensaje "Todo despejado")
        }
        else {
            // El ruido es bajo, pero aún no es persistente para resetear.
            // Solo actualizamos el contador.
            await alertStatusRef.update({
                consecutiveHighCount: 0,
                consecutiveLowCount: newLowCount,
            });
        }
    }
    return null;
});
/**
 * Envía el mensaje de alerta formateado a Telegram.
 */
async function sendTelegramAlert(deviceId, measurement, riskMessage) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("Error: El token del bot de Telegram o el ID del chat no están configurados en las variables de entorno.");
        return;
    }
    // Mensaje formateado con Markdown para Telegram
    const message = `🚨 *ALERTA DE RIESGO: ${deviceId}* 🚨\n\n🔊 *Nivel de Ruido:* ${measurement.nivel_dB}\n📈 *Nivel de Vibración:* ${measurement.vibracion_ms2}\n\n*Recomendación:*\n${riskMessage} 🎧`;
    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown", // Habilitar formato de negritas, etc.
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
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
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