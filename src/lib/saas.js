// Utilitários da parte SaaS: cargos, convites pendentes e datas.

export const ROLE_LABELS = {
  desenvolvedor: 'Admin da plataforma',
  pastor: 'Pastor',
  admin: 'Administrador',
  lider_homem: 'Líder (homens)',
  lider_mulher: 'Líder (mulheres)',
  supervisor: 'Supervisor',
  membro: 'Membro',
};

export const STATUS_LABELS = {
  trialing: 'Teste grátis',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  courtesy: 'Cortesia',
};

const PENDING_INVITE_KEY = 'convite_pendente';

export const savePendingInvite = (code) => localStorage.setItem(PENDING_INVITE_KEY, code);
export const getPendingInvite = () => localStorage.getItem(PENDING_INVITE_KEY);
export const clearPendingInvite = () => localStorage.removeItem(PENDING_INVITE_KEY);

export const inviteLink = (code) => `${window.location.origin}/convite/${code}`;

export const daysUntil = (iso) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export const formatPrice = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
