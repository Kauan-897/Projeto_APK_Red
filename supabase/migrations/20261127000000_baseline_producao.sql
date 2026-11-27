-- =====================================================================
-- BASELINE — schema de produção (projeto Red_APK), extraído em 2026-11-27
-- com `supabase db dump -s public`. Representa o banco ANTES da Fase 1.
--
-- Em produção esta migration já está aplicada: marque-a com
--   npx supabase migration repair --status applied 20261127000000
-- antes do primeiro `supabase db push`.
-- =====================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'leader',
    'member',
    'user',
    'guest',
    'developer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'scheduled',
    'ongoing',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."swap_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."swap_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
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
  -- Criptografa a senha padrao garantindo a tipagem do texto
  encrypted_pw := crypt(new_password, gen_salt('bf'::text));

  -- Insere o usuário direto na base de Autenticação do Supabase
  INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', new_email, encrypted_pw, now(),
      '{"provider": "email", "providers": ["email"]}',
      json_build_object('full_name', new_fullname, 'role', new_role, 'church_id', new_church_id)::jsonb,
      now(), now(), '', '', '', ''
  );

  RETURN new_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid", "new_gender" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_profile RECORD;
    new_user_id UUID;
BEGIN
    -- 1. Obter o perfil de quem está chamando a função
    SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

    -- 2. Verificar se o usuário existe e tem ALGUMA permissão de gerência
    IF current_profile IS NULL OR current_profile.role NOT IN ('desenvolvedor', 'pastor', 'admin', 'supervisor') THEN
        RAISE EXCEPTION 'Acesso Negado: Apenas a liderança pode criar usuários diretamente.';
    END IF;

    -- 3. Regra de Negócio: Se NÃO for desenvolvedor, SÓ PODE CRIAR 'membro'
    IF current_profile.role != 'desenvolvedor' AND new_role != 'membro' THEN
        RAISE EXCEPTION 'Permissão Insuficiente: Apenas desenvolvedores podem criar usuários com cargos de liderança. Você só pode criar contas do tipo Membro Comum.';
    END IF;

    -- 4. Tentar criar o usuário na tabela auth.users (Tabela gerenciada pelo Supabase)
    -- Atenção: Esse insert direto funciona apenas porque a função tem SECURITY DEFINER e as constraints do Supabase permitem
    -- (Geralmente é melhor usar a Admin API nativa, mas para testes / ambientes sem edge functions isso quebra um galho)
    
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        new_email,
        crypt(new_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        json_build_object('full_name', new_fullname),
        false,
        false
    )
    RETURNING id INTO new_user_id;

    -- 5. Atualizar ou Inserir o perfil na tabela public.profiles
    -- A trigger 'on_auth_user_created' provavelmente já rodou e inseriu um profile default 'membro', 
    -- então nós vamos fazer um UPDATE baseado no UUID gerado para garantir o church_id e a role correta.
    
    UPDATE public.profiles
    SET 
        role = new_role,
        church_id = new_church_id,
        name = new_fullname,
        full_name = new_fullname,
        gender = new_gender
    WHERE id = new_user_id;

    -- Se por acaso a trigger não existir, fazemos um INSERT (ON CONFLICT DO UPDATE)
    IF NOT FOUND THEN
       INSERT INTO public.profiles (id, church_id, name, full_name, email, role, gender)
       VALUES (new_user_id, new_church_id, new_fullname, new_fullname, new_email, new_role, new_gender);
    END IF;

    RETURN json_build_object('status', 'success', 'user_id', new_user_id);

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar usuário: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid", "new_gender" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_church"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    u_church_id uuid;
BEGIN
    SELECT church_id INTO u_church_id FROM profiles WHERE id = auth.uid();
    RETURN u_church_id;
END;
$$;


ALTER FUNCTION "public"."get_auth_church"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."get_auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_church_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_church_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_church_id"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_church_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, church_id, full_name, name, role, gender)
  VALUES (
    new.id, 
    new.email, 
    (new.raw_user_meta_data->>'church_id')::UUID, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'membro'),
    new.raw_user_meta_data->>'gender'
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_developer"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'desenvolvedor'
  );
$$;


ALTER FUNCTION "public"."is_developer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid",
    "event_id" "uuid",
    "status" "text" DEFAULT 'presente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['presente'::"text", 'ausente'::"text", 'justificado'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "church_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."churches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."churches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "church_id" "uuid",
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "attendees_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "end_date" "date",
    "end_time" time without time zone,
    "is_all_day" boolean DEFAULT false,
    "location" "text",
    "description" "text",
    "color" "text" DEFAULT 'blue'::"text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ministries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "church_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "leader_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."ministries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid",
    "church_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."personal_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_ministries" (
    "profile_id" "uuid" NOT NULL,
    "ministry_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "status" "text" DEFAULT 'ativo'::"text",
    CONSTRAINT "profile_ministries_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'ativo'::"text", 'recusado'::"text"])))
);


ALTER TABLE "public"."profile_ministries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "church_id" "uuid",
    "email" "text" NOT NULL,
    "full_name" "text",
    "birth_date" "date",
    "role" "text" DEFAULT 'membro'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "branch_id" "uuid",
    "gender" "text",
    "marital_status" "text",
    "address" "text",
    "has_children" boolean DEFAULT false,
    "children_details" "jsonb" DEFAULT '[]'::"jsonb",
    "spouse_name" "text",
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['M'::"text", 'F'::"text", 'Outro'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text", 'membro'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schedule_id" "uuid",
    "profile_id" "uuid",
    "role_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "schedule_members_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'confirmado'::"text", 'recusado'::"text", 'aguardando_lider'::"text"])))
);


ALTER TABLE "public"."schedule_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "church_id" "uuid",
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "location" "text",
    "max_volunteers" integer
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "church_id" "uuid",
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "platform" "text" DEFAULT 'youtube'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_profile_id_event_id_key" UNIQUE ("profile_id", "event_id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ministries"
    ADD CONSTRAINT "ministries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_notes"
    ADD CONSTRAINT "personal_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_ministries"
    ADD CONSTRAINT "profile_ministries_pkey" PRIMARY KEY ("profile_id", "ministry_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_members"
    ADD CONSTRAINT "schedule_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_members"
    ADD CONSTRAINT "schedule_members_schedule_id_profile_id_role_name_key" UNIQUE ("schedule_id", "profile_id", "role_name");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ministries"
    ADD CONSTRAINT "ministries_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ministries"
    ADD CONSTRAINT "ministries_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personal_notes"
    ADD CONSTRAINT "personal_notes_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_notes"
    ADD CONSTRAINT "personal_notes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_ministries"
    ADD CONSTRAINT "profile_ministries_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "public"."ministries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_ministries"
    ADD CONSTRAINT "profile_ministries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_members"
    ADD CONSTRAINT "schedule_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_members"
    ADD CONSTRAINT "schedule_members_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



CREATE POLICY "Dev e Admins podem tudo em filiais" ON "public"."branches" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'admin'::"text"]))))));



CREATE POLICY "Dev pode tudo em igrejas" ON "public"."churches" USING ("public"."is_developer"());



CREATE POLICY "Dev pode tudo em perfis" ON "public"."profiles" USING (("public"."get_auth_role"() = 'desenvolvedor'::"text"));



CREATE POLICY "Dev pode tudo em presenca" ON "public"."attendance" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'desenvolvedor'::"text")))));



CREATE POLICY "Escalas_Delete" ON "public"."schedule_members" FOR DELETE USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'admin'::"text", 'supervisor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text"])))))));



CREATE POLICY "Escalas_Insert" ON "public"."schedule_members" FOR INSERT WITH CHECK ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'admin'::"text", 'supervisor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text"])))))));



CREATE POLICY "Escalas_Select" ON "public"."schedule_members" FOR SELECT USING (true);



CREATE POLICY "Escalas_Update" ON "public"."schedule_members" FOR UPDATE USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'admin'::"text", 'supervisor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text"])))))));



CREATE POLICY "Leitura de igrejas é pública" ON "public"."churches" FOR SELECT USING (true);



CREATE POLICY "Lideranca gerencia eventos" ON "public"."events" USING ((("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text", 'desenvolvedor'::"text"]))))))) WITH CHECK ((("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text", 'desenvolvedor'::"text"])))))));



CREATE POLICY "Lideranca gerencia videos" ON "public"."videos" USING ((("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text", 'desenvolvedor'::"text"]))))))) WITH CHECK ((("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text", 'desenvolvedor'::"text"])))))));



CREATE POLICY "Lideres e Admins criam/editam escalas" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'admin'::"text", 'supervisor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text"]))))));



CREATE POLICY "Lideres e Admins gerenciam ministérios" ON "public"."ministries" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text"]))))));



CREATE POLICY "Lideres escolhem quem participa" ON "public"."profile_ministries" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['desenvolvedor'::"text", 'pastor'::"text", 'lider_homem'::"text", 'lider_mulher'::"text", 'supervisor'::"text"]))))));



CREATE POLICY "Membros comuns gerenciam a propria participacao" ON "public"."profile_ministries" FOR UPDATE USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Membros comuns pedem para participar de ministérios" ON "public"."profile_ministries" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Membros comuns podem sair" ON "public"."profile_ministries" FOR DELETE USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Membros veem outros da mesma igreja" ON "public"."profiles" FOR SELECT USING (("church_id" = "public"."get_auth_church"()));



CREATE POLICY "Usuário veem e editam propria presenca" ON "public"."attendance" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Usuário vê e edita seu próprio perfil" ON "public"."profiles" USING (("id" = "auth"."uid"()));



CREATE POLICY "Usuários gerenciam suas próprias anotações" ON "public"."personal_notes" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Usuários veem escalas da própria igreja" ON "public"."schedules" FOR SELECT USING (("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuários veem eventos da própria igreja" ON "public"."events" FOR SELECT USING (("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuários veem filiais da própria igreja" ON "public"."branches" FOR SELECT USING (("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuários veem ministérios da própria igreja" ON "public"."ministries" FOR SELECT USING (("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Usuários veem perfis da própria igreja" ON "public"."profiles" FOR SELECT USING (("church_id" = "public"."get_my_church_id"()));



CREATE POLICY "Usuários veem quem está nos ministérios" ON "public"."profile_ministries" FOR SELECT USING (true);



CREATE POLICY "Usuários veem videos da própria igreja" ON "public"."videos" FOR SELECT USING (("church_id" = ( SELECT "profiles"."church_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ministries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_ministries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid", "new_gender" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid", "new_gender" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_user"("new_email" "text", "new_password" "text", "new_fullname" "text", "new_role" "text", "new_church_id" "uuid", "new_gender" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_auth_church"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_auth_church"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_church"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_church_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_church_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_church_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_church_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_church_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_church_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_developer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_developer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_developer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."churches" TO "anon";
GRANT ALL ON TABLE "public"."churches" TO "authenticated";
GRANT ALL ON TABLE "public"."churches" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."ministries" TO "anon";
GRANT ALL ON TABLE "public"."ministries" TO "authenticated";
GRANT ALL ON TABLE "public"."ministries" TO "service_role";



GRANT ALL ON TABLE "public"."personal_notes" TO "anon";
GRANT ALL ON TABLE "public"."personal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_notes" TO "service_role";



GRANT ALL ON TABLE "public"."profile_ministries" TO "anon";
GRANT ALL ON TABLE "public"."profile_ministries" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_ministries" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_members" TO "anon";
GRANT ALL ON TABLE "public"."schedule_members" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_members" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- Trigger de cadastro em auth.users (fora do schema public, não sai no dump)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
