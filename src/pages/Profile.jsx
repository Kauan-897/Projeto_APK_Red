import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { profile, user, logout } = useAuth();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Meu Perfil</h1>
        <button onClick={logout} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700">Sair</button>
      </div>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col gap-4">
        <div>
            <label className="text-slate-400 text-sm">Nome</label>
            <p className="text-white font-semibold text-lg">{profile?.full_name || 'Não informado'}</p>
        </div>
        <div>
            <label className="text-slate-400 text-sm">E-mail</label>
            <p className="text-white font-semibold text-lg">{profile?.email || user?.email}</p>
        </div>
        <div>
            <label className="text-slate-400 text-sm">Cargo</label>
            <p className="text-white font-semibold text-lg uppercase">{profile?.role}</p>
        </div>
        <div>
            <label className="text-slate-400 text-sm">Aniversário</label>
            <p className="text-white font-semibold text-lg">{profile?.birth_date || 'Não cadastrado'}</p>
        </div>
        
        <button className="self-start mt-4 px-6 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-medium hover:bg-slate-600 transition">
            Alterar Senha
        </button>
      </div>
    </div>
  );
}
