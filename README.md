# StreamMode

Painel de moderador para controlar overlays de transmissao ao vivo. A interface foi migrada para Next.js com App Router, pronta para deploy na Vercel e com persistencia planejada em Neon Postgres.

## O que ja existe

- Interface estilo Figma/OBS com topbar, sidebar, canvas livre, lista de camadas e inspetor.
- Canvas com pan, zoom, selecao e movimentacao de camadas.
- Criacao de camadas de texto, imagem, frame, audio, video, GIF e grupo.
- Importacao local de midias pela aba Recursos.
- Rota publica de overlay para usar como Browser Source no OBS.
- API de workspace, assets, layers e overlay.
- Schema SQL para Neon Postgres.
- Fallback local quando `DATABASE_URL` ainda nao foi configurada.

## Rotas principais

- `/` abre o painel de moderador.
- `/overlay/streamer-1` abre o overlay limpo para OBS.
- `/api/workspace` retorna o snapshot do painel.
- `/api/assets` cria assets no Neon.
- `/api/layers` cria camadas no Neon.
- `/api/layers/[id]` atualiza propriedades de camada.
- `/api/overlay/[streamKey]` retorna a cena ativa para o overlay.

## Banco de dados

O arquivo `database/schema.sql` cria:

- `streamers`: streamers, chaves publicas de overlay e cena ativa.
- `scenes`: paginas/cenas com dimensao e status.
- `assets`: catalogo de textos, imagens, audios, videos, GIFs e frames.
- `layers`: posicao, tamanho, rotacao, opacidade, conteudo, fill, metadata e ordenacao.

Configure o Neon pela Vercel Marketplace quando possivel. Depois copie `.env.example` para `.env.local` e preencha:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Aplicar schema:

```bash
npm run db:migrate
```

## Desenvolvimento

```bash
npm install
npm run dev
```

Build de producao:

```bash
npm run typecheck
npm run build
```

## Deploy na Vercel

1. Conecte o repositorio no painel da Vercel.
2. Instale Neon pelo Marketplace da Vercel ou configure `DATABASE_URL` manualmente.
3. Configure `NEXT_PUBLIC_APP_URL` com a URL publica do projeto.
4. Rode `npm run db:migrate` localmente com a `DATABASE_URL` correta, ou aplique `database/schema.sql` pelo console do Neon.
5. Faça o deploy. A Vercel detecta Next.js automaticamente.

## OBS

No painel, copie o link exibido em `OBS`. No OBS, adicione uma fonte `Browser` com:

- URL: link copiado do painel.
- Width: `1920`.
- Height: `1080`.
- CSS customizado: opcional.

O overlay consulta `/api/overlay/[streamKey]` periodicamente para refletir alteracoes persistidas no banco.
