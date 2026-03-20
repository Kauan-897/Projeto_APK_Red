-- Extensão para lidar com senhas criptografadas (bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função RPC para criar usuários diretamente do frontend (como Admin)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  new_email TEXT,
  new_password TEXT,
  new_fullname TEXT,
  new_role TEXT,
  new_church_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Verificar se quem chama é desenvolvedor (prevenção de abuso)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'desenvolvedor') THEN
    RAISE EXCEPTION 'Acesso negado: apenas desenvolvedores podem criar usuários diretamente.';
  END IF;

  -- Gera ID do usuário
  new_user_id := gen_random_uuid();
  -- Criptografa a senha padrao (Supabase usa bcrypt)
  encrypted_pw := crypt(new_password, gen_salt('bf'));

  -- Insere o usuário direto na base de Autenticação do Supabase
  INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', new_email, encrypted_pw, now(),
      '{"provider": "email", "providers": ["email"]}',
      json_build_object('full_name', new_fullname, 'role', new_role, 'church_id', new_church_id)::jsonb,
      now(), now(), '', '', '', ''
  );

  -- NOTA: Como você tem um Trigger (handle_new_user) rodando em auth.users, 
  -- o perfil público (profiles) deste novo usuário será criado automaticamente pelo trigger!
  
  RETURN new_user_id;
END;
$$;
