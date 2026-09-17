# Template de tracking e atribuicao

Tracking e atribuicao de vendas para trafego pago. Liga o gasto do anuncio a
venda do gateway e mostra lucro real por campanha, conjunto e anuncio.

Template limpo: sobe sem nenhum dado e sem tela de login. Abriu, ja esta dentro —
o dashboard padrao se cria sozinho no primeiro acesso.

> **Nao tem autenticacao.** Quem alcancar a URL ve o faturamento. Roda local ou
> atras de algo que ja protege (rede interna, tunel, Basic Auth do proxy,
> protecao de deploy da Vercel). Se for expor na internet aberta, ponha uma
> camada de acesso antes.

## Como funciona

```
  anuncio (Meta/Google/TikTok)
        │  parametros de URL: nome|id
        ▼
  landing  ──[ /t.js ]──►  POST /api/collect       (visita + UTMs + fbp/fbc)
        │                        │
        │ links carimbados        └──► tabela visits  ─┐
        ▼                                              │ recupera UTM
  checkout do gateway                                  │ quando o gateway
        │                                              │ nao repassa
        ▼                                              │
  POST /api/webhooks/<gateway>?id=…  ──► adapters ──► ingestOrder ◄┘
                                                        │
                              parseAdRef: "Nome|1202109…" → campaign_id/adset_id/ad_id
                                                        │
  GET /api/cron/sync-meta ──► Meta Marketing API ──► ad_insights (gasto por anuncio/dia)
                                                        │
                                                        ▼
                                          /api/metrics/*  →  dashboard
```

O pulo do gato e o formato `nome|id` nos parametros de URL do anuncio: o nome e
pra voce ler na tabela, o id e o que casa a venda com o gasto que veio da API.

## Colocar a sua marca

O template vem **sem nome**. Sao dois pontos, os dois fora do codigo de negocio:

**Nome** — em `.env.local`:

```
NEXT_PUBLIC_APP_NAME=Nome Do Seu App
```

Vazio, a barra lateral mostra so o simbolo e a aba fica "Dashboard". Nada quebra.

Por ser `NEXT_PUBLIC_`, o valor entra no bundle na hora do build: depois de mexer
no `.env.local`, reinicie o `npm run dev` (ou rode `npm run build` de novo em
producao) pra ver o nome trocar.

**Cores** — as sete variaveis em `:root` no `app/globals.css`. Tailwind e os
graficos leem de la, entao muda ali e o app inteiro acompanha.

O simbolo em si (o quadrado laranja) esta em `app/components/logo.tsx` — troque
por um `<img>` ou um SVG quando tiver o logo pronto.

## Subir local

```bash
npm install
cp .env.example .env.local   # ajuste NEXT_PUBLIC_URL
npm run dev                  # http://localhost:3210
```

Sem `TURSO_DATABASE_URL` ele usa um SQLite em `local.db`. O schema se cria sozinho
na primeira requisicao — nao existe migration pra rodar nem seed pra popular.

Pra zerar tudo e comecar do nada de novo: apague o `local.db`.

## Ligar em producao

1. **Script** — em Integracoes > Script, copie e cole antes do `</head>` da pagina de vendas.
2. **Parametros de URL** — cole o template no campo "Parametros de URL" do anuncio na Meta.
3. **Webhook** — crie em Integracoes > Webhooks e cole a URL no painel do gateway.
4. **Meta Ads** — em Integracoes > Contas, cole um token de sistema com `ads_read` e habilite as contas.
5. **Crons** — agende:
   - `GET /api/cron/sync-meta?days=3` a cada 15-30 min (header `x-cron-secret`)
   - `GET /api/cron/flush-capi` a cada 1-5 min

## O que ja esta pronto

- Script de tracking: captura UTMs + click ids, janela de atribuicao, first/last click,
  cookie no dominio raiz, carimbo de links (inclusive os inseridos depois via MutationObserver),
  deteccao de InitiateCheckout / Lead / AddToCart por texto, CSS ou URL.
- Recuperacao de venda sem UTM pelo `rt_vid` gravado na visita.
- Adapters de webhook: Kirvano, Cakto, Hotmart e um generico pra qualquer gateway.
  Variacoes de URL por afiliado, co-produtor e ignorar recorrencia.
- Atribuicao ate o nivel de anuncio, com a hierarquia completada pela tabela `ad_objects`.
- Sync da Meta Marketing API: gasto/impressoes/cliques por anuncio por dia + status.
- Metricas: faturamento liquido e bruto, gasto, lucro, ROAS, ROI, margem, CPA/CPT/CPP,
  ticket medio, taxa de aprovacao no cartao, CPM, CPC, CTR, vendas sem tracking.
- Custo por produto e imposto, com recalculo dos pedidos ja gravados.
- Pixel server-side (Conversions API) com fila e retry, dedupe por `event_id`,
  regra de IP (so IPv6 / com fallback / sem IP), valor por comissao ou bruto.
- Multi-dashboard (um por negocio ou por moeda), com fuso e moeda proprios.

## O que ainda nao esta

- Google Ads, TikTok Ads e Kwai: o schema e a atribuicao ja sao multi-plataforma
  (`ad_insights.platform`), falta o cliente de API de cada uma. So a Meta sincroniza.
- Motor de regras automatizadas (pausar anuncio por CPA/ROAS): a tabela `rules` existe,
  o executor nao.
- Tela de CRUD dos pixels: a API (`/api/integrations/pixels`) esta pronta, a tela nao.

## Distribuir pra outra pessoa usar (hospedado, gratis)

Cada pessoa sobe a propria copia, com o proprio banco e o proprio webhook —
nao tem nada compartilhado entre instancias.

**1. Clique no botao** (cria conta Vercel se nao tiver, e ja conecta o banco
Turso sozinho, sem precisar criar conta la nem copiar token):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuri222%2Ftracking-system&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22tursocloud%22%2C%22productSlug%22%3A%22database%22%2C%22protocol%22%3A%22storage%22%7D%5D)

**2. A Vercel mostra um formulario com as variaveis do `.env.example`.**
Preenche assim:
- `NEXT_PUBLIC_URL` — deixa `http://localhost:3210` mesmo, ajusta no passo 3
- `CRON_SECRET` — qualquer senha (protege as rotas de cron)
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — o botao ja conecta sozinho, pode deixar em branco
- o resto pode ficar em branco (da pra configurar tudo depois, pela tela de Integracoes)

**3. Depois que o deploy terminar:**
- Copia a URL que a Vercel deu (tipo `https://tracking-system-seuzin.vercel.app`)
- Project Settings > Environment Variables > edita `NEXT_PUBLIC_URL` pra essa URL
- Deployments > ... > Redeploy (pra pegar a URL nova)

**4. Liga os crons (sync do gasto da Meta + fila do pixel):**
Esse repositorio ja vem com `.github/workflows/cron.yml` rodando a cada
5 minutos. So falta configurar, no proprio repositorio criado pelo botao
(nao neste aqui): **Settings > Secrets and variables > Actions > New
repository secret**, cria duas:
- `APP_URL` — a mesma URL do passo 3, sem `/` no final
- `CRON_SECRET` — a mesma senha do passo 2

**5. Usar:** abre a URL do passo 3, vai em Integracoes e configura o token da
Meta, o webhook do gateway e o script — tudo pela propria tela, igual descrito
em "Ligar em producao" acima.

## Um aviso sobre os adapters

Os normalizadores foram escritos a partir do formato publico de cada gateway e sao
defensivos (procuram o mesmo campo em varios caminhos), mas nao foram validados
contra um payload real de producao. O payload cru fica salvo em `orders.raw` — se
algum campo vier em outro lugar, da pra ver ali e ajustar em um lugar so.
