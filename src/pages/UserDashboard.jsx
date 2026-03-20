import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function UserDashboard() {
  const { profile, logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Painel de {profile?.role}</h1>
        <button onClick={logout} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700">Sair</button>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl">
         <p>Seja bem-vindo!</p>
         <h2 className="text-4xl text-white font-bold mt-4">75% <span className="text-sm font-normal text-slate-400">Presença</span></h2>
      </div>
    </div>
  );
}
