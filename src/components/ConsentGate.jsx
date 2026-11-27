import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { CONSENT_RELIGIOSO } from '../legal/documents';

// Tela obrigatória enquanto faltar o aceite dos termos ou o consentimento
// para o dado sensível (LGPD art. 8º e 11, I).
export default function ConsentGate({ children }) {
  const { user, consents, refreshProfile, logout } = useAuth();
  const [terms, setTerms] = useState(false);
  const [religious, setReligious] = useState(false);
  const [saving, setSaving] = useState(false);

  const pending = consents && Object.values(consents).some((c) => c.required && !c.accepted);
  if (!user || !pending) return children;

  const handleAccept = async (e) => {
    e.preventDefault();
    setSaving(true);
    for (const kind of ['termos', 'dados_religiosos']) {
      if (consents[kind]?.accepted) continue;
      const { error } = await supabase.rpc('record_consent', {
        consent_kind: kind,
        consent_granted: true,
        client_user_agent: navigator.userAgent,
      });
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    await refreshProfile();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir sua conta e todos os seus dados? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast.error(error.message);
    toast.success('Conta excluída.');
    logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4">
      <form onSubmit={handleAccept} className="w-full max-w-2xl bg-slate-900/90 border border-slate-700 rounded-2xl p-8">
        <ShieldCheck className="w-10 h-10 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Sua privacidade</h1>
        <p className="text-slate-400 mb-6">
          Antes de continuar, precisamos do seu aceite. Você pode revogar a qualquer momento em <b className="text-slate-200">Meus dados</b>.
        </p>

        <label className="flex gap-3 items-start mb-5 cursor-pointer">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-red-600" />
          <span className="text-slate-200">
            Li e aceito os <Link to="/termos" target="_blank" className="text-red-400 underline">Termos de Uso</Link> e a{' '}
            <Link to="/privacidade" target="_blank" className="text-red-400 underline">Política de Privacidade</Link>.
          </span>
        </label>

        {/* Consentimento específico e em destaque (art. 11, I) */}
        <div className="border-2 border-amber-600/60 bg-amber-950/30 rounded-xl p-5 mb-6">
          <p className="text-amber-200 font-bold mb-2">{CONSENT_RELIGIOSO.title}</p>
          <p className="text-amber-50/90 text-sm leading-relaxed mb-4">{CONSENT_RELIGIOSO.text}</p>
          <label className="flex gap-3 items-center cursor-pointer">
            <input type="checkbox" checked={religious} onChange={(e) => setReligious(e.target.checked)} className="w-5 h-5 accent-amber-500" />
            <span className="text-white font-semibold">Eu consinto com este tratamento</span>
          </label>
        </div>

        <button disabled={!terms || !religious || saving}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? 'Salvando...' : 'Aceitar e continuar'}
        </button>
        <p className="text-xs text-slate-500 mt-4">
          Se não quiser consentir, você pode sair agora ou excluir a sua conta e todos os seus dados.
        </p>
        <div className="mt-4 flex gap-6 text-sm">
          <button type="button" onClick={logout} className="text-slate-400 hover:text-white">Sair</button>
          <button type="button" onClick={handleDelete} className="text-red-400 hover:text-red-300">Excluir minha conta</button>
        </div>
      </form>
    </div>
  );
}
