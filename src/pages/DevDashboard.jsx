import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import SedesManager from '../components/SedesManager';

export default function DevDashboard() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(null);

  const tabs = [
    { id: 'videos', title: 'Gerenciar Vídeos', icon: '🎥' },
    { id: 'eventos', title: 'Eventos', icon: '📅' },
    { id: 'membros', title: 'Cargos e Membros / Sedes', icon: '👥' },
    { id: 'metricas', title: 'Zerar Métricas', icon: '⚠️', isDanger: true }
  ];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-red-500">Dashboard Desenvolvedor</h1>
        <button onClick={logout} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition">Sair</button>
      </div>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Bem-vindo, {profile?.full_name || profile?.email}!</h2>
        <p className="text-slate-400">Você possui privilégios totais no sistema. Selecione uma ação abaixo:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {tabs.map(tab => (
              <div 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all 
                  ${tab.isDanger ? 'text-red-400 border border-red-900/50 hover:bg-red-950' : 'bg-slate-900 text-white hover:ring-2 hover:ring-red-500'}
                  ${activeTab === tab.id ? 'ring-2 ring-red-500 bg-slate-700' : ''}`}
              >
                  <span className="text-2xl mb-2">{tab.icon}</span>
                  <span className="font-semibold text-center">{tab.title}</span>
              </div>
            ))}
        </div>

        {/* Content Area */}
        {activeTab && (
          <div className="mt-8">
            {activeTab === 'membros' ? (
              <SedesManager />
            ) : (
              <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-2">
                   {tabs.find(t => t.id === activeTab)?.title}
                </h3>
                <p className="text-slate-400">
                  Esta área está na fila de construção.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
