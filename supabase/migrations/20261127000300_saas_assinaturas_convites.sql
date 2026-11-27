-- =====================================================================
-- FASE 2 — SaaS: planos, assinaturas, teste grátis e convites
-- ---------------------------------------------------------------------
-- * Planos por faixa de membros (preços editáveis na tabela plans).
-- * Toda igreja tem uma assinatura; igreja nova ganha 14 dias de teste.
--   O admin da plataforma pode estender/encurtar o teste por igreja.
-- * Sem acesso (teste vencido, inadimplência além da carência, cancelada)
--   a igreja fica em MODO SOMENTE LEITURA: vê os dados, não grava.
-- * Entrada de membros só por convite (link/código). Quem cria conta sem
--   convite pode criar a própria igreja e vira pastor dela.
-- * Cobrança via Asaas: as Edge Functions asaas-checkout e asaas-webhook
--   atualizam church_subscriptions com a service_role.
-- =====================================================================

-- ------------------------------------------------------------ planos
create table if not exists public.plans (
  id text primary key,
  name text not null,
  member_limit integer,                -- null = ilimitado
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0
);

-- Valores iniciais: AJUSTE OS PREÇOS antes de vender (update public.plans ...).
insert into public.plans (id, name, member_limit, price_cents, sort_order) values
  ('essencial',   'Essencial',   100,  4900, 1),
  ('crescimento', 'Crescimento', 300,  9900, 2),
  ('expansao',    'Expansão',    1000, 19900, 3),
  ('ilimitado',   'Ilimitado',   null, 34900, 4)
on conflict (id) do nothing;

alter table public.plans enable row level security;
create policy plans_select on public.plans for select using (true);
create policy plans_admin on public.plans for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ------------------------------------------------------------ assinaturas
create table if not exists public.church_subscriptions (
  church_id uuid primary key references public.churches(id) on delete cascade,
  plan_id text references public.plans(id),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'courtesy')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  asaas_customer_id text unique,
  asaas_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.church_subscriptions.status is
  'trialing = teste grátis; active = pago; past_due = vencido (7 dias de carência); canceled; courtesy = liberado sem cobrança';

alter table public.church_subscriptions enable row level security;
create policy subscriptions_select on public.church_subscriptions for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
-- Só o admin da plataforma altera pelo app (ex.: estender teste). O Asaas altera via service_role.
create policy subscriptions_admin on public.church_subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists church_subscriptions_touch on public.church_subscriptions;
create trigger church_subscriptions_touch
  before update on public.church_subscriptions
  for each row execute procedure public.touch_updated_at();

-- Toda igreja nova nasce com 14 dias de teste.
create or replace function public.create_trial_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.church_subscriptions (church_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '14 days')
  on conflict (church_id) do nothing;
  return new;
end;
$$;

drop trigger if exists churches_create_trial on public.churches;
create trigger churches_create_trial
  after insert on public.churches
  for each row execute procedure public.create_trial_subscription();

-- Igrejas que já existem ganham 14 dias de teste a partir de agora.
insert into public.church_subscriptions (church_id, status, trial_ends_at)
select id, 'trialing', now() + interval '14 days' from public.churches
on conflict (church_id) do nothing;

-- Eventos recebidos do Asaas (auditoria e idempotência). Sem acesso pelo app.
create table if not exists public.billing_events (
  id text primary key,
  event text not null,
  church_id uuid references public.churches(id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy billing_events_admin on public.billing_events for select to authenticated
  using (public.is_platform_admin());

-- ------------------------------------------------------------ acesso
-- A igreja pode gravar dados?
create or replace function public.church_has_access(target_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case s.status
      when 'courtesy'  then true
      when 'trialing'  then s.trial_ends_at > now()
      when 'active'    then s.current_period_end is null or s.current_period_end + interval '7 days' > now()
      when 'past_due'  then s.current_period_end is not null and s.current_period_end + interval '7 days' > now()
      when 'canceled'  then s.current_period_end is not null and s.current_period_end > now()
      else false
    end
    from public.church_subscriptions s
    where s.church_id = target_church
  ), false);
$$;

create or replace function public.church_member_count(target_church uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles where church_id = target_church;
$$;

-- Resumo para o app (banner de teste/pagamento, tela de assinatura).
create or replace function public.my_church_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'church_id', s.church_id,
    'church_name', c.name,
    'status', s.status,
    'has_access', public.church_has_access(s.church_id),
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', s.current_period_end,
    'plan_id', s.plan_id,
    'plan_name', p.name,
    'member_limit', p.member_limit,
    'member_count', public.church_member_count(s.church_id)
  )
  from public.church_subscriptions s
  join public.churches c on c.id = s.church_id
  left join public.plans p on p.id = s.plan_id
  where s.church_id = public.my_church_id();
$$;

-- Limite de membros do plano (no teste não há limite).
create or replace function public.church_can_add_member(target_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.status in ('trialing', 'courtesy')
        or p.member_limit is null
        or public.church_member_count(target_church) < p.member_limit
    from public.church_subscriptions s
    left join public.plans p on p.id = s.plan_id
    where s.church_id = target_church
  ), false);
$$;

-- Modo somente leitura: bloqueia gravações de igrejas sem acesso.
create or replace function public.enforce_church_access()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_church uuid;
begin
  if auth.uid() is null or public.is_platform_admin() then
    return coalesce(new, old);
  end if;

  if rec ? 'church_id' then
    target_church := (rec->>'church_id')::uuid;
  elsif tg_table_name = 'schedule_members' then
    select church_id into target_church from public.schedules where id = (rec->>'schedule_id')::uuid;
  elsif tg_table_name = 'profile_ministries' then
    select church_id into target_church from public.ministries where id = (rec->>'ministry_id')::uuid;
  elsif tg_table_name = 'attendance' then
    select church_id into target_church from public.events where id = (rec->>'event_id')::uuid;
  end if;

  if target_church is not null and not public.church_has_access(target_church) then
    raise exception 'ASSINATURA_INATIVA: o teste grátis ou a assinatura desta igreja venceu. Regularize em Assinatura para voltar a editar.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['events', 'videos', 'schedules', 'schedule_members', 'ministries',
                           'profile_ministries', 'branches', 'attendance']
  loop
    execute format('drop trigger if exists enforce_church_access on public.%I', t);
    execute format('create trigger enforce_church_access before insert or update or delete on public.%I
                    for each row execute procedure public.enforce_church_access()', t);
  end loop;
end $$;

-- ------------------------------------------------------------ atribuição confiável de igreja
-- Igreja e cargo só mudam por funções do servidor (criar igreja, aceitar
-- convite, painel). Elas ligam esta flag durante a própria transação.
create or replace function public.trusted_assignment()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.trusted_assignment', true), '') = 'on';
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_church uuid;
begin
  -- Igreja vinda do cadastro só vale quando quem cria é o servidor (admin_create_user).
  if public.trusted_assignment() then
    begin
      requested_church := nullif(new.raw_user_meta_data->>'church_id', '')::uuid;
    exception when invalid_text_representation then
      requested_church := null;
    end;
  end if;

  insert into public.profiles (id, email, church_id, full_name, gender, role)
  values (
    new.id,
    new.email,
    requested_church,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'gender', ''),
    'membro'
  );
  return new;
end;
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_platform_admin() or public.trusted_assignment() then
    return new;
  end if;

  if new.church_id is distinct from old.church_id then
    raise exception 'Não é permitido trocar a igreja do perfil.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if new.role = 'desenvolvedor' or old.role = 'desenvolvedor' then
      raise exception 'Cargo de plataforma só pode ser alterado pelo suporte.' using errcode = '42501';
    end if;
    if new.id = auth.uid() or not public.is_church_admin(old.church_id) then
      raise exception 'Apenas pastor/admin da igreja pode alterar cargos.' using errcode = '42501';
    end if;
  end if;

  if new.email is distinct from old.email then
    raise exception 'O e-mail é alterado pelo fluxo de autenticação.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------ criar igreja (onboarding)
create or replace function public.create_church(church_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  new_church uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Faça login para criar uma igreja.' using errcode = '42501';
  end if;
  if me.church_id is not null then
    raise exception 'Você já faz parte de uma igreja.';
  end if;
  if length(trim(coalesce(church_name, ''))) < 3 then
    raise exception 'Informe o nome da igreja (mínimo 3 caracteres).';
  end if;

  insert into public.churches (name) values (trim(church_name)) returning id into new_church;

  perform set_config('app.trusted_assignment', 'on', true);
  update public.profiles set church_id = new_church, role = 'pastor' where id = me.id;
  perform set_config('app.trusted_assignment', 'off', true);

  return new_church;
end;
$$;

-- ------------------------------------------------------------ convites
create table if not exists public.church_invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  role text not null default 'membro'
    check (role in ('pastor', 'admin', 'lider_homem', 'lider_mulher', 'supervisor', 'membro')),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  expires_at timestamptz default now() + interval '30 days',
  revoked boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.church_invites enable row level security;
create policy invites_select on public.church_invites for select to authenticated
  using (public.is_church_leader(church_id) or public.is_platform_admin());
-- pastor/admin convidam qualquer cargo; supervisor convida só membro
create policy invites_insert on public.church_invites for insert to authenticated
  with check (
    uses = 0 and not revoked
    and (public.is_church_admin(church_id)
         or (role = 'membro' and church_id = public.my_church_id() and public.has_any_role(array['supervisor']))
         or public.is_platform_admin())
  );
create policy invites_update on public.church_invites for update to authenticated
  using (public.is_church_admin(church_id) or public.is_platform_admin())
  with check (public.is_church_admin(church_id) or public.is_platform_admin());
create policy invites_delete on public.church_invites for delete to authenticated
  using (public.is_church_admin(church_id) or public.is_platform_admin());

drop trigger if exists enforce_church_access on public.church_invites;
create trigger enforce_church_access before insert or update on public.church_invites
  for each row execute procedure public.enforce_church_access();

-- Mostra para quem abriu o link qual igreja está convidando (antes do cadastro).
create or replace function public.invite_preview(invite_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'church_name', c.name,
    'role', i.role,
    'valid', not i.revoked
             and (i.expires_at is null or i.expires_at > now())
             and (i.max_uses is null or i.uses < i.max_uses)
  )
  from public.church_invites i
  join public.churches c on c.id = i.church_id
  where i.code = lower(trim(invite_code));
$$;

create or replace function public.accept_invite(invite_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  inv public.church_invites;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Faça login para aceitar o convite.' using errcode = '42501';
  end if;
  if me.church_id is not null then
    raise exception 'Você já faz parte de uma igreja.';
  end if;

  select * into inv from public.church_invites where code = lower(trim(invite_code)) for update;
  if inv.id is null or inv.revoked
     or (inv.expires_at is not null and inv.expires_at <= now())
     or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
    raise exception 'Convite inválido ou expirado.';
  end if;
  if not public.church_has_access(inv.church_id) then
    raise exception 'A assinatura desta igreja está inativa. Fale com a liderança.';
  end if;
  if not public.church_can_add_member(inv.church_id) then
    raise exception 'Esta igreja atingiu o limite de membros do plano. Fale com a liderança.';
  end if;

  perform set_config('app.trusted_assignment', 'on', true);
  update public.profiles set church_id = inv.church_id, role = inv.role where id = me.id;
  perform set_config('app.trusted_assignment', 'off', true);

  update public.church_invites set uses = uses + 1 where id = inv.id;

  return jsonb_build_object('church_id', inv.church_id, 'role', inv.role);
end;
$$;

-- ------------------------------------------------------------ admin_create_user com limite de plano
create or replace function public.admin_create_user(
  new_email text,
  new_password text,
  new_fullname text,
  new_role text,
  new_church_id uuid,
  new_gender text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_user_id uuid := gen_random_uuid();
  clean_email text := lower(trim(new_email));
begin
  if not (
    public.is_platform_admin()
    or public.is_church_admin(new_church_id)
    or (new_role = 'membro' and new_church_id = public.my_church_id() and public.has_any_role(array['supervisor']))
  ) then
    raise exception 'Acesso negado: você não pode criar este usuário nesta igreja.' using errcode = '42501';
  end if;

  if new_role = 'desenvolvedor' and not public.is_platform_admin() then
    raise exception 'Cargo não permitido.' using errcode = '42501';
  end if;

  if new_role not in ('desenvolvedor', 'pastor', 'admin', 'lider_homem', 'lider_mulher', 'supervisor', 'membro') then
    raise exception 'Cargo inválido: %', new_role;
  end if;

  if not public.is_platform_admin() then
    if not public.church_has_access(new_church_id) then
      raise exception 'ASSINATURA_INATIVA: regularize a assinatura para adicionar membros.';
    end if;
    if not public.church_can_add_member(new_church_id) then
      raise exception 'Limite de membros do plano atingido. Faça upgrade em Assinatura.';
    end if;
  end if;

  if length(coalesce(new_password, '')) < 8 then
    raise exception 'A senha provisória precisa ter pelo menos 8 caracteres.';
  end if;

  if exists (select 1 from auth.users where email = clean_email) then
    raise exception 'Já existe um usuário com este e-mail.';
  end if;

  perform set_config('app.trusted_assignment', 'on', true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    clean_email, crypt(new_password, gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', new_fullname, 'church_id', new_church_id, 'gender', nullif(new_gender, '')),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  update public.profiles set role = new_role, church_id = new_church_id where id = new_user_id;

  perform set_config('app.trusted_assignment', 'off', true);
  return new_user_id;
end;
$$;

-- ------------------------------------------------------------ igrejas: fim da lista pública
-- O cadastro agora é por convite; a lista de igrejas deixa de ser pública.
drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches for select to authenticated
  using (id = public.my_church_id() or public.is_platform_admin());

-- ------------------------------------------------------------ permissões das funções
revoke all on function public.church_has_access(uuid) from public, anon;
revoke all on function public.church_member_count(uuid) from public, anon;
revoke all on function public.my_church_access() from public, anon;
revoke all on function public.church_can_add_member(uuid) from public, anon;
revoke all on function public.create_church(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.invite_preview(text) from public;
revoke all on function public.admin_create_user(text, text, text, text, uuid, text) from public, anon;
revoke all on function public.trusted_assignment() from public, anon;
revoke all on function public.enforce_church_access() from public, anon, authenticated;
revoke all on function public.create_trial_subscription() from public, anon, authenticated;

grant execute on function public.church_has_access(uuid) to authenticated;
grant execute on function public.church_member_count(uuid) to authenticated;
grant execute on function public.my_church_access() to authenticated;
grant execute on function public.church_can_add_member(uuid) to authenticated;
grant execute on function public.create_church(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.admin_create_user(text, text, text, text, uuid, text) to authenticated;
grant execute on function public.trusted_assignment() to authenticated;
