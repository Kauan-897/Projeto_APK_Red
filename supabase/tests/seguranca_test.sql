-- Testes das regras de segurança multi-igreja.
-- Rodar com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ------------------------------------------------------------------ dados
insert into public.churches (id, name, is_active) values
  ('a0000000-0000-0000-0000-00000000000a', 'Igreja A', true),
  ('b0000000-0000-0000-0000-00000000000b', 'Igreja B', true),
  ('c0000000-0000-0000-0000-00000000000c', 'Igreja Inativa', false);

-- helper para criar usuários como se viessem do signUp
create function pg_temp.signup(uid uuid, mail text, meta jsonb) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, meta, now(), now());
$$;

-- helper para agir como um usuário logado
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.signup('11111111-1111-1111-1111-111111111111', 'pastor.a@teste.com', '{"church_id":"a0000000-0000-0000-0000-00000000000a"}');
select pg_temp.signup('22222222-2222-2222-2222-222222222222', 'membro.a@teste.com', '{"church_id":"a0000000-0000-0000-0000-00000000000a"}');
select pg_temp.signup('33333333-3333-3333-3333-333333333333', 'pastor.b@teste.com', '{"church_id":"b0000000-0000-0000-0000-00000000000b"}');
-- tentativa de escalar privilégio pelo cadastro
select pg_temp.signup('44444444-4444-4444-4444-444444444444', 'hacker@teste.com',
  '{"church_id":"a0000000-0000-0000-0000-00000000000a","role":"desenvolvedor"}');
select pg_temp.signup('55555555-5555-5555-5555-555555555555', 'inativa@teste.com', '{"church_id":"c0000000-0000-0000-0000-00000000000c"}');

select pg_temp.signup('66666666-6666-6666-6666-666666666666', 'supervisor.a@teste.com', '{"church_id":"a0000000-0000-0000-0000-00000000000a"}');
update public.profiles set role = 'supervisor' where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set role = 'pastor' where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.events (id, church_id, title, date, time) values
  ('e000000a-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'Culto A', current_date, '19:00'),
  ('e000000b-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'Culto B', current_date, '19:00');
insert into public.branches (id, church_id, name) values
  ('f000000b-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'Filial B');
insert into public.ministries (id, church_id, name) values
  ('d000000a-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'Louvor A'),
  ('d000000b-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'Louvor B');
insert into public.schedules (id, church_id, title, date, time) values
  ('5c00000a-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'Escala A', current_date, '19:00');
insert into public.personal_notes (profile_id, church_id, content) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 'nota do pastor');

-- ------------------------------------------------------------------ cadastro
select is((select role from public.profiles where id = '44444444-4444-4444-4444-444444444444'), 'membro',
  'cargo enviado no cadastro é ignorado');
select is((select church_id from public.profiles where id = '55555555-5555-5555-5555-555555555555'), null,
  'igreja inativa não é aceita no cadastro');

-- ------------------------------------------------------------------ membro A
select pg_temp.login('22222222-2222-2222-2222-222222222222');

select throws_ok($$ update public.profiles set role = 'pastor' where id = auth.uid() $$, '42501', null,
  'membro não muda o próprio cargo');
select throws_ok($$ update public.profiles set church_id = 'b0000000-0000-0000-0000-00000000000b' where id = auth.uid() $$, '42501', null,
  'membro não muda a própria igreja');
select lives_ok($$ update public.profiles set full_name = 'Membro A' where id = auth.uid() $$,
  'membro edita o próprio nome');
select is((select count(*)::int from public.events), 1, 'membro vê só eventos da própria igreja');
select is((select count(*)::int from public.profiles where church_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
  'membro não vê perfis de outra igreja');
select throws_ok($$ insert into public.events (church_id, title, date, time) values ('a0000000-0000-0000-0000-00000000000a', 'x', current_date, '10:00') $$,
  '42501', null, 'membro não cria eventos');
select is((select count(*)::int from public.personal_notes), 0, 'membro não vê notas de outra pessoa');

-- escalas: voluntariar-se exige aprovação e não pode se autoaprovar
select throws_ok($$ insert into public.schedule_members (schedule_id, profile_id, role_name, status) values ('5c00000a-0000-0000-0000-000000000000', auth.uid(), 'Participante', 'confirmado') $$,
  '42501', null, 'membro não entra já confirmado');
select lives_ok($$ insert into public.schedule_members (schedule_id, profile_id, role_name, status) values ('5c00000a-0000-0000-0000-000000000000', auth.uid(), 'Participante', 'aguardando_lider') $$,
  'membro se voluntaria');
update public.schedule_members set status = 'confirmado' where profile_id = auth.uid();
select is((select status from public.schedule_members where profile_id = auth.uid()), 'aguardando_lider',
  'membro não se autoaprova');

-- ministérios
select lives_ok($$ insert into public.profile_ministries (profile_id, ministry_id, status) values (auth.uid(), 'd000000a-0000-0000-0000-000000000000', 'pendente') $$,
  'membro pede entrada em ministério da própria igreja');
select throws_ok($$ insert into public.profile_ministries (profile_id, ministry_id, status) values (auth.uid(), 'd000000b-0000-0000-0000-000000000000', 'pendente') $$,
  '42501', null, 'membro não entra em ministério de outra igreja');
select throws_ok($$ select public.admin_create_user('x@teste.com', 'SenhaForte123', 'X', 'membro', 'a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'membro não cria usuários');

-- ------------------------------------------------------------------ supervisor A
select pg_temp.logout();
select pg_temp.login('66666666-6666-6666-6666-666666666666');
select lives_ok($$ select public.admin_create_user('membro.sup@teste.com', 'SenhaForte123', 'M', 'membro', 'a0000000-0000-0000-0000-00000000000a') $$,
  'supervisor cria membro na própria igreja');
select throws_ok($$ select public.admin_create_user('lider.sup@teste.com', 'SenhaForte123', 'L', 'lider_homem', 'a0000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'supervisor não cria liderança');

-- ------------------------------------------------------------------ pastor A
select pg_temp.logout();
select pg_temp.login('11111111-1111-1111-1111-111111111111');

delete from public.branches where id = 'f000000b-0000-0000-0000-000000000000';
select pg_temp.logout();
select is((select count(*)::int from public.branches where id = 'f000000b-0000-0000-0000-000000000000'), 1,
  'pastor A não apaga filial da igreja B');
select pg_temp.login('11111111-1111-1111-1111-111111111111');

select throws_ok($$ insert into public.branches (church_id, name) values ('b0000000-0000-0000-0000-00000000000b', 'invasão') $$,
  '42501', null, 'pastor A não cria filial na igreja B');
select is((select count(*)::int from public.profile_ministries pm join public.ministries m on m.id = pm.ministry_id
           where m.church_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
  'pastor A não vê participantes de ministérios da igreja B');
select lives_ok($$ update public.profiles set role = 'lider_homem' where id = '22222222-2222-2222-2222-222222222222' $$,
  'pastor A promove membro da própria igreja');
select throws_ok($$ update public.profiles set role = 'desenvolvedor' where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'pastor não concede cargo de plataforma');
select throws_ok($$ select public.admin_create_user('novo.b@teste.com', 'SenhaForte123', 'Novo', 'membro', 'b0000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'pastor A não cria usuário na igreja B');
select throws_ok($$ select public.admin_create_user('fraca@teste.com', '123', 'Fraca', 'membro', 'a0000000-0000-0000-0000-00000000000a') $$,
  'P0001', null, 'senha provisória fraca é recusada');

select lives_ok($$ select public.admin_create_user('Novo.A@Teste.com', 'SenhaForte123', 'Novo A', 'supervisor', 'a0000000-0000-0000-0000-00000000000a', 'M') $$,
  'pastor A cria usuário na própria igreja');
select pg_temp.logout();
select results_eq(
  $$ select p.role, p.church_id::text, (select count(*)::int from auth.identities i where i.user_id = p.id)
       from public.profiles p where p.email = 'novo.a@teste.com' $$,
  $$ values ('supervisor'::text, 'a0000000-0000-0000-0000-00000000000a'::text, 1) $$,
  'usuário criado com cargo, igreja e identidade de login');

select * from finish();
rollback;
