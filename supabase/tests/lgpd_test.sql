-- Testes da Fase 3 — LGPD: consentimento, minimização, direitos do titular e auditoria.
-- Rodar com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ------------------------------------------------------------------ helpers
create function pg_temp.signup(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, '{"full_name":"Teste"}', now(), now());
$$;
create function pg_temp.consent_all(uid uuid) returns void language sql as $$
  insert into public.consents (profile_id, kind, version, granted)
  select uid, kind, version, true from public.legal_versions where kind in ('termos', 'dados_religiosos');
$$;
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

-- ------------------------------------------------------------------ dados
insert into public.churches (id, name) values ('1e000000-0000-0000-0000-000000000001', 'Igreja LGPD');
select pg_temp.signup('1e000000-0000-0000-0000-0000000000a1', 'pastor.lgpd@teste.com');
select pg_temp.signup('1e000000-0000-0000-0000-0000000000a2', 'membro.lgpd@teste.com');
select pg_temp.signup('1e000000-0000-0000-0000-0000000000a3', 'novo.lgpd@teste.com');
select pg_temp.signup('1e000000-0000-0000-0000-0000000000a4', 'apagar.lgpd@teste.com');
update public.profiles set church_id = '1e000000-0000-0000-0000-000000000001', role = 'pastor'
 where id = '1e000000-0000-0000-0000-0000000000a1';
update public.profiles set church_id = '1e000000-0000-0000-0000-000000000001', birth_date = '1990-05-10', gender = 'F'
 where id = '1e000000-0000-0000-0000-0000000000a2';
select pg_temp.consent_all('1e000000-0000-0000-0000-0000000000a1');
select pg_temp.consent_all('1e000000-0000-0000-0000-0000000000a2');
insert into public.church_invites (church_id, code) values ('1e000000-0000-0000-0000-000000000001', 'convite-lgpd');
insert into public.schedules (id, church_id, title, date, time)
values ('1e000000-0000-0000-0000-00000000005c', '1e000000-0000-0000-0000-000000000001', 'Escala', current_date, '19:00');
insert into public.schedule_members (schedule_id, profile_id, role_name, status)
values ('1e000000-0000-0000-0000-00000000005c', '1e000000-0000-0000-0000-0000000000a2', 'Louvor', 'confirmado');

-- ------------------------------------------------------------------ consentimento (art. 11)
select pg_temp.login('1e000000-0000-0000-0000-0000000000a3');
select is((public.consent_status()->'dados_religiosos'->>'accepted')::boolean, false, 'novo usuário começa sem consentimento');
select throws_like($$ select public.accept_invite('convite-lgpd') $$, 'CONSENTIMENTO_PENDENTE%',
  'sem consentimento não entra na igreja');
select throws_like($$ select public.create_church('Igreja Sem Consentimento') $$, 'CONSENTIMENTO_PENDENTE%',
  'sem consentimento não cria igreja');
select lives_ok($$ select public.record_consent('termos', true, 'teste') $$, 'aceita os termos');
select lives_ok($$ select public.record_consent('dados_religiosos', true, 'teste') $$, 'consente com dados religiosos');
select lives_ok($$ select public.accept_invite('convite-lgpd') $$, 'com consentimento entra na igreja');
select throws_ok($$ select public.record_consent('termos', false) $$, 'P0001', null, 'não revoga termos sem excluir a conta');
select is((select count(*)::int from public.consents), 2, 'titular vê só os próprios consentimentos');

-- ------------------------------------------------------------------ minimização
select pg_temp.logout();
select pg_temp.login('1e000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select email from public.profiles $$, '42501', null, 'membro não lê e-mail direto da tabela');
select throws_ok($$ select birth_date from public.profiles $$, '42501', null, 'membro não lê nascimento direto da tabela');
select is((select count(*)::int from public.profiles where full_name is not null), 3, 'membro vê nomes da própria igreja');
select is((select count(*)::int from public.church_members() where email is not null), 1,
  'membro comum só vê o próprio e-mail na lista');
select is((select email from public.my_profile()), 'membro.lgpd@teste.com', 'titular vê o próprio perfil completo');
select is((public.church_demographics()->>'females')::int, 1, 'estatísticas chegam só agregadas');

-- ------------------------------------------------------------------ dados dos filhos (art. 14)
select throws_ok($$ update public.profiles set has_children = true, children_details = '[{"nome":"Ana","idade":5}]' where id = auth.uid() $$,
  '42501', null, 'dados dos filhos exigem consentimento próprio');
select public.record_consent('dados_filhos', true);
select lives_ok($$ update public.profiles set has_children = true, children_details = '[{"nome":"Ana","idade":5}]' where id = auth.uid() $$,
  'com consentimento informa os filhos');
select public.record_consent('dados_filhos', false);
select is((select children_details from public.my_profile()), '[]'::jsonb, 'revogar apaga os dados dos filhos');

-- ------------------------------------------------------------------ acesso e auditoria
select ok(public.export_my_data()->'perfil'->>'email' = 'membro.lgpd@teste.com', 'titular exporta os próprios dados');
select is((select count(*)::int from public.audit_log), 0, 'membro comum não lê a auditoria');
select throws_ok($$ select public.set_church_dpo('Fulano', 'dpo@igreja.org') $$, '42501', null, 'membro não define encarregado');

select pg_temp.logout();
select pg_temp.login('1e000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.church_members() where email is not null), 3, 'liderança vê contato dos membros');
update public.profiles set role = 'supervisor' where id = '1e000000-0000-0000-0000-0000000000a3';
select ok((select count(*) from public.audit_log where action in ('cargo_alterado', 'dados_exportados')) >= 2,
  'pastor vê na auditoria a troca de cargo e a exportação');
select throws_like($$ select public.leave_church() $$, '%único pastor/admin%', 'único pastor não abandona a igreja');

-- ------------------------------------------------------------------ revogar e excluir
-- igreja vencida não impede o titular de sair
select pg_temp.logout();
update public.church_subscriptions set trial_ends_at = now() - interval '1 day'
 where church_id = '1e000000-0000-0000-0000-000000000001';
select pg_temp.login('1e000000-0000-0000-0000-0000000000a2');
select public.record_consent('dados_religiosos', false);
select pg_temp.logout();
select results_eq(
  $$ select church_id is null, (select count(*)::int from public.schedule_members where profile_id = p.id)
       from public.profiles p where p.id = '1e000000-0000-0000-0000-0000000000a2' $$,
  $$ values (true, 0) $$,
  'revogar o consentimento religioso tira da igreja e apaga as escalas');

select pg_temp.login('1e000000-0000-0000-0000-0000000000a4');
select lives_ok($$ select public.delete_my_account() $$, 'titular exclui a própria conta');
select pg_temp.logout();
select is((select count(*)::int from auth.users where id = '1e000000-0000-0000-0000-0000000000a4'), 0,
  'conta excluída sai do login e do perfil');

select * from finish();
rollback;
