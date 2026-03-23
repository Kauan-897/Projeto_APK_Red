-- Tabela de Eventos
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    attendees_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de Vídeos
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT DEFAULT 'youtube',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de Presença Pessoal (Taxa de Presença)
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('presente', 'ausente', 'justificado')) DEFAULT 'presente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(profile_id, event_id)
);

-- Habilitar RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Políticas para Eventos
CREATE POLICY "Usuários veem eventos da própria igreja" ON public.events FOR SELECT USING (
    church_id = (SELECT church_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Dev pode tudo em eventos" ON public.events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'desenvolvedor')
);

-- Políticas para Vídeos
CREATE POLICY "Usuários veem videos da própria igreja" ON public.videos FOR SELECT USING (
    church_id = (SELECT church_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Dev pode tudo em videos" ON public.videos FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'desenvolvedor')
);

-- Políticas para Presença
CREATE POLICY "Usuário veem e editam propria presenca" ON public.attendance FOR ALL USING (
    profile_id = auth.uid()
);
CREATE POLICY "Dev pode tudo em presenca" ON public.attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'desenvolvedor')
);

-- Inserindo alguns dados de teste temporários para a primeira visualização
-- Estes não serão inseridos por padrão a menos que existam dados nas igrejas e usuários, portanto omitidos.
