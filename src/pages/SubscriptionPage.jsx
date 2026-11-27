import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import { STATUS_LABELS, daysUntil, formatDate, formatPrice } from '../lib/saas';

export default function SubscriptionPage() {
  const { profile, access, refreshProfile } = useAuth();
  const canManage = ['pastor', 'admin'].includes(profile?.role);
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [doc, setDoc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshProfile();
    supabase.from('plans').select('*').eq('active', true).order('sort_order').then(({ data }) => setPlans(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir a página
  }, []);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('asaas-checkout', {
      body: { plan_id: selected, cpf_cnpj: doc },
    });
    setLoading(false);
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      return toast.error(body?.error ?? error.message);
    }
    if (data?.invoiceUrl) {
      window.open(data.invoiceUrl, '_blank', 'noopener');
      toast.success('Fatura aberta em outra aba. Após o pagamento, a assinatura é ativada automaticamente.');
    } else {
      toast.success('Plano atualizado!');
    }
    refreshProfile();
  };

  const trialDays = daysUntil(access?.trial_ends_at);
  const members = access?.member_count ?? 0;

  return (
    <Sidebar>
      <h1 className="text-2xl font-bold text-white mb-6">Assinatura</h1>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-8 grid sm:grid-cols-4 gap-6">
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold">Situação</p>
          <p className={`text-lg font-bold ${access?.has_access ? 'text-emerald-400' : 'text-red-400'}`}>
            {STATUS_LABELS[access?.status] ?? '—'}{!access?.has_access && ' (somente leitura)'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold">Plano</p>
          <p className="text-lg font-bold text-white">{access?.plan_name ?? 'Nenhum'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold">Membros</p>
          <p className="text-lg font-bold text-white">{members}{access?.member_limit ? ` / ${access.member_limit}` : ''}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold">
            {access?.status === 'trialing' ? 'Teste termina em' : 'Pago até'}
          </p>
          <p className="text-lg font-bold text-white">
            {access?.status === 'trialing'
              ? `${formatDate(access?.trial_ends_at)}${trialDays > 0 ? ` (${trialDays} dias)` : ''}`
              : formatDate(access?.current_period_end)}
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Planos</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {plans.map((p) => {
          const tooSmall = p.member_limit !== null && members > p.member_limit;
          const current = access?.plan_id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!canManage || tooSmall}
              onClick={() => setSelected(p.id)}
              className={`text-left p-5 rounded-2xl border transition disabled:opacity-40 disabled:cursor-not-allowed
                ${selected === p.id ? 'border-red-500 bg-red-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'}`}
            >
              <p className="text-white font-bold text-lg flex items-center gap-2">
                {p.name} {current && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">ATUAL</span>}
              </p>
              <p className="text-slate-400 text-sm mb-3">{p.member_limit ? `até ${p.member_limit} membros` : 'membros ilimitados'}</p>
              <p className="text-2xl font-bold text-white">{formatPrice(p.price_cents)}<span className="text-sm text-slate-400 font-normal">/mês</span></p>
              {tooSmall && <p className="text-xs text-amber-300 mt-2">Sua igreja já passou deste limite</p>}
            </button>
          );
        })}
      </div>

      {canManage ? (
        selected && (
          <form onSubmit={handleCheckout} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 flex flex-wrap items-end gap-4 max-w-2xl">
            <label className="grid gap-1 text-xs text-slate-400 font-semibold uppercase flex-1 min-w-[220px]">CPF ou CNPJ do responsável pela cobrança
              <input className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-500"
                value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="00.000.000/0001-00" required />
            </label>
            <button disabled={loading} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2 rounded-lg transition disabled:opacity-50">
              <Check className="w-4 h-4" /> {loading ? 'Gerando fatura...' : 'Assinar e pagar'}
            </button>
            <p className="text-xs text-slate-500 w-full">Pagamento mensal por Pix, boleto ou cartão, processado pelo Asaas.</p>
          </form>
        )
      ) : (
        <p className="text-slate-400 text-sm">Somente o pastor ou administrador da igreja pode contratar ou trocar o plano.</p>
      )}
    </Sidebar>
  );
}
