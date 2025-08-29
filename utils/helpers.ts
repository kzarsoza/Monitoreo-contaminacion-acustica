import { FirebaseData, ProcessedMeasurement, FirebaseMeasurement } from '../types';

export const parseFirebaseData = (data: FirebaseData): ProcessedMeasurement[] => {
  if (!data) return [];
  return Object.entries(data)
    .map(([id, measurement]: [string, FirebaseMeasurement]) => {
      const noise = parseFloat(measurement.nivel_dB) || 0;
      
      let status: ProcessedMeasurement['status'] = 'Desconocido';
      if (noise >= 85) {
        status = 'Rojo';
      } else if (noise >= 66 && noise <= 84) {
        status = 'Amarillo';
      } else if (noise <= 65) {
        status = 'Verde';
      }

      return {
        id,
        fecha: measurement.fecha,
        noise: noise,
        vibration: parseFloat(measurement.vibracion_ms2) || 0,
        status: status,
      };
    })
    .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Sort by timestamp descending (newest first)
};

export const getStatusColor = (status: ProcessedMeasurement['status']): string => {
  switch (status) {
    case 'Verde':
      return 'bg-green-500';
    case 'Amarillo':
      return 'bg-yellow-500';
    case 'Rojo':
      return 'bg-red-500';
    default:
      return 'bg-gray-600';
  }
};

export const getStatusRingColor = (status: ProcessedMeasurement['status']): string => {
  switch (status) {
    case 'Verde':
      return 'ring-green-400';
    case 'Amarillo':
      return 'ring-yellow-400';
    case 'Rojo':
      return 'ring-red-400';
    default:
      return 'ring-gray-500';
  }
};