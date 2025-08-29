import { FirebaseData, FirebaseMeasurement } from '../types';

// Initial seed data
const mockData: FirebaseData = {
  "1756315915": {
    "estado": "Verde",
    "fecha": "12:31:55 PM 27/08/2025",
    "nivel_dB": "56.22 dB",
    "vibracion_ms2": "1.2198 m/s²"
  },
  "1756315923": {
    "estado": "Verde",
    "fecha": "12:32:03 PM 27/08/2025",
    "nivel_dB": "58.10 dB",
    "vibracion_ms2": "1.3501 m/s²"
  },
  "1756315928": {
    "estado": "Amarillo",
    "fecha": "12:32:08 PM 27/08/2025",
    "nivel_dB": "75.40 dB",
    "vibracion_ms2": "2.1100 m/s²"
  }
};

// Fix: Changed NodeJS.Timeout to number, which is the correct return type for setInterval in browsers.
let intervalId: number | null = null;

const generateNewMeasurement = (): FirebaseMeasurement => {
    const noise = 50 + Math.random() * 40; // 50 to 90 dB
    const vibration = 1.0 + Math.random() * 2.5; // 1.0 to 3.5 m/s²

    let estado = "Verde";
    if (noise > 85 || vibration > 3.0) {
        estado = "Rojo";
    } else if (noise > 70 || vibration > 2.0) {
        estado = "Amarillo";
    }

    const now = new Date();

    return {
        estado: estado,
        fecha: `${now.toLocaleTimeString()} ${now.toLocaleDateString()}`,
        nivel_dB: `${noise.toFixed(2)} dB`,
        vibracion_ms2: `${vibration.toFixed(4)} m/s²`
    };
};

export const listenToMeasurements = (callback: (data: FirebaseData) => void): (() => void) => {
  // Immediately send the initial data
  callback(mockData);

  // Then, start generating new data every 3 seconds
  intervalId = window.setInterval(() => {
    const newTimestamp = (Math.floor(Date.now() / 1000)).toString();
    const newMeasurement = generateNewMeasurement();
    mockData[newTimestamp] = newMeasurement;

    // To keep the data manageable, let's only keep the last 100 entries
    const sortedKeys = Object.keys(mockData).sort((a,b) => parseInt(b)-parseInt(a));
    if(sortedKeys.length > 100) {
        const keyToDelete = sortedKeys[sortedKeys.length -1];
        delete mockData[keyToDelete];
    }
    
    callback({ ...mockData });
  }, 3000);

  // Return an unsubscribe function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};