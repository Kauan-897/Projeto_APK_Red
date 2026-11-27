// Recebe eventos do Asaas e atualiza church_subscriptions.
// Configure no painel Asaas: Integrações → Webhooks → URL
//   https://<projeto>.supabase.co/functions/v1/asaas-webhook
// com o mesmo token de ASAAS_WEBHOOK_TOKEN.
import { createClient } from "npm:@supabase/supabase-js@2";
import { applyAsaasEvent, json, safeEqual } from "../_shared/asaas.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const received = req.headers.get("asaas-access-token") ?? "";
  if (!expected || !safeEqual(received, expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: {
    id?: string;
    event?: string;
    payment?: { subscription?: string; externalReference?: string; dueDate?: string };
    subscription?: { id?: string; externalReference?: string };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.id || !body.event) return json({ error: "missing id/event" }, 400);

  const subscriptionId = body.payment?.subscription ?? body.subscription?.id ?? null;
  const reference = body.payment?.externalReference ?? body.subscription?.externalReference ?? null;

  // Localiza a igreja pela assinatura do Asaas ou pela referência externa (church_id).
  let query = admin.from("church_subscriptions").select("church_id, status, current_period_end");
  if (subscriptionId) query = query.eq("asaas_subscription_id", subscriptionId);
  else if (reference) query = query.eq("church_id", reference);
  else return json({ ignored: "sem assinatura/referência" });
  const { data: sub, error: subErr } = await query.maybeSingle();
  if (subErr) return json({ error: subErr.message }, 500);

  // Idempotência: o Asaas reenvia eventos; cada id é processado uma vez.
  const { error: insErr } = await admin.from("billing_events").insert({
    id: body.id,
    event: body.event,
    church_id: sub?.church_id ?? null,
    payload: body,
  });
  if (insErr) {
    if (insErr.code === "23505") return json({ duplicate: true });
    return json({ error: insErr.message }, 500);
  }

  if (!sub) return json({ ignored: "assinatura desconhecida" });

  const next = applyAsaasEvent(
    { status: sub.status, current_period_end: sub.current_period_end },
    body.event,
    body.payment,
  );
  if (!next) return json({ ignored: body.event });

  const { error: updErr } = await admin
    .from("church_subscriptions")
    .update(next)
    .eq("church_id", sub.church_id);
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ ok: true, church_id: sub.church_id, ...next });
});
