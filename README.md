# Globe RTC

Lobby multiplayer em tempo real: crie ou entre em uma sala e explore um mundo 2D com avatares, movimento e chat junto com outras pessoas. Construido em monorepo, com frontend web, API REST e servidor de jogo em tempo real.

## Sumario

1. [Visao geral](#visao-geral)
2. [Arquitetura](#arquitetura)
3. [Stack](#stack)
4. [Pre-requisitos](#pre-requisitos)
5. [Setup local rapido](#setup-local-rapido)
6. [Variaveis de ambiente](#variaveis-de-ambiente)
7. [Scripts](#scripts)
8. [Banco de dados e migrations](#banco-de-dados-e-migrations)
9. [Testes](#testes)
10. [Estrutura do repositorio](#estrutura-do-repositorio)
11. [Padroes do projeto](#padroes-do-projeto)
12. [Troubleshooting](#troubleshooting)
13. [Licenca](#licenca)

## Visao geral

O projeto e dividido em tres aplicacoes principais:

- **Web (`apps/web`)**: Next.js (App Router), autenticacao social, lobby de salas e o mundo 2D (Phaser) onde os participantes aparecem como avatares.
- **API (`apps/api`)**: NestJS + Fastify com endpoints REST, WebSocket e Swagger para criacao/gestao de salas e participantes.
- **Game Server (`apps/game-server`)**: Colyseus para sincronizar posicao, movimento e chat dos avatares em tempo real dentro de cada sala.

O compartilhamento de configuracao de ambiente e centralizado em `packages/env`.

## Arquitetura

```text
apps/web (Next.js)
  -> REST + WS -> apps/api (NestJS/Fastify)
  -> Colyseus  -> apps/game-server
apps/api
  -> PostgreSQL
packages/env
  -> schema e carga das variaveis (.env)
```

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15, React 19, Tailwind, Radix UI, React Query, NextAuth, Phaser
- **Backend**: NestJS 10, Fastify, TypeORM, Swagger
- **Realtime Game**: Colyseus
- **Banco de dados**: PostgreSQL 15

## Pre-requisitos

- Node.js `>= 20.9.0`
- pnpm `8.x`
- Docker + Docker Compose (para subir o Postgres local)

## Setup local rapido

1. Instale dependencias:

```bash
pnpm install
```

2. Configure variaveis de ambiente:

- Crie/edite o arquivo `.env` na raiz.
- Use a secao [Variaveis de ambiente](#variaveis-de-ambiente) como referencia.

3. Suba o banco local:

```bash
docker compose up -d
```

4. Rode as migrations:

```bash
pnpm --filter api typeorm migration:run
```

5. Inicie o monorepo em desenvolvimento:

```bash
pnpm dev
```

Servicos padrao em desenvolvimento:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`
- Game Server (Colyseus): `ws://localhost:2567`

## Variaveis de ambiente

Arquivo `.env` na raiz do projeto.

### Nucleo (utilizadas pelo pacote `@globe-rtc/env`)

```env
NODE_ENV=development
PORT_WEB=3000
PORT_NEST=4000

NEXTAUTH_DEBUG=false
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=nestdb
DB_TIMEZONE=America/Sao_Paulo

UPLOAD_STORAGE_PROVIDER=file-system
```

### Variaveis adicionais usadas na aplicacao

```env
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
NEXT_PUBLIC_GAME_SERVER_PORT=2567

NEXT_PUBLIC_PHASER_DYNAMIC_SCALE=true
NEXT_PUBLIC_PHASER_DYNAMIC_SCALE_QUANTIZED=false
```

## Scripts

### Raiz

- `pnpm dev`: executa `dev` de todos os workspaces via Turbo
- `pnpm build`: build de todos os workspaces
- `pnpm lint`: lint de todos os workspaces
- `pnpm test`: testes de todos os workspaces que definem script

### Web (`apps/web`)

- `pnpm --filter web dev`
- `pnpm --filter web build`
- `pnpm --filter web start`
- `pnpm --filter web lint`
- `pnpm --filter web test`

### API (`apps/api`)

- `pnpm --filter api dev`
- `pnpm --filter api build`
- `pnpm --filter api start`
- `pnpm --filter api test`
- `pnpm --filter api test:e2e`
- `pnpm --filter api typeorm`

### Game Server (`apps/game-server`)

- `pnpm --filter game-server dev`
- `pnpm --filter game-server build`
- `pnpm --filter game-server test`
- `pnpm --filter game-server loadtest`

## Banco de dados e migrations

### Criar migration

```bash
pnpm --filter api typeorm migration:generate ./src/infrastructure/migrations/NomeDaMigration
```

### Executar migrations

```bash
pnpm --filter api typeorm migration:run
```

### Reverter ultima migration

```bash
pnpm --filter api typeorm migration:revert
```

## Testes

Executar tudo no monorepo:

```bash
pnpm test
```

Executar por aplicacao:

```bash
pnpm --filter web test
pnpm --filter api test
pnpm --filter game-server test
```

## Estrutura do repositorio

```text
.
|- apps/
|  |- api/          # API NestJS (REST + WebSocket + Swagger)
|  |- web/          # Frontend Next.js + mundo 2D (Phaser)
|  |- game-server/  # Servidor Colyseus
|- packages/
|  |- env/          # Schema e load de variaveis de ambiente
|- docker-compose.yml
|- turbo.json
|- pnpm-workspace.yaml
```

## Padroes do projeto

- **Monorepo-first**: comandos via `pnpm --filter` e orquestracao por Turbo.
- **Backend em camadas** (`application`, `infrastructure`, `presentation`).
- **i18n obrigatorio no Web**:
  - Evite strings hardcoded em UI.
  - Atualize sempre `apps/web/src/locales/messages/pt-br.ts` e `apps/web/src/locales/messages/en-us.ts`.
- **Validacao de ambiente centralizada** em `packages/env`.

## Troubleshooting

- **Erro de conexao com Postgres**
  - Verifique se o container esta ativo: `docker ps`
  - Confira `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- **Swagger nao abre**
  - Garanta que a API esta rodando em `PORT_NEST`
  - Acesse `/docs` no host da API
- **Falha de login social**
  - Revise `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Avatar/mundo nao conecta**
  - Confirme `NEXT_PUBLIC_GAME_SERVER_URL` / `NEXT_PUBLIC_GAME_SERVER_PORT` (Colyseus)

## Licenca

[MIT](./LICENSE)
