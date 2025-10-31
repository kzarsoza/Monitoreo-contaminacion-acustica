import React, { useState, useEffect, useRef } from 'react';
import { ProcessedMeasurement, FirebaseData, User } from '../types';
import { listenToRealtimeMeasurements, getAvailableNodes, auth, logout } from '../services/firebaseService';
import { parseFirebaseData, getStatusColor } from '../utils/helpers';
import DashboardCard from './DashboardCard';
import HistoryChart from './HistoryChart';
import HistoryTable from './HistoryTable';
import { Bell, Zap, Activity, LogOut, Server } from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const MAX_MEASUREMENTS_DISPLAYED = 20; // Limit to the latest 20 measurements
  const [measurements, setMeasurements] = useState<ProcessedMeasurement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [availableNodes, setAvailableNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fetchNodes = async () => {
      setIsLoading(true);
      const nodes = await getAvailableNodes();
      setAvailableNodes(nodes);
      if (nodes.length > 0) {
        setSelectedNode(nodes[0]);
      } else {
        setIsLoading(false);
      }
    };
    fetchNodes();
  }, []);

  useEffect(() => {
    // 1. Cancelar la Suscripción Activa:
    // Se invoca el método para cancelar la escucha de Firebase activa.
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    // 2. Vaciar el Estado Local:
    // Se limpian los arreglos que contienen los datos del dashboard.
    setMeasurements([]);
    setIsConnected(false);

    if (!selectedNode) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    // 3. Crear la Nueva Suscripción:
    // Se procede a crear la nueva suscripción para el nodo recién seleccionado.
    const unsubscribe = listenToRealtimeMeasurements(selectedNode, (data: FirebaseData) => {
      if (data && Object.keys(data).length > 0) {
        const processedData = parseFirebaseData(data);
        setMeasurements(processedData.slice(0, MAX_MEASUREMENTS_DISPLAYED));
        setIsConnected(true);
      } else {
        setMeasurements([]);
        setIsConnected(false);
      }
      setIsLoading(false);
    });

    // Se guarda la función de cancelación para la próxima vez que cambie el nodo.
    unsubscribeRef.current = unsubscribe;

    // Limpieza final solo cuando el componente se desmonte por completo.
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedNode]);
  
  const handleLogout = () => {
    logout(auth).catch(error => console.error('Logout failed', error));
  };

  const latestMeasurement = measurements[0] || null;
  const isLive = isConnected && !isLoading;

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-200 font-sans">
      <aside className="w-64 flex-shrink-0 bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
        <h2 className="text-xl font-bold text-white mb-6 px-2">Nodos Sensores</h2>
        <nav className="flex-grow overflow-y-auto">
          <ul>
            {availableNodes.length > 0 ? (
              availableNodes.map(node => (
                <li key={node} className="mb-2">
                  <button
                    onClick={() => setSelectedNode(node)}
                    className={`w-full text-left flex items-center space-x-3 py-2.5 px-3 rounded-lg transition-colors duration-200 ${
                      selectedNode === node
                        ? 'bg-cyan-600 text-white font-semibold shadow-md'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                    aria-current={selectedNode === node ? 'page' : undefined}
                  >
                    <Server className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{node}</span>
                  </button>
                </li>
              ))
            ) : !isLoading && (
              <li className="text-gray-500 px-3 text-sm">No se encontraron nodos.</li>
            )}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Dashboard de Monitoreo
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-400">
                  {isLoading ? 'Cargando...' : isLive ? 'En vivo' : (isConnected ? 'Esperando datos' : 'Desconectado')}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </header>

          <main>
            {isLoading ? (
              <div className="text-center py-20 text-gray-400 text-lg">
                {selectedNode ? `Conectando a ${selectedNode}...` : 'Buscando nodos...'}
              </div>
            ) : !selectedNode ? (
              <div className="text-center py-20 text-gray-400 text-lg">No se encontraron nodos. Seleccione uno si aparece en la lista.</div>
            ) : (
              <>
                {/* Data Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <DashboardCard
                    title="Nivel de Ruido"
                    value={latestMeasurement ? latestMeasurement.noise.toFixed(2) : '...'}
                    unit="dB"
                    icon={<Bell className="w-8 h-8 text-cyan-400" />}
                  />
                  <DashboardCard
                    title="Vibración"
                    value={latestMeasurement ? latestMeasurement.vibration.toFixed(4) : '...'}
                    unit="m/s²"
                    icon={<Zap className="w-8 h-8 text-purple-400" />}
                  />
                  <DashboardCard
                    title="Estado General"
                    value={latestMeasurement ? latestMeasurement.status : '...'}
                    unit=""
                    icon={<Activity className="w-8 h-8 text-amber-400" />}
                    contentClass={latestMeasurement ? `${getStatusColor(latestMeasurement.status)} text-white font-bold` : 'bg-gray-700'}
                  />
                </div>

                {/* Chart and Table */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Historial de Mediciones (Últimas 30)</h2>
                    {measurements.length > 0 ? (
                      <HistoryChart data={measurements.slice(0, 30).reverse()} />
                    ) : (
                      <div className="flex items-center justify-center h-80 text-gray-500">{isConnected ? 'Esperando datos...' : 'Sin datos para mostrar.'}</div>
                    )}
                  </div>
                  <div className="xl:col-span-1 bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Datos Históricos</h2>
                    {measurements.length > 0 ? (
                      <HistoryTable data={measurements.slice(0, 30)} />
                    ) : (
                      <div className="flex items-center justify-center h-80 text-gray-500">{isConnected ? 'Esperando datos...' : 'Sin datos para mostrar.'}</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;