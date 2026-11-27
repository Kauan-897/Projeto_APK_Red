-- =====================================================================
-- Correções de schema encontradas ao comparar o código com produção
-- =====================================================================

-- O front lê profiles.avatar_url (dashboard, membros, ministérios),
-- mas a coluna não existia: as consultas voltavam erro 400.
alter table public.profiles add column if not exists avatar_url text;

-- Usuários criados pela versão antiga de admin_create_user ficaram sem
-- identidade de e-mail (auth.identities), o que impede o login por senha.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.email is not null
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- A versão antiga também deixava tokens NULL em auth.users; o Auth do
-- Supabase falha ao ler NULL nesses campos ("Database error querying schema").
update auth.users
   set confirmation_token     = coalesce(confirmation_token, ''),
       recovery_token         = coalesce(recovery_token, ''),
       email_change           = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, '')
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null;
