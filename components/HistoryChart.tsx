import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProcessedMeasurement } from '../types';

interface HistoryChartProps {
  data: ProcessedMeasurement[];
}

const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  const formattedData = data.map(m => ({
    ...m,
    // Format date for tooltip and axis
    // FIX: Convert string `id` to a number before performing arithmetic operation.
    time: new Date(Number(m.id) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'}),
  }));

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
          <XAxis dataKey="time" stroke="#A0AEC0" fontSize={12} />
          <YAxis stroke="#A0AEC0" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2D3748',
              borderColor: '#4A5568',
              borderRadius: '0.75rem',
            }}
            labelStyle={{ color: '#E2E8F0' }}
          />
          <Legend wrapperStyle={{color: '#E2E8F0'}} />
          <Line type="monotone" dataKey="noise" name="Ruido (dB)" stroke="#38BDF8" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="vibration" name="Vibración (m/s²)" stroke="#A78BFA" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoryChart;