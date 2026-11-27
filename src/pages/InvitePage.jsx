import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS, savePendingInvite } from '../lib/saas';

// Página pública aberta pelo link de convite: /convite/:code
export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [preview, setPreview] = useState(undefined);

  useEffect(() => {
    savePendingInvite(code);
    supabase.rpc('invite_preview', { invite_code: code }).then(({ data }) => setPreview(data ?? null));
  }, [code]);

  // Já logado e sem igreja: segue direto para aceitar.
  useEffect(() => {
    if (user && profile && !profile.church_id && preview?.valid) navigate('/bem-vindo', { replace: true });
  }, [user, profile, preview, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-950 via-slate-950 to-black p-4">
      <div className="bg-slate-900/80 border border-red-900/40 rounded-2xl p-10 w-full max-w-md text-center">
        {preview === undefined && <p className="text-slate-400">Carregando convite...</p>}

        {preview === null && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Convite não encontrado</h1>
            <p className="text-slate-400">Confira o link com quem te convidou.</p>
          </>
        )}

        {preview && !preview.valid && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Convite expirado</h1>
            <p className="text-slate-400">Este convite para <b className="text-white">{preview.church_name}</b> não é mais válido. Peça um novo à liderança.</p>
          </>
        )}

        {preview?.valid && (
          <>
            <p className="text-red-300 text-sm font-semibold uppercase tracking-wide mb-2">Você foi convidado</p>
            <h1 className="text-3xl font-bold text-white mb-2">{preview.church_name}</h1>
            <p className="text-slate-400 mb-8">como <b className="text-slate-200">{ROLE_LABELS[preview.role] ?? preview.role}</b></p>

            {user && profile?.church_id ? (
              <p className="text-amber-300 text-sm">Sua conta já pertence a uma igreja. Saia e entre com outra conta para aceitar.</p>
            ) : (
              <div className="grid gap-3">
                <Link to="/login?modo=cadastro" className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition">Criar minha conta</Link>
                <Link to="/login" className="text-slate-300 hover:text-white py-2">Já tenho conta — entrar</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
