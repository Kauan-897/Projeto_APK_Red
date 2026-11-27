import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Church, Ticket, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { clearPendingInvite, getPendingInvite } from '../lib/saas';

// Primeira tela de quem tem conta mas ainda não pertence a uma igreja.
export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, refreshProfile, logout } = useAuth();
  const [mode, setMode] = useState(getPendingInvite() ? 'convite' : null);
  const [churchName, setChurchName] = useState('');
  const [code, setCode] = useState(getPendingInvite() ?? '');
  const [loading, setLoading] = useState(false);

  const finish = async (msg) => {
    clearPendingInvite();
    await refreshProfile();
    toast.success(msg);
    navigate('/dashboard', { replace: true });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.rpc('create_church', { church_name: churchName });
    setLoading(false);
    if (error) return toast.error(error.message);
    finish('Igreja criada! Você tem 14 dias de teste grátis.');
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    // aceita tanto o código quanto o link inteiro colado
    const clean = code.trim().split('/').pop();
    setLoading(true);
    const { error } = await supabase.rpc('accept_invite', { invite_code: clean });
    setLoading(false);
    if (error) return toast.error(error.message);
    finish('Bem-vindo! Você entrou na igreja.');
  };

  const card = 'w-full text-left p-6 rounded-2xl border border-slate-700 bg-slate-800/60 hover:border-red-500 transition';
  const input = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-950 via-slate-950 to-black p-4">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-white mb-2">Olá{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!</h1>
        <p className="text-slate-400 mb-8">Para continuar, entre na sua igreja ou cadastre uma nova.</p>

        {mode === null && (
          <div className="grid gap-4">
            <button className={card} onClick={() => setMode('convite')}>
              <Ticket className="w-7 h-7 text-red-400 mb-3" />
              <p className="text-white font-semibold text-lg">Tenho um convite</p>
              <p className="text-slate-400 text-sm">Recebi um link ou código da liderança da minha igreja.</p>
            </button>
            <button className={card} onClick={() => setMode('criar')}>
              <Church className="w-7 h-7 text-red-400 mb-3" />
              <p className="text-white font-semibold text-lg">Cadastrar minha igreja</p>
              <p className="text-slate-400 text-sm">Sou pastor ou responsável e quero usar o sistema. 14 dias grátis, sem cartão.</p>
            </button>
          </div>
        )}

        {mode === 'convite' && (
          <form onSubmit={handleInvite} className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 grid gap-4">
            <label className="text-sm font-semibold text-slate-300">Código ou link do convite</label>
            <input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: 3f9a1c27b8e0" required autoFocus />
            <button disabled={loading} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar na igreja'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-slate-400 text-sm hover:text-white">Voltar</button>
          </form>
        )}

        {mode === 'criar' && (
          <form onSubmit={handleCreate} className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 grid gap-4">
            <label className="text-sm font-semibold text-slate-300">Nome da igreja</label>
            <input className={input} value={churchName} onChange={(e) => setChurchName(e.target.value)} placeholder="ex.: Igreja Batista Central" minLength={3} required autoFocus />
            <p className="text-xs text-slate-500">Você será o pastor (administrador) da igreja e poderá convidar os membros em seguida.</p>
            <button disabled={loading} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar igreja e começar o teste'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-slate-400 text-sm hover:text-white">Voltar</button>
          </form>
        )}

        <div className="mt-8 flex items-center gap-6 text-sm">
          <button onClick={logout} className="flex items-center gap-2 text-slate-500 hover:text-white">
            <LogOut className="w-4 h-4" /> Sair
          </button>
          <button onClick={() => navigate('/meus-dados')} className="text-slate-500 hover:text-white">Meus dados e privacidade</button>
        </div>
      </div>
    </div>
  );
}
