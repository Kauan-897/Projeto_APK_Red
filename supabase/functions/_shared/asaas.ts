// Integração com o Asaas (https://docs.asaas.com).
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   ASAAS_API_KEY        chave da API (sandbox ou produção)
//   ASAAS_BASE_URL       https://api-sandbox.asaas.com/v3 (padrão) ou https://api.asaas.com/v3
//   ASAAS_WEBHOOK_TOKEN  token configurado no webhook do painel Asaas

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function asaas<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada nas secrets das Edge Functions.");
  const base = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent": "gestao-igreja-saas",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.map((e: { description: string }) => e.description).join("; ") ?? res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }
  return data as T;
}

/** Comparação em tempo constante para o token do webhook. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export type SubscriptionState = {
  status: string;
  current_period_end: string | null;
};

/** Soma 1 mês a uma data YYYY-MM-DD (vencimento) e devolve ISO. */
export function addOneMonth(dateOnly: string): string {
  const d = new Date(`${dateOnly}T23:59:59Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/**
 * Decide o novo estado da assinatura a partir de um evento do Asaas.
 * Retorna null quando o evento não muda nada.
 */
export function applyAsaasEvent(
  current: SubscriptionState,
  event: string,
  payment?: { dueDate?: string },
): SubscriptionState | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (!payment?.dueDate) return null;
      const paidUntil = addOneMonth(payment.dueDate);
      const keep = current.current_period_end !== null &&
        new Date(current.current_period_end).getTime() > new Date(paidUntil).getTime();
      return { status: "active", current_period_end: keep ? current.current_period_end : paidUntil };
    }
    case "PAYMENT_OVERDUE": {
      if (current.status === "courtesy") return null;
      const due = payment?.dueDate ? new Date(`${payment.dueDate}T23:59:59Z`).toISOString() : null;
      return { status: "past_due", current_period_end: current.current_period_end ?? due };
    }
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      if (current.status === "courtesy") return null;
      return { status: "canceled", current_period_end: current.current_period_end };
    default:
      return null;
  }
}
