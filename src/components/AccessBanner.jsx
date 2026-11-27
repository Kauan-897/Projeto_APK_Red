import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { daysUntil } from '../lib/saas';

// Aviso no topo das páginas: dias de teste restantes ou modo somente leitura.
export default function AccessBanner() {
  const { access, profile } = useAuth();
  if (!access || profile?.role === 'desenvolvedor') return null;

  const canPay = ['pastor', 'admin'].includes(profile?.role);
  const cta = canPay && (
    <Link to="/assinatura" className="ml-auto shrink-0 bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1 rounded-lg">
      Ver planos
    </Link>
  );

  if (!access.has_access) {
    return (
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-red-700 bg-red-950/60 px-4 py-3 text-sm text-red-100">
        <span>
          <b>Modo somente leitura.</b>{' '}
          {access.status === 'trialing' ? 'O teste grátis terminou.' : 'A assinatura está inativa.'}{' '}
          {canPay ? 'Escolha um plano para voltar a editar.' : 'Fale com o pastor ou administrador da igreja.'}
        </span>
        {cta}
      </div>
    );
  }

  if (access.status === 'trialing') {
    const days = daysUntil(access.trial_ends_at);
    return (
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
        <span>Teste grátis: <b>{days} {days === 1 ? 'dia restante' : 'dias restantes'}</b>.</span>
        {cta}
      </div>
    );
  }

  if (access.status === 'past_due') {
    return (
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
        <span><b>Pagamento pendente.</b> Regularize para não entrar em modo somente leitura.</span>
        {cta}
      </div>
    );
  }

  return null;
}
