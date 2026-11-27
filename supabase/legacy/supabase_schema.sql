-- Habilita a extensão UUID para gerar IDs seguros
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Igrejas (Multi-tenant)
CREATE TABLE public.churches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Tabela de Perfis
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    birth_date DATE,
    role TEXT CHECK (role IN ('desenvolvedor', 'pastor', 'lider_homem', 'lider_mulher', 'supervisor', 'membro')) DEFAULT 'membro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Habilitar RLS (Row Level Security) nas tabelas
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para Igrejas (Leitura pública, escrita apenas pelo Dev)
CREATE POLICY "Leitura de igrejas é pública" ON public.churches FOR SELECT USING (true);
CREATE POLICY "Dev pode tudo em igrejas" ON public.churches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'desenvolvedor')
);

-- 5. Políticas para Perfis (Multi-tenant básico e controle por Dev)
CREATE POLICY "Dev pode tudo em perfis" ON public.profiles FOR ALL USING (
   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'desenvolvedor')
);

CREATE POLICY "Usuários veem perfis da própria igreja" ON public.profiles FOR SELECT USING (
    church_id = (SELECT church_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Usuário pode visualizar e editar o próprio perfil" ON public.profiles FOR SELECT USING (
    id = auth.uid()
);
CREATE POLICY "Usuário pode editar o próprio perfil" ON public.profiles FOR UPDATE USING (
    id = auth.uid()
);

-- 6. Trigger Autenticação -> Tabela Profiles
-- Cria automaticamente o perfil do usuário logo após o SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, church_id, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    (new.raw_user_meta_data->>'church_id')::UUID, 
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'membro')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Trigger para Definir Desenvolvedor
-- Se o email for 'joaopedrocallado@hotmail.com', ele vira 'desenvolvedor' automaticamente.
CREATE OR REPLACE FUNCTION public.set_dev_role()
RETURNS TRIGGER AS $$
BEGIN
  IF new.email = 'kauanribeiro00700@gmail.com' THEN
     new.role = 'desenvolvedor';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_dev_role_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_dev_role();

-- IGREJA PADRÃO:
-- Dê um INSERT manual aqui ou via painel do Supabase SQL para criar a primeira igreja se necessário.
-- INSERT INTO public.churches (name) VALUES ('Sede Principal');
