import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, DataSnapshot, get, child, query, orderByKey, limitToLast } from 'firebase/database';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { FirebaseData } from '../types';

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyBg1xM6wT12hC0xc11d84VINq_NyFfhYdM",
  authDomain: "monitoreo-ruido-6c514.firebaseapp.com",
  databaseURL: "https://monitoreo-ruido-6c514-default-rtdb.firebaseio.com",
  projectId: "monitoreo-ruido-6c514",
  storageBucket: "monitoreo-ruido-6c514.appspot.com",
  messagingSenderId: "305103444983",
  appId: "1:305103444983:web:7f8d6f123456789abcde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Export auth functions
export const registerWithEmail = createUserWithEmailAndPassword;
export const signInWithEmail = signInWithEmailAndPassword;
export const logout = signOut;

/**
 * Fetches the list of available sensor nodes.
 * @returns A promise that resolves to an array of node IDs (strings).
 */
export const getAvailableNodes = async (): Promise<string[]> => {
  const dbRef = ref(getDatabase());
  try {
    const snapshot = await get(child(dbRef, 'mediciones'));
    if (snapshot.exists()) {
      return Object.keys(snapshot.val());
    }
    return [];
  } catch (error) {
    console.error("Error fetching available nodes:", error);
    return [];
  }
};


/**
 * Listens for real-time updates for a specific device from the Firebase Realtime Database.
 * @param deviceId - The ID of the sensor device to listen to.
 * @param callback - The function to call with the new data.
 * @returns An unsubscribe function to clean up the listener.
 */
export const listenToRealtimeMeasurements = (deviceId: string, callback: (data: FirebaseData) => void): (() => void) => {
  const baseMeasurementsRef = ref(database, `mediciones/${deviceId}/`);

  // ----- INICIO DE LA CORRECCIÓN -----
  // Creamos una query que ordena por llave (timestamp)
  // y limita la descarga solo a los últimos 50 registros.
  const measurementsQuery = query(baseMeasurementsRef, orderByKey(), limitToLast(50));
  // ----- FIN DE LA CORRECCIÓN -----

  const listener = onValue(
    measurementsQuery, // Usamos la query optimizada
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      callback(data || {});
    },
    (error) => {
      console.error(`Firebase read failed for device ${deviceId}: `, error);
      callback({});
    }
  );

  // Devolver la función de desuscripción
  return () => {
    off(measurementsQuery, 'value', listener); // Nos desuscribimos de la query
  };
};
