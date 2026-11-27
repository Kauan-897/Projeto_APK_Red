-- =====================================================================
-- FASE 1 — SEGURANÇA MULTI-IGREJA
-- ---------------------------------------------------------------------
-- 1. Cargo nunca vem do navegador: todo cadastro nasce como 'membro'.
-- 2. Ninguém altera o próprio cargo/igreja; só pastor/admin da mesma
--    igreja (ou o admin da plataforma) muda cargos.
-- 3. Toda policy confere a igreja do usuário (isolamento entre igrejas).
-- 4. Remove a promoção por e-mail fixo (se existir) e helpers antigos sem uso.
-- 5. admin_create_user: pastor/admin criam qualquer cargo (exceto plataforma)
--    na PRÓPRIA igreja; supervisor cria só 'membro'. Exige senha forte e cria
--    a identidade de login (a versão antiga não criava).
--
-- Cargos:
--   desenvolvedor  = admin da plataforma (dono do SaaS), vê todas as igrejas
--   pastor, admin  = administram a igreja
--   lider_homem, lider_mulher, supervisor = lideranças
--   membro
--
-- Para tornar alguém admin da plataforma, rode no SQL Editor:
--   update public.profiles set role = 'desenvolvedor' where email = '...';
-- =====================================================================

-- ------------------------------------------------------------ cargos
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('desenvolvedor', 'pastor', 'admin', 'lider_homem', 'lider_mulher', 'supervisor', 'membro'));

-- ------------------------------------------------------------ helpers
-- SECURITY DEFINER evita recursão de RLS ao consultar profiles dentro das policies.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor');
$$;

create or replace function public.my_church_id()
returns uuid language sql stable security definer set search_path = public as $$
  select church_id from public.profiles where id = auth.uid();
$$;

-- true se o usuário logado tem um dos cargos informados
create or replace function public.has_any_role(roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;

-- administra a igreja informada (pastor/admin dela)
create or replace function public.is_church_admin(target_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_church is not null
     and target_church = public.my_church_id()
     and public.has_any_role(array['pastor', 'admin']);
$$;

-- é liderança na igreja informada
create or replace function public.is_church_leader(target_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_church is not null
     and target_church = public.my_church_id()
     and public.has_any_role(array['pastor', 'admin', 'lider_homem', 'lider_mulher', 'supervisor']);
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.my_church_id() from public, anon;
revoke all on function public.has_any_role(text[]) from public, anon;
revoke all on function public.is_church_admin(uuid) from public, anon;
revoke all on function public.is_church_leader(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.my_church_id() to authenticated;
grant execute on function public.has_any_role(text[]) to authenticated;
grant execute on function public.is_church_admin(uuid) to authenticated;
grant execute on function public.is_church_leader(uuid) to authenticated;

-- ------------------------------------------------------------ cadastro
-- Remove a promoção automática por e-mail fixo.
drop trigger if exists set_dev_role_trigger on public.profiles;
drop function if exists public.set_dev_role();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_church uuid;
begin
  -- church_id só é aceito se a igreja existir e estiver ativa
  begin
    requested_church := nullif(new.raw_user_meta_data->>'church_id', '')::uuid;
  exception when invalid_text_representation then
    requested_church := null;
  end;

  if requested_church is not null
     and not exists (select 1 from public.churches where id = requested_church and coalesce(is_active, true)) then
    requested_church := null;
  end if;

  -- O cargo enviado pelo navegador é IGNORADO: todo cadastro nasce 'membro'.
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

-- ------------------------------------------------------------ proteção de cargo/igreja
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Sem usuário logado = SQL Editor / service_role: liberado.
  if auth.uid() is null or public.is_platform_admin() then
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

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute procedure public.guard_profile_update();

-- ------------------------------------------------------------ criação de usuários pelo painel
drop function if exists public.admin_create_user(text, text, text, text, uuid);
drop function if exists public.admin_create_user(text, text, text, text, uuid, text);

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

  if length(coalesce(new_password, '')) < 8 then
    raise exception 'A senha provisória precisa ter pelo menos 8 caracteres.';
  end if;

  if exists (select 1 from auth.users where email = clean_email) then
    raise exception 'Já existe um usuário com este e-mail.';
  end if;

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

  -- Identidade de e-mail, necessária para o login por senha.
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- O trigger criou o perfil como 'membro'; aplica o cargo escolhido e garante a igreja.
  update public.profiles
     set role = new_role, church_id = new_church_id
   where id = new_user_id;

  return new_user_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, text, uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text, uuid, text) to authenticated;

-- ------------------------------------------------------------ policies
-- Remove TODAS as policies existentes nessas tabelas (os nomes variam
-- entre os bancos de cada colega) e recria do zero.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('churches', 'profiles', 'branches', 'events', 'videos', 'attendance',
                         'ministries', 'profile_ministries', 'schedules', 'schedule_members', 'personal_notes')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.events enable row level security;
alter table public.videos enable row level security;
alter table public.attendance enable row level security;
alter table public.ministries enable row level security;
alter table public.profile_ministries enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_members enable row level security;
alter table public.personal_notes enable row level security;

-- churches: só o admin da plataforma altera (is_active será usado para bloqueio por inadimplência)
-- leitura pública (a tela de cadastro lista as igrejas; será trocada por convites na Fase 2)
create policy churches_select on public.churches for select using (true);
create policy churches_admin_write on public.churches for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or church_id = public.my_church_id() or public.is_platform_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_church_admin(church_id) or public.is_platform_admin())
  with check (id = auth.uid() or public.is_church_admin(church_id) or public.is_platform_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_platform_admin());

-- branches (filiais): pastor/admin
create policy branches_select on public.branches for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
create policy branches_write on public.branches for all to authenticated
  using (public.is_church_admin(church_id) or public.is_platform_admin())
  with check (public.is_church_admin(church_id) or public.is_platform_admin());

-- events / videos / schedules / ministries: lideranças
create policy events_select on public.events for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
create policy events_write on public.events for all to authenticated
  using (public.is_church_leader(church_id) or public.is_platform_admin())
  with check (public.is_church_leader(church_id) or public.is_platform_admin());

create policy videos_select on public.videos for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
create policy videos_write on public.videos for all to authenticated
  using (public.is_church_leader(church_id) or public.is_platform_admin())
  with check (public.is_church_leader(church_id) or public.is_platform_admin());

create policy schedules_select on public.schedules for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
create policy schedules_write on public.schedules for all to authenticated
  using (public.is_church_leader(church_id) or public.is_platform_admin())
  with check (public.is_church_leader(church_id) or public.is_platform_admin());

create policy ministries_select on public.ministries for select to authenticated
  using (church_id = public.my_church_id() or public.is_platform_admin());
create policy ministries_write on public.ministries for all to authenticated
  using (public.is_church_leader(church_id) or public.is_platform_admin())
  with check (public.is_church_leader(church_id) or public.is_platform_admin());

-- attendance: o próprio membro ou a liderança da igreja do evento
create policy attendance_own on public.attendance for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.church_id = public.my_church_id())
  );
create policy attendance_leaders on public.attendance for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and (public.is_church_leader(e.church_id) or public.is_platform_admin())))
  with check (exists (select 1 from public.events e where e.id = event_id and (public.is_church_leader(e.church_id) or public.is_platform_admin())));

-- profile_ministries: membro pede para entrar (pendente) e pode sair; liderança aprova
create policy profile_ministries_select on public.profile_ministries for select to authenticated
  using (exists (select 1 from public.ministries m where m.id = ministry_id
                 and (m.church_id = public.my_church_id() or public.is_platform_admin())));
create policy profile_ministries_self_join on public.profile_ministries for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'pendente'
    and exists (select 1 from public.ministries m where m.id = ministry_id and m.church_id = public.my_church_id())
  );
create policy profile_ministries_self_leave on public.profile_ministries for delete to authenticated
  using (profile_id = auth.uid());
create policy profile_ministries_leaders on public.profile_ministries for all to authenticated
  using (exists (select 1 from public.ministries m where m.id = ministry_id
                 and (public.is_church_leader(m.church_id) or m.leader_id = auth.uid() or public.is_platform_admin())))
  with check (
    exists (select 1 from public.ministries m where m.id = ministry_id
            and (public.is_church_leader(m.church_id) or m.leader_id = auth.uid() or public.is_platform_admin()))
    and exists (select 1 from public.profiles p join public.ministries m on m.id = ministry_id
                where p.id = profile_id and p.church_id = m.church_id)
  );

-- schedule_members: membro se voluntaria / confirma / cancela; liderança escala
create policy schedule_members_select on public.schedule_members for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id
                 and (s.church_id = public.my_church_id() or public.is_platform_admin())));
create policy schedule_members_self_volunteer on public.schedule_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'aguardando_lider'
    and exists (select 1 from public.schedules s where s.id = schedule_id and s.church_id = public.my_church_id())
  );
create policy schedule_members_self_update on public.schedule_members for update to authenticated
  -- quem se voluntariou ('aguardando_lider') não pode se autoaprovar
  using (profile_id = auth.uid() and status <> 'aguardando_lider')
  with check (profile_id = auth.uid() and status in ('confirmado', 'recusado', 'pendente'));
create policy schedule_members_self_delete on public.schedule_members for delete to authenticated
  using (profile_id = auth.uid());
create policy schedule_members_leaders on public.schedule_members for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id
                 and (public.is_church_leader(s.church_id) or public.is_platform_admin())))
  with check (
    exists (select 1 from public.schedules s where s.id = schedule_id
            and (public.is_church_leader(s.church_id) or public.is_platform_admin()))
    and exists (select 1 from public.profiles p join public.schedules s on s.id = schedule_id
                where p.id = profile_id and p.church_id = s.church_id)
  );

-- personal_notes: só o dono
create policy personal_notes_own on public.personal_notes for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and church_id is not distinct from public.my_church_id());

-- ------------------------------------------------------------ limpeza
-- Helpers antigos, usados só pelas policies removidas acima.
drop function if exists public.get_auth_church();
drop function if exists public.get_auth_role();
drop function if exists public.get_my_church_id();
drop function if exists public.get_user_church_id();
drop function if exists public.is_developer();
-- Referencia a tabela user_roles, que não existe.
drop function if exists public.has_role(public.app_role, uuid);
