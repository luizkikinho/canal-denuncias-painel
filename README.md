# Painel de Chamados — Canal de Denúncias Anônimas

Painel administrativo do sistema de recebimento de denúncias anônimas via WhatsApp. É a interface da organização que recebe os relatos: aqui os atendentes visualizam, assumem, respondem e finalizam chamados, e os administradores gerenciam empresas, usuários, categorias, textos do bot e a conexão com o WhatsApp — tudo com anonimato do denunciante garantido (nenhum dado identificável é armazenado).

Projeto desenvolvido como trabalho de conclusão de curso (TG 2). O backend da comunicação (`chamados_anonimos_backend`, Node.js) é um repositório irmão.

## Funcionalidades

- **Autenticação e perfis** — login via Supabase Auth, perfis com cargos (`super_admin` e `master`) na tabela `administradores`, com rotas protegidas (`RequireSuperAdmin`) e encerramento automático por inatividade.
- **Visão geral (dashboard)** — KPIs (total, aguardando atendimento, em análise, concluídas), gráfico de ocorrências por categoria e chamados recentes.
- **Gestão de chamados** — fila de chamados abertos, atribuição ("Atender"), resposta e conclusão com registro em histórico, filtros por "Meus chamados" e "Finalizados", paginação e controle de SLA (horas aberto).
- **Administração de empresas** — criação de empresas com provisionamento automático da instância de WhatsApp (via Edge Function → backend → Evolution API), conexão por QR Code e ativação/desativação.
- **Mensagens do bot** — edição dos textos exibidos pelo bot no WhatsApp, personalizados por empresa (com fallback para os textos padrão).
- **Simulador de WhatsApp** — chat que reproduz o fluxo completo do bot (termos LGPD → menu → categoria → relato → protocolo) sem depender da Evolution API, exibindo botões, listas e transcrições.
- **Segurança** — Row Level Security (RLS) no Supabase: cada agente enxerga apenas os chamados atribuídos a ele (ou não atribuídos), masters veem apenas a própria empresa e o `super_admin` vê tudo.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Radix UI, Recharts, React Router |
| Backend de dados | Supabase (PostgreSQL, Auth, RLS, Edge Functions em Deno) |
| Integrações | Edge Functions → backend Node.js (webhook da Evolution API) |
| Qualidade | ESLint, Prettier, `tsc --noEmit` |

## Arquitetura

```
painel-chamados (este repositório)
        │  supabase-js (anon key + RLS)
        ▼
   Supabase ── tabelas: chamados, registro_chamados, empresas,
        │        categorias, administradores, mensagens_bot
        │        view: chamados_painel (security_invoker)
        │
        ├── Edge Functions (Deno, server-side, service key)
        │      create-empresa · get-qr-empresa · simular-whatsapp
        │      create-user · delete-user
        │              │  Bearer PROVISION_SECRET
        │              ▼
        └── (opcional) backend Node.js — /provisionar · /qr · /simular
                        │
                        ▼
                 Evolution API (WhatsApp)
```

O navegador nunca fala diretamente com a Evolution API: provisionamento, QR e simulador passam obrigatoriamente pelas Edge Functions, que autenticam o usuário e repassam ao backend com segredo server-side.

## Requisitos

- Node.js 20+
- Um projeto Supabase (plano gratuito atende)
- (Opcional) backend `chamados_anonimos_backend` rodando, para provisionamento real e simulador remoto

## Configuração

Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# Opcional: falar direto com o backend (senão, o simulador usa a Edge Function)
VITE_BACKEND_URL=http://localhost:8000
VITE_PROVISION_SECRET=seu-segredo
```

Banco de dados (SQL Editor do Supabase, nesta ordem):

1. `supabase/seed_empresas_categorias.sql` — empresas/categorias de exemplo
2. `supabase/rls_chamados_painel.sql` — grants da view `chamados_painel`
3. `supabase/rls_visibilidade_chamados.sql` — regras de visibilidade/atribuição de chamados
4. `supabase/rls_mensagens_bot.sql` — RLS por empresa nas mensagens do bot

Edge Functions (Supabase CLI):

```bash
supabase functions deploy create-empresa get-qr-empresa simular-whatsapp create-user delete-user
supabase secrets set KOYEB_BACKEND_URL=... PROVISION_SECRET=... MOCK_MODE=true
```

> Sem `KOYEB_BACKEND_URL` (ou com `MOCK_MODE=true`), as Edge Functions criam empresas e conexões em modo simulado — ideal para desenvolvimento local.

## Rodando o projeto

```bash
npm install
npm run dev        # http://localhost:5173
```

Scripts disponíveis:

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Type-check + build de produção |
| `npm run typecheck` | Verificação de tipos sem gerar saída |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run preview` | Pré-visualiza o build |

## Estrutura de pastas

```
src/
├── pages/            # Rotas: Dashboard, VisaoGeral, Conta, chamados/, admin/
├── components/       # Componentes de UI e layout (sidebar, header, cards)
│   └── ui/           # shadcn/ui
├── lib/              # Cliente Supabase, contexto de usuário, simulador, textos do bot
├── hooks/            # use-idle-timeout, use-mobile
supabase/
├── functions/        # Edge Functions (Deno)
└── *.sql             # Seeds e políticas RLS
```

## Licença

Uso acadêmico (trabalho de conclusão de curso).
