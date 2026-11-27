# Gestão Igreja

SaaS de gestão de igrejas: eventos, escalas, membros, ministérios e filiais.
Cada igreja é um *tenant* isolado no mesmo banco.

**Stack:** React 19 + Vite + Tailwind · Supabase (Postgres, Auth, RLS)

---

## Começando

Pré-requisitos: **Node 20+**, **Git** e, para rodar o banco local, **Docker Desktop**.

```bash
git clone https://github.com/Kauan-897/Projeto_APK_Red.git
cd Projeto_APK_Red
npm install
cp .env.example .env      # no PowerShell: Copy-Item .env.example .env
```

Preencha o `.env` com a URL e a *anon key* do Supabase
(*Project Settings → API*). **Nunca commite o `.env`.**

```bash
npm run dev               # http://localhost:5173
```

### Banco local (recomendado para desenvolver)

Com o Docker aberto:

```bash
npm run db:start          # sobe Postgres + Auth + Studio locais e aplica as migrations
```

O comando mostra a `API URL` e a `anon key` locais: use-as no `.env`.
O Studio fica em http://localhost:54323.

```bash
npm run db:reset          # recria o banco local do zero a partir das migrations
npm run db:stop
```

---

## Banco de dados: migrations

Todo o schema fica em `supabase/migrations/`, em ordem cronológica.
**Não altere o banco de produção pelo painel**: crie uma migration.

1. Faça a mudança no banco **local** (pelo Studio ou SQL).
2. Gere o arquivo: `npm run db:diff -- nome_da_mudanca`
3. Revise o SQL gerado, rode `npm run db:reset` e teste.
4. Commit + Pull Request. Depois do merge, aplique em produção:
   `npm run db:push` (requer `npx supabase link` feito uma vez).

`supabase/legacy/` guarda os scripts antigos, só como referência.

### Primeira vez aplicando em produção

`20261127000000_baseline_producao.sql` é o schema que já existia em produção
(extraído com `supabase db dump`). Ela **não** deve rodar de novo lá:

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>   # rode dentro da pasta do projeto
npx supabase migration repair --status applied 20261127000000
npx supabase db push
```

---

## Cargos e permissões

| Cargo | Pode |
|---|---|
| `desenvolvedor` | Admin da plataforma (dono do SaaS): vê e gerencia todas as igrejas |
| `pastor`, `admin` | Administram a própria igreja: filiais, cargos, criação de usuários |
| `lider_homem`, `lider_mulher`, `supervisor` | Eventos, escalas, ministérios e vídeos da própria igreja |
| `membro` | Vê os dados da igreja, se voluntaria em escalas, pede entrada em ministérios |

Regras garantidas **no banco** (RLS + triggers), não só na tela:

- Todo cadastro nasce como `membro`; o cargo enviado pelo navegador é ignorado.
- Ninguém altera o próprio cargo ou a própria igreja.
- Toda leitura e escrita é limitada à igreja do usuário.

Para tornar alguém admin da plataforma, rode no SQL Editor do Supabase:

```sql
update public.profiles set role = 'desenvolvedor' where email = 'pessoa@exemplo.com';
```

---

## SaaS: igrejas, convites e assinaturas

- **Nova igreja:** quem cria conta sem convite pode cadastrar a própria igreja e vira o pastor dela.
  Toda igreja nova ganha **14 dias de teste grátis**.
- **Membros entram só por convite:** pastor/admin geram links em **Convites** (cargo, número de usos e validade).
  Supervisor gera convites só de membro.
- **Planos por faixa de membros** na tabela `plans` (preços em centavos, editáveis sem deploy).
- **Sem acesso** (teste vencido, pagamento atrasado há mais de 7 dias ou cancelada), a igreja fica em
  **modo somente leitura**: vê tudo, não grava nada.
- **Admin da plataforma:** no dashboard, em *Assinaturas e Testes*, estende/encurta o teste de cada igreja ou libera como cortesia.

### Configurar o Asaas

1. Crie uma conta no [sandbox do Asaas](https://sandbox.asaas.com) e gere a chave da API.
2. No Supabase, em *Edge Functions → Secrets*, cadastre:
   - `ASAAS_API_KEY`: a chave da API
   - `ASAAS_BASE_URL`: `https://api-sandbox.asaas.com/v3` (em produção, `https://api.asaas.com/v3`)
   - `ASAAS_WEBHOOK_TOKEN`: um texto aleatório e longo
3. Publique as funções: `npx supabase functions deploy asaas-checkout asaas-webhook`
4. No Asaas, em *Integrações → Webhooks*, aponte para
   `https://<ref-do-projeto>.supabase.co/functions/v1/asaas-webhook`, usando o mesmo token do passo 2,
   com os eventos de cobrança (`PAYMENT_*`) e de assinatura (`SUBSCRIPTION_*`).

Para testar localmente: `npx supabase functions serve --env-file <arquivo-com-as-variaveis>`.

---

## LGPD

Pertencer a uma igreja revela convicção religiosa: **dado pessoal sensível** (LGPD art. 5º, II).
Por isso o app foi desenhado assim:

| Exigência | Como o app cumpre |
|---|---|
| Consentimento específico e destacado (art. 11, I) | Tela obrigatória antes de usar o app; sem ela não se cria nem se entra em igreja (garantido no banco) |
| Registro do consentimento (art. 8º) | Tabela `consents`, só de inclusão, com versão do texto e data |
| Dados de crianças (art. 14) | Consentimento próprio do responsável; revogar apaga os dados dos filhos |
| Minimização (art. 6º, III) | Membros veem só nome, foto e cargo uns dos outros; contato e dados pessoais só o titular e a liderança (permissões por coluna) |
| Direitos do titular (art. 18) | *Meus dados*: corrigir, baixar tudo em JSON, revogar, sair da igreja, excluir a conta |
| Registro das operações (art. 37) | `audit_log`: cargos, entradas/saídas, exportações, exclusões |
| Encarregado (art. 41) | Contato do encarregado por igreja, em *Meus dados* |

**Antes de vender:** preencha os dados da empresa em `src/legal/documents.js` e peça a um
advogado para revisar os textos. Ao alterar um texto, atualize a versão no arquivo **e** em
`public.legal_versions` (nova migration): todos terão de aceitar de novo.

---

## Fluxo de trabalho da equipe

- Nunca commite direto na `main`: crie uma branch (`feat/...`, `fix/...`) e abra um Pull Request.
- O CI (GitHub Actions) roda lint, build e aplica as migrations num banco limpo a cada PR.
- Antes de abrir o PR: `npm run lint` e `npm run build`.
