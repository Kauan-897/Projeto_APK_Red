import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { STATUS_LABELS, daysUntil, formatDate } from '../lib/saas';

// Painel do admin da plataforma: situação de cada igreja e ajuste do teste grátis.
export default function SubscriptionsAdmin() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});

  const load = useCallback(async () => {
    const [{ data: subs, error }, { data: profiles }] = await Promise.all([
      supabase.from('church_subscriptions').select('*, churches(name), plans(name, member_limit)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('church_id'),
    ]);
    if (error) return toast.error(error.message);
    setRows(subs ?? []);
    const c = {};
    (profiles ?? []).forEach((p) => { if (p.church_id) c[p.church_id] = (c[p.church_id] ?? 0) + 1; });
    setCounts(c);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load é assíncrono; o setState ocorre após o await
    load();
  }, [load]);

  const update = async (churchId, patch, msg) => {
    const { error } = await supabase.from('church_subscriptions').update(patch).eq('church_id', churchId);
    if (error) return toast.error(error.message);
    toast.success(msg);
    load();
  };

  // Estende/encurta o teste a partir do fim atual (ou de hoje, se já venceu).
  const shiftTrial = (row, days) => {
    const base = row.trial_ends_at && new Date(row.trial_ends_at) > new Date() ? new Date(row.trial_ends_at) : new Date();
    base.setDate(base.getDate() + days);
    update(row.church_id, { status: 'trialing', trial_ends_at: base.toISOString() },
      `Teste ${days > 0 ? 'estendido' : 'encurtado'} até ${base.toLocaleDateString('pt-BR')}`);
  };

  const setTrialDate = (row, value) => {
    if (!value) return;
    update(row.church_id, { status: 'trialing', trial_ends_at: new Date(`${value}T23:59:59`).toISOString() }, 'Data do teste definida');
  };

  const toggleCourtesy = (row) => {
    if (row.status === 'courtesy') {
      update(row.church_id, { status: 'trialing', trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString() },
        'Cortesia removida: 7 dias de teste para regularizar');
    } else if (window.confirm(`Liberar ${row.churches?.name} como cortesia (sem cobrança, sem prazo)?`)) {
      update(row.church_id, { status: 'courtesy' }, 'Igreja liberada como cortesia');
    }
  };

  const btn = 'px-2 py-1 rounded-md text-xs font-semibold transition';

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-xl font-bold mb-1 text-white">Assinaturas das igrejas</h3>
      <p className="text-slate-400 text-sm mb-4">Estenda ou encurte o teste grátis de cada igreja, ou libere como cortesia.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-3">Igreja</th>
              <th className="px-3 py-3">Situação</th>
              <th className="px-3 py-3">Plano</th>
              <th className="px-3 py-3">Membros</th>
              <th className="px-3 py-3">Teste até</th>
              <th className="px-3 py-3">Pago até</th>
              <th className="px-3 py-3">Ajustar teste</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const left = daysUntil(r.trial_ends_at);
              return (
                <tr key={r.church_id} className="border-b border-slate-700">
                  <td className="px-3 py-3 text-white font-medium">{r.churches?.name}</td>
                  <td className="px-3 py-3">{STATUS_LABELS[r.status]}</td>
                  <td className="px-3 py-3">{r.plans?.name ?? '—'}</td>
                  <td className="px-3 py-3">{counts[r.church_id] ?? 0}{r.plans?.member_limit ? ` / ${r.plans.member_limit}` : ''}</td>
                  <td className="px-3 py-3">
                    {formatDate(r.trial_ends_at)}
                    {r.status === 'trialing' && left !== null && (
                      <span className={`ml-1 text-xs ${left > 0 ? 'text-slate-500' : 'text-red-400'}`}>({left > 0 ? `${left}d` : 'vencido'})</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{formatDate(r.current_period_end)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => shiftTrial(r, -7)} className={`${btn} bg-slate-700 hover:bg-slate-600`}>−7d</button>
                      <button onClick={() => shiftTrial(r, 7)} className={`${btn} bg-slate-700 hover:bg-slate-600`}>+7d</button>
                      <button onClick={() => shiftTrial(r, 30)} className={`${btn} bg-slate-700 hover:bg-slate-600`}>+30d</button>
                      <input type="date" onChange={(e) => setTrialDate(r, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white" title="Definir data exata" />
                      <button onClick={() => toggleCourtesy(r)}
                        className={`${btn} ${r.status === 'courtesy' ? 'bg-amber-700 hover:bg-amber-600' : 'bg-emerald-800 hover:bg-emerald-700'}`}>
                        {r.status === 'courtesy' ? 'Tirar cortesia' : 'Cortesia'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan="7" className="px-3 py-6 text-center text-slate-500">Nenhuma igreja.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
