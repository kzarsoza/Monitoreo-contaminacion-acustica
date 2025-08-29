
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  contentClass?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, unit, icon, contentClass = 'bg-gray-700' }) => {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg border border-gray-700 transform hover:scale-105 transition-transform duration-300">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
        {icon}
      </div>
      <div>
        <p className={`text-4xl font-bold mt-2 inline-block rounded-lg p-2 ${contentClass}`}>
          {value}
        </p>
        {unit && <span className="text-lg text-gray-400 ml-2">{unit}</span>}
      </div>
    </div>
  );
};

export default DashboardCard;
