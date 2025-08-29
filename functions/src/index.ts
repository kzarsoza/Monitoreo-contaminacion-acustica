import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.database();

// Set SendGrid API Key from Firebase environment configuration
const SENDGRID_API_KEY = functions.config().sendgrid.key;
const TO_EMAIL = functions.config().sendgrid.to_email;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("SendGrid API key not set. Email notifications are disabled.");
}


const NOISE_THRESHOLD_DB = 65.0; // 65 dB
const DURATION_MINUTES = 1; // Check for sustained noise over 1 minute
const DURATION_SECONDS = DURATION_MINUTES * 60;

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
 * and sends an email alert if the condition is met.
 */
export const checkNoiseLevel = functions.database
  .ref("/mediciones/{deviceId}/{timestamp}")
  .onWrite(async (change, context) => {
    // If data was deleted, do nothing.
    if (!change.after.exists()) {
      return null;
    }

    const { deviceId } = context.params;
    const newMeasurement = change.after.val() as Measurement;
    const noiseLevel = parseFloat(newMeasurement.nivel_dB);

    const alertStatusRef = db.ref(`/alert_status/${deviceId}`);

    // If the state is "Verde" or noise is below threshold, reset the alert status.
    // This re-arms the alert system for the next event.
    if (newMeasurement.estado.toLowerCase() === "verde" || noiseLevel < NOISE_THRESHOLD_DB) {
      await alertStatusRef.set({ alerted: false });
      console.log(`[${deviceId}] Noise level is normal. Alert status reset.`);
      return null;
    }

    // --- High Noise Detected ---
    console.log(`[${deviceId}] High noise detected (${noiseLevel} dB). Checking conditions...`);

    // Check if an alert has already been sent to prevent spam.
    const alertStatusSnapshot = await alertStatusRef.once("value");
    if (alertStatusSnapshot.val()?.alerted === true) {
      console.log(`[${deviceId}] Alert already sent. No action needed.`);
      return null;
    }

    // Check all records in the last minute.
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - DURATION_SECONDS;
    const recentDataRef = db.ref(`/mediciones/${deviceId}`)
      .orderByKey()
      .startAt(String(oneMinuteAgo));

    const recentDataSnapshot = await recentDataRef.once("value");
    const recentMeasurements = recentDataSnapshot.val() as { [key: string]: Measurement };

    if (!recentMeasurements) {
      console.log(`[${deviceId}] Not enough data in the last ${DURATION_MINUTES} minute(s).`);
      return null;
    }

    // Verify that ALL recent measurements are above the threshold.
    const allRecordsAreHigh = Object.values(recentMeasurements).every(
      (m) => parseFloat(m.nivel_dB) >= NOISE_THRESHOLD_DB
    );

    if (allRecordsAreHigh) {
      console.log(`[${deviceId}] Condition met: Sustained high noise for ${DURATION_MINUTES} minute(s).`);

      // Send the email alert
      await sendAlertEmail(deviceId);

      // Set the alert status to true to prevent re-sending emails.
      await alertStatusRef.set({ alerted: true });
    } else {
      console.log(`[${deviceId}] High noise detected, but not sustained for the full duration.`);
    }

    return null;
  });


/**
 * Sends an email notification using SendGrid.
 * @param {string} deviceId The ID of the sensor device that triggered the alert.
 */
async function sendAlertEmail(deviceId: string) {
  if (!SENDGRID_API_KEY || !TO_EMAIL) {
    console.error("Cannot send email: SendGrid API key or TO_EMAIL is not configured.");
    return;
  }

  const durationText = DURATION_MINUTES === 1 ? "un minuto" : `${DURATION_MINUTES} minutos`;

  const msg = {
    to: TO_EMAIL,
    from: "noreply@monitoreo-ambiental.com", // Use a verified sender with your email provider
    subject: "Alerta de Prevención: Exposición a Ruido Elevado",
    text: `Hola.\n\nSe ha detectado un nivel de ruido sostenido superior a ${NOISE_THRESHOLD_DB} dB durante más de ${durationText} en el sensor con ID: ${deviceId}.\n\nSe recomienda tomar precauciones para proteger la audición en la zona monitoreada.`,
    html: `<p>Hola.</p>
           <p>Se ha detectado un nivel de ruido sostenido superior a <strong>${NOISE_THRESHOLD_DB} dB</strong> durante más de <strong>${durationText}</strong> en el sensor con ID: <strong>${deviceId}</strong>.</p>
           <p>Se recomienda tomar precauciones para proteger la audición en la zona monitoreada.</p>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`[${deviceId}] Alert email sent successfully to ${TO_EMAIL}.`);
  } catch (error) {
    console.error(`[${deviceId}] Error sending email:`, error);
  }
}
