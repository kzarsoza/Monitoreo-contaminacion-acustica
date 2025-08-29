import type { User } from 'firebase/auth';

export type { User };

export interface FirebaseMeasurement {
  estado: string;
  fecha: string;
  nivel_dB: string;
  vibracion_ms2: string;
}

export type FirebaseData = Record<string, FirebaseMeasurement>;

export interface ProcessedMeasurement {
  id: string; // The timestamp key from Firebase
  fecha: string;
  noise: number;
  vibration: number;
  status: 'Verde' | 'Amarillo' | 'Rojo' | 'Desconocido';
}