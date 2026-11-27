-- =====================================================================
-- FASE 3 — LGPD (Lei 13.709/2018)
-- ---------------------------------------------------------------------
-- Pertencer a uma igreja revela "filiação a organização de caráter
-- religioso": dado pessoal SENSÍVEL (art. 5º, II). O tratamento exige
-- consentimento específico e destacado (art. 11, I). Dados de crianças
-- exigem consentimento específico de um dos pais (art. 14, § 1º).
--
-- 1. Versões dos documentos legais + registro de consentimentos (art. 8º, § 2º)
-- 2. Sem consentimento não se entra em igreja; revogar = sair da igreja
-- 3. Dados dos filhos só com consentimento próprio; revogar apaga os dados
-- 4. Minimização (art. 6º, III): membro comum vê só nome/foto/cargo dos
--    outros; contato e dados pessoais só o titular e a liderança
-- 5. Direitos do titular (art. 18): exportar, corrigir, sair, excluir conta
-- 6. Registro das operações (art. 37): audit_log
-- 7. Encarregado (art. 41): contato do encarregado por igreja
-- =====================================================================

-- ------------------------------------------------------------ documentos e consentimentos
create table if not exists public.legal_versions (
  kind text primary key check (kind in ('termos', 'dados_religiosos', 'dados_filhos')),
  version text not null,
  published_at timestamptz not null default now()
);

comment on table public.legal_versions is
  'Versão vigente de cada documento. Ao mudar o texto, atualize a versão aqui e no front (src/legal): todos precisarão aceitar de novo.';

insert into public.legal_versions (kind, version) values
  ('termos', '2026-11-27'),
  ('dados_religiosos', '2026-11-27'),
  ('dados_filhos', '2026-11-27')
on conflict (kind) do nothing;

alter table public.legal_versions enable row level security;
create policy legal_versions_select on public.legal_versions for select using (true);
create policy legal_versions_admin on public.legal_versions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Registro imutável: cada aceite ou revogação vira uma linha nova.
create table if not exists public.consents (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null references public.legal_versions(kind),
  version text not null,
  granted boolean not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists consents_profile_kind_idx on public.consents (profile_id, kind, created_at desc);

alter table public.consents enable row level security;
create policy consents_select_own on public.consents for select to authenticated
  using (profile_id = auth.uid() or public.is_platform_admin());
-- Sem insert/update/delete pelo app: só pela função record_consent.

create or replace function public.has_consent(target uuid, consent_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.granted and c.version = v.version
    from public.consents c
    join public.legal_versions v on v.kind = c.kind
    where c.profile_id = target and c.kind = consent_kind
    order by c.created_at desc, c.id desc
    limit 1
  ), false);
$$;

create or replace function public.require_consents()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_consent(auth.uid(), 'termos') or not public.has_consent(auth.uid(), 'dados_religiosos') then
    raise exception 'CONSENTIMENTO_PENDENTE: aceite os termos e o tratamento de dados religiosos para continuar.'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.consent_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_object_agg(v.kind, jsonb_build_object(
    'version', v.version,
    'accepted', public.has_consent(auth.uid(), v.kind),
    'required', v.kind in ('termos', 'dados_religiosos')
  ))
  from public.legal_versions v;
$$;

-- ------------------------------------------------------------ auditoria (art. 37)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,              -- sem FK: o registro sobrevive à exclusão da conta
  church_id uuid references public.churches(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_church_idx on public.audit_log (church_id, at desc);

alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_platform_admin() or public.is_church_admin(church_id));

create or replace function public.log_audit(p_action text, p_church uuid, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, church_id, action, target_id, details)
  values (auth.uid(), p_church, p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

-- Mudanças de cargo e de igreja ficam registradas automaticamente.
create or replace function public.audit_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    perform public.log_audit('cargo_alterado', coalesce(new.church_id, old.church_id), new.id,
      jsonb_build_object('de', old.role, 'para', new.role));
  end if;
  if new.church_id is distinct from old.church_id then
    perform public.log_audit(case when new.church_id is null then 'saiu_da_igreja' else 'entrou_na_igreja' end,
      coalesce(new.church_id, old.church_id), new.id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profile_changes on public.profiles;
create trigger audit_profile_changes
  after update on public.profiles
  for each row execute procedure public.audit_profile_changes();

-- ------------------------------------------------------------ registrar consentimento
create or replace function public.record_consent(consent_kind text, consent_granted boolean, client_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  current_version text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Faça login.' using errcode = '42501';
  end if;

  select version into current_version from public.legal_versions where kind = consent_kind;
  if current_version is null then
    raise exception 'Tipo de consentimento inválido: %', consent_kind;
  end if;

  if consent_kind = 'termos' and not consent_granted then
    raise exception 'Para deixar de aceitar os termos, exclua sua conta em Meus dados.';
  end if;

  -- Revogar o consentimento religioso = deixar de ser membro (art. 18, IX).
  if consent_kind = 'dados_religiosos' and not consent_granted and me.church_id is not null then
    perform public.leave_church();
  end if;

  -- Revogar o consentimento dos filhos apaga esses dados (art. 18, VI).
  if consent_kind = 'dados_filhos' and not consent_granted then
    perform set_config('app.trusted_assignment', 'on', true);
    update public.profiles set has_children = false, children_details = '[]'::jsonb where id = me.id;
    perform set_config('app.trusted_assignment', 'off', true);
  end if;

  insert into public.consents (profile_id, kind, version, granted, user_agent)
  values (me.id, consent_kind, current_version, consent_granted, left(client_user_agent, 300));

  return public.consent_status();
end;
$$;

-- ------------------------------------------------------------ dados dos filhos (art. 14)
create or replace function public.guard_children_data()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.trusted_assignment() then
    return new;
  end if;
  if (coalesce(new.has_children, false) is distinct from coalesce(old.has_children, false)
      or coalesce(new.children_details, '[]'::jsonb) is distinct from coalesce(old.children_details, '[]'::jsonb))
     and (coalesce(new.has_children, false) or jsonb_array_length(coalesce(new.children_details, '[]'::jsonb)) > 0)
     and not public.has_consent(new.id, 'dados_filhos') then
    raise exception 'Para informar dados dos filhos, aceite antes o termo específico (LGPD, art. 14).' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_children_data on public.profiles;
create trigger guard_children_data
  before update on public.profiles
  for each row execute procedure public.guard_children_data();

-- ------------------------------------------------------------ minimização (art. 6º, III)
-- Colunas pessoais saem da leitura direta; o app usa as funções abaixo.
revoke select on public.profiles from anon, authenticated;
grant select (id, church_id, full_name, role, avatar_url, branch_id, created_at)
  on public.profiles to authenticated;

-- Meu próprio perfil, completo.
create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- Membros da minha igreja: liderança vê contato e dados pessoais; membro comum, só o básico.
create or replace function public.church_members()
returns table (
  id uuid, full_name text, role text, avatar_url text, branch_id uuid, created_at timestamptz,
  email text, gender text, birth_date date
) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.role, p.avatar_url, p.branch_id, p.created_at,
         case when leader then p.email end,
         case when leader then p.gender end,
         case when leader then p.birth_date end
  from public.profiles p,
       lateral (select public.is_church_leader(public.my_church_id()) or p.id = auth.uid() as leader) l
  where p.church_id = public.my_church_id()
  order by p.full_name;
$$;

-- Estatísticas da igreja só em números agregados.
create or replace function public.church_demographics()
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (
    select gender, extract(year from age(birth_date))::int as idade
    from public.profiles where church_id = public.my_church_id()
  )
  select jsonb_build_object(
    'total', (select count(*) from p),
    'males', (select count(*) from p where gender = 'M'),
    'females', (select count(*) from p where gender = 'F'),
    'ageGroups', jsonb_build_object(
      '0-12',  (select count(*) from p where idade between 0 and 12),
      '13-17', (select count(*) from p where idade between 13 and 17),
      '18-25', (select count(*) from p where idade between 18 and 25),
      '26-40', (select count(*) from p where idade between 26 and 40),
      '41-60', (select count(*) from p where idade between 41 and 60),
      '60+',   (select count(*) from p where idade > 60)
    )
  );
$$;

-- Painel do admin da plataforma.
create or replace function public.admin_list_profiles()
returns table (id uuid, full_name text, email text, role text, church_id uuid, church_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.email, p.role, p.church_id, c.name, p.created_at
    from public.profiles p left join public.churches c on c.id = p.church_id
    order by p.created_at desc;
end;
$$;

-- ------------------------------------------------------------ direitos do titular (art. 18)
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  result jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Faça login.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),
    'base_legal', 'LGPD art. 18, II e V — acesso e portabilidade',
    'perfil', to_jsonb(me),
    'igreja', (select jsonb_build_object('id', c.id, 'nome', c.name, 'encarregado', c.dpo_name, 'contato_encarregado', c.dpo_email)
               from public.churches c where c.id = me.church_id),
    'consentimentos', coalesce((select jsonb_agg(to_jsonb(x) - 'profile_id' order by x.created_at)
                                from public.consents x where x.profile_id = me.id), '[]'::jsonb),
    'ministerios', coalesce((select jsonb_agg(jsonb_build_object('ministerio', m.name, 'situacao', pm.status, 'desde', pm.created_at))
                             from public.profile_ministries pm join public.ministries m on m.id = pm.ministry_id
                             where pm.profile_id = me.id), '[]'::jsonb),
    'escalas', coalesce((select jsonb_agg(jsonb_build_object('escala', s.title, 'data', s.date, 'funcao', sm.role_name, 'situacao', sm.status))
                         from public.schedule_members sm join public.schedules s on s.id = sm.schedule_id
                         where sm.profile_id = me.id), '[]'::jsonb),
    'presencas', coalesce((select jsonb_agg(jsonb_build_object('evento', e.title, 'data', e.date, 'situacao', a.status))
                           from public.attendance a join public.events e on e.id = a.event_id
                           where a.profile_id = me.id), '[]'::jsonb),
    'anotacoes_pessoais', coalesce((select jsonb_agg(jsonb_build_object('texto', n.content, 'criada_em', n.created_at))
                                    from public.personal_notes n where n.profile_id = me.id), '[]'::jsonb)
  ) into result;

  perform public.log_audit('dados_exportados', me.church_id, me.id, '{}'::jsonb);
  return result;
end;
$$;

-- Último pastor/admin não pode abandonar a igreja sem passar a administração.
create or replace function public.assert_not_last_admin(target uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = target;
  if p.church_id is not null and p.role in ('pastor', 'admin')
     and not exists (select 1 from public.profiles o
                     where o.church_id = p.church_id and o.id <> p.id and o.role in ('pastor', 'admin')) then
    raise exception 'Você é o único pastor/admin da igreja. Promova outra pessoa antes de sair ou excluir a conta.';
  end if;
end;
$$;

create or replace function public.leave_church()
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.church_id is null then
    return;
  end if;
  perform public.assert_not_last_admin(me.id);

  -- Direito do titular vale mesmo com a igreja em modo somente leitura.
  perform set_config('app.trusted_assignment', 'on', true);
  delete from public.profile_ministries where profile_id = me.id;
  delete from public.schedule_members where profile_id = me.id;
  delete from public.attendance where profile_id = me.id;
  delete from public.personal_notes where profile_id = me.id;
  update public.ministries set leader_id = null where leader_id = me.id;

  update public.profiles set church_id = null, branch_id = null, role = 'membro' where id = me.id;
  perform set_config('app.trusted_assignment', 'off', true);
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Faça login.' using errcode = '42501';
  end if;
  if me.role = 'desenvolvedor' then
    raise exception 'Contas de admin da plataforma são removidas pelo suporte.';
  end if;
  perform public.assert_not_last_admin(me.id);

  perform public.log_audit('conta_excluida', me.church_id, me.id, '{}'::jsonb);
  perform set_config('app.trusted_assignment', 'on', true);
  -- Apaga a conta de login; o perfil e tudo ligado a ele saem em cascata.
  delete from auth.users where id = me.id;
end;
$$;

-- A trava de assinatura (Fase 2) não pode impedir o exercício de direitos do titular.
create or replace function public.enforce_church_access()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_church uuid;
begin
  if auth.uid() is null or public.is_platform_admin() or public.trusted_assignment() then
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

-- ------------------------------------------------------------ encarregado (art. 41)
alter table public.churches add column if not exists dpo_name text;
alter table public.churches add column if not exists dpo_email text;

create or replace function public.set_church_dpo(p_name text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid := public.my_church_id();
begin
  if not public.is_church_admin(target) then
    raise exception 'Apenas pastor/admin da igreja define o encarregado.' using errcode = '42501';
  end if;
  update public.churches set dpo_name = nullif(trim(p_name), ''), dpo_email = nullif(trim(p_email), '') where id = target;
  perform public.log_audit('encarregado_definido', target, null, jsonb_build_object('nome', p_name));
end;
$$;

-- ------------------------------------------------------------ consentimento exigido para entrar em igreja
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
  perform public.require_consents();
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
  perform public.require_consents();
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

-- ------------------------------------------------------------ permissões
revoke all on function public.has_consent(uuid, text) from public, anon, authenticated;
revoke all on function public.require_consents() from public, anon;
revoke all on function public.consent_status() from public, anon;
revoke all on function public.record_consent(text, boolean, text) from public, anon;
revoke all on function public.log_audit(text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.audit_profile_changes() from public, anon, authenticated;
revoke all on function public.guard_children_data() from public, anon, authenticated;
revoke all on function public.my_profile() from public, anon;
revoke all on function public.church_members() from public, anon;
revoke all on function public.church_demographics() from public, anon;
revoke all on function public.admin_list_profiles() from public, anon;
revoke all on function public.export_my_data() from public, anon;
revoke all on function public.assert_not_last_admin(uuid) from public, anon, authenticated;
revoke all on function public.leave_church() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.set_church_dpo(text, text) from public, anon;
revoke all on function public.create_church(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;

grant execute on function public.consent_status() to authenticated;
grant execute on function public.record_consent(text, boolean, text) to authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.church_members() to authenticated;
grant execute on function public.church_demographics() to authenticated;
grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.leave_church() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.set_church_dpo(text, text) to authenticated;
grant execute on function public.create_church(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
