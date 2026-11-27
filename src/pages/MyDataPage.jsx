import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, LogOut, Trash2, Plus, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import { CONSENT_FILHOS, CONSENT_RELIGIOSO } from '../legal/documents';
import { ROLE_LABELS, formatDate } from '../lib/saas';

const AUDIT_LABELS = {
  cargo_alterado: 'Cargo alterado',
  entrou_na_igreja: 'Entrou na igreja',
  saiu_da_igreja: 'Saiu da igreja',
  dados_exportados: 'Dados exportados',
  conta_excluida: 'Conta excluída',
  encarregado_definido: 'Encarregado definido',
};

const field = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-500';
const card = 'bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-6';

// Direitos do titular (LGPD art. 18): ver, corrigir, baixar, revogar, sair e excluir.
export default function MyDataPage() {
  const { profile, consents, refreshProfile, logout } = useAuth();
  const isChurchAdmin = ['pastor', 'admin'].includes(profile?.role);

  const [form, setForm] = useState({});
  const [children, setChildren] = useState([]);
  const [church, setChurch] = useState(null);
  const [dpo, setDpo] = useState({ name: '', email: '' });
  const [audit, setAudit] = useState([]);
  const [childConsentCheck, setChildConsentCheck] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Sincroniza o formulário sempre que o perfil é recarregado (após salvar ou consentir).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cópia editável do perfil vindo do servidor
    setForm({
      full_name: profile.full_name ?? '',
      gender: profile.gender ?? '',
      birth_date: profile.birth_date ?? '',
      address: profile.address ?? '',
      marital_status: profile.marital_status ?? '',
      spouse_name: profile.spouse_name ?? '',
    });
    setChildren(Array.isArray(profile.children_details) ? profile.children_details : []);
  }, [profile]);

  const churchId = profile?.church_id;
  const loadChurch = useCallback(async () => {
    if (!churchId) return;
    const { data } = await supabase.from('churches').select('id, name, dpo_name, dpo_email').eq('id', churchId).single();
    setChurch(data);
    setDpo({ name: data?.dpo_name ?? '', email: data?.dpo_email ?? '' });
    if (isChurchAdmin) {
      const { data: logs } = await supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(30);
      setAudit(logs ?? []);
    }
  }, [churchId, isChurchAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadChurch é assíncrono; o setState ocorre após o await
    loadChurch();
  }, [loadChurch]);

  const childConsent = consents?.dados_filhos?.accepted;

  // ------------------------------------------------ ações
  const saveProfile = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id);
    if (error) return toast.error(error.message);
    toast.success('Dados atualizados.');
    refreshProfile();
  };

  const consent = async (kind, granted) => {
    const { error } = await supabase.rpc('record_consent', {
      consent_kind: kind, consent_granted: granted, client_user_agent: navigator.userAgent,
    });
    if (error) { toast.error(error.message); return false; }
    await refreshProfile();
    return true;
  };

  const saveChildren = async () => {
    const clean = children.filter((c) => c.nome?.trim());
    const { error } = await supabase.from('profiles')
      .update({ has_children: clean.length > 0, children_details: clean })
      .eq('id', profile.id);
    if (error) return toast.error(error.message);
    toast.success('Filhos atualizados.');
    refreshProfile();
  };

  const revokeChildren = async () => {
    if (!window.confirm('Revogar o consentimento apaga os dados dos seus filhos. Continuar?')) return;
    if (await consent('dados_filhos', false)) toast.success('Consentimento revogado e dados dos filhos apagados.');
  };

  const exportData = async () => {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) return toast.error(error.message);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo com seus dados baixado.');
  };

  const leaveChurch = async () => {
    if (!window.confirm(`Sair de ${church?.name}? Seus ministérios, escalas, presenças e anotações nesta igreja serão apagados.`)) return;
    const { error } = await supabase.rpc('leave_church');
    if (error) return toast.error(error.message);
    toast.success('Você saiu da igreja.');
    refreshProfile();
  };

  const revokeReligious = async () => {
    if (!window.confirm('Revogar este consentimento faz você sair da igreja e apaga seus vínculos com ela. Continuar?')) return;
    if (await consent('dados_religiosos', false)) toast.success('Consentimento revogado.');
  };

  const deleteAccount = async () => {
    const typed = window.prompt('Para excluir sua conta e todos os seus dados, digite EXCLUIR');
    if (typed !== 'EXCLUIR') return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast.error(error.message);
    toast.success('Conta excluída.');
    logout();
  };

  const saveDpo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc('set_church_dpo', { p_name: dpo.name, p_email: dpo.email });
    if (error) return toast.error(error.message);
    toast.success('Encarregado atualizado.');
    loadChurch();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Sidebar>
      <h1 className="text-2xl font-bold text-white mb-1">Meus dados</h1>
      <p className="text-slate-400 text-sm mb-6">
        Seus direitos pela LGPD (art. 18). Leia a <Link to="/privacidade" className="text-red-400 underline">Política de Privacidade</Link>.
      </p>

      {/* ------------------------------------------------ perfil */}
      <form onSubmit={saveProfile} className={card}>
        <h2 className="text-lg font-semibold text-white mb-4">Perfil</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">Nome
            <input className={field} value={form.full_name ?? ''} onChange={set('full_name')} required />
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">E-mail
            <input className={`${field} opacity-60`} value={profile?.email ?? ''} disabled />
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">Gênero
            <select className={field} value={form.gender ?? ''} onChange={set('gender')}>
              <option value="">Prefiro não informar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">Nascimento
            <input type="date" className={field} value={form.birth_date ?? ''} onChange={set('birth_date')} />
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1 sm:col-span-2">Endereço
            <input className={field} value={form.address ?? ''} onChange={set('address')} />
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">Estado civil
            <select className={field} value={form.marital_status ?? ''} onChange={set('marital_status')}>
              <option value="">Prefiro não informar</option>
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
            </select>
          </label>
          <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1">Cônjuge
            <input className={field} value={form.spouse_name ?? ''} onChange={set('spouse_name')} />
          </label>
        </div>
        <p className="text-xs text-slate-500 mt-3">Só você e a liderança da sua igreja veem estes dados. Os demais membros veem apenas nome, foto e cargo.</p>
        <button className="mt-4 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2 rounded-lg">Salvar</button>
      </form>

      {/* ------------------------------------------------ filhos (art. 14) */}
      <div className={card}>
        <h2 className="text-lg font-semibold text-white mb-2">Filhos</h2>
        {!childConsent ? (
          <div className="border border-amber-700/60 bg-amber-950/30 rounded-xl p-4">
            <p className="text-amber-200 font-semibold mb-1">{CONSENT_FILHOS.title}</p>
            <p className="text-sm text-amber-50/90 mb-3">{CONSENT_FILHOS.text}</p>
            <label className="flex gap-2 items-center text-sm text-white mb-3">
              <input type="checkbox" checked={childConsentCheck} onChange={(e) => setChildConsentCheck(e.target.checked)} className="w-4 h-4 accent-amber-500" />
              Sou responsável legal e consinto
            </label>
            <button disabled={!childConsentCheck} onClick={() => consent('dados_filhos', true)}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              Consentir e informar filhos
            </button>
          </div>
        ) : (
          <>
            {children.map((c, i) => (
              <div key={i} className="flex gap-3 mb-2">
                <input className={field} placeholder="Nome" value={c.nome ?? ''}
                  onChange={(e) => setChildren(children.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                <input className={`${field} w-28`} type="number" min="0" max="17" placeholder="Idade" value={c.idade ?? ''}
                  onChange={(e) => setChildren(children.map((x, j) => (j === i ? { ...x, idade: e.target.value } : x)))} />
                <button type="button" onClick={() => setChildren(children.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-400"><X className="w-5 h-5" /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-4 mt-3 items-center">
              <button type="button" onClick={() => setChildren([...children, { nome: '', idade: '' }])}
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"><Plus className="w-4 h-4" /> Adicionar</button>
              <button type="button" onClick={saveChildren} className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-sm">Salvar filhos</button>
              <button type="button" onClick={revokeChildren} className="text-sm text-amber-400 hover:text-amber-300 ml-auto">Revogar consentimento</button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------ consentimentos e dados */}
      <div className={card}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Consentimentos</h2>
        <ul className="text-sm grid gap-2 mb-5">
          <li>Termos de Uso e Política de Privacidade: <b className="text-emerald-400">aceitos</b></li>
          <li>{CONSENT_RELIGIOSO.title}: {consents?.dados_religiosos?.accepted ? <b className="text-emerald-400">concedido</b> : <b className="text-slate-400">não concedido</b>}
            {consents?.dados_religiosos?.accepted && profile?.church_id && (
              <button onClick={revokeReligious} className="ml-3 text-amber-400 hover:text-amber-300">revogar</button>
            )}
          </li>
          <li>{CONSENT_FILHOS.title}: {childConsent ? <b className="text-emerald-400">concedido</b> : <b className="text-slate-400">não concedido</b>}</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportData} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Download className="w-4 h-4" /> Baixar meus dados (JSON)
          </button>
          {profile?.church_id && (
            <button onClick={leaveChurch} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              <LogOut className="w-4 h-4" /> Sair da igreja
            </button>
          )}
          <button onClick={deleteAccount} className="flex items-center gap-2 bg-red-900/60 hover:bg-red-800 text-red-100 px-4 py-2 rounded-lg text-sm font-semibold">
            <Trash2 className="w-4 h-4" /> Excluir minha conta
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ igreja: encarregado e auditoria */}
      {church && (
        <div className={card}>
          <h2 className="text-lg font-semibold text-white mb-1">Privacidade na {church.name}</h2>
          <p className="text-sm text-slate-400 mb-4">
            Encarregado de dados da igreja (LGPD art. 41):{' '}
            {church.dpo_name ? <b className="text-slate-200">{church.dpo_name} — {church.dpo_email}</b> : <span className="text-slate-500">não informado</span>}
          </p>

          {isChurchAdmin && (
            <>
              <form onSubmit={saveDpo} className="flex flex-wrap gap-3 items-end mb-6">
                <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1 flex-1 min-w-[180px]">Nome do encarregado
                  <input className={field} value={dpo.name} onChange={(e) => setDpo({ ...dpo, name: e.target.value })} />
                </label>
                <label className="text-xs text-slate-400 font-semibold uppercase grid gap-1 flex-1 min-w-[180px]">E-mail
                  <input type="email" className={field} value={dpo.email} onChange={(e) => setDpo({ ...dpo, email: e.target.value })} />
                </label>
                <button className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-sm">Salvar</button>
              </form>

              <h3 className="text-sm font-semibold text-slate-300 mb-2">Registro de operações (últimas 30)</h3>
              <table className="w-full text-sm">
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t border-slate-700">
                      <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{formatDate(a.at)} {new Date(a.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2 pr-4 text-slate-200">{AUDIT_LABELS[a.action] ?? a.action}</td>
                      <td className="py-2 text-slate-400">
                        {a.details?.de && `${ROLE_LABELS[a.details.de] ?? a.details.de} → ${ROLE_LABELS[a.details.para] ?? a.details.para}`}
                      </td>
                    </tr>
                  ))}
                  {audit.length === 0 && <tr><td className="py-3 text-slate-500">Nenhuma operação registrada.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </Sidebar>
  );
}
