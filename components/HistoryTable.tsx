
import React from 'react';
import { ProcessedMeasurement } from '../types';
import { getStatusColor, getStatusRingColor } from '../utils/helpers';

interface HistoryTableProps {
  data: ProcessedMeasurement[];
}

const HistoryTable: React.FC<HistoryTableProps> = ({ data }) => {
  const StatusPill = ({ status }: { status: ProcessedMeasurement['status'] }) => (
    <div className="flex items-center">
      <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(status)} border-2 ${getStatusRingColor(status)}`}></div>
      <span className="font-medium">{status}</span>
    </div>
  );

  return (
    <div className="max-h-96 overflow-y-auto pr-2">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
          <tr>
            <th scope="col" className="py-3 px-4">
              Fecha y Hora
            </th>
            <th scope="col" className="py-3 px-4 text-center">
              Ruido
            </th>
            <th scope="col" className="py-3 px-4 text-center">
              Vibración
            </th>
            <th scope="col" className="py-3 px-4">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50">
              <td className="py-3 px-4 font-mono text-xs">{item.fecha}</td>
              <td className="py-3 px-4 text-center font-mono">{item.noise.toFixed(2)}</td>
              <td className="py-3 px-4 text-center font-mono">{item.vibration.toFixed(4)}</td>
              <td className="py-3 px-4">
                <StatusPill status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
