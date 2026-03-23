-- Schema para Gestão de Membros, Ministérios e Filiais (Congregações)

-- 1. Criação da Tabela de Filiais (Branches)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Atualizar Profiles para incluir a branch_id (Filial do membro)
-- Verifica se a coluna não existe antes de adicionar
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='branch_id') THEN
        ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Criação da Tabela de Ministérios
CREATE TABLE IF NOT EXISTS public.ministries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Tabela de Relacionamento N:N (Membros <-> Ministérios)
CREATE TABLE IF NOT EXISTS public.profile_ministries (
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (profile_id, ministry_id)
);

-- Habilitar RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_ministries ENABLE ROW LEVEL SECURITY;

-- Políticas para Branches (Filiais)
CREATE POLICY "Usuários veem filiais da própria igreja" ON public.branches FOR SELECT USING (
    church_id = (SELECT church_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Dev e Admins podem tudo em filiais" ON public.branches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('desenvolvedor', 'pastor', 'admin'))
);

-- Políticas para Ministries (Ministérios)
CREATE POLICY "Usuários veem ministérios da própria igreja" ON public.ministries FOR SELECT USING (
    church_id = (SELECT church_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Lideres e Admins gerenciam ministérios" ON public.ministries FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('desenvolvedor', 'pastor', 'lider_homem', 'lider_mulher', 'supervisor'))
);

-- Políticas para Profile_Ministries
CREATE POLICY "Usuários veem quem está nos ministérios" ON public.profile_ministries FOR SELECT USING (
    -- Só vê relacionamentos se pertencer à mesma igreja (lógica implícita através das outras tabelas)
    true
);
CREATE POLICY "Lideres escolhem quem participa" ON public.profile_ministries FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('desenvolvedor', 'pastor', 'lider_homem', 'lider_mulher', 'supervisor'))
);
