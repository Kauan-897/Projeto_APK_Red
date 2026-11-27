// Cria (ou troca de plano) a assinatura da igreja no Asaas e devolve o link
// da fatura, onde o pastor paga com Pix, boleto ou cartão.
// Chamada pelo app logado: supabase.functions.invoke('asaas-checkout', { body: { plan_id, cpf_cnpj } })
import { createClient } from "npm:@supabase/supabase-js@2";
import { asaas, corsHeaders, json } from "../_shared/asaas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    // Quem está chamando?
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Faça login novamente." }, 401);
    const user = userData.user;

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, church_id, full_name, email")
      .eq("id", user.id)
      .single();
    if (!profile?.church_id || !["pastor", "admin"].includes(profile.role)) {
      return json({ error: "Apenas o pastor ou admin da igreja pode contratar o plano." }, 403);
    }

    const { plan_id, cpf_cnpj } = await req.json().catch(() => ({}));
    const doc = onlyDigits(cpf_cnpj);
    if (doc.length !== 11 && doc.length !== 14) {
      return json({ error: "Informe um CPF ou CNPJ válido para a cobrança." }, 400);
    }

    const { data: plan } = await admin.from("plans").select("*").eq("id", plan_id).eq("active", true).single();
    if (!plan) return json({ error: "Plano inválido." }, 400);

    // O plano precisa comportar os membros atuais.
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("church_id", profile.church_id);
    if (plan.member_limit !== null && (count ?? 0) > plan.member_limit) {
      return json({ error: `Sua igreja tem ${count} membros; o plano ${plan.name} comporta ${plan.member_limit}.` }, 400);
    }

    const [{ data: church }, { data: sub }] = await Promise.all([
      admin.from("churches").select("id, name").eq("id", profile.church_id).single(),
      admin.from("church_subscriptions").select("*").eq("church_id", profile.church_id).single(),
    ]);

    // 1. Cliente no Asaas (um por igreja)
    let customerId: string | null = sub?.asaas_customer_id ?? null;
    if (!customerId) {
      const customer = await asaas<{ id: string }>("/customers", {
        method: "POST",
        body: {
          name: church!.name,
          email: profile.email,
          cpfCnpj: doc,
          externalReference: profile.church_id,
          notificationDisabled: false,
        },
      });
      customerId = customer.id;
    }

    const value = plan.price_cents / 100;
    const description = `Gestão Igreja — plano ${plan.name}`;

    // 2. Assinatura mensal (troca o valor se já existir)
    let subscriptionId: string | null = sub?.asaas_subscription_id ?? null;
    if (subscriptionId) {
      await asaas(`/subscriptions/${subscriptionId}`, {
        method: "PUT",
        body: { value, description, updatePendingPayments: true },
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const created = await asaas<{ id: string }>("/subscriptions", {
        method: "POST",
        body: {
          customer: customerId,
          billingType: "UNDEFINED", // o pagador escolhe Pix, boleto ou cartão
          value,
          nextDueDate: today,
          cycle: "MONTHLY",
          description,
          externalReference: profile.church_id,
        },
      });
      subscriptionId = created.id;
    }

    await admin
      .from("church_subscriptions")
      .update({ plan_id: plan.id, asaas_customer_id: customerId, asaas_subscription_id: subscriptionId })
      .eq("church_id", profile.church_id);

    // 3. Link da próxima fatura em aberto
    const payments = await asaas<{ data: { invoiceUrl: string; status: string }[] }>(
      `/subscriptions/${subscriptionId}/payments?status=PENDING`,
    );
    const invoiceUrl = payments.data?.[0]?.invoiceUrl ?? null;

    return json({ ok: true, invoiceUrl });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});
