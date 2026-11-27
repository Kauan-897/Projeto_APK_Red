-- Testes da Fase 2: onboarding, convites, teste grátis, bloqueio e limites de plano.
-- Rodar com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ------------------------------------------------------------------ helpers
create function pg_temp.signup(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, '{}', now(), now());
$$;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.signup('a1111111-0000-0000-0000-000000000001', 'fundador@teste.com');
select pg_temp.signup('a1111111-0000-0000-0000-000000000002', 'convidado@teste.com');
select pg_temp.signup('a1111111-0000-0000-0000-000000000003', 'convidado2@teste.com');
select pg_temp.signup('a1111111-0000-0000-0000-000000000004', 'atrasado@teste.com');
select pg_temp.signup('a1111111-0000-0000-0000-000000000009', 'dev@teste.com');
update public.profiles set role = 'desenvolvedor' where id = 'a1111111-0000-0000-0000-000000000009';

-- ------------------------------------------------------------------ assinaturas
select is((select count(*)::int from public.churches c
           where not exists (select 1 from public.church_subscriptions s where s.church_id = c.id)), 0,
  'toda igreja existente tem assinatura');

-- ------------------------------------------------------------------ onboarding
select pg_temp.login('a1111111-0000-0000-0000-000000000001');
select is((select count(*)::int from public.churches), 0, 'usuário sem igreja não vê lista de igrejas');
select lives_ok($$ select public.create_church('Igreja do Fundador') $$, 'usuário sem igreja cria a própria igreja');
select is((select role from public.profiles where id = auth.uid()), 'pastor', 'quem cria a igreja vira pastor');
select results_eq(
  $$ select status, (trial_ends_at > now() + interval '13 days' and trial_ends_at < now() + interval '15 days')
       from public.church_subscriptions where church_id = public.my_church_id() $$,
  $$ values ('trialing'::text, true) $$,
  'igreja nova ganha 14 dias de teste');
select is((public.my_church_access()->>'has_access')::boolean, true, 'igreja em teste tem acesso');
select throws_ok($$ select public.create_church('Segunda Igreja') $$, 'P0001', 'Você já faz parte de uma igreja.',
  'não cria segunda igreja');
select lives_ok($$ insert into public.events (church_id, title, date, time) values (public.my_church_id(), 'Culto', current_date, '19:00') $$,
  'pastor grava durante o teste');

-- pastor não estende o próprio teste
update public.church_subscriptions set trial_ends_at = now() + interval '1 year' where church_id = public.my_church_id();
select ok((select trial_ends_at < now() + interval '15 days' from public.church_subscriptions where church_id = public.my_church_id()),
  'pastor não altera a própria assinatura');

-- convites
insert into public.church_invites (church_id, code, role) values (public.my_church_id(), 'convite-lider', 'lider_homem');
insert into public.church_invites (church_id, code, role, max_uses) values (public.my_church_id(), 'convite-unico', 'membro', 1);
insert into public.church_invites (church_id, code, role, expires_at) values (public.my_church_id(), 'convite-vencido', 'membro', now() - interval '1 day');
insert into public.church_invites (church_id, code, role, revoked) values (public.my_church_id(), 'convite-revogado', 'membro', false);
update public.church_invites set revoked = true where code = 'convite-revogado';
select is((select count(*)::int from public.church_invites), 4, 'pastor cria e vê convites da igreja');
select throws_ok($$ insert into public.church_invites (church_id, code, role, uses) values (public.my_church_id(), 'trapaca', 'membro', 50) $$,
  '42501', null, 'convite não nasce com usos');

-- ------------------------------------------------------------------ visitante abre o link
select pg_temp.anon();
select is((public.invite_preview('convite-lider')->>'church_name'), 'Igreja do Fundador', 'link mostra a igreja antes do cadastro');
select is((public.invite_preview('convite-vencido')->>'valid')::boolean, false, 'link vencido aparece como inválido');
select throws_ok($$ select public.accept_invite('convite-lider') $$, '42501', null, 'visitante não aceita convite sem login');

-- ------------------------------------------------------------------ aceitar convite
select pg_temp.logout();
select pg_temp.login('a1111111-0000-0000-0000-000000000002');
select lives_ok($$ select public.accept_invite('CONVITE-LIDER') $$, 'convidado aceita o convite');
select results_eq(
  $$ select role, church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001')
       from public.profiles where id = auth.uid() $$,
  $$ values ('lider_homem'::text, true) $$,
  'convidado entra na igreja com o cargo do convite');
select throws_ok($$ select public.accept_invite('convite-unico') $$, 'P0001', 'Você já faz parte de uma igreja.',
  'quem já tem igreja não aceita outro convite');
select throws_ok($$ insert into public.church_invites (church_id, role) values (public.my_church_id(), 'membro') $$,
  '42501', null, 'líder não cria convites');

select pg_temp.logout();
select pg_temp.login('a1111111-0000-0000-0000-000000000003');
select throws_ok($$ select public.accept_invite('convite-vencido') $$, 'P0001', 'Convite inválido ou expirado.', 'convite vencido é recusado');
select throws_ok($$ select public.accept_invite('convite-revogado') $$, 'P0001', 'Convite inválido ou expirado.', 'convite revogado é recusado');
select lives_ok($$ select public.accept_invite('convite-unico') $$, 'convite de uso único funciona');

select pg_temp.logout();
select pg_temp.login('a1111111-0000-0000-0000-000000000004');
select throws_ok($$ select public.accept_invite('convite-unico') $$, 'P0001', 'Convite inválido ou expirado.', 'convite de uso único não é reutilizado');

-- ------------------------------------------------------------------ modo somente leitura
select pg_temp.logout();
update public.church_subscriptions set trial_ends_at = now() - interval '1 minute'
 where church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001');
select pg_temp.login('a1111111-0000-0000-0000-000000000001');
select throws_like($$ insert into public.events (church_id, title, date, time) values (public.my_church_id(), 'X', current_date, '10:00') $$,
  'ASSINATURA_INATIVA%', 'teste vencido bloqueia gravação');
select is((select count(*)::int from public.events), 1, 'teste vencido ainda permite ler os dados');

-- inadimplente dentro da carência de 7 dias continua gravando
select pg_temp.logout();
update public.church_subscriptions set status = 'past_due', current_period_end = now() - interval '3 days'
 where church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001');
select pg_temp.login('a1111111-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.events (church_id, title, date, time) values (public.my_church_id(), 'Y', current_date, '10:00') $$,
  'inadimplente na carência ainda grava');

-- ------------------------------------------------------------------ limite de membros do plano
select pg_temp.logout();
insert into public.plans (id, name, member_limit, price_cents) values ('teste_3', 'Teste 3', 3, 100);
update public.church_subscriptions set status = 'active', plan_id = 'teste_3', current_period_end = now() + interval '20 days'
 where church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001');
select pg_temp.login('a1111111-0000-0000-0000-000000000001');
select throws_ok($$ select public.admin_create_user('extra@teste.com', 'SenhaForte123', 'Extra', 'membro', public.my_church_id()) $$,
  'P0001', 'Limite de membros do plano atingido. Faça upgrade em Assinatura.', 'limite do plano barra novo membro');

-- ------------------------------------------------------------------ admin da plataforma
select pg_temp.logout();
select pg_temp.login('a1111111-0000-0000-0000-000000000009');
update public.church_subscriptions set status = 'trialing', trial_ends_at = now() + interval '30 days'
 where church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001');
select ok((select trial_ends_at > now() + interval '29 days' from public.church_subscriptions
           where church_id = (select church_id from public.profiles where id = 'a1111111-0000-0000-0000-000000000001')),
  'admin da plataforma estende o teste');
select pg_temp.logout();
select pg_temp.login('a1111111-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.events (church_id, title, date, time) values (public.my_church_id(), 'Z', current_date, '10:00') $$,
  'teste estendido libera gravação de novo');

select * from finish();
rollback;
