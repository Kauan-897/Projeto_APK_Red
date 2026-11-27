import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Plus, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import { ROLE_LABELS, formatDate, inviteLink } from '../lib/saas';

const ADMIN_ROLES = ['pastor', 'admin'];

export default function InvitesPage() {
  const { profile } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const canInvite = isAdmin || profile?.role === 'supervisor';

  const [invites, setInvites] = useState([]);
  const [role, setRole] = useState('membro');
  const [maxUses, setMaxUses] = useState('');
  const [days, setDays] = useState('30');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('church_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setInvites(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load é assíncrono; o setState ocorre após o await
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('church_invites')
      .insert([{
        church_id: profile.church_id,
        role,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: days ? new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString() : null,
      }])
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await navigator.clipboard?.writeText(inviteLink(data.code)).catch(() => {});
    toast.success('Convite criado e link copiado!');
    load();
  };

  const copy = async (code) => {
    await navigator.clipboard?.writeText(inviteLink(code)).catch(() => {});
    toast.success('Link copiado!');
  };

  const revoke = async (id) => {
    if (!window.confirm('Revogar este convite? O link deixa de funcionar.')) return;
    const { error } = await supabase.from('church_invites').update({ revoked: true }).eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const statusOf = (i) => {
    if (i.revoked) return ['Revogado', 'text-slate-500'];
    if (i.expires_at && new Date(i.expires_at) < new Date()) return ['Expirado', 'text-slate-500'];
    if (i.max_uses && i.uses >= i.max_uses) return ['Esgotado', 'text-slate-500'];
    return ['Ativo', 'text-emerald-400'];
  };

  const field = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-500';

  return (
    <Sidebar>
      <h1 className="text-2xl font-bold text-white mb-1">Convites</h1>
      <p className="text-slate-400 text-sm mb-6">Membros entram na igreja somente por convite. Gere um link e envie pelo WhatsApp.</p>

      {canInvite && (
        <form onSubmit={handleCreate} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-8 flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-xs text-slate-400 font-semibold uppercase">Cargo
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
              {(isAdmin ? ['membro', 'lider_homem', 'lider_mulher', 'supervisor', 'admin', 'pastor'] : ['membro']).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-400 font-semibold uppercase">Usos máximos
            <input className={`${field} w-32`} type="number" min="1" placeholder="ilimitado" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-slate-400 font-semibold uppercase">Validade
            <select className={field} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="1">1 dia</option>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="">Sem validade</option>
            </select>
          </label>
          <button disabled={saving} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2 rounded-lg transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> Gerar convite
          </button>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Expira</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => {
              const [label, color] = statusOf(i);
              return (
                <tr key={i.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 font-mono text-slate-200">{i.code}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[i.role]}</td>
                  <td className="px-4 py-3">{i.uses}{i.max_uses ? ` / ${i.max_uses}` : ''}</td>
                  <td className="px-4 py-3">{formatDate(i.expires_at)}</td>
                  <td className={`px-4 py-3 font-semibold ${color}`}>{label}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {label === 'Ativo' && (
                      <>
                        <button onClick={() => copy(i.code)} className="text-blue-400 hover:text-blue-300 mr-4 inline-flex items-center gap-1"><Copy className="w-4 h-4" /> Copiar link</button>
                        {isAdmin && <button onClick={() => revoke(i.id)} className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"><Ban className="w-4 h-4" /> Revogar</button>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Nenhum convite ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Sidebar>
  );
}
